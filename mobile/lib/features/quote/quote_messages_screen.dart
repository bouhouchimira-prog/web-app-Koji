import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/quote/providers/quote_message_provider.dart';
import 'package:koji/features/quote/repositories/quote_message_repository.dart';

/// Per-devis discussion between the entreprise (this app) and the client (who
/// uses the signature web app). Reads and writes the shared `quote_messages`
/// thread via [quoteMessagesProvider] / [QuoteMessageRepository].
class QuoteMessagesScreen extends ConsumerStatefulWidget {
  const QuoteMessagesScreen({
    super.key,
    required this.quoteId,
    this.clientName,
  });

  final String quoteId;
  final String? clientName;

  @override
  ConsumerState<QuoteMessagesScreen> createState() =>
      _QuoteMessagesScreenState();
}

class _QuoteMessagesScreenState extends ConsumerState<QuoteMessagesScreen> {
  static const _navy = Color(0xFF0F172A);
  static const _gold = Color(0xFFA18B73);

  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  // Company identity used as the message author and to tell our own (outbound)
  // messages from the client's. Resolved from the business profile.
  String _companyName = 'Entreprise';
  String _companyEmail = '';

  final List<File> _pendingFiles = [];
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _loadCompanyIdentity();
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadCompanyIdentity() async {
    final user = ref.read(authProvider).value;
    if (user == null) return;
    // Fall back to the auth email until the business profile loads.
    _companyEmail = user.email ?? '';
    try {
      final userData = await ref.read(userRepositoryProvider).getUser(user.id);
      final biz = userData?['business_info'] as Map<String, dynamic>?;
      if (!mounted) return;
      setState(() {
        _companyName = (biz?['raisonSociale'] as String?)?.trim().isNotEmpty == true
            ? biz!['raisonSociale'] as String
            : _companyName;
        final emailPro = (biz?['emailPro'] as String?)?.trim() ?? '';
        if (emailPro.isNotEmpty) _companyEmail = emailPro;
      });
    } catch (_) {
      // Keep the auth-email fallback.
    }
  }

  Future<void> _pickImage() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(source: ImageSource.gallery);
      if (image != null) {
        setState(() => _pendingFiles.add(File(image.path)));
      }
    } catch (e) {
      _showError('Impossible de sélectionner l\'image');
    }
  }

  Future<void> _pickFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
      );
      final path = result?.files.single.path;
      if (path != null) {
        setState(() => _pendingFiles.add(File(path)));
      }
    } catch (e) {
      _showError('Impossible de sélectionner le fichier');
    }
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if ((text.isEmpty && _pendingFiles.isEmpty) || _isSending) return;

    setState(() => _isSending = true);
    final filesToSend = List<File>.from(_pendingFiles);
    try {
      await ref.read(quoteMessageRepositoryProvider).sendMessage(
            quoteId: widget.quoteId,
            text: text,
            authorName: _companyName,
            authorEmail: _companyEmail,
            files: filesToSend,
          );
      _textController.clear();
      setState(() => _pendingFiles.clear());
      ref.invalidate(quoteMessagesProvider(widget.quoteId));
      // Let the rebuilt list lay out, then jump to the newest message.
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (e) {
      _showError('Échec de l\'envoi du message');
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToBottom() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
    );
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(quoteMessagesProvider(widget.quoteId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(),
            Expanded(
              child: messagesAsync.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Erreur de chargement: $e',
                        textAlign: TextAlign.center),
                  ),
                ),
                data: (messages) => messages.isEmpty
                    ? _buildEmptyState()
                    : _buildMessageList(messages),
              ),
            ),
            _buildComposer(),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    final title = (widget.clientName?.trim().isNotEmpty == true)
        ? widget.clientName!.trim()
        : 'Discussion';
    return Container(
      color: const Color(0xFFF5F0EB),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.chevron_left_rounded,
                color: _navy, size: 30),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: _navy,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const Text(
                  'Messagerie du devis',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.forum_outlined, color: _gold, size: 30),
            ),
            const SizedBox(height: 16),
            const Text(
              'Aucun message',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: _navy,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Démarrez la conversation avec votre client.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageList(List<Map<String, dynamic>> messages) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: messages.length,
      itemBuilder: (context, i) => _buildBubble(messages[i]),
    );
  }

  Widget _buildBubble(Map<String, dynamic> message) {
    final authorEmail = (message['author_email'] as String?) ?? '';
    final mine = QuoteMessageRepository.isFromCompany(authorEmail, _companyEmail);
    final text = (message['text'] as String?) ?? '';
    final author = (message['author_name'] as String?) ?? 'Client';
    final createdAt = message['created_at'] as String?;
    final attachments =
        (message['attachments'] as List?)?.cast<Map<String, dynamic>>() ??
            const [];

    final align = mine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = mine ? _navy : Colors.white;
    final textColor = mine ? Colors.white : _navy;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(
            mine ? 'Vous' : author,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 4),
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.74,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(mine ? 16 : 4),
                bottomRight: Radius.circular(mine ? 4 : 16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (text.isNotEmpty)
                  Text(text, style: TextStyle(fontSize: 14, color: textColor)),
                if (attachments.isNotEmpty) ...[
                  if (text.isNotEmpty) const SizedBox(height: 8),
                  ...attachments.map((a) => _buildAttachment(a, mine)),
                ],
              ],
            ),
          ),
          if (createdAt != null) ...[
            const SizedBox(height: 4),
            Text(
              _formatDate(createdAt),
              style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAttachment(Map<String, dynamic> att, bool mine) {
    final signedUrl = att['signedUrl'] as String?;
    final name = (att['original_name'] as String?) ?? 'fichier';
    final mime = (att['mime_type'] as String?) ?? '';
    final isImage = mime.startsWith('image/');

    if (isImage && signedUrl != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 6),
        child: GestureDetector(
          onTap: () => _openUrl(signedUrl),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: Image.network(
              signedUrl,
              width: 180,
              height: 180,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _fileChip(name, mine),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: GestureDetector(
        onTap: signedUrl != null ? () => _openUrl(signedUrl) : null,
        child: _fileChip(name, mine),
      ),
    );
  }

  Widget _fileChip(String name, bool mine) {
    final fg = mine ? Colors.white : _navy;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: (mine ? Colors.white : _navy).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.insert_drive_file_outlined, size: 16, color: fg),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              name,
              style: TextStyle(
                  fontSize: 12, color: fg, fontWeight: FontWeight.w500),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildComposer() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (_pendingFiles.isNotEmpty)
            SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _pendingFiles.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, i) {
                  final f = _pendingFiles[i];
                  final fname = f.uri.pathSegments.isNotEmpty
                      ? f.uri.pathSegments.last
                      : 'fichier';
                  return Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.attach_file,
                            size: 16, color: _navy),
                        const SizedBox(width: 6),
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 120),
                          child: Text(
                            fname,
                            style: const TextStyle(
                                fontSize: 12, color: _navy),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () =>
                              setState(() => _pendingFiles.removeAt(i)),
                          child: const Icon(Icons.close,
                              size: 16, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          if (_pendingFiles.isNotEmpty) const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              IconButton(
                icon: const Icon(Icons.image_outlined, color: _gold),
                onPressed: _isSending ? null : _pickImage,
                tooltip: 'Joindre une image',
              ),
              IconButton(
                icon: const Icon(Icons.attach_file, color: _gold),
                onPressed: _isSending ? null : _pickFile,
                tooltip: 'Joindre un fichier',
              ),
              Expanded(
                child: TextField(
                  controller: _textController,
                  minLines: 1,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: InputDecoration(
                    hintText: 'Écrire un message...',
                    filled: true,
                    fillColor: const Color(0xFFF1F5F9),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: _isSending ? null : _send,
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: _navy,
                    shape: BoxShape.circle,
                  ),
                  child: _isSending
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.send_rounded,
                          color: Colors.white, size: 20),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      _showError('Impossible d\'ouvrir le fichier');
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return DateFormat('dd/MM/yyyy HH:mm').format(dt);
    } catch (_) {
      return '';
    }
  }
}
