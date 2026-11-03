import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_router.dart';
import 'package:koji/apps/entreprise/entreprise_router.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/core/theme_provider.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/offline/offline_cache_service.dart';
import 'package:koji/features/offline/offline_queue.dart';
import 'package:koji/features/offline/sync_worker.dart';
import 'package:koji/features/notifications/push_service.dart';
import 'package:koji/features/quote/repository/quote_repository.dart';

/// Shared start-up for both apps. Each entrypoint only picks [kind].
Future<void> runKojiApp(KojiAppKind kind) async {
  WidgetsFlutterBinding.ensureInitialized();
  KojiAppConfig.use(kind);

  // Sentry (monitoring erreurs). Optionnel : si SENTRY_DSN n'est pas fourni
  // via --dart-define, on saute l'initialisation (pas d'erreur).
  const sentryDsn = String.fromEnvironment('SENTRY_DSN');
  if (sentryDsn.isNotEmpty) {
    await SentryFlutter.init((options) {
      options.dsn = sentryDsn;
      options.tracesSampleRate = kReleaseMode ? 0.1 : 1.0;
    });
  }

  await SupabaseConfig.initialize();
  await initializeDateFormatting();

  // Offline-first : initialiser le cache et la queue hors-ligne (Hive).
  // Pas bloquant pour l'UI : on n'attend pas le SyncWorker.
  await OfflineCacheService.instance.initialize();
  await OfflineQueue.instance.initialize();

  // Push notifications distantes (FCM). Non bloquant et pas sur le web :
  // l'app demarre meme si Firebase n'est pas encore configure (le service
  // logue l'erreur et renvoie null).
  if (!kIsWeb) {
    unawaited(PushNotificationService.instance.initialize());
  }

  // Planning reminders and overdue-invoice alerts only concern the entreprise,
  // and local notifications are not available on the web. Not awaited: on
  // first launch the setup waits for the permission prompt, which must appear
  // over the app rather than keep it on a black screen until answered.
  if (kind == KojiAppKind.entreprise && !kIsWeb) {
    unawaited(NotificationService.instance.refreshDailySummary());
    unawaited(NotificationService.instance.notifyOverdueInvoices());
  }

  // Built outside the widget tree so the Marketplace module's koji-web
  // session (saved on a previous launch) is restored before the router's
  // first build — otherwise `isLoggedIn` would read false for one frame
  // even with a valid stored session.
  final container = ProviderContainer();
  if (kind == KojiAppKind.client) {
    await container.read(kojiWebApiClientProvider).restoreSession();
  }

  // Enregistrement des handlers de replay hors-ligne (SyncWorker).
  final quoteRepo = container.read(quoteRepositoryProvider);
  final webApi = container.read(kojiWebApiClientProvider);
  SyncWorker.instance.registerHandler('update_quote_status', (payload) async {
    await quoteRepo.updateQuoteStatus(
      payload['quoteId'] as String,
      payload['status'] as String,
    );
  });
  // Handler generique pour les appels HTTP a l'API web (enqueue via
  // OfflineQueue.enqueueApiCall). Permet de rejouer n'importe quel POST/PATCH
  // sans ecrire un handler dedie par type d'action.
  SyncWorker.instance.registerHandler('api_call', (payload) async {
    final method = (payload['method'] as String? ?? 'POST').toUpperCase();
    final path = payload['path'] as String;
    final body = Map<String, dynamic>.from(payload['body'] as Map? ?? {});
    if (method == 'POST') {
      await webApi.postJson(path, body);
    } else if (method == 'PATCH') {
      await webApi.patchJson(path, body);
    } else {
      throw UnsupportedError('Methode HTTP non supportee: $method');
    }
  });
  // Handlers dedies pour la creation de devis et de clients hors-ligne.
  // Rejoues via l'API web (meme endpoints qu'en ligne).
  SyncWorker.instance.registerHandler('create_quote', (payload) async {
    final body = Map<String, dynamic>.from(payload['body'] as Map? ?? {});
    await webApi.postJson('/api/quotes', body);
  });
  SyncWorker.instance.registerHandler('create_client', (payload) async {
    final body = Map<String, dynamic>.from(payload['body'] as Map? ?? {});
    await webApi.postJson('/api/clients', body);
  });
  SyncWorker.instance.start();

  runApp(
    UncontrolledProviderScope(container: container, child: const KojiApp()),
  );
}

class KojiApp extends ConsumerStatefulWidget {
  const KojiApp({super.key});

  @override
  ConsumerState<KojiApp> createState() => _KojiAppState();
}

class _KojiAppState extends ConsumerState<KojiApp> {
  late final GoRouter _router =
      KojiAppConfig.isClient ? buildClientRouter() : buildEntrepriseRouter();

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final themeMode = ref.watch(themeProvider);
    return MaterialApp.router(
      title: KojiAppConfig.appName,
      debugShowCheckedModeBanner: false,
      theme: KojiTheme.light(),
      darkTheme: KojiTheme.dark(),
      themeMode: themeMode,
      routerConfig: _router,
    );
  }
}
