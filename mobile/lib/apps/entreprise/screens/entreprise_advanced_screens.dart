import 'package:flutter/material.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

// === PLANNING ===
class EntreprisePlanningScreen extends StatelessWidget {
  const EntreprisePlanningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Planning',
      appBarOnPhone: true,
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Intervention ${i + 1}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '2026-11-${15 + i}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

// === ARCHIVES ===
class EntrepriseArchivesScreen extends StatelessWidget {
  const EntrepriseArchivesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Archives',
      appBarOnPhone: true,
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 10,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Projet archivé ${i + 1}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Complété',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

// === MARKETPLACE (Entreprise Browse) ===
class EntrepriseMarketplaceScreen extends StatelessWidget {
  const EntrepriseMarketplaceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Opportunités',
      appBarOnPhone: true,
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Chantier #${1000 + i}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Budget: €${5000 + (i * 2000)}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

// === FOURNITURES (Supplies) ===
class EntrepriseFournituresScreen extends StatelessWidget {
  const EntrepriseFournituresScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Fournitures',
      appBarOnPhone: true,
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 5,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Fourniture ${i + 1}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Stock: ${100 - (i * 10)} unités',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Colors.grey,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

// === COMPTABILITÉ (Accounting) ===
class EntrepriseComptabiliteScreen extends StatelessWidget {
  const EntrepriseComptabiliteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return KojiPage(
      title: 'Comptabilité',
      appBarOnPhone: true,
      main: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFFFFFFF),
            border: Border.all(color: const Color(0xFFD9D9D4)),
            borderRadius: BorderRadius.circular(2),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Résumé financier',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 16),
              _FinancialRow('Revenus', '€250,000'),
              _FinancialRow('Dépenses', '€80,000'),
              _FinancialRow('Bénéfice', '€170,000', isProfit: true),
            ],
          ),
        ),
      ],
    );
  }
}

class _FinancialRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isProfit;

  const _FinancialRow(
    this.label,
    this.value, {
    this.isProfit = false,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isProfit ? Colors.green : const Color(0xFF171B1E),
            ),
          ),
        ],
      ),
    );
  }
}
