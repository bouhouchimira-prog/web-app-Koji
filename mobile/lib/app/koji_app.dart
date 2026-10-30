import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

/// Shared start-up for both apps. Each entrypoint only picks [kind].
Future<void> runKojiApp(KojiAppKind kind) async {
  WidgetsFlutterBinding.ensureInitialized();
  KojiAppConfig.use(kind);

  await SupabaseConfig.initialize();
  await initializeDateFormatting();

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
