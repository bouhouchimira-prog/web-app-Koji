import 'package:flutter/material.dart';

/// Helper class for responsive sizing across different screen sizes
/// All sizes are calculated as percentages of screen dimensions
/// OPTIMIZED: Caches MediaQuery values to avoid repeated lookups
class ResponsiveHelper {
  final double _screenWidth;
  final double _screenHeight;
  final double _widthScaleFactor;
  final double _avgScaleFactor;

  // Scaling is designed around phone widths. Past a large phone the factors
  // stop growing, otherwise tablets / the web layout render text and icons
  // several times too big.
  static const double _maxScaledWidth = 430;
  static const double _maxScaledHeight = 932;

  ResponsiveHelper._(this._screenWidth, this._screenHeight)
      : _widthScaleFactor =
            (_screenWidth > _maxScaledWidth ? _maxScaledWidth : _screenWidth) /
                375,
        _avgScaleFactor = (((_screenWidth > _maxScaledWidth
                        ? _maxScaledWidth
                        : _screenWidth) +
                    (_screenHeight > _maxScaledHeight
                        ? _maxScaledHeight
                        : _screenHeight)) /
                2) /
            375;

  factory ResponsiveHelper(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    return ResponsiveHelper._(size.width, size.height);
  }

  /// Get screen width (cached)
  double get screenWidth => _screenWidth;

  /// Get screen height (cached)
  double get screenHeight => _screenHeight;

  /// Calculate width as percentage of screen width
  /// Example: width(5) returns 5% of screen width
  double width(double percentage) {
    return _screenWidth * (percentage / 100);
  }

  /// Calculate height as percentage of screen height
  /// Example: height(10) returns 10% of screen height
  double height(double percentage) {
    return _screenHeight * (percentage / 100);
  }

  /// Calculate responsive font size based on screen width
  /// Base size is for a 375px wide screen (iPhone SE/standard)
  double fontSize(double baseSize) {
    return baseSize * _widthScaleFactor;
  }

  /// Calculate responsive spacing based on screen dimensions
  /// Uses average of width and height for balanced scaling
  double spacing(double baseSize) {
    return baseSize * _avgScaleFactor;
  }

  /// Calculate responsive border radius
  double borderRadius(double baseSize) {
    return baseSize * _widthScaleFactor;
  }

  /// Calculate responsive icon size
  double iconSize(double baseSize) {
    return baseSize * _widthScaleFactor;
  }

  /// Get responsive padding - horizontal as % of width, vertical as % of height
  EdgeInsets paddingSymmetric({
    double horizontalPercent = 0,
    double verticalPercent = 0,
  }) {
    return EdgeInsets.symmetric(
      horizontal: width(horizontalPercent),
      vertical: height(verticalPercent),
    );
  }

  /// Get responsive padding - all sides as % of width
  EdgeInsets paddingAll(double percentage) {
    return EdgeInsets.all(width(percentage));
  }

  /// Get responsive padding with individual percentages
  EdgeInsets paddingOnly({
    double left = 0,
    double top = 0,
    double right = 0,
    double bottom = 0,
  }) {
    return EdgeInsets.only(
      left: width(left),
      top: height(top),
      right: width(right),
      bottom: height(bottom),
    );
  }
}

/// Extension to easily access ResponsiveHelper from BuildContext
extension ResponsiveExtension on BuildContext {
  ResponsiveHelper get responsive => ResponsiveHelper(this);
}
