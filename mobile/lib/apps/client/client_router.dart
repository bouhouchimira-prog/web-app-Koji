import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/router_location.dart';
import 'package:koji/app/session_guard.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_accueil_screen.dart';
import 'package:koji/apps/client/screens/client_chantiers_screen.dart';
import 'package:koji/apps/client/screens/client_devis_screen.dart';
import 'package:koji/apps/client/screens/client_messages_inbox_screen.dart';
import 'package:koji/apps/client/screens/client_parametres_screen.dart';
import 'package:koji/apps/client/screens/client_profil_screen.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/features/auth/koji_auth_screen.dart';
import 'package:koji/features/client/client_messages_screen.dart';
import 'package:koji/features/client/client_tasks_screen.dart';
import 'package:koji/features/help/help_screen.dart';
import 'package:koji/features/marketplace/marketplace_home_screen.dart';
import 'package:koji/features/marketplace/marketplace_login_screen.dart';
import 'package:koji/features/marketplace/marketplace_new_screen.dart';
import 'package:koji/features/marketplace/marketplace_offer_detail_screen.dart';
import 'package:koji/features/signature/signature_list_screen.dart';
import 'package:koji/features/signature/signature_screen.dart';
import 'package:koji/features/signature/signature_success_screen.dart';
import 'package:koji/features/splash/splash_screen.dart';

// Routes of the client app (Koji). The paths used by the existing client
// screens ('/client-home', '/client/…', '/signature/…') are kept so those
// screens keep working unchanged inside the new shell.

Page<dynamic> _fade(GoRouterState state, Widget child) {
  return CustomTransitionPage(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 150),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return FadeTransition(
        opacity: CurveTween(curve: Curves.easeInOut).animate(animation),
        child: child,
      );
    },
  );
}

GoRoute _page(String path, Widget Function(GoRouterState state) build) =>
    GoRoute(
      path: path,
      pageBuilder: (context, state) => _fade(state, build(state)),
    );

GoRouter buildClientRouter({bool requireSession = true}) => GoRouter(
      initialLocation: '/splash',
      redirect: requireSession
          ? kojiSessionGuard(const {'/splash', '/login', '/signup'})
          : null,
      routes: [
        _page('/splash', (_) => const SplashScreen()),
        _page('/login', (_) => const KojiAuthScreen()),
        _page('/signup',
            (_) => const KojiAuthScreen(initialTab: KojiAuthTab.signup)),
        _page('/client/marketplace/login',
            (_) => const MarketplaceLoginScreen()),
        _page('/client/marketplace/new', (_) => const MarketplaceNewScreen()),
        ShellRoute(
          builder: (context, state, child) => ClientShell(
            location: currentRoutePath(GoRouter.of(context)),
            child: child,
          ),
          routes: [
            _page('/client-home', (_) => const ClientAccueilScreen()),
            _page('/client/devis', (_) => const ClientDevisScreen()),
            _page('/client/chantiers', (_) => const ClientChantiersScreen()),
            _page('/client/tasks', (_) => const ClientTasksScreen()),
            // /client/messages is the Radar des Chantiers inbox on the site
            // (app/client/messages/page.jsx) — a different feature from the
            // per-devis chat below (ClientChatScreen, Supabase
            // quote_messages). ClientMessagesPage (per-devis list) has no
            // confirmed site equivalent at this route; kept but no longer
            // wired here — see the mobile mission report for this call.
            _page('/client/messages', (_) => const ClientMessagesInboxScreen()),
            _page(
              '/client/messages/:quoteId',
              (state) => ClientChatScreen(
                quoteId: state.pathParameters['quoteId']!,
                artisanName: state.extra as String?,
              ),
            ),
            _page('/client/profil', (_) => const ClientProfilScreen()),
            _page('/client/parametres', (_) => const ClientParametresScreen()),
            _page('/client/aide', (_) => const KojiHelpScreen()),
            _page('/client/marketplace',
                (_) => const MarketplaceHomeScreen()),
            _page(
              '/client/marketplace/:offerId',
              (state) => MarketplaceOfferDetailScreen(
                offerId: state.pathParameters['offerId']!,
              ),
            ),
            _page('/signature/list', (_) => const SignatureListScreen()),
            _page('/signature/sign', (state) {
              final extra = state.extra;
              final quote = extra is SignatureArgs
                  ? extra.quote
                  : extra as Map<String, dynamic>? ?? {};
              return SignatureScreen(quote: quote);
            }),
            _page('/signature/success', (_) => const SignatureSuccessScreen()),
          ],
        ),
      ],
    );
