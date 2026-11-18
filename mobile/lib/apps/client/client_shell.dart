import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/client/repository/client_repository.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

/// Frame of every signed-in client page.
///
/// * Wide screens: navy top band + client side menu on the warm page
///   background (design: "Interface client").
/// * Phones: the main pages ([clientTabPaths], and those opened from them,
///   see [clientOngletDe]) share the bottom bar of the
///   client charter ([ClientBottomBar]); deeper pages (chat, signature…) are
///   full screen.
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wide = MediaQuery.sizeOf(context).width >= KojiBreakpoints.wide;
    if (wide) return _webLayout(context, ref);

    final onglet = clientOngletDe(location);
    if (onglet == null) return child;
    final bas = MediaQuery.paddingOf(context).bottom;
    return Stack(
      children: [
        Scaffold(
          body: child,
          // Place de la barre ; elle est dessinée par-dessus, parce que le
          // « + » dépasse sur la page.
          bottomNavigationBar: SizedBox(height: ClientBottomBar.hauteur + bas),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: ClientBottomBar(
            location: onglet,
            onSelect: (path) => context.go(path),
            onNouveau: () => ouvrirNouveauProjet(context, ref),
          ),
        ),
      ],
    );
  }

  Widget _webLayout(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final pending = ref
            .watch(clientQuotesProvider)
            .valueOrNull
            ?.where((q) => ClientRepository.isPending(q['status']))
            .length ??
        0;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final unread = ref
            .watch(clientNotificationsProvider)
            .valueOrNull
            ?.where((n) => n['read'] != true)
            .length ??
        0;
    return Material(
      color: p.page,
      child: Column(
        children: [
          KojiTopband(
            espace: 'Espace particulier',
            accountName: account?.displayName ?? 'Koji',
            onAccount: () => openClientNav(context, ref, 'profil'),
            unreadCount: unread,
            onNotifications: () => context.push('/client/notifications'),
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

/// Barre du bas du téléphone (maquette `.cl-tb`) : Projets, Messages, le « + »
/// central, Paiements (masqué tant que [paiementsPret] est faux), Profil.
/// Sa hauteur compte les 14 px dont le « + » dépasse au-dessus de la barre ;
/// cette bande reste transparente et laisse passer les gestes vers la page.
class ClientBottomBar extends StatelessWidget {
  const ClientBottomBar({
    super.key,
    required this.location,
    required this.onSelect,
    required this.onNouveau,
  });

  final String location;
  final ValueChanged<String> onSelect;
  final VoidCallback onNouveau;

  /// Hauteur de la barre blanche, sans la marge basse de l'appareil.
  static const double hauteur = 56;
  static const double _depassement = 14;

  @override
  Widget build(BuildContext context) {
    final bas = MediaQuery.paddingOf(context).bottom;
    Widget onglet(String path, String icone, String label) => Expanded(
          child: Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              height: hauteur,
              child: _Onglet(
                icone: icone,
                label: label,
                actif: location == path,
                onTap: () => onSelect(path),
              ),
            ),
          ),
        );

    // Fond transparent : la barre est posée hors du Scaffold (le « + »
    // dépasse sur la page), il lui faut un Material pour ses textes.
    return Material(
      type: MaterialType.transparency,
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: 1.3,
        child: SizedBox(
          height: _depassement + hauteur + bas,
          child: Stack(
            children: [
              const Positioned(
                left: 0,
                right: 0,
                top: _depassement,
                bottom: 0,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: ClCharte.blanc,
                    border: Border(top: BorderSide(color: ClCharte.ligne)),
                  ),
                ),
              ),
              Positioned.fill(
                bottom: bas,
                child: Row(
                  children: [
                    onglet('/client-home', ClIcones.projets, 'Projets'),
                    onglet('/client/messages', ClIcones.messages, 'Messages'),
                    Expanded(
                      child: Align(
                        alignment: Alignment.topCenter,
                        child: _Plus(onTap: onNouveau),
                      ),
                    ),
                    if (paiementsPret)
                      onglet(
                          '/client/paiements', ClIcones.paiements, 'Paiements'),
                    onglet('/client/profil', ClIcones.profil, 'Profil'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Un onglet : pictogramme 22 px et libellé 11 px ; actif, marine et gras
/// avec un filet de 2 px au-dessus.
class _Onglet extends StatelessWidget {
  const _Onglet({
    required this.icone,
    required this.label,
    required this.actif,
    required this.onTap,
  });

  final String icone;
  final String label;
  final bool actif;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final couleur = actif ? ClCharte.marine : ClCharte.gris;
    return Semantics(
      container: true,
      button: true,
      selected: actif,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(
                color: actif ? ClCharte.marine : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              KojiIcon(icone, size: 22, color: couleur),
              const SizedBox(height: 3),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ClCharte.texte(11,
                    graisse: actif ? FontWeight.w700 : FontWeight.w400,
                    couleur: couleur,
                    hauteur: 1.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Le « + » central : carré marine de 44 px, sans libellé.
class _Plus extends StatelessWidget {
  const _Plus({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: 'Nouveau projet',
      excludeSemantics: true,
      child: Material(
        color: ClCharte.marine,
        borderRadius: BorderRadius.circular(2),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: const SizedBox(
            width: 44,
            height: 44,
            child: Center(
              child: KojiIcon(ClIcones.plus, size: 24, color: ClCharte.blanc),
            ),
          ),
        ),
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
