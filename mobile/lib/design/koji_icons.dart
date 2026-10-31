import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Stroke icons copied from the koji web design (24×24 viewBox, round caps).
/// Each value is the `d` attribute of a single SVG path.
abstract final class KojiIcons {
  // Navigation — entreprise menu
  static const chantiers =
      'M4 21V5l8-3 8 3v16M4 21h16M9 9h2M13 9h2M9 13h2M13 13h2M10 21v-4h4v4';
  static const devis = 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h7M9 17h7';
  static const factures =
      'M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2zM9 7h6M9 11h6M9 15h4';
  static const fournitures = 'M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10';
  static const bibliotheque =
      'M4 4h6a3 3 0 0 1 3 3v14a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v14a2 2 0 0 1 2-2h7z';
  static const comptabilite = 'M4 20h16M7 20V10M12 20V4M17 20v-7';
  static const contacts =
      'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 20v-2a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8';
  static const calendrier = 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5';
  static const archives = 'M3 4h18v4H3zM5 8v12h14V8M10 12h4';
  static const corbeille = 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6';
  static const profil =
      'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0';
  static const aide =
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1.2-1.5 2.5M12 17h.01';
  static const parametres =
      'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4';

  // Navigation — client menu
  static const accueil = 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6';
  static const messages =
      'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12';
  static const deconnexion = 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9';
  // Radar des Chantiers / Marketplace — broadcast-wave glyph.
  static const radar =
      'M4.93 19.07a10 10 0 0 1 0-14.14M7.76 16.24a6 6 0 0 1 0-8.49M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2M16.24 7.76a6 6 0 0 1 0 8.49M19.07 4.93a10 10 0 0 1 0 14.14';

  // Extra sections of the existing app
  static const interventions = 'M9 3h6v3H9zM8 4.5H5V21h14V4.5h-3M9 13l2 2 4-4';
  static const planning = 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5M8 14h3v3H8z';
  static const signature = 'M3 17c3-1 4-6 6-6s1 5 3 5 3-3 4-3 2 2 5 2M3 21h18';

  // UI
  static const clock = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 7v5l3 2';
  static const check = 'M5 12.5l4.5 4.5L19 7';
  static const euro = 'M17 6a6 6 0 1 0 0 12M4 10h9M4 14h9';
  static const bell =
      'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0';
  static const search = 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.35-4.35';
  static const arrowRight = 'M5 12h14M13 6l6 6-6 6';
  static const chevronRight = 'M9 6l6 6-6 6';
  static const back = 'M15 18l-6-6 6-6';
  static const mail = 'M3 6h18v12H3zM3 7l9 7 9-7';
  static const lock = 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3';
  static const eye =
      'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6';
  static const eyeOff =
      'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2';
  static const plus = 'M12 5v14M5 12h14';
  static const sparkle =
      'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z';
  static const pin =
      'M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5';
  static const menu = 'M4 6h16M4 12h16M4 18h10';
  static const close = 'M6 6l12 12M18 6L6 18';
  static const alert = 'M12 3l10 18H2zM12 10v4.5M12 17.5h.01';
  static const send = 'M22 2L11 13M22 2l-7 20-4-9-9-4z';
  static const file = 'M6 2h9l5 5v15H6zM14 2v6h6';
  static const user = profil;
  static const key =
      'M15 9a4 4 0 1 1-3.5 6L5 21H3v-2l1-1h2v-2h2l3.5-3.5A4 4 0 0 1 15 9zM16 8h.01';
  static const hardHat = 'M3 18h18M5 18v-3a7 7 0 0 1 14 0v3M10 8V5h4v3M12 5v4';
  static const sun =
      'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
  static const more = 'M5 12h.01M12 12h.01M19 12h.01';
  static const download = 'M12 3v12M7 10l5 5 5-5M4 21h16';
}

/// Renders a [KojiIcons] path, tinted with [color] (defaults to the ambient
/// [IconTheme] colour).
class KojiIcon extends StatelessWidget {
  const KojiIcon(
    this.path, {
    super.key,
    this.size = 18,
    this.color,
    this.strokeWidth = 1.8,
  });

  final String path;
  final double size;
  final Color? color;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? IconTheme.of(context).color ?? Colors.black;
    return SvgPicture.string(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
      'stroke="#000" stroke-width="$strokeWidth" stroke-linecap="round" '
      'stroke-linejoin="round"><path d="$path"/></svg>',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
    );
  }
}
