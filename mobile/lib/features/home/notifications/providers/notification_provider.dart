import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/home/notifications/models/notification_model.dart';
import 'package:koji/features/home/notifications/repositories/notification_repository.dart';

/// Server-backed notification list (company rows only). Supabase Realtime is
/// not reliably enabled on this project (see quote_message_provider.dart's
/// note), so this follows the same FutureProvider + ref.invalidate(...)
/// pattern used elsewhere rather than a stream.
final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  return ref.read(notificationRepositoryProvider).getAll();
});

final unreadNotificationsCountProvider = Provider<int>((ref) {
  final async = ref.watch(notificationsProvider);
  return async.maybeWhen(
    data: (items) => items.where((n) => !n.read).length,
    orElse: () => 0,
  );
});
