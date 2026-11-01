import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

// === DEVIS ===

class EntrepriseDevisScreen extends ConsumerWidget {
  const EntrepriseDevisScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Devis',
      appBarOnPhone: true,
      top: [
        KojiButton(
          label: '+ Créer devis',
          onPressed: () {},
        ),
      ],
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Devis #${1000 + i}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 15,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Client Dupont',
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, size: 20),
                    ],
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

class EntrepriseDevisDetailScreen extends ConsumerWidget {
  final String devisId;
  const EntrepriseDevisDetailScreen({super.key, required this.devisId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Devis #$devisId',
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
                'Détails',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 12),
              _DetailRow('Client', 'SARL Dupont'),
              _DetailRow('Montant', '€5,200'),
              _DetailRow('Statut', 'En attente'),
            ],
          ),
        ),
      ],
    );
  }
}

// === CLIENTS ===

class EntrepriseClientsScreen extends ConsumerWidget {
  const EntrepriseClientsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Clients',
      appBarOnPhone: true,
      top: [
        KojiButton(
          label: '+ Ajouter client',
          onPressed: () {},
        ),
      ],
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
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Client ${i + 1}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'contact@client$i.com',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 20),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class EntrepriseClientDetailScreen extends ConsumerWidget {
  final String clientId;
  const EntrepriseClientDetailScreen({super.key, required this.clientId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Client $clientId',
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
                'Informations',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 12),
              _DetailRow('Nom', 'SARL $clientId'),
              _DetailRow('Email', 'contact@$clientId.com'),
              _DetailRow('Téléphone', '+33 1 23 45 67 89'),
            ],
          ),
        ),
      ],
    );
  }
}

// === ÉQUIPE ===

class EntrepriseEquipeScreen extends ConsumerWidget {
  const EntrepriseEquipeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Équipe',
      appBarOnPhone: true,
      top: [
        KojiButton(
          label: '+ Ajouter membre',
          onPressed: () {},
        ),
      ],
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 4,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Membre ${i + 1}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Rôle: Ouvrier',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, size: 20),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class EntrepriseEquipeMemberScreen extends ConsumerWidget {
  final String memberId;
  const EntrepriseEquipeMemberScreen({super.key, required this.memberId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Membre $memberId',
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
                'Profil',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
              const SizedBox(height: 12),
              _DetailRow('Nom', 'Équipier $memberId'),
              _DetailRow('Rôle', 'Ouvrier'),
              _DetailRow('Email', 'member@koji.pro'),
            ],
          ),
        ),
      ],
    );
  }
}

// === FACTURATION ===

class EntrepriseFacturationScreen extends ConsumerWidget {
  const EntrepriseFacturationScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiPage(
      title: 'Facturation',
      appBarOnPhone: true,
      main: [
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: 6,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) {
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFFFFFFFF),
                border: Border.all(color: const Color(0xFFD9D9D4)),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(14),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Facture #${2000 + i}',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '€${5000 + (i * 1000)}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Text(
                    'Payée',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.green,
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

class _DetailRow extends StatelessWidget {
  final String label;
  final String value;

  const _DetailRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: Colors.grey,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
