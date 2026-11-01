import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

/// Entreprise dashboard redesigned for KOJI Pro mobile experience.
class EntrepriseAccueilScreen extends ConsumerWidget {
  const EntrepriseAccueilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Accueil',
      appBarOnPhone: true,
      main: [
        // KPIs section - 3 column layout
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: _MobileKpiCard(
                    label: 'Devis',
                    value: '5',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _MobileKpiCard(
                    label: 'Chantiers',
                    value: '12',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _MobileKpiCard(
                    label: 'Factures',
                    value: '€45K',
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Quick actions
        Row(
          children: [
            Expanded(
              child: KojiButton(
                label: 'Créer devis',
                onPressed: () => context.push('/entreprise/devis'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: KojiButton(
                label: 'Nouveau client',
                variant: KojiButtonVariant.secondary,
                onPressed: () => context.push('/entreprise/clients'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Recent activity
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Activité récente',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            GestureDetector(
              onTap: () {},
              child: const Text(
                'Voir tout',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        KojiCard(
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 3,
            separatorBuilder: (_, __) => const Divider(height: 16),
            itemBuilder: (context, i) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Devis #${1000 + i} créé',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Client: SARL Dupont',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _MobileKpiCard extends StatelessWidget {
  final String label;
  final String value;

  const _MobileKpiCard({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        border: Border.all(color: const Color(0xFFD9D9D4)),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
