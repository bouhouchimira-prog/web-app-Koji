/// Base URL of koji-web (the Next.js app), used as the real backend for
/// everything the Marketplace needs that already exists there (assistant IA,
/// pricing, Stripe escrow) rather than re-implementing it in Dart. See
/// memory/MEMORY.md for the architecture note behind this choice.
abstract final class KojiWebApiConfig {
  // Overridable at build/run time:
  //   flutter run --dart-define=KOJI_WEB_BASE_URL=https://getkoji.io
  static const String _override = String.fromEnvironment(
    'KOJI_WEB_BASE_URL',
  );

  static String get baseUrl =>
      _override.isNotEmpty ? _override : 'https://getkoji.io';
}
