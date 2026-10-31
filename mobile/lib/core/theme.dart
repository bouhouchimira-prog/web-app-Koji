import 'package:flutter/material.dart';
import 'package:koji/core/responsive_helper.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/design/koji_tokens.dart';

/// Legacy theme helpers used across the existing screens. The values now come
/// from the koji web design ([KojiColors] / [KojiTheme]) so older screens pick
/// up the new look without being rewritten.
class AppTheme {
  static const Color primaryBlueLight = KojiColors.navy;
  static const Color primaryBlueDark = KojiColors.cream;
  static const Color primaryBlue = primaryBlueLight;

  static const Color darkNavy = KojiColors.navy;
  static const Color textDark = KojiColors.ink;
  static const Color textLight = KojiColors.muted;
  static const Color backgroundLight = Color(0xFFFFFFFF);
  static const Color background = backgroundLight;
  static const Color cream = KojiColors.pageEntreprise;
  static const Color backgroundDark = KojiColors.darkPage;
  static const Color surfaceDark = KojiColors.darkSurface;
  static const Color cardDark = KojiColors.darkSurfaceMuted;
  static const Color dividerDark = KojiColors.darkLine;
  static const Color textOnDark = KojiColors.darkInk;
  static const Color textSecondaryDark = KojiColors.darkMuted;

  static TextStyle defaultTextStyle({FontWeight? fontWeight}) {
    return TextStyle(
      fontFamily: KojiTheme.fontFamily,
      fontWeight: fontWeight ?? FontWeight.normal,
    );
  }

  static TextStyle headingStyle(BuildContext context) {
    return TextStyle(
      fontFamily: KojiTheme.fontFamily,
      fontSize: context.responsive.fontSize(28),
      fontWeight: FontWeight.w800,
      color: context.koji.heading,
      height: 1.2,
    );
  }

  static TextStyle bodyStyle(BuildContext context) {
    return TextStyle(
      fontFamily: KojiTheme.fontFamily,
      fontSize: context.responsive.fontSize(16),
      color: context.koji.muted,
      height: 1.5,
    );
  }

  static TextStyle buttonTextStyle(BuildContext context) => TextStyle(
        fontFamily: KojiTheme.fontFamily,
        fontSize: context.responsive.fontSize(16),
        fontWeight: FontWeight.w700,
        color: Colors.white,
      );

  static bool isDark(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark;

  static Color surface(BuildContext context) =>
      Theme.of(context).colorScheme.surface;

  static Color backgroundColor(BuildContext context) =>
      Theme.of(context).scaffoldBackgroundColor;

  static Color textPrimary(BuildContext context) =>
      Theme.of(context).colorScheme.onSurface;

  static Color textSecondary(BuildContext context) => context.koji.muted;

  static Color borderColor(BuildContext context) => context.koji.line;

  static Color mutedSurface(BuildContext context) => context.koji.surfaceMuted;

  static Color headerBackground(BuildContext context) => context.koji.topband;

  static ThemeData lightThemeData(BuildContext context) => KojiTheme.light();

  static ThemeData darkThemeData(BuildContext context) => KojiTheme.dark();

  static ThemeData themeData(BuildContext context) => lightThemeData(context);
}
