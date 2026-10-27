import 'dart:io';
import 'package:logger/logger.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Reads and writes the per-devis discussion shared with the client signature
/// web app. Both apps use the same `quote_messages` /
/// `quote_message_attachments` tables and the `quote_attachments` storage
/// bucket — koji-main (the entreprise) talks to them directly via the Supabase
/// Flutter client, while the client uses the Next.js web app.
///
/// There is no role column on the table; a message is treated as coming from
/// the entreprise when its `author_email` matches the company's email, and from
/// the client otherwise (see [isFromCompany]).
class QuoteMessageRepository {
  QuoteMessageRepository(this._client);

  final SupabaseClient _client;
  final Logger _logger = Logger();

  static const String _bucket = 'quote_attachments';

  /// All messages for a devis (oldest first), each with its attachments
  /// resolved to short-lived signed URLs ready to display/download.
  Future<List<Map<String, dynamic>>> getMessages(String quoteId) async {
    final rows = await _client
        .from('quote_messages')
        .select('*, quote_message_attachments(*)')
        .eq('quote_id', quoteId)
        .order('created_at', ascending: true);

    final messages = List<Map<String, dynamic>>.from(rows);
    for (final m in messages) {
      final atts = (m['quote_message_attachments'] as List?) ?? const [];
      final resolved = <Map<String, dynamic>>[];
      for (final a in atts) {
        final att = Map<String, dynamic>.from(a as Map);
        final path = att['file_path'] as String?;
        if (path != null && path.isNotEmpty) {
          att['signedUrl'] = await _signedUrl(path);
        }
        resolved.add(att);
      }
      m['attachments'] = resolved;
    }
    return messages;
  }

  /// Post a message (with optional file attachments) as the entreprise.
  ///
  /// [authorName]/[authorEmail] should be the company identity so the client
  /// web app shows replies under the company name and our own [isFromCompany]
  /// check can tell the two sides apart.
  Future<void> sendMessage({
    required String quoteId,
    required String text,
    required String authorName,
    required String authorEmail,
    List<File> files = const [],
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty && files.isEmpty) return;

    try {
      // 1. Insert the message row.
      final inserted = await _client
          .from('quote_messages')
          .insert({
            'quote_id': quoteId,
            'text': trimmed,
            'author_name': authorName,
            'author_email': authorEmail,
          })
          .select()
          .single();

      final messageId = inserted['id'] as String;

      // 2. Upload each file and record it. Mirror the web app's path layout:
      //    quotes/<quoteId>/<messageId>/<unique>_<safeName>
      for (final file in files) {
        final original = file.uri.pathSegments.isNotEmpty
            ? file.uri.pathSegments.last
            : 'fichier';
        final safeName = original.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
        final unique = '${DateTime.now().millisecondsSinceEpoch}_$safeName';
        final path = 'quotes/$quoteId/$messageId/$unique';

        try {
          await _client.storage.from(_bucket).upload(path, file);
        } catch (e) {
          _logger.e('Failed to upload attachment $safeName', error: e);
          continue; // skip the file, keep the message
        }

        final size = await file.length();
        await _client.from('quote_message_attachments').insert({
          'message_id': messageId,
          'bucket_id': _bucket,
          'file_path': path,
          'mime_type': _mimeFromName(safeName),
          'file_size': size,
          'original_name': original,
        });
      }
    } catch (e) {
      _logger.e('Failed to send quote message', error: e);
      rethrow;
    }
  }

  /// Latest message timestamps per quote, used by the home screen to detect new
  /// inbound (client) messages. Returns a map of quoteId -> most recent
  /// client-authored `created_at` (ISO string), skipping the company's own
  /// messages so the entreprise isn't notified about what it just sent.
  Future<Map<String, String>> latestClientMessageAtForQuotes(
    List<String> quoteIds,
    String companyEmail,
  ) async {
    if (quoteIds.isEmpty) return {};
    final rows = await _client
        .from('quote_messages')
        .select('quote_id, author_email, created_at')
        .inFilter('quote_id', quoteIds)
        .order('created_at', ascending: false);

    final result = <String, String>{};
    for (final r in rows) {
      final qId = r['quote_id'] as String?;
      final email = (r['author_email'] as String?) ?? '';
      final createdAt = r['created_at'] as String?;
      if (qId == null || createdAt == null) continue;
      if (isFromCompany(email, companyEmail)) continue; // only client messages
      // rows are newest-first, so the first one seen per quote is the latest.
      result.putIfAbsent(qId, () => createdAt);
    }
    return result;
  }

  /// One summary per quote that has at least one message, for the global
  /// Messages inbox. Each summary carries the latest message (any author) and
  /// the latest *client* message time, so the inbox can show a preview and an
  /// unread indicator. Keyed by quoteId.
  Future<Map<String, QuoteMessageSummary>> messageSummariesForQuotes(
    List<String> quoteIds,
    String companyEmail,
  ) async {
    if (quoteIds.isEmpty) return {};
    final rows = await _client
        .from('quote_messages')
        .select('quote_id, text, author_name, author_email, created_at')
        .inFilter('quote_id', quoteIds)
        .order('created_at', ascending: false);

    final result = <String, QuoteMessageSummary>{};
    for (final r in rows) {
      final qId = r['quote_id'] as String?;
      if (qId == null) continue;
      final email = (r['author_email'] as String?) ?? '';
      final createdAt = (r['created_at'] as String?) ?? '';
      final fromCompany = isFromCompany(email, companyEmail);

      final existing = result[qId];
      if (existing == null) {
        // First (newest) row for this quote = the latest message overall.
        result[qId] = QuoteMessageSummary(
          quoteId: qId,
          lastText: (r['text'] as String?) ?? '',
          lastAuthor: (r['author_name'] as String?) ?? '',
          lastFromCompany: fromCompany,
          lastAt: createdAt,
          lastClientAt: fromCompany ? null : createdAt,
        );
      } else if (existing.lastClientAt == null && !fromCompany) {
        // Fill in the most recent client message time once we reach it.
        result[qId] = existing.copyWith(lastClientAt: createdAt);
      }
    }
    return result;
  }

  Future<String?> _signedUrl(String path) async {
    try {
      return await _client.storage.from(_bucket).createSignedUrl(path, 300);
    } catch (e) {
      _logger.w('Failed to sign attachment url for $path: $e');
      return null;
    }
  }

  /// True when a message's author email is the company's — i.e. an outbound
  /// (entreprise) message. Comparison is case/whitespace-insensitive.
  static bool isFromCompany(String authorEmail, String companyEmail) {
    final a = authorEmail.trim().toLowerCase();
    final b = companyEmail.trim().toLowerCase();
    return a.isNotEmpty && a == b;
  }

  static String _mimeFromName(String name) {
    final lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) {
      return 'application/msword';
    }
    return 'application/octet-stream';
  }
}

/// Compact view of a devis conversation for the global Messages inbox.
class QuoteMessageSummary {
  const QuoteMessageSummary({
    required this.quoteId,
    required this.lastText,
    required this.lastAuthor,
    required this.lastFromCompany,
    required this.lastAt,
    this.lastClientAt,
  });

  final String quoteId;
  final String lastText; // latest message text (any author)
  final String lastAuthor; // latest message author name
  final bool lastFromCompany; // true if the latest message is the entreprise's
  final String lastAt; // ISO timestamp of the latest message
  final String? lastClientAt; // ISO timestamp of the latest CLIENT message

  QuoteMessageSummary copyWith({String? lastClientAt}) => QuoteMessageSummary(
        quoteId: quoteId,
        lastText: lastText,
        lastAuthor: lastAuthor,
        lastFromCompany: lastFromCompany,
        lastAt: lastAt,
        lastClientAt: lastClientAt ?? this.lastClientAt,
      );
}
