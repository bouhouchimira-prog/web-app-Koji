import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/quote/providers/quote_message_provider.dart';
import 'package:koji/features/quote/repositories/quote_message_repository.dart';

/// "Mes Messages" — the client picks one of their devis to open its discussion
/// with the entreprise. One conversation per devis, mirroring the entreprise
/// inbox but scoped to the devis addressed to this client (by email).
class ClientMessagesScreen extends ConsumerWidget {
  const ClientMessagesScreen({super.key});

  static const _darkNavy = Color(0xFF0F172A);
  static const _slate = Color(0xFF64748B);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotesAsync = ref.watch(clientQuotesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Mes Messages',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkNavy)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _darkNavy, size: 20),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/client-home');
            }
          },
        ),
      ),
      body: quotesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('Impossible de charger vos conversations.\n$e',
                textAlign: TextAlign.center,
                style: const TextStyle(color: _slate)),
          ),
        ),
        data: (quotes) {
          if (quotes.isEmpty) return _empty();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(clientQuotesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: quotes.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) => _conversationRow(context, quotes[i]),
            ),
          );
        },
      ),
    );
  }

  Widget _conversationRow(BuildContext context, Map<String, dynamic> quote) {
    final company = (quote['company'] as Map?)?.cast<String, dynamic>() ?? {};
    final artisan = (company['raisonSociale'] as String?) ??
        (company['name'] as String?) ??
        'Votre artisan';
    final ref = (quote['quoteNumber'] ?? quote['reference'] ?? 'Devis').toString();
    final quoteId = quote['id'] as String?;

    return GestureDetector(
      onTap: quoteId == null
          ? null
          : () => context.push('/client/messages/$quoteId', extra: artisan),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: const BoxDecoration(
                color: Color(0xFFEFF6FF),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.storefront_outlined,
                  color: Color(0xFF1D74FF)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(artisan,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: _darkNavy),
                      overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 2),
                  Text('Devis $ref',
                      style: const TextStyle(fontSize: 12, color: _slate)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: _slate),
          ],
        ),
      ),
    );
  }

  Widget _empty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.forum_outlined, size: 72, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('Aucune conversation',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          const Text(
            'Vous pourrez échanger avec votre artisan\ndès qu\'un devis vous sera adressé.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFFCBD5E1)),
          ),
        ],
      ),
    );
  }
}

/// Per-devis discussion from the client's side. Authors messages as the client
/// (their profile name + login email) so [QuoteMessageRepository.isFromCompany]
/// attributes the entreprise's replies to the other side of the thread.
class ClientChatScreen extends ConsumerStatefulWidget {
  const ClientChatScreen({
    super.key,
    required this.quoteId,
    this.artisanName,
    this.embedded = false,
  });

  final String quoteId;
  final String? artisanName;

  /// Shown inside the two-pane messages page (no back arrow).
  final bool embedded;

  @override
  ConsumerState<ClientChatScreen> createState() => _ClientChatScreenState();
}

class _ClientChatScreenState extends ConsumerState<ClientChatScreen> {
  static const _navy = Color(0xFF16233F);

  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  String _clientName = 'Client';
  String _clientEmail = '';
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _loadClientIdentity();
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadClientIdentity() async {
    final user = ref.read(authRepositoryProvider).currentUser;
    if (user == null) return;
    _clientEmail = user.email ?? '';
    try {
      final data = await ref.read(userRepositoryProvider).getUser(user.id);
      final name = (data?['full_name'] as String?)?.trim();
      if (!mounted) return;
      setState(() {
        if (name != null && name.isNotEmpty) {
          _clientName = name;
        } else if (_clientEmail.isNotEmpty) {
          _clientName = _clientEmail.split('@').first;
        }
      });
    } catch (_) {
      if (mounted && _clientEmail.isNotEmpty) {
        setState(() => _clientName = _clientEmail.split('@').first);
      }
    }
  }

  Future<void> _send() async {
    final text = _textController.text.trim();
    if (text.isEmpty || _isSending) return;
    setState(() => _isSending = true);
    try {
      await ref.read(quoteMessageRepositoryProvider).sendMessage(
            quoteId: widget.quoteId,
            text: text,
            authorName: _clientName,
            authorEmail: _clientEmail,
          );
      _textController.clear();
      ref.invalidate(quoteMessagesProvider(widget.quoteId));
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Échec de l\'envoi du message'),
              backgroundColor: Colors.red),
        );
      }
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

  @override
  Widget build(BuildContext context) {
    final messagesAsync = ref.watch(quoteMessagesProvider(widget.quoteId));
    final title = (widget.artisanName?.trim().isNotEmpty == true)
        ? widget.artisanName!.trim()
        : 'Votre artisan';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F4F0),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(title),
            Expanded(
              child: messagesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text('Erreur de chargement: $e',
                        textAlign: TextAlign.center),
                  ),
                ),
                data: (messages) => messages.isEmpty
                    ? _emptyThread()
                    : _buildMessageList(messages),
              ),
            ),
            _buildComposer(),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(String title) {
    return Container(
      color: const Color(0xFFF6F4F0),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      child: Row(
        children: [
          if (!widget.embedded) ...[
            GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  context.pop();
                } else {
                  context.go('/client-home');
                }
              },
              child:
                  const Icon(Icons.chevron_left_rounded, color: _navy, size: 30),
            ),
            const SizedBox(width: 4),
          ] else
            const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        fontSize: 17, fontWeight: FontWeight.bold, color: _navy),
                    overflow: TextOverflow.ellipsis),
                const Text('Messagerie du devis',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyThread() {
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
              child:
                  const Icon(Icons.forum_outlined, color: Color(0xFFA18B73), size: 30),
            ),
            const SizedBox(height: 16),
            const Text('Aucun message',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold, color: _navy)),
            const SizedBox(height: 6),
            const Text('Posez une question à votre artisan.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
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
    // "Mine" = the client's own message: author email matches the logged-in
    // client. Anything else (incl. empty-email rows) is treated as the artisan.
    final useMine = QuoteMessageRepository.isFromCompany(authorEmail, _clientEmail);
    final text = (message['text'] as String?) ?? '';
    final author = (message['author_name'] as String?) ?? 'Artisan';
    final createdAt = message['created_at'] as String?;

    final align = useMine ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = useMine ? _navy : Colors.white;
    final textColor = useMine ? Colors.white : _navy;

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: align,
        children: [
          Text(useMine ? 'Vous' : author,
              style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF64748B))),
          const SizedBox(height: 4),
          Container(
            constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.74),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(useMine ? 16 : 4),
                bottomRight: Radius.circular(useMine ? 4 : 16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(text, style: TextStyle(fontSize: 14, color: textColor)),
          ),
          if (createdAt != null) ...[
            const SizedBox(height: 4),
            Text(_formatDate(createdAt),
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
          ],
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
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
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                          strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.send_rounded, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
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
