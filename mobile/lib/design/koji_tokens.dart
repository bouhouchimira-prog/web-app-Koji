import 'package:flutter/material.dart';

/// Raw colour values taken from the koji web design canvas
/// ("koji — Dashboards des outils"). Screens should read colours through
/// [KojiPalette] (`context.koji`) so they follow light / dark mode; these
/// constants are the brand values both palettes are built from.
abstract final class KojiColors {
  // ── Brand ──
  static const navy = Color(0xFF16233F);
  static const navyDeep = Color(0xFF0B1530);
  static const navySoft = Color(0xFF1D2F57);
  static const cream = Color(0xFFE8DCCB);
  static const sand = Color(0xFFF3EEE6);
  static const gold = Color(0xFFE6B94F);
  static const goldDeep = Color(0xFFCB9A2E);
  static const goldText = Color(0xFF8F6A12);

  // ── Surfaces & lines ──
  static const pageEntreprise = Color(0xFFF6F7FB);
  static const pageClient = Color(0xFFF6F4F0);
  static const line = Color(0xFFEDEDF3);
  static const lineSoft = Color(0xFFF1F2F6);
  static const lineStrong = Color(0xFFDADDE6);
  static const fieldLine = Color(0xFFE5E5EC);
  static const warmLine = Color(0xFFECE8E1);

  // ── Text ──
  static const ink = Color(0xFF1E2430);
  static const inkSoft = Color(0xFF3C4660);
  static const muted = Color(0xFF6B7280);
  static const faint = Color(0xFF9C9FB0);
  static const onNavyMuted = Color(0xFFAEB4C4);

  // ── Navigation ──
  static const navActive = Color(0xFFEDEFFB);

  // ── Tones (foreground / background) ──
  static const green = Color(0xFF1E8E5A);
  static const greenBg = Color(0xFFE6F5EE);
  static const amber = Color(0xFFB7791F);
  static const amberBg = Color(0xFFFDF3DC);
  static const coral = Color(0xFFC4452D);
  static const coralBg = Color(0xFFFBE9E5);
  static const coralDot = Color(0xFFE5654B);
  static const info = Color(0xFF3B5BDB);
  static const infoBg = Color(0xFFE8ECFD);
  static const greyBg = Color(0xFFF0F1F5);
  static const premium = Color(0xFF8A5A00);
  static const premiumBg = Color(0xFFFDF0CF);

  // ── Dark mode bases (kept from the previous app theme) ──
  static const darkPage = Color(0xFF0F1117);
  static const darkSurface = Color(0xFF1A1D26);
  static const darkSurfaceMuted = Color(0xFF222633);
  static const darkLine = Color(0xFF2D3142);
  static const darkInk = Color(0xFFE5E7EB);
  static const darkMuted = Color(0xFF9CA3AF);
}

/// Semantic tone used by status pills, KPI tiles and alert boxes.
enum KojiTone { navy, green, amber, coral, info, grey }

/// Layout breakpoints. At [wide] and above the apps switch to the web layout
/// from the design (navy top band + fixed side menu).
abstract final class KojiBreakpoints {
  static const double wide = 1024;
  static const double medium = 720;

  static bool isWide(BuildContext context) =>
      MediaQuery.sizeOf(context).width >= wide;
}

/// Theme-aware colours. Registered on both koji themes as a [ThemeExtension];
/// read it with `context.koji`.
@immutable
class KojiPalette extends ThemeExtension<KojiPalette> {
  const KojiPalette({
    required this.page,
    required this.surface,
    required this.surfaceMuted,
    required this.line,
    required this.lineSoft,
    required this.lineStrong,
    required this.ink,
    required this.inkSoft,
    required this.muted,
    required this.faint,
    required this.heading,
    required this.navActiveBg,
    required this.navActiveFg,
    required this.primary,
    required this.onPrimary,
    required this.topband,
    required this.isDark,
  });

  /// Page background behind cards.
  final Color page;
  final Color surface;
  final Color surfaceMuted;
  final Color line;
  final Color lineSoft;
  final Color lineStrong;
  final Color ink;
  final Color inkSoft;
  final Color muted;
  final Color faint;

  /// Titles and big numbers (navy in light mode).
  final Color heading;
  final Color navActiveBg;
  final Color navActiveFg;

  /// Main call-to-action fill.
  final Color primary;
  final Color onPrimary;
  final Color topband;
  final bool isDark;

  static KojiPalette light({required Color page}) => KojiPalette(
        page: page,
        surface: Colors.white,
        surfaceMuted: KojiColors.pageEntreprise,
        line: KojiColors.line,
        lineSoft: KojiColors.lineSoft,
        lineStrong: KojiColors.lineStrong,
        ink: KojiColors.ink,
        inkSoft: KojiColors.inkSoft,
        muted: KojiColors.muted,
        faint: KojiColors.faint,
        heading: KojiColors.navy,
        navActiveBg: KojiColors.navActive,
        navActiveFg: KojiColors.navy,
        primary: KojiColors.navy,
        onPrimary: Colors.white,
        topband: KojiColors.navy,
        isDark: false,
      );

  static const dark = KojiPalette(
    page: KojiColors.darkPage,
    surface: KojiColors.darkSurface,
    surfaceMuted: KojiColors.darkSurfaceMuted,
    line: KojiColors.darkLine,
    lineSoft: Color(0xFF262A36),
    lineStrong: Color(0xFF3A3F52),
    ink: KojiColors.darkInk,
    inkSoft: Color(0xFFC9CDD6),
    muted: KojiColors.darkMuted,
    faint: Color(0xFF7A7F8E),
    heading: Colors.white,
    navActiveBg: KojiColors.darkSurfaceMuted,
    navActiveFg: KojiColors.cream,
    primary: KojiColors.cream,
    onPrimary: KojiColors.navy,
    topband: KojiColors.navyDeep,
    isDark: true,
  );

  /// Foreground colour of a tone.
  Color toneFg(KojiTone tone) => switch (tone) {
        KojiTone.navy => isDark ? KojiColors.cream : KojiColors.navy,
        KojiTone.green => isDark ? const Color(0xFF4CC38A) : KojiColors.green,
        KojiTone.amber => isDark ? const Color(0xFFE2A94A) : KojiColors.amber,
        KojiTone.coral => isDark ? const Color(0xFFEF7A62) : KojiColors.coral,
        KojiTone.info => isDark ? const Color(0xFF8DA2F5) : KojiColors.info,
        KojiTone.grey => muted,
      };

  /// Soft background of a tone (pill fill, icon tile, alert box).
  Color toneBg(KojiTone tone) {
    if (isDark) return toneFg(tone).withValues(alpha: 0.16);
    return switch (tone) {
      KojiTone.navy => KojiColors.navActive,
      KojiTone.green => KojiColors.greenBg,
      KojiTone.amber => KojiColors.amberBg,
      KojiTone.coral => KojiColors.coralBg,
      KojiTone.info => KojiColors.infoBg,
      KojiTone.grey => KojiColors.greyBg,
    };
  }

  @override
  KojiPalette copyWith({Color? page}) => KojiPalette(
        page: page ?? this.page,
        surface: surface,
        surfaceMuted: surfaceMuted,
        line: line,
        lineSoft: lineSoft,
        lineStrong: lineStrong,
        ink: ink,
        inkSoft: inkSoft,
        muted: muted,
        faint: faint,
        heading: heading,
        navActiveBg: navActiveBg,
        navActiveFg: navActiveFg,
        primary: primary,
        onPrimary: onPrimary,
        topband: topband,
        isDark: isDark,
      );

  @override
  KojiPalette lerp(ThemeExtension<KojiPalette>? other, double t) {
    if (other is! KojiPalette) return this;
    Color mix(Color a, Color b) => Color.lerp(a, b, t)!;
    return KojiPalette(
      page: mix(page, other.page),
      surface: mix(surface, other.surface),
      surfaceMuted: mix(surfaceMuted, other.surfaceMuted),
      line: mix(line, other.line),
      lineSoft: mix(lineSoft, other.lineSoft),
      lineStrong: mix(lineStrong, other.lineStrong),
      ink: mix(ink, other.ink),
      inkSoft: mix(inkSoft, other.inkSoft),
      muted: mix(muted, other.muted),
      faint: mix(faint, other.faint),
      heading: mix(heading, other.heading),
      navActiveBg: mix(navActiveBg, other.navActiveBg),
      navActiveFg: mix(navActiveFg, other.navActiveFg),
      primary: mix(primary, other.primary),
      onPrimary: mix(onPrimary, other.onPrimary),
      topband: mix(topband, other.topband),
      isDark: t < 0.5 ? isDark : other.isDark,
    );
  }
}

extension KojiPaletteContext on BuildContext {
  /// The koji palette of the current theme (falls back to the light
  /// entreprise palette when a widget is built outside a koji theme).
  KojiPalette get koji =>
      Theme.of(this).extension<KojiPalette>() ??
      KojiPalette.light(page: KojiColors.pageEntreprise);
}
