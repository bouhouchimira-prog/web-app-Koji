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

  // Pictogrammes des notifications (`.cnf-ic`) et des lignes de liste.
  static const cloche = 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4';
  static const devis = 'M6 3h9l4 4v14H6zM9 12h6M9 16h6';
  static const document = 'M6 3h9l4 4v14H6zM14 3v5h5';
  static const calendrier = 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4';
  static const paiement = 'M3 7h18v11H3zM3 11h18M7 15h3';
  static const lieu =
      'M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zM12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z';
  static const drapeau = 'M5 21V4h11l-1.5 3.5L16 11H5';
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

/// Barre avec retour (`.cl-bar`) : « ‹ », titre en serif, sous-titre. Sans
/// [onRetour] (racine d'un onglet), pas de « ‹ ». [action] : bouton à droite
/// (menu « ⋮ » Signaler / Bloquer d'une conversation).
class ClBarre extends StatelessWidget {
  const ClBarre({
    super.key,
    required this.titre,
    this.sousTitre = '',
    required this.onRetour,
    this.action,
  });

  final String titre;
  final String sousTitre;
  final VoidCallback? onRetour;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final haut = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        color: ClCharte.marine,
        padding: EdgeInsets.only(top: haut, left: onRetour == null ? 16 : 0),
        child: Row(
          children: [
            if (onRetour != null)
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
            if (action != null) action!,
          ],
        ),
      ),
    );
  }
}

/// Action principale (`.cl-btn`, une seule par écran) ou secondaire
/// (`.cw-sec`). Pleine largeur ; inactive quand [onPressed] est nul.
/// [contour] : action destructrice (`.cl-del`), grande mais jamais pleine.
/// [compact] : petit bouton posé dans une bulle ou une carte.
class ClBouton extends StatelessWidget {
  const ClBouton(
    this.label, {
    super.key,
    required this.onPressed,
    this.secondaire = false,
    this.contour = false,
    this.compact = false,
    this.charge = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool secondaire;
  final bool contour;
  final bool compact;

  /// Envoi en cours : le bouton tourne et n'écoute plus.
  final bool charge;

  @override
  Widget build(BuildContext context) {
    final actif = onPressed != null && !charge;
    final marine =
        ClCharte.marine.withValues(alpha: onPressed == null ? 0.35 : 1);
    final trait = secondaire || contour;
    final encre = trait ? marine : ClCharte.blanc;
    final hauteur = compact ? 36.0 : (secondaire ? 42.0 : 52.0);
    final taille = compact || secondaire ? 14.0 : 16.0;
    return Semantics(
      button: true,
      enabled: actif,
      child: Material(
        color: contour
            ? ClCharte.blanc
            : (secondaire ? Colors.transparent : marine),
        shape: trait
            ? Border.all(color: marine, width: contour ? 1.5 : 1)
            : null,
        child: InkWell(
          onTap: actif ? onPressed : null,
          child: Container(
            height: hauteur,
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
                    style: ClCharte.texte(taille,
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
    this.masque = false,
    this.lectureSeule = false,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final int maxLines;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  /// Mot de passe : caractères masqués.
  final bool masque;

  /// Valeur affichée mais non modifiable (cadre gris).
  final bool lectureSeule;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder cadre(double trait) => OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(
              color: lectureSeule ? ClCharte.ligne : ClCharte.marine,
              width: trait),
        );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: ClCharte.texte(12, couleur: ClCharte.gris)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          maxLines: masque ? 1 : maxLines,
          obscureText: masque,
          readOnly: lectureSeule,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          cursorColor: ClCharte.marine,
          style: ClCharte.texte(15,
              couleur: lectureSeule ? ClCharte.gris : ClCharte.marine),
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
            focusedBorder: cadre(lectureSeule ? 1 : 2),
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

/// Garde une largeur de lecture sur grand écran (la coquille y pose déjà
/// son menu) ; sans effet sur un téléphone.
class ClLargeur extends StatelessWidget {
  const ClLargeur({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth <= 760) return child;
      return Align(
        alignment: Alignment.topLeft,
        child: SizedBox(width: 720, child: child),
      );
    });
  }
}

/// Écran de la charte : barre marine (`.cl-bar`), corps, et [bas] collé en
/// bas de l'écran (champ de saisie, action principale).
class ClEcran extends StatelessWidget {
  const ClEcran({
    super.key,
    required this.titre,
    this.sousTitre = '',
    this.onRetour,
    required this.corps,
    this.bas,
    this.action,
  });

  final String titre;
  final String sousTitre;
  final VoidCallback? onRetour;
  final Widget corps;
  final Widget? bas;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ClCharte.riz,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClBarre(titre: titre, sousTitre: sousTitre, onRetour: onRetour, action: action),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: ClLargeur(child: corps),
            ),
          ),
          if (bas != null)
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(16, 6, 16, 14),
              child: ClLargeur(child: bas!),
            ),
        ],
      ),
    );
  }
}

/// Ligne de liste (`.cl-row`) : pictogramme facultatif, titre, détail gris,
/// et à droite « › » quand elle s'ouvre, ou [fin] (coche, valeur…).
class ClRangee extends StatelessWidget {
  const ClRangee({
    super.key,
    required this.titre,
    this.detail = '',
    this.icone,
    this.fin,
    this.onTap,
  });

  final String titre;
  final String detail;
  final String? icone;
  final Widget? fin;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final droite = fin ??
        (onTap == null
            ? null
            : Text('›',
                style: ClCharte.texte(20, couleur: ClCharte.gris, hauteur: 1)));
    return Semantics(
      button: onTap != null,
      child: Material(
        color: ClCharte.blanc,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(border: Border.all(color: ClCharte.ligne)),
            child: Row(
              children: [
                if (icone != null) ...[
                  KojiIcon(icone!, size: 20, color: ClCharte.marine),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titre,
                          style: ClCharte.texte(14, graisse: FontWeight.w700)),
                      if (detail.isNotEmpty)
                        Text(detail,
                            style: ClCharte.texte(12, couleur: ClCharte.gris)),
                    ],
                  ),
                ),
                if (droite != null) ...[const SizedBox(width: 12), droite],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Intitulé de section (`.cl-sec`) au-dessus d'un groupe de lignes.
class ClSection extends StatelessWidget {
  const ClSection(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text(texte,
            style: ClCharte.texte(12,
                graisse: FontWeight.w600, couleur: ClCharte.gris)),
      );
}

/// Lien souligné (`.cl-l`).
class ClLien extends StatelessWidget {
  const ClLien(this.texte, {super.key, required this.onTap, this.taille = 13});

  final String texte;
  final VoidCallback onTap;
  final double taille;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      link: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Text(
            texte,
            style: ClCharte.texte(taille).copyWith(
              decoration: TextDecoration.underline,
              decorationColor: ClCharte.marine,
            ),
          ),
        ),
      ),
    );
  }
}

/// Bulle d'un fil (`.cl-bub`) : reçue (blanche, à gauche) ou envoyée
/// (marine, à droite), 82 % de la largeur au plus. [note] : heure, en petit.
class ClBulle extends StatelessWidget {
  const ClBulle({
    super.key,
    required this.texte,
    this.envoyee = false,
    this.auteur = '',
    this.note = '',
    this.actions,
  });

  final String texte;
  final bool envoyee;
  final String auteur;
  final String note;

  /// Boutons sous le texte (répondre à un rendez-vous…).
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final encre = envoyee ? ClCharte.blanc : ClCharte.marine;
    return LayoutBuilder(builder: (context, c) {
      return Align(
        alignment: envoyee ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: c.maxWidth * 0.82),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: envoyee ? ClCharte.marine : ClCharte.blanc,
              border: envoyee ? null : Border.all(color: ClCharte.ligne),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (auteur.isNotEmpty) ...[
                  Text(auteur,
                      style: ClCharte.texte(12,
                          graisse: FontWeight.w700, couleur: encre)),
                  const SizedBox(height: 3),
                ],
                Text(texte,
                    style: ClCharte.texte(14, couleur: encre, hauteur: 1.45)),
                if (note.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Text(note,
                      style: ClCharte.texte(11,
                          couleur:
                              envoyee ? ClCharte.clair : ClCharte.gris)),
                ],
                if (actions != null) ...[
                  const SizedBox(height: 8),
                  actions!,
                ],
              ],
            ),
          ),
        ),
      );
    });
  }
}

/// Champ d'écriture d'un fil (`.cl-in`) : cadre marine, bouton d'envoi.
class ClSaisie extends StatelessWidget {
  const ClSaisie({
    super.key,
    required this.controller,
    required this.onEnvoyer,
    this.hint = 'Écrire un message…',
    this.envoi = false,
  });

  final TextEditingController controller;
  final VoidCallback onEnvoyer;
  final String hint;

  /// Envoi en cours : le bouton tourne et n'écoute plus.
  final bool envoi;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.marine),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: envoi ? null : (_) => onEnvoyer(),
              cursorColor: ClCharte.marine,
              style: ClCharte.texte(14),
              decoration: InputDecoration(
                isDense: true,
                filled: false,
                hintText: hint,
                hintStyle: ClCharte.texte(14, couleur: ClCharte.gris),
                contentPadding: const EdgeInsets.fromLTRB(12, 11, 4, 11),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
          Semantics(
            container: true,
            button: true,
            label: 'Envoyer',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: envoi ? null : onEnvoyer,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: envoi
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: ClCharte.marine),
                      )
                    : const KojiIcon(KojiIcons.send,
                        size: 18, color: ClCharte.marine),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Carré d'un pictogramme de notification (`.cnf-ic`) ; [grand] : celui du
/// détail, marine.
class ClPicto extends StatelessWidget {
  const ClPicto(this.icone, {super.key, this.grand = false});

  final String icone;
  final bool grand;

  @override
  Widget build(BuildContext context) {
    final cote = grand ? 52.0 : 36.0;
    return Container(
      width: cote,
      height: cote,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: grand ? ClCharte.marine : ClCharte.riz,
        border: Border.all(color: grand ? ClCharte.marine : ClCharte.ligne),
      ),
      child: KojiIcon(icone,
          size: grand ? 24 : 18, color: grand ? ClCharte.riz : ClCharte.marine),
    );
  }
}

/// Intitulé de jour d'une liste (`.cnf-day`) : « Aujourd'hui », « Hier »…
class ClJour extends StatelessWidget {
  const ClJour(this.texte, {super.key});

  final String texte;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(2, 6, 2, 8),
        child: Text(texte,
            style: ClCharte.texte(12,
                graisse: FontWeight.w600, couleur: ClCharte.gris)),
      );
}

/// Ligne d'une notification (`.cnf-r`) : pictogramme, titre (gras si non
/// lue), une ligne de détail, l'heure et le point marine des non lues. Les
/// lignes d'un même jour se touchent : seule la [premiere] a un filet haut.
class ClLigneNotification extends StatelessWidget {
  const ClLigneNotification({
    super.key,
    required this.icone,
    required this.titre,
    this.detail = '',
    this.heure = '',
    this.nonLue = false,
    this.premiere = true,
    this.onTap,
  });

  final String icone;
  final String titre;
  final String detail;
  final String heure;
  final bool nonLue;
  final bool premiere;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    const filet = BorderSide(color: ClCharte.ligne);
    return Semantics(
      button: onTap != null,
      label: nonLue ? 'Non lue' : null,
      child: Material(
        color: ClCharte.blanc,
        child: InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            decoration: BoxDecoration(
              border: Border(
                top: premiere ? filet : BorderSide.none,
                left: filet,
                right: filet,
                bottom: filet,
              ),
            ),
            child: Row(
              children: [
                ClPicto(icone),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titre,
                          style: ClCharte.texte(14,
                              graisse:
                                  nonLue ? FontWeight.w700 : FontWeight.w500)),
                      if (detail.isNotEmpty)
                        Text(detail,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: ClCharte.texte(12, couleur: ClCharte.gris)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                if (heure.isNotEmpty)
                  Text(heure, style: ClCharte.texte(12, couleur: ClCharte.gris)),
                if (nonLue) ...[
                  const SizedBox(width: 10),
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: ClCharte.marine,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
