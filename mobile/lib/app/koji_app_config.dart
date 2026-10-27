/// Which of the two koji apps is running. Set once by the entrypoint
/// (`main_client.dart` / `main_entreprise.dart`) before `runApp`, and read by
/// the few shared screens (splash, connexion) that behave differently per app.
enum KojiAppKind { client, entreprise }

abstract final class KojiAppConfig {
  static KojiAppKind _kind = KojiAppKind.entreprise;

  static KojiAppKind get kind => _kind;
  static bool get isClient => _kind == KojiAppKind.client;
  static bool get isEntreprise => _kind == KojiAppKind.entreprise;

  static void use(KojiAppKind kind) => _kind = kind;

  /// Store / window title.
  static String get appName => isClient ? 'Koji' : 'Koji Pro';

  /// Subtitle shown under the logo in the top band and the menus.
  static String get espaceLabel =>
      isClient ? 'Espace particulier' : 'Espace entreprise';

  /// Value the auth layer stores in `users.is_pro` for this app.
  static bool get isPro => isEntreprise;

  /// Legacy `?type=` value still understood by the auth providers.
  static String get loginType => isClient ? 'particulier' : 'entreprise';

  /// Optional links to the *other* app, shown on the connexion page
  /// ("Vous êtes une entreprise ?"). Pass them at build time:
  ///   --dart-define=KOJI_PRO_URL=https://...
  ///   --dart-define=KOJI_CLIENT_URL=https://...
  static const _proUrl = String.fromEnvironment('KOJI_PRO_URL');
  static const _clientUrl = String.fromEnvironment('KOJI_CLIENT_URL');

  static String get otherAppUrl => isClient ? _proUrl : _clientUrl;

  /// Support address shown on the connexion and help pages.
  static const supportEmail = 'contact@kojibuild.com';
}
