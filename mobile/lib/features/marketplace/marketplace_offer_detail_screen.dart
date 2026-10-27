import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/marketplace_status.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

/// Detail of one published chantier: its own info + the entreprises that
/// positioned themselves on it. Read-only for now — messaging, RDV and
/// payment are later steps of the Marketplace plan.
class MarketplaceOfferDetailScreen extends ConsumerWidget {
  const MarketplaceOfferDetailScreen({super.key, required this.offerId});

  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(marketplaceOfferDetailProvider(offerId));
    final positionsAsync =
        ref.watch(marketplaceOfferPositionsProvider(offerId));

    return offerAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (err, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: KojiEmptyState(
            icon: KojiIcons.alert,
            title: 'Impossible de charger ce chantier',
            subtitle: '$err',
            action: KojiButton(
              label: 'Réessayer',
              variant: KojiButtonVariant.secondary,
              onPressed: () =>
                  ref.invalidate(marketplaceOfferDetailProvider(offerId)),
            ),
          ),
        ),
      ),
      data: (offer) => _OfferDetailBody(
        offer: offer,
        positionsAsync: positionsAsync,
        onRefresh: () {
          ref.invalidate(marketplaceOfferDetailProvider(offerId));
          ref.invalidate(marketplaceOfferPositionsProvider(offerId));
        },
      ),
    );
  }
}

class _OfferDetailBody extends StatelessWidget {
  const _OfferDetailBody({
    required this.offer,
    required this.positionsAsync,
    required this.onRefresh,
  });

  final Map<String, dynamic> offer;
  final AsyncValue<List<Map<String, dynamic>>> positionsAsync;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final status = offer['status'] as String?;
    final metier = (offer['metier'] as String?)?.trim();
    final description = (offer['description'] as String?)?.trim() ?? '';
    final ouvrages = offer['ouvrages'] as List? ?? const [];
    final delai = offer['delaiEstimeJours'];
    final addressParts = [
      offer['address'],
      offer['postalCode'],
      offer['city'],
    ].whereType<String>().where((s) => s.trim().isNotEmpty).join(', ');

    final positions = positionsAsync.valueOrNull ?? const [];

    return KojiPage(
      title: metier?.isNotEmpty == true ? metier! : 'Chantier',
      subtitle: addressParts.isEmpty ? null : addressParts,
      appBarOnPhone: true,
      onRefresh: () async => onRefresh(),
      top: [
        Row(
          children: [
            KojiPill(
              marketplaceStatusLabel(status),
              tone: marketplaceStatusTone(status),
            ),
            if (delai != null) ...[
              const SizedBox(width: 10),
              KojiIcon(KojiIcons.clock, size: 14, color: p.muted),
              const SizedBox(width: 5),
              Text(
                '$delai jours estimés',
                style: TextStyle(fontSize: 13, color: p.muted),
              ),
            ],
          ],
        ),
      ],
      main: [
        if (description.isNotEmpty)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const KojiSectionTitle('Description'),
                const SizedBox(height: 10),
                Text(
                  description,
                  style: TextStyle(fontSize: 14, height: 1.5, color: p.ink),
                ),
              ],
            ),
          ),
        if (ouvrages.isNotEmpty) const SizedBox(height: 12),
        if (ouvrages.isNotEmpty)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const KojiSectionTitle('Ouvrages'),
                const SizedBox(height: 10),
                for (final (i, o) in ouvrages.indexed) ...[
                  if (i > 0) const Divider(height: 20),
                  _OuvrageRow(ouvrage: o as Map<String, dynamic>),
                ],
              ],
            ),
          ),
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KojiSectionTitle('Entreprises positionnées'),
              const SizedBox(height: 10),
              positionsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
                error: (err, _) => Text(
                  'Impossible de charger les positionnements.',
                  style: TextStyle(fontSize: 13, color: p.muted),
                ),
                data: (_) => positions.isEmpty
                    ? Text(
                        'Aucune entreprise positionnée pour le moment.',
                        style: TextStyle(fontSize: 13, color: p.muted),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final (i, pos) in positions.indexed) ...[
                            if (i > 0) const Divider(height: 18),
                            _PositionRow(position: pos),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OuvrageRow extends StatelessWidget {
  const _OuvrageRow({required this.ouvrage});

  final Map<String, dynamic> ouvrage;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final room = (ouvrage['room'] as String?)?.trim();
    final postes = ouvrage['postes'] as List? ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (room?.isNotEmpty == true)
          Text(
            room!,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: p.heading,
            ),
          ),
        const SizedBox(height: 4),
        for (final poste in postes)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              '• ${poste is Map ? (poste['label'] ?? poste) : poste}',
              style: TextStyle(fontSize: 13, color: p.muted),
            ),
          ),
      ],
    );
  }
}

class _PositionRow extends StatelessWidget {
  const _PositionRow({required this.position});

  final Map<String, dynamic> position;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final snapshot = position['entrepriseSnapshot'] as Map<String, dynamic>?;
    final name = (snapshot?['raisonSociale'] as String?) ?? 'Une entreprise';
    final phone = (snapshot?['phone'] as String?)?.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KojiAvatar(name, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: p.heading,
                ),
              ),
              if (phone?.isNotEmpty == true)
                Text(
                  phone!,
                  style: TextStyle(fontSize: 12.5, color: p.muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
