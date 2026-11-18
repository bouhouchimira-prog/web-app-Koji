import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
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

/// « Paiements » (maquette CLI-02) n'a pas encore d'écran : tant que c'est
/// faux, l'onglet est masqué et la barre montre Projets, Messages, « + »,
/// Profil. À passer à vrai avec la route '/client/paiements'.
const paiementsPret = false;

/// Onglets du téléphone, dans l'ordre de la barre du bas (maquette `.cl-tb`) ;
/// seules ces pages l'affichent. Le « + » central n'est pas un onglet : il
/// ouvre un nouveau projet. Devis et Chantiers gardent leurs routes (cartes
/// de « Vos projets », menu du grand écran) mais ne sont plus dans la barre.
const clientTabPaths = [
  '/client-home',
  '/client/messages',
  if (paiementsPret) '/client/paiements',
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

/// « + » et « Nouveau projet » : la demande se publie sur le site, il faut y
/// être connecté.
void ouvrirNouveauProjet(BuildContext context, WidgetRef ref) {
  final connecte = ref.read(kojiWebApiClientProvider).isLoggedIn;
  context.push(
      connecte ? '/client/marketplace/new' : '/client/marketplace/login');
}
