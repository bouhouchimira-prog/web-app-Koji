import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';

import 'package:koji/app/koji_web_api_client.dart';

// Outils communs aux tests de l'app Koji (charte Client) : polices de la
// charte, cadre téléphone des images de référence, session du site simulée.

/// DM Sans et Shippori Mincho, comme dans l'app, pour les images de référence.
Future<void> chargerPolicesClient() async {
  Future<ByteData> lire(String fichier) => File('assets/fonts/$fichier')
      .readAsBytes()
      .then((b) => ByteData.view(b.buffer));
  final sans = FontLoader('DMSans');
  for (final f in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    sans.addFont(lire('DMSans-$f.ttf'));
  }
  await sans.load();
  await (FontLoader('ShipporiMincho')
        ..addFont(lire('ShipporiMincho-SemiBold.ttf')))
      .load();
}

/// Cadre téléphone des maquettes : 390 × 844, densité 3.
void cadreTelephone(WidgetTester tester) {
  tester.view.physicalSize = const Size(390 * 3, 844 * 3);
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
}

/// Session du site ouverte, sans réseau : tout appel qui partirait vraiment
/// fait échouer le test.
class ApiConnectee extends KojiWebApiClient {
  ApiConnectee()
      : super(
          httpClient: MockClient((request) async {
            fail('Appel réseau inattendu en test : ${request.url}');
          }),
        );

  @override
  bool get isLoggedIn => true;
}

/// Pas de session du site, et pas de réseau non plus.
class ApiDeconnectee extends KojiWebApiClient {
  ApiDeconnectee()
      : super(
          httpClient: MockClient((request) async {
            fail('Appel réseau inattendu en test : ${request.url}');
          }),
        );

  @override
  bool get isLoggedIn => false;
}
