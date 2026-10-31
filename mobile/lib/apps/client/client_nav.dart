import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';

const _routes = {
  'accueil': '/client-home',
  'devis': '/client/devis',
  'chantiers': '/client/chantiers',
  'messages': '/client/messages',
  'marketplace': '/client/marketplace',
  'profil': '/client/profil',
  'parametres': '/client/parametres',
  'aide': '/client/aide',
};

/// Top-level client pages: they get the phone bottom bar, deeper pages don't.
// Marketplace is deliberately NOT added here: the phone bottom bar's layout
// is sized for exactly 5 tabs elsewhere (KojiShell) — adding a 6th risks
// breaking that without touching that file too. It's reachable from the
// "Principales" menu group below (always shown, not width-constrained).
const clientTabPaths = [
  '/client-home',
  '/client/devis',
  '/client/chantiers',
  '/client/messages',
  '/client/profil',
];

/// Menu of the client app (design: "Client — Menu (composant)").
List<KojiNavGroup> clientNavGroups({int pendingDevis = 0}) => [
      KojiNavGroup(label: 'Principales', items: [
        const KojiNavItem(
            id: 'accueil', label: 'Accueil', icon: KojiIcons.accueil),
        KojiNavItem(
          id: 'devis',
          label: 'Devis reçus',
          icon: KojiIcons.devis,
          badge: pendingDevis,
        ),
        const KojiNavItem(
            id: 'chantiers', label: 'Mes chantiers', icon: KojiIcons.chantiers),
        const KojiNavItem(
            id: 'messages', label: 'Messages', icon: KojiIcons.messages),
        const KojiNavItem(
            id: 'marketplace',
            label: 'Radar des Chantiers',
            icon: KojiIcons.radar),
      ]),
      const KojiNavGroup(label: 'Configuration', pushToBottom: true, items: [
        KojiNavItem(id: 'profil', label: 'Profil', icon: KojiIcons.profil),
        KojiNavItem(
            id: 'parametres', label: 'Paramètres', icon: KojiIcons.parametres),
        KojiNavItem(id: 'aide', label: 'Aide', icon: KojiIcons.aide),
        KojiNavItem(
          id: 'deconnexion',
          label: 'Déconnexion',
          icon: KojiIcons.deconnexion,
          destructive: true,
        ),
      ]),
    ];

String? clientActiveNav(String path) {
  if (path == '/client-home') return 'accueil';
  if (path.startsWith('/client/devis') || path.startsWith('/signature')) {
    return 'devis';
  }
  if (path.startsWith('/client/chantiers') ||
      path.startsWith('/client/tasks')) {
    return 'chantiers';
  }
  for (final e in _routes.entries) {
    if (path.startsWith(e.value)) return e.key;
  }
  return null;
}

/// Client pages are reached with `go`: each one is a top-level destination.
Future<void> openClientNav(
    BuildContext context, WidgetRef ref, String id) async {
  final router = GoRouter.of(context);
  if (id == 'deconnexion') {
    await ref.read(authProvider.notifier).signOut();
    router.go('/login');
    return;
  }
  final route = _routes[id];
  if (route != null) router.go(route);
}
