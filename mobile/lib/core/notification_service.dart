import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;

/// Simple local-notification layer for the contractor.
///
/// Two kinds of notifications:
/// 1. Daily 18:00 — "Demain: N tâches planifiées" (rescheduled every app start
///    / task mutation so the count is current).
/// 2. On-task-create — if the task starts within the next 2 hours, schedule
///    a one-shot reminder 15 minutes before it starts.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  static const _channelId = 'koji_schedule';
  static const _channelName = 'Planning';
  static const _dailySummaryId = 1001;
  static const _nextTaskBaseId = 2000;

  // Signature notifications get their own channel/id-range so they show with
  // high priority and don't collide with planning notifications.
  static const _signatureChannelId = 'koji_signature';
  static const _signatureChannelName = 'Signatures';
  static const _signatureBaseId = 3000;

  // Facturation / overdue-payment notifications.
  static const _invoiceChannelId = 'koji_facturation';
  static const _invoiceChannelName = 'Facturation';
  static const _invoiceOverdueId = 4000;

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialised = false;
  Future<void>? _initialising;

  /// Safe to call concurrently: on first launch this waits for the user's
  /// answer to the permission prompt, and every caller shares that one setup.
  Future<void> init() {
    if (_initialised) return Future.value();
    return _initialising ??=
        _initialise().whenComplete(() => _initialising = null);
  }

  Future<void> _initialise() async {
    tz.initializeTimeZones();

    const android = AndroidInitializationSettings('@mipmap/ic_launcher');
    const ios = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const settings = InitializationSettings(android: android, iOS: ios);

    await _plugin.initialize(settings);

    // Request runtime permission where applicable.
    await _plugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    await _plugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, badge: true, sound: true);

    _initialised = true;
  }

  /// Call on app start and after any create/update/delete of a scheduled task.
  /// Reads tomorrow's tasks and schedules a single 18:00 summary.
  Future<void> refreshDailySummary() async {
    try {
      await init();
      await _plugin.cancel(_dailySummaryId);

      final userId = SupabaseConfig.client.auth.currentUser?.id;
      if (userId == null) return;

      final now = DateTime.now();
      final tomorrow = DateTime(now.year, now.month, now.day + 1);
      final repo = ScheduledTaskRepository(SupabaseConfig.client);
      final tasks = await repo.fetchForDate(tomorrow);

      if (tasks.isEmpty) return;

      final workerCount =
          tasks.map((t) => t.workerId).toSet().length;
      final body =
          'Demain : ${tasks.length} tâche${tasks.length == 1 ? '' : 's'} pour '
          '$workerCount ouvrier${workerCount == 1 ? '' : 's'}.';

      final summaryAt = DateTime(now.year, now.month, now.day, 18, 0);
      final fireAt = summaryAt.isAfter(now)
          ? summaryAt
          : summaryAt.add(const Duration(days: 1));

      await _plugin.zonedSchedule(
        _dailySummaryId,
        'Planning de demain',
        body,
        tz.TZDateTime.from(fireAt, tz.local),
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: 'Résumé quotidien du planning',
            importance: Importance.defaultImportance,
            priority: Priority.defaultPriority,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
        matchDateTimeComponents: DateTimeComponents.time,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('refreshDailySummary error: $e');
    }
  }

  /// Immediate notification raised when a client signs a quote.
  ///
  /// [quoteId] keeps the notification id stable per quote so re-raising it
  /// (e.g. on a stream replay) updates rather than stacks the same alert.
  Future<void> notifySignature({
    required String quoteId,
    required String clientName,
    String? amountLabel,
  }) async {
    try {
      if (!_initialised) await init();

      final body = amountLabel != null && amountLabel.isNotEmpty
          ? '$clientName a signé le devis ($amountLabel).'
          : '$clientName a signé le devis.';
      final id = _signatureBaseId + quoteId.hashCode.abs() % 10000;

      await _plugin.show(
        id,
        'Devis signé ✍️',
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _signatureChannelId,
            _signatureChannelName,
            channelDescription: 'Alertes de signature de devis par le client',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('notifySignature error: $e');
    }
  }

  /// Raises a single summary notification for the invoices that are « En
  /// retard » on the website (sent, échéance passed). Invoices live in
  /// koji-web (/api/invoices), the backend shared with the site. Call on app
  /// start and after an invoice changes. No-op when nothing is overdue.
  Future<void> notifyOverdueInvoices() async {
    final api = KojiProApi(tokenProvider: supabaseAccessToken);
    try {
      if (!_initialised) await init();
      await _plugin.cancel(_invoiceOverdueId);

      if (SupabaseConfig.client.auth.currentUser == null) return;

      final invoices = await api.list('/api/invoices', 'invoices');
      final overdue = invoices.where((i) => isActive(i) && invoiceBucket(i) == 'Retard').toList();
      if (overdue.isEmpty) return;

      final totalDue = overdue.fold<double>(0, (sum, i) => sum + amountOf(i));
      final count = overdue.length;
      final body = count == 1
          ? 'La facture ${overdue.first['invoiceNumber'] ?? ''} est en retard de '
              'paiement (${euro(totalDue)} dus).'
          : '$count factures en retard de paiement '
              '(${euro(totalDue)} dus au total).';

      await _plugin.show(
        _invoiceOverdueId,
        'Paiement en retard ⏰',
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _invoiceChannelId,
            _invoiceChannelName,
            channelDescription:
                'Alertes de retard de paiement des factures clients',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('notifyOverdueInvoices error: $e');
    } finally {
      api.dispose();
    }
  }

  /// One-shot reminder 15 min before [task] starts, if that moment is still in
  /// the future. No-op otherwise.
  Future<void> scheduleTaskReminder(ScheduledTask task) async {
    try {
      await init();
      final parts = task.startTime.split(':');
      final start = DateTime(
        task.scheduledDate.year,
        task.scheduledDate.month,
        task.scheduledDate.day,
        int.parse(parts[0]),
        int.parse(parts[1]),
      );
      final remindAt = start.subtract(const Duration(minutes: 15));
      if (!remindAt.isAfter(DateTime.now())) return;

      final id = _nextTaskBaseId + task.id.hashCode.abs() % 10000;
      await _plugin.zonedSchedule(
        id,
        'Tâche à démarrer',
        '${task.title} dans 15 min (${task.startTime})',
        tz.TZDateTime.from(remindAt, tz.local),
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: 'Rappel avant démarrage de tâche',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      );
    } catch (e) {
      if (kDebugMode) debugPrint('scheduleTaskReminder error: $e');
    }
  }

  /// Immediate notification raised when a remote push (FCM) arrives while the
  /// app is in the foreground. Background/terminated pushes are displayed by
  /// the OS itself.
  Future<void> notifyPush({required String title, required String body}) async {
    try {
      if (!_initialised) await init();
      final id = DateTime.now().millisecondsSinceEpoch % 100000;
      await _plugin.show(
        id,
        title,
        body,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            _channelId,
            _channelName,
            channelDescription: 'Notifications push distantes',
            importance: Importance.high,
            priority: Priority.high,
          ),
          iOS: DarwinNotificationDetails(),
        ),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('notifyPush error: $e');
    }
  }
}
