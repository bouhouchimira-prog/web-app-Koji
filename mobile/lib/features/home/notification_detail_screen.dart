import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/home/notifications/models/notification_model.dart';
import 'package:koji/features/home/notifications/providers/notification_provider.dart';
import 'package:koji/features/home/notifications/repositories/notification_repository.dart';

/// Full detail view for a single notification — metadata table with
/// copy-to-clipboard values, mirroring the web app's notification detail
/// page. Opened from a tile in [NotificationsPanel]/the notification list.
class NotificationDetailScreen extends ConsumerWidget {
  final AppNotification notification;

  const NotificationDetailScreen({super.key, required this.notification});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final n = notification;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      appBar: AppBar(
        title: const Text('Détail de la notification'),
        actions: [
          IconButton(
            icon: const Icon(Icons.archive_outlined),
            tooltip: 'Archiver',
            onPressed: () async {
              await ref.read(notificationRepositoryProvider).archive(n.id);
              ref.invalidate(notificationsProvider);
              if (context.mounted) Navigator.pop(context);
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            tooltip: 'Supprimer',
            onPressed: () async {
              await ref.read(notificationRepositoryProvider).delete(n.id);
              ref.invalidate(notificationsProvider);
              if (context.mounted) Navigator.pop(context);
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              n.title,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppTheme.textPrimary(context),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              n.message,
              style: TextStyle(
                fontSize: 15,
                color: AppTheme.textSecondary(context),
              ),
            ),
            const SizedBox(height: 24),
            if (n.meta.isNotEmpty) ...[
              Text(
                'Informations',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.textPrimary(context),
                ),
              ),
              const SizedBox(height: 8),
              ..._metaRows(context, n.meta),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _metaRows(BuildContext context, Map<String, dynamic> meta) {
    return meta.entries
        .where((e) => e.key != 'dedupeKey' && e.value != null)
        .map((e) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.mutedSurface(context),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.key,
                          style: TextStyle(
                              fontSize: 11, color: AppTheme.textSecondary(context)),
                        ),
                        Text(
                          '${e.value}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.textPrimary(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy, size: 18),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: '${e.value}'));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Copié')),
                      );
                    },
                  ),
                ],
              ),
            ))
        .toList();
  }
}
