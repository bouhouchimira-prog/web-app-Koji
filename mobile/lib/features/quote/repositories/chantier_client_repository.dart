import 'package:logger/logger.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Data access for the per-chantier CLIENT space (the "Espace Particulier"
/// reached with an Identifiant + Mot de passe, with NO Supabase auth session).
///
/// All reads/writes go through SECURITY DEFINER RPCs granted to `anon`, so they
/// work without a logged-in user — the unguessable quote id (obtained from
/// `login_with_access_code`) is the authorization. This mirrors what the Next.js
/// signature web app does.
class ChantierClientRepository {
  ChantierClientRepository(this._client);

  final SupabaseClient _client;
  final Logger _logger = Logger();

  /// Load the full quote (metadata + rooms + tasks) by id alone, via the
  /// `get_quote_for_client` RPC. Returns the raw map the RPC produces, or null
  /// when the quote can't be opened.
  Future<Map<String, dynamic>?> getQuoteForClient(String quoteId) async {
    try {
      final result = await _client.rpc('get_quote_for_client', params: {
        'p_quote_id': quoteId,
        'p_email': '',
      });
      if (result == null) return null;
      return Map<String, dynamic>.from(result as Map);
    } catch (e) {
      _logger.e('Failed to load quote for client', error: e);
      rethrow;
    }
  }

  /// Submit the client's signature for a quote, via the `submit_quote_signature`
  /// RPC (sessionless). [signatureDataUrl] is a data URL / base64 PNG string.
  /// Returns true when the quote was updated.
  Future<bool> submitSignature({
    required String quoteId,
    required String signatureDataUrl,
  }) async {
    try {
      final result = await _client.rpc('submit_quote_signature', params: {
        'p_quote_id': quoteId,
        'p_email': '',
        'p_signature_data': signatureDataUrl,
      });
      return result == true;
    } catch (e) {
      _logger.e('Failed to submit signature', error: e);
      rethrow;
    }
  }
}
