import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

const _typeLabel = {
  'radar.message': 'Nouveau message',
  'radar.expertise_publiee': 'Chantier publié',
  'radar.positionnement': 'Entreprise positionnée',
  'client.task_started': 'Travaux démarrés',
  'client.task_to_validate': 'Tâche à valider',
};

/// "Notifications" (/client/notifications, pas de maquette) — gabarit :
/// mêmes actions que la cloche du menu sur le site (lire, supprimer), via
/// /api/notifications (même route que le marquage "lu" de la boîte
/// Messages).
class ClientNotificationsScreen extends ConsumerWidget {
  const ClientNotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(clientNotificationsProvider);
    final notifications = notificationsAsync.valueOrNull ?? const [];
    final unread = notifications.where((n) => n['read'] != true).length;

    Future<void> markRead(String id) async {
      await ref.read(marketplaceRepositoryProvider).markNotificationRead(id);
      ref.invalidate(clientNotificationsProvider);
    }

    Future<void> delete(String id) async {
      await ref.read(marketplaceRepositoryProvider).deleteNotification(id);
      ref.invalidate(clientNotificationsProvider);
    }

    return KojiPage(
      title: 'Notifications',
      subtitle: unread == 0
          ? 'Tout est lu.'
          : '$unread notification${unread > 1 ? 's' : ''} non lue'
              '${unread > 1 ? 's' : ''}.',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(clientNotificationsProvider),
      actions: [
        if (unread > 0)
          KojiButton(
            label: 'Tout marquer comme lu',
            variant: KojiButtonVariant.secondary,
            onPressed: () async {
              await ref
                  .read(marketplaceRepositoryProvider)
                  .markAllNotificationsRead();
              ref.invalidate(clientNotificationsProvider);
            },
          ),
      ],
      main: [
        if (notificationsAsync.isLoading && notifications.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (notificationsAsync.hasError)
          KojiCard(
            child: KojiEmptyState(
              icon: KojiIcons.alert,
              title: 'Impossible de charger vos notifications',
              action: KojiButton(
                label: 'Réessayer',
                variant: KojiButtonVariant.secondary,
                onPressed: () => ref.invalidate(clientNotificationsProvider),
              ),
            ),
          )
        else if (notifications.isEmpty)
          const KojiCard(
            child: KojiEmptyState(
              icon: KojiIcons.bell,
              title: 'Aucune notification',
            ),
          )
        else
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (i, n) in notifications.indexed) ...[
                  if (i > 0) const Divider(height: 18),
                  _NotificationRow(
                    notification: n,
                    onMarkRead: () => markRead(n['id'] as String),
                    onDelete: () => delete(n['id'] as String),
                    onTap: () {
                      if (n['read'] != true) markRead(n['id'] as String);
                      final offerId = n['offerId'] as String?;
                      if (offerId != null) {
                        context.push('/client/marketplace/$offerId');
                      }
                    },
                  ),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.notification,
    required this.onMarkRead,
    required this.onDelete,
    required this.onTap,
  });

  final Map<String, dynamic> notification;
  final VoidCallback onMarkRead;
  final VoidCallback onDelete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final read = notification['read'] == true;
    final title = (notification['title'] as String?) ??
        _typeLabel[notification['type']] ??
        'Notification';
    final message = (notification['message'] as String?) ?? '';
    final createdAt = DateTime.tryParse('${notification['createdAt']}');

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6),
              decoration: BoxDecoration(
                color: read ? Colors.transparent : p.primary,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: read ? FontWeight.w600 : FontWeight.w800,
                      color: p.ink,
                    ),
                  ),
                  if (message.isNotEmpty)
                    Text(
                      message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, color: p.muted),
                    ),
                  if (createdAt != null)
                    Text(
                      DateFormat('d MMM y · HH:mm', 'fr_FR').format(createdAt),
                      style: TextStyle(fontSize: 11.5, color: p.faint),
                    ),
                ],
              ),
            ),
            IconButton(
              icon: KojiIcon(KojiIcons.close, size: 15, color: p.muted),
              onPressed: onDelete,
              tooltip: 'Supprimer',
            ),
          ],
        ),
      ),
    );
  }
}
