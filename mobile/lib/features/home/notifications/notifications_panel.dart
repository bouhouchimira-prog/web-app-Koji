import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/home/notification_detail_screen.dart';
import 'package:koji/features/home/notifications/models/notification_model.dart';
import 'package:koji/features/home/notifications/providers/notification_provider.dart';
import 'package:koji/features/home/notifications/repositories/notification_repository.dart';

/// Bottom sheet listing in-app notifications (e.g. client signatures).
///
/// Opening it marks everything read, which clears the header badge. Returns
/// `true` via [Navigator.pop] when the user taps a notification, so the home
/// screen can switch to the Devis tab.
class NotificationsPanel extends ConsumerWidget {
  const NotificationsPanel({super.key});

  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => const NotificationsPanel(),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final hasNotifications =
        notificationsAsync.asData?.value.isNotEmpty ?? false;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.3,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: AppTheme.surface(context),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: AppTheme.borderColor(context),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
                child: Row(
                  children: [
                    Text(
                      'Notifications',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary(context),
                      ),
                    ),
                    const Spacer(),
                    if (hasNotifications)
                      TextButton(
                        onPressed: () async {
                          await ref
                              .read(notificationRepositoryProvider)
                              .deleteAll();
                          ref.invalidate(notificationsProvider);
                        },
                        child: const Text('Tout effacer'),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: notificationsAsync.when(
                  data: (notifications) {
                    // Mark read once the panel is built (after this frame to
                    // avoid mutating provider state during build).
                    if (notifications.any((n) => !n.read)) {
                      WidgetsBinding.instance.addPostFrameCallback((_) async {
                        await ref
                            .read(notificationRepositoryProvider)
                            .markAllRead();
                        ref.invalidate(notificationsProvider);
                      });
                    }
                    return notifications.isEmpty
                        ? _empty(context)
                        : ListView.separated(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                            itemCount: notifications.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 10),
                            itemBuilder: (context, i) =>
                                _tile(context, notifications[i]),
                          );
                  },
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (_, __) => _empty(context),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _empty(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none,
              size: 56, color: AppTheme.textSecondary(context)),
          const SizedBox(height: 12),
          Text(
            'Aucune notification',
            style: TextStyle(
              fontSize: 15,
              color: AppTheme.textSecondary(context),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, AppNotification n) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () {
        // Quote-related notifications (signature/message) still drive the
        // home screen's "jump to Devis tab" behaviour; anything else opens
        // the full detail view instead.
        if (n.quoteId != null) {
          Navigator.pop(context, true);
        } else {
          Navigator.pop(context);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => NotificationDetailScreen(notification: n),
            ),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Color(0xFFDCFCE7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle,
                  color: Color(0xFF166534), size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    n.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    n.message,
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _relativeTime(n.createdAt),
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _relativeTime(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return "À l'instant";
    if (d.inMinutes < 60) return 'Il y a ${d.inMinutes} min';
    if (d.inHours < 24) return 'Il y a ${d.inHours} h';
    return 'Il y a ${d.inDays} j';
  }
}
