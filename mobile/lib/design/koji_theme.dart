import 'package:flutter/material.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_tokens.dart';

/// Material themes for both koji apps. Koji (client) keeps Plus Jakarta Sans,
/// navy actions and rounded cards; Koji Pro (entreprise) follows the website's
/// Koji Pro art direction (app/home-pro.css): DM Sans, graphite, yellow
/// reserved for the main action, 2 px corners everywhere.
abstract final class KojiTheme {
  /// Bundled font families (declared in pubspec.yaml).
  static const fontFamily = 'PlusJakartaSans';
  static const proFontFamily = 'DMSans';

  static bool _isPro(KojiAppKind? kind) => (kind ?? KojiAppConfig.kind) == KojiAppKind.entreprise;

  static ThemeData light([KojiAppKind? kind]) {
    if (_isPro(kind)) return _build(KojiPalette.pro, Brightness.light, pro: true);
    return _build(
      KojiPalette.light(page: KojiColors.pageClient),
      Brightness.light,
    );
  }

  static ThemeData dark([KojiAppKind? kind]) => _isPro(kind)
      ? _build(KojiPalette.proDark, Brightness.dark, pro: true)
      : _build(KojiPalette.dark, Brightness.dark);

  static ThemeData _build(KojiPalette p, Brightness brightness, {bool pro = false}) {
    final family = pro ? proFontFamily : fontFamily;
    final base = ThemeData(
      brightness: brightness,
      useMaterial3: true,
      fontFamily: family,
    );
    final textTheme =
        base.textTheme.apply(bodyColor: p.ink, displayColor: p.heading);

    TextStyle font(double size, FontWeight weight, Color color) => TextStyle(
        fontFamily: family,
        fontSize: size,
        fontWeight: weight,
        color: color);

    // Koji Pro : 2 px partout, comme le site (--radius).
    double r(double legacy) => pro ? 2 : legacy;
    final accent = pro ? p.heading : (p.isDark ? KojiColors.cream : KojiColors.navy);
    // Koji Pro : le jaune est réservé à l'action principale ; onglets, puces,
    // cases et interrupteurs sélectionnés sont graphite.
    final selection = pro ? p.heading : p.primary;
    final onSelection = pro ? p.surface : p.onPrimary;

    final fieldBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(r(13)),
      borderSide: BorderSide(color: pro ? KojiColors.proBtn : (p.isDark ? p.line : KojiColors.fieldLine)),
    );

    final scheme = ColorScheme.fromSeed(
      seedColor: KojiColors.navy,
      brightness: brightness,
    ).copyWith(
      primary: p.primary,
      onPrimary: p.onPrimary,
      secondary: pro ? p.heading : (p.isDark ? KojiColors.cream : KojiColors.goldText),
      onSecondary: pro ? p.surface : (p.isDark ? KojiColors.navy : Colors.white),
      surface: p.surface,
      onSurface: p.ink,
      outline: p.lineStrong,
      outlineVariant: p.line,
      error: p.toneFg(KojiTone.coral),
    );

    return base.copyWith(
      colorScheme: scheme,
      primaryColor: p.primary,
      scaffoldBackgroundColor: p.page,
      canvasColor: p.surface,
      textTheme: textTheme,
      extensions: [p],
      dividerColor: p.line,
      dividerTheme: DividerThemeData(color: p.line, thickness: 1, space: 1),
      iconTheme: IconThemeData(color: p.heading),
      appBarTheme: AppBarTheme(
        backgroundColor: p.page,
        foregroundColor: p.heading,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: font(18, FontWeight.w800, p.heading),
        iconTheme: IconThemeData(color: p.heading),
      ),
      cardTheme: CardThemeData(
        color: p.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(r(18)),
          side: BorderSide(color: p.line),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.onPrimary,
          disabledBackgroundColor: p.lineStrong,
          disabledForegroundColor: p.faint,
          elevation: 0,
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(12))),
          textStyle: font(14, FontWeight.w700, p.onPrimary),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: p.primary,
          foregroundColor: p.onPrimary,
          minimumSize: const Size(0, 44),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(12))),
          textStyle: font(14, FontWeight.w700, p.onPrimary),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: p.heading,
          backgroundColor: p.surface,
          side: BorderSide(color: p.lineStrong),
          minimumSize: const Size(0, 44),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(12))),
          textStyle: font(14, FontWeight.w700, p.heading),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: accent,
          textStyle: font(14, FontWeight.w700, p.heading),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: p.primary,
        foregroundColor: p.onPrimary,
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(16))),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: p.surface,
        hintStyle: font(15, FontWeight.w400, p.faint),
        labelStyle: font(14, FontWeight.w600, p.muted),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: fieldBorder,
        enabledBorder: fieldBorder,
        focusedBorder: fieldBorder.copyWith(
          borderSide: BorderSide(color: p.heading, width: 1.5),
        ),
        errorBorder: fieldBorder.copyWith(
          borderSide: BorderSide(color: p.toneFg(KojiTone.coral)),
        ),
      ),
      checkboxTheme: CheckboxThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(6))),
        side: BorderSide(color: p.lineStrong, width: 1.5),
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? selection : null,
        ),
        checkColor: WidgetStatePropertyAll(onSelection),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? onSelection : p.surface,
        ),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? selection : p.lineStrong,
        ),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: p.heading,
        linearTrackColor: p.navActiveBg,
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: onSelection,
        unselectedLabelColor: p.muted,
        dividerColor: Colors.transparent,
        labelStyle: font(13, FontWeight.w700, onSelection),
        unselectedLabelStyle: font(13, FontWeight.w600, p.muted),
        indicator: BoxDecoration(
          color: selection,
          borderRadius: BorderRadius.circular(r(10)),
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: p.surface,
        selectedColor: selection,
        side: BorderSide(color: p.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(18))),
        labelStyle: font(13, FontWeight.w600, p.muted),
      ),
      listTileTheme: ListTileThemeData(
        iconColor: p.muted,
        textColor: p.ink,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      ),
      drawerTheme: DrawerThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(r(24))),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(18))),
        titleTextStyle: font(18, FontWeight.w800, p.heading),
        contentTextStyle: font(14, FontWeight.w400, p.inkSoft),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: p.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(r(12)),
          side: BorderSide(color: p.line),
        ),
        textStyle: font(14, FontWeight.w600, p.ink),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: pro
            ? KojiColors.proGraphite
            : (p.isDark ? KojiColors.darkSurfaceMuted : KojiColors.navy),
        contentTextStyle: font(14, FontWeight.w600, Colors.white),
        actionTextColor: pro ? KojiColors.proYellow : KojiColors.gold,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(r(12))),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: p.surface,
        surfaceTintColor: Colors.transparent,
        indicatorColor: p.navActiveBg,
        height: 66,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (s) => font(
            11.5,
            s.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
            s.contains(WidgetState.selected) ? p.navActiveFg : p.muted,
          ),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: p.surface,
        selectedItemColor: p.navActiveFg,
        unselectedItemColor: p.muted,
      ),
    );
  }
}
