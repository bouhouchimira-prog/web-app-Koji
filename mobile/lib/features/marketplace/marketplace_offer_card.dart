import 'package:flutter/material.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/marketplace_status.dart';

/// Row for one published chantier in "Mes demandes" (gabarit: ClientQuoteCard).
class MarketplaceOfferCard extends StatelessWidget {
  const MarketplaceOfferCard({super.key, required this.offer, this.onTap});

  final Map<String, dynamic> offer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final status = offer['status'] as String?;
    final metier = (offer['metier'] as String?)?.trim();
    final city = (offer['city'] as String?)?.trim();
    final ouvrages = offer['ouvrages'] as List? ?? const [];
    final delai = offer['delaiEstimeJours'];
    final hasReply = offer['hasArtisanReply'] == true;

    return KojiCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  metier?.isNotEmpty == true ? metier! : 'Chantier',
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    color: p.heading,
                  ),
                ),
              ),
              KojiPill(
                marketplaceStatusLabel(status),
                tone: marketplaceStatusTone(status),
              ),
            ],
          ),
          if (city?.isNotEmpty == true) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                KojiIcon(KojiIcons.pin, size: 14, color: p.muted),
                const SizedBox(width: 6),
                Text(city!, style: TextStyle(fontSize: 13, color: p.muted)),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 6,
            children: [
              _MetaChip(
                icon: KojiIcons.bibliotheque,
                label: '${ouvrages.length} ouvrage'
                    '${ouvrages.length > 1 ? 's' : ''}',
              ),
              if (delai != null)
                _MetaChip(icon: KojiIcons.clock, label: '$delai j estimés'),
              if (hasReply)
                _MetaChip(
                  icon: KojiIcons.messages,
                  label: 'Nouvelle réponse',
                  color: p.toneFg(KojiTone.info),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label, this.color});

  final String icon;
  final String label;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final tint = color ?? p.muted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        KojiIcon(icon, size: 13, color: tint),
        const SizedBox(width: 5),
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: tint,
          ),
        ),
      ],
    );
  }
}
