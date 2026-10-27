import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/marketplace_offer_card.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

enum _Filter { tous, publiees, enAttente, terminees }

/// "Mes demandes" — every chantier the particulier published on the Radar,
/// read from koji-web's own API (see KojiWebApiClient for why).
class MarketplaceHomeScreen extends ConsumerStatefulWidget {
  const MarketplaceHomeScreen({super.key});

  @override
  ConsumerState<MarketplaceHomeScreen> createState() =>
      _MarketplaceHomeScreenState();
}

class _MarketplaceHomeScreenState
    extends ConsumerState<MarketplaceHomeScreen> {
  _Filter _filter = _Filter.tous;

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
      // Reached directly (e.g. deep link) without a koji-web session yet.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/client/marketplace/login');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final offersAsync = ref.watch(marketplaceOffersProvider);
    final offers = offersAsync.valueOrNull ?? const <Map<String, dynamic>>[];
    final publiees =
        offers.where((o) => o['status'] == 'Publiee').toList();
    final enAttente =
        offers.where((o) => o['status'] == 'En attente').toList();
    final terminees =
        offers.where((o) => o['status'] == 'Terminee').toList();
    final visible = switch (_filter) {
      _Filter.tous => offers,
      _Filter.publiees => publiees,
      _Filter.enAttente => enAttente,
      _Filter.terminees => terminees,
    };

    final Widget list;
    if (offersAsync.isLoading && offers.isEmpty) {
      list = const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    } else if (offersAsync.hasError) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.alert,
          title: 'Impossible de charger vos demandes',
          subtitle: '${offersAsync.error}',
          action: KojiButton(
            label: 'Réessayer',
            variant: KojiButtonVariant.secondary,
            onPressed: () => ref.invalidate(marketplaceOffersProvider),
          ),
        ),
      );
    } else if (visible.isEmpty) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.radar,
          title: offers.isEmpty
              ? 'Aucun chantier publié'
              : 'Aucune demande dans cette liste',
          subtitle: offers.isEmpty
              ? 'Publiez un chantier pour recevoir des propositions '
                  "d'entreprises près de vous."
              : null,
        ),
      );
    } else {
      list = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, o) in visible.indexed) ...[
            if (i > 0) const SizedBox(height: 12),
            MarketplaceOfferCard(
              offer: o,
              onTap: () => context.go('/client/marketplace/${o['id']}'),
            ),
          ],
        ],
      );
    }

    return KojiPage(
      // Titre/sous-titre exacts du site (app/client/radar/page.jsx) : la
      // page s'appelle "Publier un chantier", "Mes demandes" n'est qu'un
      // titre de section plus bas (conservé ci-dessous).
      title: 'Publier un chantier',
      subtitle: 'Publiez vos travaux, les entreprises du BTP vous '
          'contactent. Gratuit et illimité.',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(marketplaceOffersProvider),
      actions: [
        KojiButton(
          label: 'Publier un chantier',
          leadingIcon: KojiIcons.plus,
          onPressed: () => context.go('/client/marketplace/new'),
        ),
      ],
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'Demandes',
            value: '${offers.length}',
            tone: KojiTone.navy,
            icon: KojiIcons.radar,
          ),
          KojiKpi(
            label: 'Publiées',
            value: '${publiees.length}',
            tone: KojiTone.info,
            icon: KojiIcons.devis,
          ),
          KojiKpi(
            label: 'En attente',
            value: '${enAttente.length}',
            tone: KojiTone.amber,
            icon: KojiIcons.clock,
          ),
          KojiKpi(
            label: 'Terminées',
            value: '${terminees.length}',
            tone: KojiTone.green,
            icon: KojiIcons.check,
          ),
        ]),
      ],
      main: [
        KojiSectionTitle(
          offers.isEmpty ? 'Mes demandes' : 'Mes demandes (${offers.length})',
        ),
        const SizedBox(height: 10),
        KojiFilterChips<_Filter>(
          options: {
            _Filter.tous: 'Toutes · ${offers.length}',
            _Filter.publiees: 'Publiées · ${publiees.length}',
            _Filter.enAttente: 'En attente · ${enAttente.length}',
            _Filter.terminees: 'Terminées · ${terminees.length}',
          },
          value: _filter,
          onChanged: (f) => setState(() => _filter = f),
        ),
        list,
      ],
      side: [
        KojiPromoCard(
          eyebrow: 'Se déconnecter',
          text: 'Quitter la session Radar des Chantiers sur cet appareil.',
          actionLabel: 'Se déconnecter',
          onAction: () async {
            await api.logout();
            if (context.mounted) context.go('/client/marketplace/login');
          },
        ),
      ],
    );
  }
}
