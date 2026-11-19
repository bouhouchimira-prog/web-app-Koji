import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

// Pièces communes de Koji Client · signer, suivre, payer (maquette CLI-02) :
// encadré de prix, onglets, lignes de paiement, ouverture d'un fichier du
// site, et passage d'un lien du site à une page de l'app. Tous les textes et
// montants viennent du site, déjà formatés : rien n'est calculé ici.

String texteSite(dynamic v) => v is String ? v.trim() : '';

Map<String, dynamic> mapSite(dynamic v) =>
    v is Map<String, dynamic> ? v : const <String, dynamic>{};

List<Map<String, dynamic>> listeSite(dynamic v) =>
    ((v is List) ? v : const []).whereType<Map<String, dynamic>>().toList();

/// Page de l'app pour un lien du site, ou nul quand l'app n'en a pas :
/// `/client/chantier/{id}` ouvre l'écran CLI-02, la conversation d'une
/// demande ouvre son fil dans Messages, `/client/paiements` l'onglet.
String? routeAppDuLienSite(String lien) {
  final uri = Uri.tryParse(lien.trim());
  if (uri == null) return null;
  if (uri.hasScheme && !RegExp(r'(^|\.)getkoji\.io$').hasMatch(uri.host)) {
    return null;
  }
  final morceaux = uri.pathSegments.where((m) => m.isNotEmpty).toList();
  if (morceaux.length == 3 &&
      morceaux[0] == 'client' &&
      morceaux[1] == 'chantier') {
    final onglet = uri.queryParameters['onglet'];
    return '/client/devis/${Uri.encodeComponent(morceaux[2])}'
        '${onglet == null ? '' : '?onglet=${Uri.encodeQueryComponent(onglet)}'}';
  }
  if (morceaux.length == 3 &&
      morceaux[0] == 'client' &&
      morceaux[1] == 'radar' &&
      (uri.queryParameters['entreprise'] ?? '').isNotEmpty) {
    final fil = '${morceaux[2]}:${uri.queryParameters['entreprise']}';
    return '/client/messages?fil=${Uri.encodeQueryComponent(fil)}';
  }
  if (morceaux.length == 2 &&
      morceaux[0] == 'client' &&
      morceaux[1] == 'paiements') {
    return '/client/paiements';
  }
  return null;
}

/// Extension d'un fichier d'après ses premiers octets (PDF, PNG ou JPEG :
/// la décennale peut être une image).
String extensionFichier(Uint8List octets) {
  bool commence(List<int> debut) =>
      octets.length >= debut.length &&
      [for (var i = 0; i < debut.length; i++) octets[i] == debut[i]]
          .every((b) => b);
  if (commence([0x89, 0x50, 0x4E, 0x47])) return 'png';
  if (commence([0xFF, 0xD8, 0xFF])) return 'jpg';
  return 'pdf';
}

/// Nom de fichier lisible tiré d'un titre (« Devis signé, version 2 »).
String nomDeFichier(String titre) {
  const accents = {
    'à': 'a', 'â': 'a', 'ä': 'a', 'ç': 'c', 'é': 'e', 'è': 'e', 'ê': 'e',
    'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'û': 'u',
    'ü': 'u', 'œ': 'oe',
  };
  final bas = titre.toLowerCase().split('').map((c) => accents[c] ?? c).join();
  final propre = bas
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
  return propre.isEmpty ? 'document' : propre;
}

/// Ouvre un fichier de l'espace client (devis, facture, PV, décennale) :
/// téléchargé avec la session du site, puis proposé au partage, d'où il
/// s'ouvre dans la visionneuse du téléphone (comme l'export des données dans
/// Paramètres). Remplacé dans les tests.
final clientOuvrirFichierProvider =
    Provider<Future<void> Function(String chemin, String titre)>(
        (ref) => (chemin, titre) async {
              final octets = await ref
                  .read(marketplaceRepositoryProvider)
                  .getFichierClient(chemin);
              final dossier = await getTemporaryDirectory();
              final ext = extensionFichier(octets);
              final fichier =
                  File('${dossier.path}/koji-${nomDeFichier(titre)}.$ext');
              await fichier.writeAsBytes(octets);
              await Share.shareXFiles([
                XFile(fichier.path,
                    mimeType: switch (ext) {
                      'png' => 'image/png',
                      'jpg' => 'image/jpeg',
                      _ => 'application/pdf',
                    }),
              ]);
            });

/// Encadré de prix (`.cl-price`) : sable, libellé, montant en serif, détail.
class ClPrix extends StatelessWidget {
  const ClPrix({
    super.key,
    required this.titre,
    required this.montant,
    this.detail = '',
    this.lien = '',
    this.onLien,
    this.action,
  });

  final String titre;
  final String montant;
  final String detail;

  /// Lien souligné après le détail (« ce qui change depuis la version 1 »).
  final String lien;
  final VoidCallback? onLien;

  /// Bouton posé dans l'encadré (télécharger la facture).
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final petit = ClCharte.texte(12);
    return Container(
      width: double.infinity,
      color: ClCharte.sable,
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (titre.isNotEmpty) Text(titre, style: petit),
          const SizedBox(height: 2),
          Text(montant, style: ClCharte.titre(30).copyWith(height: 1.2)),
          if (detail.isNotEmpty || lien.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text.rich(
              TextSpan(children: [
                TextSpan(text: detail),
                if (lien.isNotEmpty) ...[
                  if (detail.isNotEmpty) const TextSpan(text: ' · '),
                  WidgetSpan(
                    alignment: PlaceholderAlignment.baseline,
                    baseline: TextBaseline.alphabetic,
                    child: Semantics(
                      link: true,
                      child: GestureDetector(
                        onTap: onLien,
                        behavior: HitTestBehavior.opaque,
                        child: Text(
                          lien,
                          style: petit.copyWith(
                            decoration: TextDecoration.underline,
                            decorationColor: ClCharte.marine,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ]),
              style: petit,
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 10),
            action!,
          ],
        ],
      ),
    );
  }
}

/// Onglets d'une page (`.cw-sub`, version téléphone) : bande blanche, un
/// onglet par part égale, l'actif en gras et souligné de marine.
class ClOnglets extends StatelessWidget {
  const ClOnglets({
    super.key,
    required this.onglets,
    required this.actif,
    required this.onChoisir,
  });

  /// Clé et libellé de chaque onglet.
  final List<(String, String)> onglets;
  final String actif;
  final ValueChanged<String> onChoisir;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: ClCharte.blanc,
        border: Border(bottom: BorderSide(color: ClCharte.ligne)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        children: [
          for (final (cle, libelle) in onglets)
            Expanded(
              child: Semantics(
                button: true,
                selected: cle == actif,
                child: GestureDetector(
                  onTap: () => onChoisir(cle),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(4, 12, 4, 10),
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: cle == actif
                              ? ClCharte.marine
                              : Colors.transparent,
                          width: 2,
                        ),
                      ),
                    ),
                    child: Text(
                      libelle,
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ClCharte.texte(14,
                          graisse:
                              cle == actif ? FontWeight.w700 : FontWeight.w400,
                          couleur:
                              cle == actif ? ClCharte.marine : ClCharte.gris,
                          hauteur: 1.2),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Note grise sous un bloc (`.cw-n`).
class ClNote extends StatelessWidget {
  const ClNote(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(texte,
            style: ClCharte.texte(12, couleur: ClCharte.gris, hauteur: 1.45)),
      );
}

/// Encadré blanc d'une liste vide (`.kc2-vide`).
class ClVide extends StatelessWidget {
  const ClVide(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: ClCharte.blanc,
          border: Border.all(color: ClCharte.ligne),
        ),
        child: Text(texte, style: ClCharte.texte(14, couleur: ClCharte.gris)),
      );
}

/// Une ligne de paiement (`.cl-pay`) : payée, à payer (la prochaine due est
/// encadrée de marine), à venir (atténuée). Touchée, elle ouvre la facture.
class ClLignePaiement extends StatelessWidget {
  const ClLignePaiement({
    super.key,
    required this.ligne,
    this.due = false,
    this.onFacture,
  });

  final Map<String, dynamic> ligne;
  final bool due;
  final VoidCallback? onFacture;

  @override
  Widget build(BuildContext context) {
    final aVenir = ligne['etat'] == 'a_venir';
    final detail = texteSite(ligne['detail']);
    final petit = ClCharte.texte(12, couleur: ClCharte.gris);
    return Opacity(
      opacity: aVenir ? 0.7 : 1,
      child: Semantics(
        button: onFacture != null,
        child: Material(
          color: ClCharte.blanc,
          child: InkWell(
            onTap: onFacture,
            child: Container(
              padding: EdgeInsets.all(due ? 11 : 12),
              decoration: BoxDecoration(
                border: Border.all(
                  color: due ? ClCharte.marine : ClCharte.ligne,
                  width: due ? 2 : 1,
                ),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(texteSite(ligne['titre']),
                            style:
                                ClCharte.texte(14, graisse: FontWeight.w700)),
                        Text.rich(
                          TextSpan(children: [
                            TextSpan(text: detail),
                            if (onFacture != null) ...[
                              if (detail.isNotEmpty)
                                const TextSpan(text: ' · '),
                              TextSpan(
                                text: 'PDF',
                                style: petit.copyWith(
                                  color: ClCharte.marine,
                                  decoration: TextDecoration.underline,
                                  decorationColor: ClCharte.marine,
                                ),
                              ),
                            ],
                          ]),
                          style: petit,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(texteSite(ligne['montant']),
                      style: ClCharte.texte(15, graisse: FontWeight.w700)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Les paiements d'un chantier (forme `paiements` du site) : lignes, ou le
/// texte « vide », puis la retenue de garantie expliquée. Le bouton
/// « Payer » est à part (ClPayer, client_paiement_en_ligne.dart).
List<Widget> clListePaiements(
  Map<String, dynamic> paiements, {
  required void Function(String chemin, String titre) ouvrir,
}) {
  final lignes = listeSite(paiements['lignes']);
  final aPayer = mapSite(paiements['aPayer']);
  final retenue = texteSite(paiements['retenue']);
  return [
    if (lignes.isEmpty)
      ClVide(texteSite(paiements['vide']))
    else
      for (final l in lignes)
        ClLignePaiement(
          ligne: l,
          due: aPayer.isNotEmpty && aPayer['factureId'] == l['id'],
          onFacture: texteSite(l['pdf']).isEmpty
              ? null
              : () => ouvrir(texteSite(l['pdf']), texteSite(l['titre'])),
        ),
    if (retenue.isNotEmpty) ClInfo(retenue),
  ];
}
