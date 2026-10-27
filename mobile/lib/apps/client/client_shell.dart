import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/client/repository/client_repository.dart';

/// Frame of every signed-in client page.
///
/// * Wide screens: navy top band + client side menu on the warm page
///   background (design: "Interface client").
/// * Phones: the five main pages share a bottom navigation bar; deeper pages
///   (chat, signature…) are full screen.
class ClientShell extends ConsumerWidget {
  const ClientShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  static const _designedPaths = {
    '/client-home',
    '/client/devis',
    '/client/chantiers',
    '/client/messages',
    '/client/profil',
    '/client/parametres',
    '/client/aide',
  };

  static const _tabs = [
    (KojiIcons.accueil, 'Accueil'),
    (KojiIcons.devis, 'Devis'),
    (KojiIcons.chantiers, 'Chantiers'),
    (KojiIcons.messages, 'Messages'),
    (KojiIcons.profil, 'Profil'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref
            .watch(clientQuotesProvider)
            .valueOrNull
            ?.where((q) => ClientRepository.isPending(q['status']))
            .length ??
        0;
    final wide = MediaQuery.sizeOf(context).width >= KojiBreakpoints.wide;
    if (wide) return _webLayout(context, ref, pending);

    final tabIndex = clientTabPaths.indexOf(location);
    if (tabIndex < 0) return child;
    final p = context.koji;
    return Scaffold(
      body: child,
      bottomNavigationBar: DecoratedBox(
        decoration:
            BoxDecoration(border: Border(top: BorderSide(color: p.line))),
        child: NavigationBar(
          selectedIndex: tabIndex,
          onDestinationSelected: (i) => context.go(clientTabPaths[i]),
          destinations: [
            for (final (i, t) in _tabs.indexed)
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: i == 1 && pending > 0,
                  label: Text('$pending'),
                  backgroundColor: KojiColors.coralDot,
                  child: KojiIcon(t.$1, size: 22, color: p.muted),
                ),
                selectedIcon: KojiIcon(t.$1,
                    size: 22, color: p.navActiveFg, strokeWidth: 2),
                label: t.$2,
              ),
          ],
        ),
      ),
    );
  }

  Widget _webLayout(BuildContext context, WidgetRef ref, int pending) {
    final p = context.koji;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    return Material(
      color: p.page,
      child: Column(
        children: [
          KojiTopband(
            espace: 'Espace particulier',
            accountName: account?.displayName ?? 'Koji',
            onAccount: () => openClientNav(context, ref, 'profil'),
          ),
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KojiSideNav(
                  groups: clientNavGroups(pendingDevis: pending),
                  activeId: clientActiveNav(location),
                  itemHeight: 42,
                  header: const _SpaceHeader(),
                  onSelect: (item) => openClientNav(context, ref, item.id),
                ),
                Expanded(
                  child: KojiContentArea(
                    maxWidth: _designedPaths.contains(location) ? null : 960,
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

/// "KJ · Koji · Espace particulier" box at the top of the client menu.
class _SpaceHeader extends StatelessWidget {
  const _SpaceHeader();

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: p.isDark ? p.surfaceMuted : KojiColors.pageClient,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: KojiColors.navy,
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: const KojiLogo(size: 18, showWord: false),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Koji',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: p.heading)),
                Text('Espace particulier',
                    style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
