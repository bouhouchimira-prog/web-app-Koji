import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_paiement_en_ligne.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

/// « Paiements » (maquette CLI-02), l'onglet de la barre du bas : les
/// factures de tous les chantiers, regroupées par chantier
/// (GET /api/client/paiements), avec le rendu de l'onglet Paiements d'un
/// chantier. « Payer » seulement quand l'entreprise encaisse en ligne
/// (aPayer.payer) ; sinon, la facture se télécharge et se règle par virement.
/// Gabarit web : app/client/paiements/page.jsx.
class ClientPaiementsScreen extends ConsumerWidget {
  const ClientPaiementsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
      // Sans session du site : « Retrouver mon projet » d'abord.
      return ClEcran(
        titre: 'Paiements',
        corps: ClCorps(children: [
          const ClInfo('Connectez-vous à votre espace Koji pour retrouver les '
              'factures de vos chantiers.'),
          ClBouton('Se connecter',
              onPressed: () => context.push('/client/marketplace/login')),
        ]),
      );
    }

    final async = ref.watch(clientPaiementsProvider);
    final vue = async.valueOrNull;
    Future<void> actualiser() async => ref.invalidate(clientPaiementsProvider);

    Future<void> ouvrir(String chemin, String titre) async {
      try {
        await ref.read(clientOuvrirFichierProvider)(chemin, titre);
      } catch (err) {
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(err is KojiWebApiException
                ? err.message
                : "Impossible d'ouvrir le document.")));
      }
    }

    final Widget corps;
    if (vue == null && async.hasError) {
      final expiree =
          async.error is KojiWebApiException &&
              (async.error as KojiWebApiException).statusCode == 401;
      corps = ClCorps(children: [
        Text(
            expiree
                ? 'Votre session a expiré. Connectez-vous pour retrouver vos '
                    'paiements.'
                : "Les paiements n'ont pas pu être chargés.",
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        expiree
            ? ClBouton('Se connecter',
                onPressed: () => context.push('/client/marketplace/login'))
            : ClBouton('Réessayer', secondaire: true, onPressed: actualiser),
      ]);
    } else if (vue == null) {
      corps = const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child:
              CircularProgressIndicator(strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    } else {
      final groupes = listeSite(vue['groupes']);
      corps = ClCorps(
        onRefresh: actualiser,
        children: [
          if (groupes.isEmpty) ClVide(texteSite(vue['vide'])),
          for (final (i, g) in groupes.indexed) ...[
            if (i > 0) const SizedBox(height: 16),
            _EnTete(groupe: g),
            ..._paiementsDuGroupe(g, ouvrir, actualiser),
          ],
          if (texteSite(vue['note']).isNotEmpty) ClNote(texteSite(vue['note'])),
        ],
      );
    }

    final aPayer = vue?['aPayer'] is num ? (vue!['aPayer'] as num).toInt() : 0;
    return ClEcran(
      titre: 'Paiements',
      sousTitre: switch (aPayer) {
        0 => '',
        1 => '1 facture à payer',
        _ => '$aPayer factures à payer',
      },
      corps: corps,
    );
  }

  List<Widget> _paiementsDuGroupe(
      Map<String, dynamic> g,
      Future<void> Function(String chemin, String titre) ouvrir,
      VoidCallback actualiser) {
    final p = mapSite(g['paiements']);
    final aPayer = mapSite(p['aPayer']);
    return [
      ...clListePaiements(p, ouvrir: ouvrir),
      if (aPayer.isNotEmpty)
        ClPrix(
          titre: texteSite(aPayer['titre']),
          montant: texteSite(aPayer['montant']),
          detail: texteSite(aPayer['detail']),
          // Plusieurs chantiers : aucune action principale, le bouton est au
          // trait (comme sur le site).
          action: texteSite(aPayer['pdf']).isEmpty
              ? null
              : ClBouton('Télécharger la facture',
                  contour: true,
                  onPressed: () => ouvrir(
                      texteSite(aPayer['pdf']), texteSite(aPayer['detail']))),
        ),
      // « Payer » quand l'entreprise de ce chantier encaisse en ligne.
      if (mapSite(aPayer['payer']).isNotEmpty)
        ClPayer(aPayer: aPayer, onRetour: actualiser),
    ];
  }
}

/// Titre d'un chantier, son entreprise, et « Voir le chantier ».
class _EnTete extends StatelessWidget {
  const _EnTete({required this.groupe});

  final Map<String, dynamic> groupe;

  @override
  Widget build(BuildContext context) {
    final route = routeAppDuLienSite(texteSite(groupe['lien'])) ??
        '/client/devis/${Uri.encodeComponent(texteSite(groupe['id']))}'
            '?onglet=paiements';
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(texteSite(groupe['titre']), style: ClCharte.titre(20)),
              if (texteSite(groupe['entreprise']).isNotEmpty)
                Text(texteSite(groupe['entreprise']),
                    style: ClCharte.texte(13, couleur: ClCharte.gris)),
            ],
          ),
        ),
        const SizedBox(width: 12),
        ClLien('Voir le chantier', onTap: () => context.push(route)),
      ],
    );
  }
}
