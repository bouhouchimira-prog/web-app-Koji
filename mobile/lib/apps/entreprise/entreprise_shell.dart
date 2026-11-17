import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/entreprise_activity_watcher.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/apps/entreprise/entreprise_search.dart';
import 'package:koji/apps/entreprise/entreprise_sidebar.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/design/hors_ligne.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/koji/koji_assistant.dart';
import 'package:koji/features/notifications_pro/notifications_pro.dart' show notificationsCentreRoute, nonLuesCentreProvider;

/// Frame of every signed-in entreprise page.
///
/// * Wide screens (web, tablets in landscape): the design's layout — navy top
///   band, fixed side menu, page in the content area.
/// * Phones: the page as-is; navigation stays in the home screen's bottom bar
///   and its drawer (which shows the same side menu).
class EntrepriseShell extends ConsumerWidget {
  const EntrepriseShell({
    super.key,
    required this.location,
    required this.child,
  });

  final String location;
  final Widget child;

  /// Pages built for the wide layout. Older phone-first pages are centred in a
  /// readable column instead of stretching across the window.
  static const _fullWidthPaths = {'/home', '/aide'};

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wide = MediaQuery.sizeOf(context).width >= KojiBreakpoints.wide;
    final page = wide ? _webLayout(context, ref) : child;
    return EntrepriseActivityWatcher(
      child: BandeauHorsLigne(child: _avecKoji(page, wide)),
    );
  }

  // Koji sur chaque page (PRO-18.1) : bouton fixe en bas à droite, absent
  // là où il gênerait (devis guidé, démarrage, signature).
  static const _sansKoji = ['/quote/', '/demarrage', '/signature', '/business-info', '/profession'];
  static const _sections = {'chantiers': 'Chantiers', 'facturation': 'Factures', 'depenses': 'Dépenses', 'equipe': 'Équipe', 'contacts': 'Contacts', 'calendrier': 'Calendrier', 'kojipage': 'KojiPage', 'reseau-pro': 'Réseau pro', 'intervention-rapide': 'Intervention', 'fournitures': 'Fournitures', 'bibliotheque': 'Bibliothèque'};

  Widget _avecKoji(Widget page, bool wide) {
    if (_sansKoji.any(location.startsWith)) return page;
    final segments = Uri.parse(location).pathSegments;
    final section = segments.isEmpty ? '' : _sections[segments.first] ?? '';
    return Stack(children: [
      Positioned.fill(child: page),
      Positioned(right: wide ? 24 : 12, bottom: wide ? 24 : 88, child: KojiBoutonFlottant(page: section)),
    ]);
  }

  Widget _webLayout(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final tab = ref.watch(entrepriseHomeTabProvider);
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final unread = ref.watch(nonLuesCentreProvider);
    final fullWidth = _fullWidthPaths.contains(location);

    return Material(
      color: p.page,
      child: Column(
        children: [
          KojiTopband(
            espace: 'Espace entreprise',
            accountName: account?.displayName ?? 'Koji',
            searchHint: 'Rechercher un chantier, un devis, un client…',
            onSearch: () => showEntrepriseSearch(context, ref),
            unreadCount: unread,
            onNotifications: () => GoRouter.of(context).push(notificationsCentreRoute),
            onAccount: () => openEntrepriseNav(context, ref, 'profil'),
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                EntrepriseSidebar(activeId: entrepriseActiveNav(location, tab)),
                Expanded(
                  child: KojiContentArea(
                    maxWidth: fullWidth ? null : 960,
                    child: child,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
