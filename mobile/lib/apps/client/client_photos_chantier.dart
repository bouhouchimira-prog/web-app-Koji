import 'package:flutter/material.dart';

import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/design/koji_client_charte.dart';

/// Photos « après » du chantier (maquette CLI-02, règle PRO-02.2 : les
/// photos avant et pendant restent chez l'entreprise). Chaque photo vient de
/// GET /api/client/chantier/{quoteId} avec un lien temporaire (1 h) créé par
/// le serveur : `{ url, legende: "19/11 · Rui C.", lot, etiquette? }`.

/// Une photo « après » : date et auteur en bas (`.ph-st`), « Après » en haut
/// (`.ph-k`). Sans réseau, un fond gris à la place de l'image.
class ClPhotoApres extends StatelessWidget {
  const ClPhotoApres({
    super.key,
    required this.photo,
    this.onTap,
    this.hauteur = 150,
  });

  final Map<String, dynamic> photo;
  final VoidCallback? onTap;
  final double hauteur;

  @override
  Widget build(BuildContext context) {
    final legende = texteSite(photo['legende']);
    final etiquette = texteSite(photo['etiquette']);
    final lot = texteSite(photo['lot']);
    return Semantics(
      button: onTap != null,
      label:
          ['Photo après', lot, legende].where((t) => t.isNotEmpty).join(' · '),
      child: GestureDetector(
        onTap: onTap,
        child: SizedBox(
          height: hauteur,
          width: double.infinity,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                texteSite(photo['url']),
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    const ColoredBox(color: ClCharte.ligne),
                loadingBuilder: (context, child, progres) => progres == null
                    ? child
                    : const ColoredBox(color: ClCharte.ligne),
              ),
              Positioned(
                left: 6,
                top: 6,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                  color: ClCharte.blanc,
                  child: Text(
                    (etiquette.isEmpty ? 'Après' : etiquette).toUpperCase(),
                    style: ClCharte.texte(10,
                        graisse: FontWeight.w700, hauteur: 1),
                  ),
                ),
              ),
              if (legende.isNotEmpty)
                Positioned(
                  left: 6,
                  bottom: 6,
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    color: const Color(0xD9171B1E),
                    child: Text(legende,
                        style: ClCharte.texte(11,
                            graisse: FontWeight.w600,
                            couleur: ClCharte.blanc,
                            hauteur: 1.2)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// La photo en grand, avec l'étape et la légende.
Future<void> ouvrirPhotoApres(
    BuildContext context, Map<String, dynamic> photo) {
  return showDialog<void>(
    context: context,
    barrierColor: const Color(0xEB101529),
    builder: (ctx) => Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(16),
      shape: const RoundedRectangleBorder(),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          InteractiveViewer(
            child: Image.network(
              texteSite(photo['url']),
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => Padding(
                padding: const EdgeInsets.all(24),
                child: Text("La photo n'a pas pu être chargée.",
                    style: ClCharte.texte(13, couleur: ClCharte.blanc)),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            [texteSite(photo['lot']), texteSite(photo['legende'])]
                .where((t) => t.isNotEmpty)
                .join(' · '),
            style: ClCharte.texte(13, couleur: ClCharte.blanc),
          ),
          const SizedBox(height: 10),
          ClBouton('Fermer',
              contour: true, onPressed: () => Navigator.of(ctx).pop()),
        ],
      ),
    ),
  );
}

/// « Photos du chantier » (Documents) : les photos « après », par étape.
class ClGaleriePhotos extends StatelessWidget {
  const ClGaleriePhotos(this.photos, {super.key});

  final List<Map<String, dynamic>> photos;

  @override
  Widget build(BuildContext context) {
    final etapes = <String>[];
    for (final p in photos) {
      final lot =
          texteSite(p['lot']).isEmpty ? 'Chantier' : texteSite(p['lot']);
      if (!etapes.contains(lot)) etapes.add(lot);
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.ligne),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, etape) in etapes.indexed) ...[
            if (i > 0) const SizedBox(height: 14),
            Text(etape, style: ClCharte.texte(13, graisse: FontWeight.w700)),
            const SizedBox(height: 8),
            LayoutBuilder(builder: (context, c) {
              final largeur = (c.maxWidth - 8) / 2;
              return Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final p in photos.where((p) =>
                      (texteSite(p['lot']).isEmpty
                          ? 'Chantier'
                          : texteSite(p['lot'])) ==
                      etape))
                    SizedBox(
                      width: largeur,
                      child: ClPhotoApres(
                        photo: p,
                        hauteur: largeur * 3 / 4,
                        onTap: () => ouvrirPhotoApres(context, p),
                      ),
                    ),
                ],
              );
            }),
          ],
        ],
      ),
    );
  }
}
