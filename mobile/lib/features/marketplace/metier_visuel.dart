import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Port of lib/metier-visuel.jsx — same colors, same matching order, same
/// pictograms (as raw SVG inner markup, since a couple mix several shapes
/// and don't fit KojiIcon's single-`<path>` renderer).
class MetierVisuel {
  const MetierVisuel(this.color, this.svgInner);
  final Color color;
  final String svgInner;
}

final List<(RegExp, MetierVisuel)> _metiersVisuel = [
  (
    RegExp('plomb|chauffe|sanitaire', caseSensitive: false),
    const MetierVisuel(
      Color(0xFF2F6FB5),
      '<path d="M12 2.5s6.5 7.2 6.5 11.8a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.5 12 2.5z"/>',
    ),
  ),
  (
    RegExp('[ée]lectri', caseSensitive: false),
    const MetierVisuel(
      Color(0xFFD99A1E),
      '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    ),
  ),
  (
    RegExp('serrur', caseSensitive: false),
    const MetierVisuel(
      Color(0xFF6B5BB5),
      '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    ),
  ),
  (
    RegExp('peint', caseSensitive: false),
    const MetierVisuel(
      Color(0xFFC0567A),
      '<rect x="3" y="3" width="15" height="6" rx="1"/>'
          '<path d="M18 6h2v5h-9v3M10 14h2v7h-2z"/>',
    ),
  ),
  (
    RegExp('carrel|fa[iï]ence', caseSensitive: false),
    const MetierVisuel(
      Color(0xFF1F8A7A),
      '<rect x="3" y="3" width="8" height="8"/>'
          '<rect x="13" y="3" width="8" height="8"/>'
          '<rect x="3" y="13" width="8" height="8"/>'
          '<rect x="13" y="13" width="8" height="8"/>',
    ),
  ),
  (
    RegExp('ma[çc]on|b[ée]ton|gros', caseSensitive: false),
    const MetierVisuel(
      Color(0xFFA0673A),
      '<rect x="2" y="4" width="20" height="16"/>'
          '<path d="M2 10h20M2 16h20M12 4v6M7 10v6M17 10v6M12 16v4"/>',
    ),
  ),
  (
    RegExp('menuis|bois', caseSensitive: false),
    const MetierVisuel(
      Color(0xFF8A6A3A),
      '<path d="M3 21 14 10"/><path d="m13 5 6 6-3 3-6-6z"/>',
    ),
  ),
];

const MetierVisuel _metierVisuelDefaut = MetierVisuel(
  Color(0xFF172549),
  '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
);

MetierVisuel metierVisuel(String? metier) {
  final value = metier ?? '';
  for (final (match, visuel) in _metiersVisuel) {
    if (match.hasMatch(value)) return visuel;
  }
  return _metierVisuelDefaut;
}

/// Round, colored métier pictogram ("ct-offer-metier-badge" on the web).
class MetierBadge extends StatelessWidget {
  const MetierBadge({super.key, required this.metier, this.size = 36});

  final String? metier;
  final double size;

  @override
  Widget build(BuildContext context) {
    final visuel = metierVisuel(metier);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: visuel.color, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: SvgPicture.string(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
        'stroke="#fff" stroke-width="1.8" stroke-linecap="round" '
        'stroke-linejoin="round">${visuel.svgInner}</svg>',
        width: size * 0.5,
        height: size * 0.5,
      ),
    );
  }
}
