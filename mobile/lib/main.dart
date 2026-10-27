import 'package:koji/app/koji_app.dart';
import 'package:koji/app/koji_app_config.dart';

/// Default entrypoint = the entreprise app (Koji Pro), so existing
/// `flutter run` / CI commands keep building the same store app.
/// Use `lib/main_client.dart` for the client app.
void main() => runKojiApp(KojiAppKind.entreprise);
