import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';

/// Tab shown by the entreprise home (`/home`): 0 tableau de bord, 1 devis,
/// 2 chantiers. Shared by the side menu and the phone bottom bar.
final entrepriseHomeTabProvider = StateProvider<int>((ref) => 0);

const _homeTabs = {'accueil': 0, 'devis': 1, 'chantiers': 2};

const _routes = {
  'messages': '/messages',
  'factures': '/facturation',
  'fournitures': '/fournitures',
  'bibliotheque': '/ouvrage-library',
  'calendrier': '/calendrier',
  'planning': '/planning',
  'equipe': '/synchronization',
  'interventions': '/interventions',
  'archives': '/archives',
  'profil': '/profile/company',
  'signature': '/signature',
  'parametres': '/settings/pricing',
  'aide': '/aide',
};

/// Menu of the entreprise app, grouped like the design's "Composant — Menu".
const entrepriseNavGroups = [
  KojiNavGroup(label: 'Outils', items: [
    KojiNavItem(
        id: 'accueil', label: 'Tableau de bord', icon: KojiIcons.accueil),
    KojiNavItem(id: 'chantiers', label: 'Chantiers', icon: KojiIcons.chantiers),
    KojiNavItem(id: 'devis', label: 'Devis', icon: KojiIcons.devis),
    KojiNavItem(id: 'messages', label: 'Messages', icon: KojiIcons.messages),
  ]),
  KojiNavGroup(label: 'Gestion', items: [
    KojiNavItem(id: 'factures', label: 'Facturation', icon: KojiIcons.factures),
    KojiNavItem(
        id: 'fournitures', label: 'Fournitures', icon: KojiIcons.fournitures),
    KojiNavItem(
        id: 'bibliotheque',
        label: 'Bibliothèque koji',
        icon: KojiIcons.bibliotheque),
    KojiNavItem(
        id: 'calendrier', label: 'Calendrier', icon: KojiIcons.calendrier),
    KojiNavItem(id: 'planning', label: 'Planning', icon: KojiIcons.planning),
    KojiNavItem(id: 'equipe', label: 'Équipe', icon: KojiIcons.contacts),
    KojiNavItem(
        id: 'interventions',
        label: 'Interventions',
        icon: KojiIcons.interventions),
    KojiNavItem(id: 'archives', label: 'Archives', icon: KojiIcons.archives),
  ]),
  KojiNavGroup(label: 'Configuration', items: [
    KojiNavItem(id: 'profil', label: 'Profil', icon: KojiIcons.profil),
    KojiNavItem(
        id: 'signature', label: 'Ma signature', icon: KojiIcons.signature),
    KojiNavItem(
        id: 'parametres', label: 'Paramètres', icon: KojiIcons.parametres),
    KojiNavItem(id: 'aide', label: 'Aide', icon: KojiIcons.aide),
    KojiNavItem(
        id: 'deconnexion',
        label: 'Déconnexion',
        icon: KojiIcons.deconnexion,
        destructive: true),
  ]),
];

/// Menu entry to highlight for the current location.
String? entrepriseActiveNav(String path, int homeTab) {
  if (path == '/home' || path == '/' || path.isEmpty) {
    return const ['accueil', 'devis', 'chantiers'][homeTab.clamp(0, 2)];
  }
  bool starts(String p) => path.startsWith(p);
  if (starts('/chantier/facturation') || starts('/facturation')) {
    return 'factures';
  }
  if (starts('/chantier')) return 'chantiers';
  if (starts('/quote/messages') || starts('/messages')) return 'messages';
  if (starts('/quote')) return 'devis';
  if (starts('/fournitures')) return 'fournitures';
  if (starts('/ouvrage-library')) return 'bibliotheque';
  if (starts('/calendrier')) return 'calendrier';
  if (starts('/planning')) return 'planning';
  if (starts('/synchronization') || starts('/workers') || starts('/projects')) {
    return 'equipe';
  }
  if (starts('/interventions')) return 'interventions';
  if (starts('/archives')) return 'archives';
  if (starts('/profile')) return 'profil';
  if (starts('/signature')) return 'signature';
  if (starts('/settings')) return 'parametres';
  if (starts('/aide')) return 'aide';
  return null;
}

/// Opens a menu entry. Home tabs switch the `/home` tab; every other section
/// is pushed on top of `/home`, so its back button returns to the dashboard
/// and the existing screens keep their usual push/pop behaviour.
Future<void> openEntrepriseNav(
    BuildContext context, WidgetRef ref, String id) async {
  final router = GoRouter.of(context);
  if (id == 'deconnexion') {
    await ref.read(authProvider.notifier).signOut();
    router.go('/login');
    return;
  }
  final tab = _homeTabs[id];
  if (tab != null) {
    ref.read(entrepriseHomeTabProvider.notifier).state = tab;
    router.go('/home');
    return;
  }
  final route = _routes[id];
  if (route == null) return;
  router.go('/home');
  router.push(route);
}
