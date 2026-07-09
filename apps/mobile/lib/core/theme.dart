import 'package:flutter/material.dart';

/// Brand palette — matches the web admin panel.
class Brand {
  static const emerald = Color(0xFF047857);
  static const emeraldLight = Color(0xFF10B981);
  static const gold = Color(0xFFB8860B);
  static const goldLight = Color(0xFFD4A422);

  static const excellent = Color(0xFF059669);
  static const veryGood = Color(0xFF10B981);
  static const good = Color(0xFF84CC16);
  static const fair = Color(0xFFF59E0B);
  static const poor = Color(0xFFEF4444);

  static const present = Color(0xFF10B981);
  static const absent = Color(0xFFEF4444);
  static const sick = Color(0xFFF59E0B);
  static const permission = Color(0xFF64748B);
}

ThemeData _base(ColorScheme scheme) {
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 1,
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      titleTextStyle: TextStyle(
        color: scheme.onSurface,
        fontSize: 20,
        fontWeight: FontWeight.w700,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.4),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: scheme.primary, width: 1.6),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    chipTheme: ChipThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      side: BorderSide(color: scheme.outlineVariant),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1, thickness: 1),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
    ),
  );
}

ThemeData buildLightTheme() => _base(
      ColorScheme.fromSeed(
        seedColor: Brand.emerald,
        brightness: Brightness.light,
      ).copyWith(primary: Brand.emerald, secondary: Brand.gold),
    );

ThemeData buildDarkTheme() => _base(
      ColorScheme.fromSeed(
        seedColor: Brand.emerald,
        brightness: Brightness.dark,
      ).copyWith(primary: Brand.emeraldLight, secondary: Brand.goldLight),
    );
