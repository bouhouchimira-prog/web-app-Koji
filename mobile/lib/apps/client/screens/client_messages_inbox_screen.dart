import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

/// "Messages" (/client/messages sur le site, lu en entier) — boîte de
/// réception unique des conversations Radar des Chantiers (entreprise ↔
/// particulier à propos d'une offre), PAS la messagerie par devis. Ce n'est
/// pas un nouvel endpoint côté serveur : koji-web regroupe lui-même ce qui
/// existe déjà par (offre, entreprise), voir MarketplaceRepository.
class ClientMessagesInboxScreen extends ConsumerStatefulWidget {
  const ClientMessagesInboxScreen({super.key});

  @override
  ConsumerState<ClientMessagesInboxScreen> createState() =>
      _ClientMessagesInboxScreenState();
}

class _ClientMessagesInboxScreenState
    extends ConsumerState<ClientMessagesInboxScreen> {
  String? _activeKey;
  final _draftController = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void dispose() {
    _draftController.dispose();
    super.dispose();
  }

  String _keyOf(Map<String, dynamic> conv) =>
      '${conv['offerId']}:${conv['entrepriseUserId']}';

  Future<void> _openConversation(Map<String, dynamic> conv) async {
    setState(() => _activeKey = _keyOf(conv));
    if (conv['unread'] != true) return;
    // Marque les notifications "radar.message" de cette conversation comme
    // lues, même geste que le site (ouvrir = lire).
    try {
      final notifications =
          await ref.read(marketplaceRepositoryProvider).getNotifications();
      final toMark = notifications.where((n) =>
          n['type'] == 'radar.message' &&
          n['read'] != true &&
          n['offerId'] == conv['offerId'] &&
          n['entrepriseUserId'] == conv['entrepriseUserId']);
      for (final n in toMark) {
        await ref
            .read(marketplaceRepositoryProvider)
            .markNotificationRead(n['id'] as String);
      }
      ref.invalidate(clientMessagesInboxProvider);
    } catch (_) {
      // Jamais bloquant, comme sur le site.
    }
  }

  Future<void> _send(String offerId, String entrepriseUserId) async {
    final text = _draftController.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(marketplaceRepositoryProvider).sendMessage(
            offerId,
            entrepriseUserId: entrepriseUserId,
            message: text,
          );
      _draftController.clear();
      ref.invalidate(clientMessagesInboxProvider);
    } catch (err) {
      setState(() => _error =
          err is KojiWebApiException ? err.message : "Erreur lors de l'envoi.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/client/marketplace/login');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final conversationsAsync = ref.watch(clientMessagesInboxProvider);
    final conversations = conversationsAsync.valueOrNull ?? const [];
    Map<String, dynamic>? active;
    for (final c in conversations) {
      if (_keyOf(c) == _activeKey) {
        active = c;
        break;
      }
    }

    return KojiPage(
      title: active == null ? 'Messages' : 'Conversation',
      subtitle: active == null
          ? 'Vos échanges avec les artisans, rattachés à chaque chantier.'
          : null,
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(clientMessagesInboxProvider),
      main: [
        if (active == null)
          _InboxList(
            loading: conversationsAsync.isLoading,
            hasError: conversationsAsync.hasError,
            conversations: conversations,
            onOpen: _openConversation,
          )
        else
          _ConversationPanel(
            conversation: active,
            draftController: _draftController,
            sending: _sending,
            error: _error,
            onBack: () => setState(() {
              _activeKey = null;
              _error = null;
            }),
            onSend: () => _send(
              active!['offerId'] as String,
              active['entrepriseUserId'] as String,
            ),
          ),
      ],
    );
  }
}

class _InboxList extends StatelessWidget {
  const _InboxList({
    required this.loading,
    required this.hasError,
    required this.conversations,
    required this.onOpen,
  });

  final bool loading;
  final bool hasError;
  final List<Map<String, dynamic>> conversations;
  final ValueChanged<Map<String, dynamic>> onOpen;

  @override
  Widget build(BuildContext context) {
    if (loading && conversations.isEmpty) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (hasError) {
      return const KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.alert,
          title: 'Impossible de charger vos messages',
        ),
      );
    }
    if (conversations.isEmpty) {
      return const KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.messages,
          title: "Aucun message pour l'instant",
          subtitle: 'Les artisans qui vous contactent sur vos demandes '
              'apparaîtront ici.',
        ),
      );
    }
    return KojiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (i, conv) in conversations.indexed) ...[
            if (i > 0) const Divider(height: 18),
            _ConversationRow(conversation: conv, onTap: () => onOpen(conv)),
          ],
        ],
      ),
    );
  }
}

class _ConversationRow extends StatelessWidget {
  const _ConversationRow({required this.conversation, required this.onTap});

  final Map<String, dynamic> conversation;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final snapshot = conversation['entrepriseSnapshot'] as Map<String, dynamic>?;
    final name = (snapshot?['raisonSociale'] as String?) ?? 'Entreprise';
    final offre = conversation['offre'] as Map<String, dynamic>? ?? const {};
    final messages = (conversation['messages'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
    final last = messages.isEmpty ? null : messages.last;
    final unread = conversation['unread'] == true;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            KojiAvatar(name, size: 40),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: p.heading,
                          ),
                        ),
                      ),
                      if (unread) ...[
                        const SizedBox(width: 6),
                        const KojiPill('Nouveau', tone: KojiTone.info),
                      ],
                    ],
                  ),
                  Text(
                    '${offre['description'] ?? ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 12.5, color: p.muted),
                  ),
                  if (last != null)
                    Text(
                      '${last['message'] ?? ''}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, color: p.faint),
                    ),
                ],
              ),
            ),
            KojiIcon(KojiIcons.chevronRight, size: 16, color: p.muted),
          ],
        ),
      ),
    );
  }
}

class _ConversationPanel extends StatelessWidget {
  const _ConversationPanel({
    required this.conversation,
    required this.draftController,
    required this.sending,
    required this.error,
    required this.onBack,
    required this.onSend,
  });

  final Map<String, dynamic> conversation;
  final TextEditingController draftController;
  final bool sending;
  final String? error;
  final VoidCallback onBack;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final snapshot = conversation['entrepriseSnapshot'] as Map<String, dynamic>?;
    final name = (snapshot?['raisonSociale'] as String?) ?? 'Entreprise';
    final offre = conversation['offre'] as Map<String, dynamic>? ?? const {};
    final messages = (conversation['messages'] as List? ?? const [])
        .cast<Map<String, dynamic>>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextButton.icon(
          onPressed: onBack,
          icon: KojiIcon(KojiIcons.back, size: 14, color: p.heading),
          label: const Text('Toutes les conversations'),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name,
                  style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w800,
                      color: p.heading)),
              const SizedBox(height: 4),
              Text('${offre['description'] ?? ''}',
                  style: TextStyle(fontSize: 12.5, color: p.muted)),
              if ((offre['address'] as String?)?.isNotEmpty == true)
                Text('${offre['address']}',
                    style: TextStyle(fontSize: 12.5, color: p.muted)),
            ],
          ),
        ),
        const SizedBox(height: 12),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  KojiIcon(KojiIcons.messages, size: 18, color: p.heading),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Discussion interne Koji',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, color: p.heading)),
                        Text(
                          "Vos échanges restent sur Koji tant que le rendez-vous"
                          " n'est pas confirmé.",
                          style: TextStyle(fontSize: 11.5, color: p.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final m in messages) _Bubble(message: m),
              if (error != null) ...[
                const SizedBox(height: 8),
                Text(error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: KojiField(
                      label: '',
                      controller: draftController,
                      hint: 'Écrire un message…',
                      textInputAction: TextInputAction.send,
                      onSubmitted: sending ? null : (_) => onSend(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: sending ? null : onSend,
                    icon: KojiIcon(KojiIcons.send, color: p.primary),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final Map<String, dynamic> message;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final fromParticulier = message['senderType'] == 'particulier';
    return Align(
      alignment: fromParticulier ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: const BoxConstraints(maxWidth: 260),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: fromParticulier ? p.primary : p.surfaceMuted,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          '${message['message'] ?? ''}',
          style: TextStyle(
            color: fromParticulier ? p.onPrimary : p.ink,
            height: 1.4,
          ),
        ),
      ),
    );
  }
}
