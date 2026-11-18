import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:koji/design/koji_brand_marks.dart';
import 'package:koji/design/koji_icons.dart';

// Charte v2, univers Client (app Koji) : marine, sable, riz, coins carrés,
// ni jaune ni ombre. Titres en Shippori Mincho, le reste en DM Sans. Entre
// parenthèses, la classe de la maquette que chaque élément reprend.

/// Couleurs, polices et mesures de la charte Client.
abstract final class ClCharte {
  static const marine = Color(0xFF101529);
  static const sable = Color(0xFFE7D8C5);
  static const riz = Color(0xFFF8F6F1);
  static const blanc = Color(0xFFFFFFFF);
  static const ligne = Color(0xFFE6E2DA);
  static const gris = Color(0xFF6B6A66);

  /// Texte clair posé sur le marine.
  static const clair = Color(0xFFC9CDE0);

  static const serif = 'ShipporiMincho';
  static const sans = 'DMSans';

  /// Marges d'un écran téléphone, écart entre deux blocs.
  static const corps = EdgeInsets.fromLTRB(16, 14, 16, 20);
  static const double ecart = 10;

  /// Titres : Shippori Mincho, seule graisse embarquée (600).
  static TextStyle titre(double taille, {Color couleur = marine}) => TextStyle(
        fontFamily: serif,
        fontSize: taille,
        fontWeight: FontWeight.w600,
        color: couleur,
        height: 1.25,
      );

  static TextStyle texte(
    double taille, {
    FontWeight graisse = FontWeight.w400,
    Color couleur = marine,
    double hauteur = 1.35,
  }) =>
      TextStyle(
        fontFamily: sans,
        fontSize: taille,
        fontWeight: graisse,
        color: couleur,
        height: hauteur,
      );
}

/// Pictogrammes de la barre du bas (`.cl-tb`), tracés de la maquette.
abstract final class ClIcones {
  static const projets = 'M4 20h16M6 20V9l6-4 6 4v11';
  static const messages = 'M4 5h16v11H9l-5 4z';
  static const plus = KojiIcons.plus;
  static const paiements = 'M4 7h16v12H4zM4 11h16';
  static const profil = KojiIcons.profil;
}

/// Bandeau du haut (`.cl-top`) : mot-symbole sable, « Bonjour {nom} », et la
/// cloche des notifications quand [onNotifications] est donné.
class ClBandeau extends StatelessWidget {
  const ClBandeau({
    super.key,
    this.nom = '',
    this.nonLues = 0,
    this.onNotifications,
  });

  final String nom;
  final int nonLues;
  final VoidCallback? onNotifications;

  @override
  Widget build(BuildContext context) {
    final haut = MediaQuery.paddingOf(context).top;
    final cloche = onNotifications != null;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: ColoredBox(
        color: ClCharte.marine,
        child: Stack(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(16, haut + 18, cloche ? 54 : 16, 18),
              child: Row(
                children: [
                  const KojiWordmark(height: 13, color: ClCharte.sable),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      nom.isEmpty ? 'Bonjour' : 'Bonjour $nom',
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ClCharte.texte(13, couleur: ClCharte.clair),
                    ),
                  ),
                ],
              ),
            ),
            if (cloche)
              Positioned(
                top: haut,
                right: 4,
                bottom: 0,
                child: Center(
                  child: _Cloche(nonLues: nonLues, onTap: onNotifications!),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Cloche discrète du bandeau : trait blanc, compteur sable.
class _Cloche extends StatelessWidget {
  const _Cloche({required this.nonLues, required this.onTap});

  final int nonLues;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Notifications',
      child: Semantics(
        container: true,
        button: true,
        label: switch (nonLues) {
          0 => 'Notifications',
          1 => 'Notifications, 1 non lue',
          _ => 'Notifications, $nonLues non lues',
        },
        excludeSemantics: true,
        child: GestureDetector(
          onTap: onTap,
          behavior: HitTestBehavior.opaque,
          child: SizedBox(
            width: 44,
            height: 44,
            child: Stack(
              alignment: Alignment.center,
              children: [
                const KojiIcon(KojiIcons.bell, size: 20, color: ClCharte.blanc),
                if (nonLues > 0)
                  Positioned(
                    top: 7,
                    right: 5,
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 15),
                      height: 15,
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      alignment: Alignment.center,
                      color: ClCharte.sable,
                      child: Text(
                        nonLues > 9 ? '9+' : '$nonLues',
                        style: ClCharte.texte(10,
                            graisse: FontWeight.w700, hauteur: 1),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Barre avec retour (`.cl-bar`) : « ‹ », titre en serif, sous-titre.
class ClBarre extends StatelessWidget {
  const ClBarre({
    super.key,
    required this.titre,
    this.sousTitre = '',
    required this.onRetour,
  });

  final String titre;
  final String sousTitre;
  final VoidCallback onRetour;

  @override
  Widget build(BuildContext context) {
    final haut = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        color: ClCharte.marine,
        padding: EdgeInsets.only(top: haut),
        child: Row(
          children: [
            Semantics(
              container: true,
              button: true,
              label: 'Retour',
              excludeSemantics: true,
              child: GestureDetector(
                onTap: onRetour,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
                  child: Text('‹',
                      style: ClCharte.texte(24,
                          couleur: ClCharte.blanc, hauteur: 1.1)),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(0, 16, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      titre,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: ClCharte.titre(19, couleur: ClCharte.blanc),
                    ),
                    if (sousTitre.isNotEmpty)
                      Text(
                        sousTitre,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ClCharte.texte(12, couleur: ClCharte.clair),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Action principale (`.cl-btn`, une seule par écran) ou secondaire
/// (`.cw-sec`). Pleine largeur ; inactive quand [onPressed] est nul.
class ClBouton extends StatelessWidget {
  const ClBouton(
    this.label, {
    super.key,
    required this.onPressed,
    this.secondaire = false,
    this.charge = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool secondaire;

  /// Envoi en cours : le bouton tourne et n'écoute plus.
  final bool charge;

  @override
  Widget build(BuildContext context) {
    final actif = onPressed != null && !charge;
    final marine =
        ClCharte.marine.withValues(alpha: onPressed == null ? 0.35 : 1);
    final encre = secondaire ? marine : ClCharte.blanc;
    return Semantics(
      button: true,
      enabled: actif,
      child: Material(
        color: secondaire ? Colors.transparent : marine,
        shape: secondaire ? Border.all(color: marine) : null,
        child: InkWell(
          onTap: actif ? onPressed : null,
          child: Container(
            height: secondaire ? 42 : 52,
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: charge
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: encre),
                  )
                : Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: ClCharte.texte(secondaire ? 14 : 16,
                        graisse: FontWeight.w600, couleur: encre, hauteur: 1.2),
                  ),
          ),
        ),
      ),
    );
  }
}

/// Étiquette d'état (`.cl-st`) : pleine (marine, texte blanc) ou au trait.
class ClEtiquette extends StatelessWidget {
  const ClEtiquette(this.label, {super.key, this.pleine = true});

  final String label;
  final bool pleine;

  @override
  Widget build(BuildContext context) {
    return Container(
      // Le trait compte dans les 3/7 de la maquette : même taille pleine ou non.
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: pleine ? ClCharte.marine : null,
        border: Border.all(color: ClCharte.marine),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: ClCharte.texte(11,
            graisse: FontWeight.w700,
            couleur: pleine ? ClCharte.blanc : ClCharte.marine,
            hauteur: 1.3),
      ),
    );
  }
}

/// Carte d'un projet (`.cl-pj`) : filet marine en haut, titre, détail, état.
class ClCarteProjet extends StatelessWidget {
  const ClCarteProjet({
    super.key,
    required this.titre,
    this.detail = '',
    this.etiquette = '',
    this.etiquettePleine = true,
    this.attenue = false,
    this.onTap,
  });

  final String titre;
  final String detail;
  final String etiquette;
  final bool etiquettePleine;

  /// Projet en retrait (brouillon) : carte à 75 %.
  final bool attenue;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: attenue ? 0.75 : 1,
      child: Semantics(
        button: onTap != null,
        child: Material(
          color: ClCharte.blanc,
          child: InkWell(
            onTap: onTap,
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: const BoxDecoration(
                border: Border(
                  top: BorderSide(color: ClCharte.marine, width: 2),
                  left: BorderSide(color: ClCharte.ligne),
                  right: BorderSide(color: ClCharte.ligne),
                  bottom: BorderSide(color: ClCharte.ligne),
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(titre,
                            style: ClCharte.texte(15,
                                graisse: FontWeight.w700)),
                        if (detail.isNotEmpty)
                          Text(detail,
                              style: ClCharte.texte(12,
                                  couleur: ClCharte.gris)),
                      ],
                    ),
                  ),
                  if (etiquette.isNotEmpty) ...[
                    const SizedBox(width: 10),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 130),
                      child: ClEtiquette(etiquette, pleine: etiquettePleine),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Carte d'une proposition (`.cl-of`) : nom, prix en serif, lignes de détail.
/// Choisie : trait marine de 2 px.
class ClCarteOffre extends StatelessWidget {
  const ClCarteOffre({
    super.key,
    required this.nom,
    required this.prix,
    this.lignes = const [],
    this.choisie = false,
    this.onTap,
  });

  final String nom;

  /// Prix tel que le site l'écrit (« 6 034,82 € », « à venir »).
  final String prix;
  final List<String> lignes;
  final bool choisie;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      selected: choisie,
      child: Material(
        color: ClCharte.blanc,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: EdgeInsets.all(choisie ? 11 : 12),
            decoration: BoxDecoration(
              border: Border.all(
                color: choisie ? ClCharte.marine : ClCharte.ligne,
                width: choisie ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 3),
                        child: Text(nom,
                            style: ClCharte.texte(15,
                                graisse: FontWeight.w700)),
                      ),
                    ),
                    if (prix.isNotEmpty) ...[
                      const SizedBox(width: 10),
                      Text(prix, style: ClCharte.titre(20)),
                    ],
                  ],
                ),
                for (final l in lignes) ...[
                  const SizedBox(height: 3),
                  Text(l, style: ClCharte.texte(12, couleur: ClCharte.gris)),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Encadré d'information (`.cl-info`) : fond sable, texte marine.
class ClInfo extends StatelessWidget {
  const ClInfo(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: ClCharte.sable,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Text(texte, style: ClCharte.texte(13, hauteur: 1.4)),
    );
  }
}

/// Ligne libellé / valeur (`.cl-cr`), filet en dessous.
class ClLigne extends StatelessWidget {
  const ClLigne(this.libelle, this.valeur, {super.key});

  final String libelle;
  final String valeur;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ClCharte.ligne)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: c.maxWidth * 0.45),
              child: Text(libelle, style: ClCharte.texte(14)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                valeur,
                textAlign: TextAlign.right,
                style: ClCharte.texte(14, graisse: FontWeight.w700),
              ),
            ),
          ],
        ),
      );
    });
  }
}

/// Case à cocher (`.cl-ck`) : carré de 20 px, cochée = marine et coche
/// blanche. [detail] ajoute une ligne grise sous le libellé.
class ClCase extends StatelessWidget {
  const ClCase({
    super.key,
    required this.cochee,
    required this.onChanged,
    required this.label,
    this.detail = '',
  });

  final bool cochee;
  final ValueChanged<bool>? onChanged;
  final String label;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      checked: cochee,
      enabled: onChanged != null,
      child: InkWell(
        onTap: onChanged == null ? null : () => onChanged!(!cochee),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: cochee ? ClCharte.marine : ClCharte.blanc,
                  border: Border.all(color: ClCharte.marine, width: 1.5),
                ),
                child: cochee
                    ? const KojiIcon(KojiIcons.check,
                        size: 13, color: ClCharte.blanc, strokeWidth: 3)
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Text(label, style: ClCharte.texte(13)),
                    ),
                    if (detail.isNotEmpty)
                      Text(detail,
                          style: ClCharte.texte(12, couleur: ClCharte.gris)),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Champ de saisie (`.cl-fld`) : libellé gris au-dessus d'un cadre marine.
class ClChamp extends StatelessWidget {
  const ClChamp({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.maxLines = 1,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final int maxLines;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder cadre(double trait) => OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: ClCharte.marine, width: trait),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: ClCharte.texte(12, couleur: ClCharte.gris)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          cursorColor: ClCharte.marine,
          style: ClCharte.texte(15),
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: ClCharte.blanc,
            hintText: hint,
            hintStyle: ClCharte.texte(15, couleur: ClCharte.gris),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            border: cadre(1),
            enabledBorder: cadre(1),
            focusedBorder: cadre(2),
          ),
        ),
      ],
    );
  }
}

/// Titre de section (`.cl-h`).
class ClTitre extends StatelessWidget {
  const ClTitre(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) =>
      Text(texte, style: ClCharte.titre(22));
}

/// Corps d'un écran : marges de la charte, 10 px entre deux blocs, tirer
/// pour actualiser quand [onRefresh] est donné.
class ClCorps extends StatelessWidget {
  const ClCorps({
    super.key,
    required this.children,
    this.onRefresh,
    this.padding = ClCharte.corps,
  });

  final List<Widget> children;
  final Future<void> Function()? onRefresh;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    Widget liste = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding,
      children: [
        for (final (i, bloc) in children.indexed) ...[
          if (i > 0) const SizedBox(height: ClCharte.ecart),
          bloc,
        ],
      ],
    );
    if (onRefresh != null) {
      liste = RefreshIndicator(
        color: ClCharte.marine,
        backgroundColor: ClCharte.blanc,
        onRefresh: onRefresh!,
        child: liste,
      );
    }
    return liste;
  }
}
