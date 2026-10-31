import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/entreprise_activity_watcher.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/apps/entreprise/entreprise_search.dart';
import 'package:koji/apps/entreprise/entreprise_sidebar.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/home/notifications/notifications_panel.dart';
import 'package:koji/features/home/notifications/providers/notification_provider.dart';

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
    return EntrepriseActivityWatcher(
      child: wide ? _webLayout(context, ref) : child,
    );
  }

  Widget _webLayout(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final tab = ref.watch(entrepriseHomeTabProvider);
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationsCountProvider);
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
            onNotifications: () async {
              final tapped = await NotificationsPanel.show(context);
              if (tapped == true && context.mounted) {
                ref.read(entrepriseHomeTabProvider.notifier).state = 1;
                GoRouter.of(context).go('/home');
              }
            },
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
