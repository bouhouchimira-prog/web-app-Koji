import 'package:flutter/material.dart';

/// New Koji Pro art direction (mockup PRO-01 « Accueil », v0.2): graphite ink,
/// one yellow per zone, hairline cards with a 2 px graphite top rule, DM Sans
/// with tabular figures. Light by default; the mockup's dark proposal when the
/// app is in dark mode.
@immutable
class ProDa {
  const ProDa._({
    required this.page,
    required this.card,
    required this.ink,
    required this.grey,
    required this.line,
    required this.frame,
    required this.rule,
    required this.soft,
    required this.seg,
    required this.segOn,
    required this.pill,
    required this.fill,
    required this.onFill,
  });

  final Color page;
  final Color card;
  final Color ink;
  final Color grey;
  final Color line;
  final Color frame;
  final Color rule;
  final Color soft;
  final Color seg;
  final Color segOn;
  final Color pill;

  /// Solid status (« Bloquant », numbered markers, counters).
  final Color fill;
  final Color onFill;

  static const prim = Color(0xFFFFC400);
  static const onPrim = Color(0xFF171B1E);
  static const font = 'DMSans';

  static const light = ProDa._(
    page: Color(0xFFECECE7),
    card: Color(0xFFFFFFFF),
    ink: Color(0xFF171B1E),
    grey: Color(0xFF5B5F66),
    line: Color(0xFFD9D9D4),
    frame: Color(0xFFCFCFC9),
    rule: Color(0xFFE3E3DE),
    soft: Color(0xFFF5F5F2),
    seg: Color(0xFFE2E2DB),
    segOn: Color(0xFFBDBDB4),
    pill: Color(0xFFE6E6E0),
    fill: Color(0xFF171B1E),
    onFill: Color(0xFFFFFFFF),
  );

  static const dark = ProDa._(
    page: Color(0xFF121518),
    card: Color(0xFF1A1E23),
    ink: Color(0xFFF5F5F2),
    grey: Color(0xFFA7ABB2),
    line: Color(0xFF2E333A),
    frame: Color(0xFF2E333A),
    rule: Color(0xFF2A2F35),
    soft: Color(0xFF1F252B),
    seg: Color(0xFF1F252B),
    segOn: Color(0xFF3A4048),
    pill: Color(0xFF2A3036),
    fill: Color(0xFFF5F5F2),
    onFill: Color(0xFF0B0D0F),
  );

  static ProDa of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? dark : light;

  TextStyle text(
    double size, {
    FontWeight weight = FontWeight.w400,
    Color? color,
    double? height,
    double? letterSpacing,
  }) =>
      TextStyle(
        fontFamily: font,
        fontSize: size,
        fontWeight: weight,
        color: color ?? ink,
        height: height,
        letterSpacing: letterSpacing,
        fontFeatures: const [FontFeature.tabularFigures()],
      );
}

/// White card, hairline frame, 2 px graphite rule on top.
class ProCard extends StatelessWidget {
  const ProCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(14, 12, 14, 4),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: da.card,
        border: Border(
          top: BorderSide(color: da.ink, width: 2),
          left: BorderSide(color: da.frame),
          right: BorderSide(color: da.frame),
          bottom: BorderSide(color: da.frame),
        ),
      ),
      child: child,
    );
  }
}

/// Card title with its optional counter box and a link on the right.
class ProCardHeader extends StatelessWidget {
  const ProCardHeader({
    super.key,
    required this.title,
    this.count,
    this.action,
  });

  final String title;
  final int? count;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      padding: const EdgeInsets.only(bottom: 10),
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: da.rule)),
      ),
      child: Row(
        children: [
          Flexible(
            child: Text(title,
                style: da.text(17, weight: FontWeight.w700),
                overflow: TextOverflow.ellipsis),
          ),
          if (count != null && count! > 0) ...[
            const SizedBox(width: 8),
            Container(
              constraints: const BoxConstraints(minWidth: 22),
              height: 22,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              alignment: Alignment.center,
              decoration: BoxDecoration(border: Border.all(color: da.ink)),
              child: Text('$count',
                  style: da.text(12, weight: FontWeight.w700, height: 1)),
            ),
          ],
          const Spacer(),
          if (action != null) action!,
        ],
      ),
    );
  }
}

/// Small grey pill used for « Plein écran », « Tout voir »…
class ProPill extends StatelessWidget {
  const ProPill({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Material(
      color: da.pill,
      borderRadius: BorderRadius.circular(2),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(2),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: Text(label, style: da.text(13, weight: FontWeight.w600)),
        ),
      ),
    );
  }
}

enum ProTagTone {
  /// Solid: « Bloquant ».
  solid,

  /// Graphite outline: « Échéance », « Aujourd'hui », « À répondre ».
  ink,

  /// Grey outline: « À relancer », « Brouillon ».
  grey,
}

class ProTag extends StatelessWidget {
  const ProTag(this.label, {super.key, this.tone = ProTagTone.ink});

  final String label;
  final ProTagTone tone;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final solid = tone == ProTagTone.solid;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: solid ? da.fill : null,
        border: Border.all(
          color: solid
              ? da.fill
              : tone == ProTagTone.grey
                  ? da.grey
                  : da.ink,
        ),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Text(
        label,
        style: da.text(12,
            weight: solid ? FontWeight.w600 : FontWeight.w500,
            color: solid ? da.onFill : da.ink),
      ),
    );
  }
}

/// The one yellow button of a zone.
class ProPrimaryButton extends StatelessWidget {
  const ProPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = 48,
    this.expand = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 18, color: ProDa.onPrim),
          const SizedBox(width: 8),
        ],
        Flexible(
          child: Text(label,
              overflow: TextOverflow.ellipsis,
              style: da.text(15, weight: FontWeight.w600, color: ProDa.onPrim)),
        ),
      ],
    );
    return Opacity(
      opacity: onPressed == null ? 0.45 : 1,
      child: Material(
        color: ProDa.prim,
        borderRadius: BorderRadius.circular(2),
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(2),
          child: SizedBox(
            height: height,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 22),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// Segmented filter (« Tous 4 · Nouveaux 3 · Positions prises 1 »).
class ProSegmented<T> extends StatelessWidget {
  const ProSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final List<(T, String, int)> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: da.seg,
        borderRadius: BorderRadius.circular(2),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final (key, label, count) in options)
              GestureDetector(
                onTap: () => onChanged(key),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: 32,
                  margin: const EdgeInsets.only(right: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  alignment: Alignment.center,
                  decoration: key == value
                      ? BoxDecoration(
                          color: da.card,
                          border: Border.all(color: da.segOn),
                          borderRadius: BorderRadius.circular(2),
                        )
                      : null,
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: label),
                      // Compteur négatif = pas de compteur (sélecteur de période).
                      if (count >= 0)
                        TextSpan(
                          text: '  $count',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                    ]),
                    style: da.text(13,
                        weight:
                            key == value ? FontWeight.w700 : FontWeight.w600,
                        color: key == value ? da.ink : da.grey),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Numbered marker of a Radar row; outlined once the position is taken.
class ProNumber extends StatelessWidget {
  const ProNumber(this.n, {super.key, this.done = false});

  final int n;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      width: 24,
      height: 24,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done ? da.card : da.fill,
        border: done ? Border.all(color: da.ink, width: 1.5) : null,
      ),
      child: Text('$n',
          style: da.text(12,
              weight: FontWeight.w700, color: done ? da.ink : da.onFill)),
    );
  }
}
