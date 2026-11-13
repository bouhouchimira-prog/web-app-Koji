import 'package:flutter/material.dart';

import 'package:koji/design/koji_brand_marks.dart';

// Écran de compte Koji Pro (maquette PRO-00) : mêmes couleurs et mêmes
// formes que le site (components/entreprise-login.css). Charte v2 : DM Sans,
// graphite, un seul jaune par zone, arrondis 4 px pour ce qu'on touche.
class ProAuth {
  static const graphite = Color(0xFF171B1E);
  static const yellow = Color(0xFFFFC400);
  static const grey = Color(0xFF5B5F66);
  static const line = Color(0xFFCFCFC9);
  static const field = Color(0xFF8A8F98);
  static const tab = Color(0xFFDEDED6);
  static const pill = Color(0xFFE2E2DB);
  static const muted = Color(0xFFC4C7CC);
  static const font = 'DMSans';

  static TextStyle text(double size,
          {FontWeight weight = FontWeight.w400,
          Color color = graphite,
          double? height}) =>
      TextStyle(
          fontFamily: font,
          fontSize: size,
          fontWeight: weight,
          color: color,
          height: height);

  static const radius = BorderRadius.all(Radius.circular(4));
}

/// Téléphone : bandeau graphite (mot-symbole et phrase de marque).
class ProAuthBand extends StatelessWidget {
  const ProAuthBand({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: ProAuth.graphite,
      padding: EdgeInsets.fromLTRB(
          20, MediaQuery.paddingOf(context).top + 28, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const KojiWordmark(height: 18, color: Colors.white),
          const SizedBox(height: 8),
          Text('Décrivez le chantier. Koji le chiffre.',
              style: ProAuth.text(14, color: ProAuth.muted)),
        ],
      ),
    );
  }
}

/// Tablette : panneau graphite de gauche.
class ProAuthPanel extends StatelessWidget {
  const ProAuthPanel({super.key});

  @override
  Widget build(BuildContext context) {
    Widget point(String texte) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('•  ',
                  style: ProAuth.text(15, color: const Color(0xFFD5D7DA))),
              Expanded(
                  child: Text(texte,
                      style: ProAuth.text(15,
                          color: const Color(0xFFD5D7DA), height: 1.5))),
            ],
          ),
        );
    return Container(
      color: ProAuth.graphite,
      padding: const EdgeInsets.fromLTRB(56, 56, 56, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const KojiWordmark(height: 20, color: Colors.white),
          const SizedBox(height: 62),
          Text('Décrivez le chantier.\nKoji le chiffre.',
              style: ProAuth.text(34,
                  weight: FontWeight.w700, color: Colors.white, height: 1.15)),
          const SizedBox(height: 22),
          point('Radar des chantiers près de chez vous'),
          point('Devis guidé, envoyé en 10 minutes'),
          point('Chantier, photos, factures au même endroit'),
          const Spacer(),
          Text('getkoji.io', style: ProAuth.text(13, color: ProAuth.field)),
        ],
      ),
    );
  }
}

/// Onglets « Se connecter / Créer un compte » (onglets classeur, fil jaune).
class ProAuthTabs extends StatelessWidget {
  const ProAuthTabs({super.key, required this.login, required this.onChanged});

  final bool login;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    Widget tab(String label, bool on, VoidCallback onTap) => Semantics(
          button: true,
          selected: on,
          child: GestureDetector(
            onTap: onTap,
            behavior: HitTestBehavior.opaque,
            // Bord arrondi seulement en haut : coupe nette, puis bordures
            // de couleurs différentes (fil jaune de l'onglet actif).
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(4)),
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 9, 16, 10),
                decoration: BoxDecoration(
                  color: on ? Colors.white : ProAuth.tab,
                  border: Border(
                    top: BorderSide(
                        color: on ? ProAuth.yellow : Colors.transparent,
                        width: 3),
                    left: const BorderSide(color: ProAuth.line),
                    right: const BorderSide(color: ProAuth.line),
                  ),
                ),
                child: Text(label,
                    style: ProAuth.text(15,
                        weight: on ? FontWeight.w700 : FontWeight.w600,
                        color:
                            on ? ProAuth.graphite : const Color(0xFF3A3F44))),
              ),
            ),
          ),
        );
    return Container(
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: ProAuth.line))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          tab('Se connecter', login, () => onChanged(true)),
          const SizedBox(width: 3),
          tab('Créer un compte', !login, () => onChanged(false)),
        ],
      ),
    );
  }
}

/// Champ avec son libellé au-dessus (12 px gris), bordure grise, 4 px.
class ProAuthField extends StatelessWidget {
  const ProAuthField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.obscure = false,
    this.suffix,
    this.keyboardType,
    this.autofillHints,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.maxLength,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool obscure;
  final Widget? suffix;
  final TextInputType? keyboardType;
  final Iterable<String>? autofillHints;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
            borderRadius: ProAuth.radius,
            borderSide: BorderSide(color: color, width: width));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: ProAuth.text(12, color: ProAuth.grey)),
        const SizedBox(height: 5),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          autofillHints: autofillHints,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          maxLength: maxLength,
          style: ProAuth.text(15),
          cursorColor: ProAuth.graphite,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: ProAuth.text(15, color: ProAuth.field),
            counterText: '',
            isDense: true,
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            suffixIcon: suffix,
            enabledBorder: border(ProAuth.field),
            focusedBorder: border(ProAuth.graphite, 2),
            border: border(ProAuth.field),
          ),
        ),
      ],
    );
  }
}

/// Le bouton jaune de la zone.
class ProAuthPrimaryButton extends StatelessWidget {
  const ProAuthPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return Opacity(
      opacity: onPressed == null ? 0.5 : 1,
      child: Material(
        color: ProAuth.yellow,
        borderRadius: ProAuth.radius,
        child: InkWell(
          onTap: enabled ? onPressed : null,
          borderRadius: ProAuth.radius,
          child: SizedBox(
            height: 48,
            child: Center(
              child: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.2, color: ProAuth.graphite))
                  : Text(label,
                      style: ProAuth.text(15, weight: FontWeight.w700)),
            ),
          ),
        ),
      ),
    );
  }
}

/// Lien en pastille grise (« Mot de passe oublié ? »).
class ProAuthPill extends StatelessWidget {
  const ProAuthPill({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Material(
        color: ProAuth.pill,
        borderRadius: ProAuth.radius,
        child: InkWell(
          onTap: onTap,
          borderRadius: ProAuth.radius,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child:
                Text(label, style: ProAuth.text(13, weight: FontWeight.w600)),
          ),
        ),
      ),
    );
  }
}

/// Séparateur « ou ».
class ProAuthOr extends StatelessWidget {
  const ProAuthOr({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(child: Divider(color: ProAuth.line, height: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Text('ou', style: ProAuth.text(13, color: ProAuth.field)),
        ),
        const Expanded(child: Divider(color: ProAuth.line, height: 1)),
      ],
    );
  }
}

/// « Continuer avec … » pleine largeur, contour gris.
class ProAuthProviderButton extends StatelessWidget {
  const ProAuthProviderButton({
    super.key,
    required this.logo,
    required this.label,
    required this.onTap,
  });

  final Widget logo;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: ProAuth.radius, side: BorderSide(color: ProAuth.field)),
      child: InkWell(
        onTap: onTap,
        borderRadius: ProAuth.radius,
        child: SizedBox(
          height: 48,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              logo,
              const SizedBox(width: 10),
              Text(label, style: ProAuth.text(14, weight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Case des conditions, jamais pré-cochée.
class ProAuthCheck extends StatelessWidget {
  const ProAuthCheck({
    super.key,
    required this.value,
    required this.onChanged,
    required this.title,
    required this.detail,
  });

  final bool value;
  final ValueChanged<bool> onChanged;
  final Widget title;
  final Widget detail;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      shape:
          const RoundedRectangleBorder(side: BorderSide(color: ProAuth.line)),
      child: InkWell(
        onTap: () => onChanged(!value),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 12, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Checkbox(
                value: value,
                onChanged: (v) => onChanged(v ?? false),
                activeColor: ProAuth.graphite,
                side: const BorderSide(color: ProAuth.graphite, width: 1.5),
                shape: const RoundedRectangleBorder(),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [title, const SizedBox(height: 3), detail],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
