import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/marketplace_status.dart';
import 'package:koji/features/marketplace/metier_visuel.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

/// Client home ("/client" on the web: hero + "Mes chantiers" + "Mes
/// demandes" — see app/client/page.jsx, read line by line to build this).
class ClientAccueilScreen extends ConsumerWidget {
  const ClientAccueilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final tasksAsync = ref.watch(clientTasksProvider);
    final offersAsync = ref.watch(marketplaceOffersProvider);
    final chantiers =
        ClientChantier.group(tasksAsync.valueOrNull ?? const []);
    final offers = offersAsync.valueOrNull ?? const <Map<String, dynamic>>[];
    final prenom = (account?.firstName ?? '').trim();
    final unread = ref
            .watch(clientNotificationsProvider)
            .valueOrNull
            ?.where((n) => n['read'] != true)
            .length ??
        0;

    return KojiPage(
      title: prenom.isEmpty ? 'Accueil' : 'Bonjour $prenom',
      onRefresh: () async {
        ref.invalidate(clientTasksProvider);
        ref.invalidate(marketplaceOffersProvider);
        ref.invalidate(clientNotificationsProvider);
      },
      actions: [
        // Point d'entrée vers les notifications sur mobile : la coquille
        // (ClientShell) n'affiche la cloche que sur grand écran.
        Badge(
          isLabelVisible: unread > 0,
          label: Text('$unread'),
          backgroundColor: KojiColors.coralDot,
          child: IconButton(
            onPressed: () => context.push('/client/notifications'),
            icon: const KojiIcon(KojiIcons.bell),
            tooltip: 'Notifications',
          ),
        ),
      ],
      main: [
        // Hero — wording matches the web (app/client/page.jsx: "Un autre
        // projet de travaux ?" / CTA "+ Publier un chantier"), dark-navy
        // card + sparkle accent from the mobile maquette (01_accueil).
        Container(
          padding: const EdgeInsets.fromLTRB(22, 20, 22, 20),
          decoration: BoxDecoration(
            color: KojiColors.navy,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.only(top: 2),
                    child: KojiIcon(KojiIcons.sparkle,
                        size: 18, color: KojiColors.gold),
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Un autre projet de travaux ?',
                      style: TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              const Text(
                'Décrivez votre projet en quelques minutes. Les artisans de '
                'votre secteur vous répondent.',
                style: TextStyle(
                  fontSize: 13.5,
                  color: KojiColors.onNavyMuted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 16),
              KojiButton(
                label: 'Publier un chantier',
                leadingIcon: KojiIcons.plus,
                variant: KojiButtonVariant.light,
                expand: true,
                onPressed: () => context.go('/client/marketplace/new'),
              ),
              const SizedBox(height: 10),
              const Text(
                "C'est gratuit, et c'est vous qui choisissez votre artisan.",
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: KojiColors.onNavyMuted),
              ),
            ],
          ),
        ),

        if (chantiers.isNotEmpty) ...[
          const SizedBox(height: 16),
          KojiSectionTitle(
            'Mes chantiers (${chantiers.length})',
            action: 'Tout voir',
            onAction: () => context.go('/client/chantiers'),
          ),
          const SizedBox(height: 10),
          for (final (i, c) in chantiers.take(5).indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            _ChantierHomeCard(chantier: c),
          ],
        ],

        const SizedBox(height: 16),
        KojiSectionTitle(
          offers.isEmpty ? 'Mes demandes' : 'Mes demandes (${offers.length})',
          action: 'Tout voir',
          onAction: () => context.go('/client/marketplace'),
        ),
        const SizedBox(height: 10),
        if (offersAsync.isLoading && offers.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (offers.isEmpty)
          const KojiCard(
            child: KojiEmptyState(
              compact: true,
              icon: KojiIcons.radar,
              title: "Aucune demande publiée pour l'instant",
            ),
          )
        else
          for (final (i, offre) in offers.take(5).indexed) ...[
            if (i > 0) const SizedBox(height: 10),
            _OfferHomeCard(offre: offre),
          ],
      ],
    );
  }
}

class _ChantierHomeCard extends StatelessWidget {
  const _ChantierHomeCard({required this.chantier});

  final ClientChantier chantier;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final c = chantier;
    final (label, tone) = c.status;
    return KojiCard(
      onTap: () => context.push(
        '/client/chantier/${Uri.encodeComponent(c.id ?? c.reference)}',
        extra: c,
      ),
      child: Row(
        children: [
          KojiProgressRing(percent: (c.progress * 100).round(), size: 56),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  c.reference,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: p.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${c.done} / ${c.total} tâches',
                  style: TextStyle(fontSize: 12.5, color: p.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Flexible(child: KojiPill(label, tone: tone)),
        ],
      ),
    );
  }
}

class _OfferHomeCard extends StatelessWidget {
  const _OfferHomeCard({required this.offre});

  final Map<String, dynamic> offre;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final description = (offre['description'] as String?) ?? '';
    final shortDescription =
        description.length > 60 ? '${description.substring(0, 60)}…' : description;
    final metier = offre['metier'] as String?;
    final address = (offre['address'] as String?) ?? '';
    final hasReply = offre['hasArtisanReply'] == true;
    final status = offre['status'] as String?;

    return KojiCard(
      onTap: () => context.go('/client/marketplace/${offre['id']}'),
      child: Row(
        children: [
          MetierBadge(metier: metier),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  shortDescription.isEmpty ? 'Chantier' : shortDescription,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: p.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  [metier, address].where((s) => (s ?? '').isNotEmpty).join(' · '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: p.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Flexible(
            child: KojiPill(
              hasReply
                  ? 'Un artisan vous a écrit'
                  : marketplaceStatusLabel(status),
              tone: hasReply ? KojiTone.info : marketplaceStatusTone(status),
            ),
          ),
        ],
      ),
    );
  }
}
