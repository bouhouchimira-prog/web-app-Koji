import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';

/// White card with the hairline border and 18px radius used for every block
/// of the web design.
class KojiCard extends StatelessWidget {
  const KojiCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(22, 20, 22, 20),
    this.onTap,
    this.color,
    this.borderColor,
    this.radius = 18,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: borderColor ?? p.line),
    );
    return Material(
      color: color ?? p.surface,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}

/// Indicator tile: tinted icon + label, big number + small note.
class KojiKpi extends StatelessWidget {
  const KojiKpi({
    super.key,
    required this.label,
    required this.value,
    this.sub = '',
    this.tone = KojiTone.navy,
    this.icon = KojiIcons.comptabilite,
    this.onTap,
  });

  final String label;
  final String value;
  final String sub;
  final KojiTone tone;
  final String icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final fg = p.toneFg(tone);
    final subColor = tone == KojiTone.navy ? p.muted : fg;
    return KojiCard(
      radius: 16,
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      child: SizedBox(
        height: 80,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: p.toneBg(tone),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: KojiIcon(icon, size: 17, color: fg, strokeWidth: 1.9),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    // Two lines so phone-width tiles don't cut the label.
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.2,
                      fontWeight: FontWeight.w600,
                      color: p.muted,
                    ),
                  ),
                ),
              ],
            ),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                      color: p.heading,
                      height: 1.1,
                    ),
                  ),
                  if (sub.isNotEmpty) ...[
                    const SizedBox(width: 10),
                    Text(
                      sub,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: subColor,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Lays out KPI tiles four across on wide screens and two across below.
class KojiKpiRow extends StatelessWidget {
  const KojiKpiRow({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final perRow = c.maxWidth >= 860 ? children.length : 2;
      const gap = 16.0;
      // Floored so rounding never pushes the last tile onto a new line.
      final w = ((c.maxWidth - gap * (perRow - 1)) / perRow).floorToDouble();
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [for (final k in children) SizedBox(width: w, child: k)],
      );
    });
  }
}

/// Small rounded status label ("En cours", "Signé"…).
class KojiPill extends StatelessWidget {
  const KojiPill(this.label, {super.key, this.tone = KojiTone.info});

  final String label;
  final KojiTone tone;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: p.toneBg(tone),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        maxLines: 1,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: p.toneFg(tone),
          height: 1.2,
        ),
      ),
    );
  }
}

/// Page title + subtitle with optional actions on the right (wrapping under
/// the title on narrow screens).
class KojiPageHeader extends StatelessWidget {
  const KojiPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final narrow = MediaQuery.sizeOf(context).width < KojiBreakpoints.medium;
    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: narrow ? 22 : 26,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
            color: p.heading,
            height: 1.2,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle!, style: TextStyle(fontSize: 14, color: p.muted)),
        ],
      ],
    );
    if (actions.isEmpty) return heading;
    if (narrow) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          heading,
          const SizedBox(height: 14),
          Wrap(spacing: 10, runSpacing: 10, children: actions),
        ],
      );
    }
    return Row(
      children: [
        Expanded(child: heading),
        const SizedBox(width: 16),
        Wrap(spacing: 10, runSpacing: 10, children: actions),
      ],
    );
  }
}

/// Section title inside a card, with an optional trailing link.
class KojiSectionTitle extends StatelessWidget {
  const KojiSectionTitle(this.title, {super.key, this.action, this.onAction});

  final String title;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: p.heading,
            ),
          ),
        ),
        if (action != null)
          InkWell(
            onTap: onAction,
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              child: Text(
                action!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: p.isDark ? KojiColors.cream : KojiColors.info,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

enum KojiButtonVariant { primary, secondary, gold, light }

/// Button styles of the design: navy primary, outlined secondary, gold
/// highlight and a white variant for dark cards.
class KojiButton extends StatelessWidget {
  const KojiButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = KojiButtonVariant.primary,
    this.leadingIcon,
    this.trailingIcon,
    this.loading = false,
    this.expand = false,
    this.height = 44,
    this.dimWhenDisabled = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final KojiButtonVariant variant;
  final String? leadingIcon;
  final String? trailingIcon;
  final bool loading;
  final bool expand;
  final double height;

  /// False for purely decorative buttons (marketing illustrations).
  final bool dimWhenDisabled;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final enabled = onPressed != null && !loading;
    final (Color bg, Color fg, Color? border, Gradient? gradient) =
        switch (variant) {
      KojiButtonVariant.primary => (p.primary, p.onPrimary, null, null),
      KojiButtonVariant.secondary => (p.surface, p.heading, p.lineStrong, null),
      KojiButtonVariant.light => (Colors.white, KojiColors.navy, null, null),
      KojiButtonVariant.gold => (
          KojiColors.gold,
          KojiColors.navy,
          null,
          const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [KojiColors.gold, KojiColors.goldDeep],
          ),
        ),
    };

    final content = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: fg),
          )
        else ...[
          if (leadingIcon != null) ...[
            KojiIcon(leadingIcon!, size: 17, color: fg, strokeWidth: 2.2),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: height >= 52 ? 16 : 14,
                fontWeight: height >= 52 ? FontWeight.w800 : FontWeight.w700,
                color: fg,
              ),
            ),
          ),
          if (trailingIcon != null) ...[
            const SizedBox(width: 10),
            KojiIcon(trailingIcon!, size: 18, color: fg, strokeWidth: 2.2),
          ],
        ],
      ],
    );

    return Opacity(
      opacity: enabled || loading || !dimWhenDisabled ? 1 : 0.45,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          color: gradient == null ? bg : null,
          gradient: gradient,
          borderRadius: BorderRadius.circular(height >= 52 ? 14 : 12),
          border: border != null ? Border.all(color: border) : null,
          boxShadow: variant == KojiButtonVariant.gold
              ? [
                  BoxShadow(
                    color: KojiColors.goldDeep.withValues(alpha: 0.28),
                    blurRadius: 24,
                    offset: const Offset(0, 10),
                  ),
                ]
              : null,
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: enabled ? onPressed : null,
            borderRadius: BorderRadius.circular(height >= 52 ? 14 : 12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}

/// Labelled text field from the connexion pages (54px, 13px radius, icon).
class KojiField extends StatelessWidget {
  const KojiField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.icon,
    this.obscure = false,
    this.suffix,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.autofillHints,
    this.helper,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final String? icon;
  final bool obscure;
  final Widget? suffix;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Iterable<String>? autofillHints;
  final String? helper;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: p.heading,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          autofillHints: autofillHints,
          maxLines: obscure ? 1 : maxLines,
          style: TextStyle(fontSize: 15, color: p.ink),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: icon == null
                ? null
                : Padding(
                    padding: const EdgeInsets.only(left: 16, right: 12),
                    child: KojiIcon(icon!, size: 19, color: p.faint),
                  ),
            prefixIconConstraints:
                const BoxConstraints(minWidth: 0, minHeight: 0),
            suffixIcon: suffix,
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: 6),
          Text(helper!, style: TextStyle(fontSize: 12.5, color: p.muted)),
        ],
      ],
    );
  }
}

/// Two-option switch on a sand track ("Connexion | Créer un compte").
class KojiSegmented<T> extends StatelessWidget {
  const KojiSegmented({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
    this.compact = false,
  });

  final Map<T, String> options;
  final T value;
  final ValueChanged<T> onChanged;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      padding: EdgeInsets.all(compact ? 4 : 5),
      decoration: BoxDecoration(
        color: p.isDark ? p.surfaceMuted : KojiColors.sand,
        borderRadius: BorderRadius.circular(compact ? 13 : 15),
      ),
      child: Row(
        children: [
          for (final e in options.entries)
            Expanded(
              child: GestureDetector(
                onTap: () => onChanged(e.key),
                behavior: HitTestBehavior.opaque,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: compact ? 36 : 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: e.key == value ? p.surface : Colors.transparent,
                    borderRadius: BorderRadius.circular(compact ? 10 : 11),
                    boxShadow: e.key == value
                        ? [
                            BoxShadow(
                              color: KojiColors.navy.withValues(alpha: 0.10),
                              blurRadius: 8,
                              offset: const Offset(0, 2),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    e.value,
                    style: TextStyle(
                      fontSize: compact ? 13.5 : 15,
                      fontWeight:
                          e.key == value ? FontWeight.w800 : FontWeight.w700,
                      color: e.key == value ? p.heading : p.muted,
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

/// Row of rounded filter chips ("Tous · 3", "En cours · 1"…).
class KojiFilterChips<T> extends StatelessWidget {
  const KojiFilterChips({
    super.key,
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final Map<T, String> options;
  final T value;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final e in options.entries)
          InkWell(
            onTap: () => onChanged(e.key),
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: e.key == value ? p.primary : p.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: e.key == value ? p.primary : p.line,
                ),
              ),
              child: Text(
                e.value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: e.key == value ? p.onPrimary : p.muted,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Centered illustration-less empty state.
class KojiEmptyState extends StatelessWidget {
  const KojiEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.icon = KojiIcons.file,
    this.action,
    this.compact = false,
  });

  final String title;
  final String? subtitle;
  final String icon;
  final Widget? action;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Padding(
      padding:
          EdgeInsets.symmetric(vertical: compact ? 18 : 36, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: compact ? 44 : 56,
            height: compact ? 44 : 56,
            decoration: BoxDecoration(
              color: p.navActiveBg,
              borderRadius: BorderRadius.circular(compact ? 13 : 16),
            ),
            alignment: Alignment.center,
            child: KojiIcon(icon, size: compact ? 20 : 24, color: p.heading),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: p.heading,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 6),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13.5, color: p.muted, height: 1.45),
            ),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/// Round avatar with initials.
class KojiAvatar extends StatelessWidget {
  const KojiAvatar(
    this.name, {
    super.key,
    this.size = 40,
    this.background,
    this.foreground,
  });

  final String name;
  final double size;
  final Color? background;
  final Color? foreground;

  static String initialsOf(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'[\s\-_@.]+'))
        .where((s) => s.isNotEmpty)
        .toList();
    if (parts.isEmpty) return 'K';
    if (parts.length == 1) {
      final w = parts.first;
      return w.substring(0, w.length >= 2 ? 2 : 1).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: background ?? p.navActiveBg,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initialsOf(name),
        style: TextStyle(
          fontSize: size * 0.33,
          fontWeight: FontWeight.w800,
          color: foreground ?? p.heading,
        ),
      ),
    );
  }
}

/// Thin rounded progress bar.
class KojiProgressBar extends StatelessWidget {
  const KojiProgressBar({
    super.key,
    required this.value,
    this.color,
    this.track,
    this.height = 8,
  });

  final double value;
  final Color? color;
  final Color? track;
  final double height;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(color: track ?? p.navActiveBg),
            FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: value.clamp(0.0, 1.0),
              child: ColoredBox(color: color ?? p.heading),
            ),
          ],
        ),
      ),
    );
  }
}

/// Soft tinted box for alerts ("À surveiller").
class KojiAlertBox extends StatelessWidget {
  const KojiAlertBox({
    super.key,
    required this.title,
    required this.message,
    this.tone = KojiTone.amber,
    this.icon = KojiIcons.alert,
    this.onTap,
  });

  final String title;
  final String message;
  final KojiTone tone;
  final String icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Material(
      color: p.toneBg(tone),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KojiIcon(icon, size: 17, color: p.toneFg(tone), strokeWidth: 2),
              const SizedBox(width: 12),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '$title\n',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: p.toneFg(tone),
                        ),
                      ),
                      TextSpan(text: message),
                    ],
                  ),
                  style: TextStyle(fontSize: 13, height: 1.45, color: p.ink),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dark navy call-to-action card used at the bottom of side columns.
class KojiPromoCard extends StatelessWidget {
  const KojiPromoCard({
    super.key,
    required this.eyebrow,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final String eyebrow;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 20),
      decoration: BoxDecoration(
        color: KojiColors.navy,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            eyebrow.toUpperCase(),
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
              color: KojiColors.onNavyMuted,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              height: 1.45,
              color: Colors.white,
            ),
          ),
          if (actionLabel != null) ...[
            const SizedBox(height: 12),
            KojiButton(
              label: actionLabel!,
              onPressed: onAction,
              variant: KojiButtonVariant.light,
              height: 42,
            ),
          ],
        ],
      ),
    );
  }
}

/// The koji mark (brand SVG asset) with the "Koji" word next to it.
class KojiLogo extends StatelessWidget {
  const KojiLogo({
    super.key,
    this.size = 32,
    this.markColor = KojiColors.cream,
    this.wordColor,
    this.showWord = true,
    this.subtitle,
    this.subtitleColor,
    this.wordSize,
  });

  final double size;
  final Color markColor;
  final Color? wordColor;
  final bool showWord;
  final String? subtitle;
  final Color? subtitleColor;
  final double? wordSize;

  @override
  Widget build(BuildContext context) {
    final mark = SvgPicture.asset(
      'assets/icons/LOGO.svg',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(markColor, BlendMode.srcIn),
    );
    if (!showWord) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: size * 0.36),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Koji',
              style: TextStyle(
                fontSize: wordSize ?? size * 0.62,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                height: 1.15,
                color: wordColor ?? context.koji.heading,
              ),
            ),
            if (subtitle != null)
              Text(
                subtitle!,
                style: TextStyle(
                  fontSize: 12,
                  height: 1.2,
                  color: subtitleColor ?? context.koji.muted,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

/// Formats an amount the French way: "184 500 €".
String kojiEuro(num value, {bool cents = false}) {
  final negative = value < 0;
  final abs = value.abs();
  final whole = cents ? abs.truncate() : abs.round();
  final digits = whole.toString();
  final buf = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    // No-break space between thousands.
    if (i > 0 && (digits.length - i) % 3 == 0) buf.write(' ');
    buf.write(digits[i]);
  }
  var out = buf.toString();
  if (cents) {
    final c = ((abs - whole) * 100).round().toString().padLeft(2, '0');
    out = '$out,$c';
  }
  return '${negative ? '-' : ''}$out €';
}
