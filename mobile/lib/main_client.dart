import 'package:koji/app/koji_app.dart';
import 'package:koji/app/koji_app_config.dart';

/// Koji — the client (particulier) app.
///   flutter run --flavor client -t lib/main_client.dart
void main() => runKojiApp(KojiAppKind.client);
