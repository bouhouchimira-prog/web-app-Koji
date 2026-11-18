import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/router_location.dart';
import 'package:koji/app/session_guard.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/screens/client_accueil_screen.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/apps/client/screens/client_aide_screen.dart';
import 'package:koji/apps/client/screens/client_chantier_detail_screen.dart';
import 'package:koji/apps/client/screens/client_chantiers_screen.dart';
import 'package:koji/apps/client/screens/client_devis_chantier_screen.dart';
import 'package:koji/apps/client/screens/client_devis_screen.dart';
import 'package:koji/apps/client/screens/client_messages_inbox_screen.dart';
import 'package:koji/apps/client/screens/client_notifications_screen.dart';
import 'package:koji/apps/client/screens/client_paiements_screen.dart';
import 'package:koji/apps/client/screens/client_parametres_screen.dart';
import 'package:koji/apps/client/screens/client_profil_screen.dart';
import 'package:koji/apps/client/screens/client_propositions_screen.dart';
import 'package:koji/apps/client/screens/client_retrouver_screen.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/features/auth/koji_auth_screen.dart';
import 'package:koji/features/client/client_messages_screen.dart';
import 'package:koji/features/client/client_tasks_screen.dart';
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
        // Session du site absente : « Retrouver mon projet » par code
        // (maquette CLI-05). L'adresse historique est gardée, tous les
        // écrans y envoient déjà ; le mot de passe reste en lien secondaire.
        _page('/client/marketplace/login',
            (_) => const ClientRetrouverScreen()),
        _page('/client/connexion', (_) => const MarketplaceLoginScreen()),
        // Un devis ou chantier du site (maquette CLI-02), 4 onglets ;
        // « ?onglet=devis|chantier|paiements|documents ». Hors coquille : la
        // page pose elle-même la barre du bas, absente pendant la signature.
        // Distinct de /client/chantier/:key (chantier suivi dans l'app).
        _page(
          '/client/devis/:quoteId',
          (state) => ClientDevisChantierScreen(
            quoteId: state.pathParameters['quoteId']!,
            onglet: state.uri.queryParameters['onglet'],
          ),
        ),
        // « ?draftId= » : reprise d'un brouillon depuis « Vos projets ».
        _page(
          '/client/marketplace/new',
          (state) => MarketplaceNewScreen(
            draftId: state.uri.queryParameters['draftId'],
          ),
        ),
        // Propositions reçues pour une demande : plein écran, sans la barre
        // du bas (maquette CLI-01).
        _page(
          '/client/projet/:offerId',
          (state) => ClientPropositionsScreen(
            offerId: state.pathParameters['offerId']!,
          ),
        ),
        ShellRoute(
          builder: (context, state, child) => ClientShell(
            location: currentRoutePath(GoRouter.of(context)),
            child: child,
          ),
          routes: [
            _page('/client-home', (_) => const ClientAccueilScreen()),
            _page('/client/devis', (_) => const ClientDevisScreen()),
            _page('/client/chantiers', (_) => const ClientChantiersScreen()),
            _page(
              '/client/chantier/:key',
              (state) => ClientChantierDetailScreen(
                chantier: state.extra as ClientChantier,
              ),
            ),
            _page('/client/tasks', (_) => const ClientTasksScreen()),
            // /client/messages is the Radar des Chantiers inbox on the site
            // (app/client/messages/page.jsx) — a different feature from the
            // per-devis chat below (ClientChatScreen, Supabase
            // quote_messages). ClientMessagesPage (per-devis list) has no
            // confirmed site equivalent at this route; kept but no longer
            // wired here — see the mobile mission report for this call.
            // « ?fil=demande:entreprise » ouvre un fil (notification).
            _page(
              '/client/messages',
              (state) => ClientMessagesInboxScreen(
                fil: state.uri.queryParameters['fil'],
              ),
            ),
            _page(
              '/client/messages/:quoteId',
              (state) => ClientChatScreen(
                quoteId: state.pathParameters['quoteId']!,
                artisanName: state.extra as String?,
              ),
            ),
            _page('/client/paiements', (_) => const ClientPaiementsScreen()),
            _page('/client/profil', (_) => const ClientProfilScreen()),
            _page('/client/parametres', (_) => const ClientParametresScreen()),
            _page('/client/aide', (_) => const ClientAideScreen()),
            _page('/client/notifications',
                (_) => const ClientNotificationsScreen()),
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
