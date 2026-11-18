import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

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

/// Le dépôt du site simulé : données fournies par le test, chaque appel
/// noté dans [appels] (« nom:argument »), rien ne part sur le réseau.
class DepotSimule extends MarketplaceRepository {
  DepotSimule({
    this.fils = const [],
    this.notifications = const [],
    this.profil = const {},
    this.chantier = const {},
    this.paiements = const {},
    this.reponseSignature = const {},
    this.erreurEnvoi,
    this.erreurLecture,
  }) : super(ApiConnectee());

  List<Map<String, dynamic>> fils;
  List<Map<String, dynamic>> notifications;
  Map<String, dynamic> profil;

  /// Réponse de /api/client/chantier/{id} et de /api/client/paiements.
  Map<String, dynamic> chantier;
  Map<String, dynamic> paiements;

  /// Réponse de …/signer.
  Map<String, dynamic> reponseSignature;

  /// Erreur renvoyée par les lectures (chantier, paiements), quand donnée.
  Object? erreurLecture;

  /// Derniers champs envoyés à …/signer.
  Map<String, dynamic>? signatureEnvoyee;

  /// Erreur renvoyée par les envois (messages, profil…), quand donnée.
  Object? erreurEnvoi;

  final appels = <String>[];

  /// Derniers champs envoyés à /api/client/profile.
  Map<String, dynamic>? profilEnvoye;

  Future<T> _envoi<T>(String appel, T resultat) async {
    appels.add(appel);
    if (erreurEnvoi != null) throw erreurEnvoi!;
    return resultat;
  }

  @override
  Future<List<Map<String, dynamic>>> getClientMessages() async => fils;

  @override
  Future<List<Map<String, dynamic>>> getNotifications() async => notifications;

  @override
  Future<Map<String, dynamic>> getClientProfile() async => profil;

  @override
  Future<void> markNotificationRead(String id) => _envoi('lu:$id', null);

  @override
  Future<void> markAllNotificationsRead() => _envoi('tout-lu', null);

  @override
  Future<void> deleteNotification(String id) => _envoi('supprime:$id', null);

  @override
  Future<Map<String, dynamic>> sendMessage(String offerId,
          {required String entrepriseUserId, required String message}) =>
      _envoi('message:$offerId:$entrepriseUserId:$message', {});

  @override
  Future<Map<String, dynamic>> respondRdv(String offerId,
          {required String entrepriseUserId,
          required String respondsToId,
          required bool accepted}) =>
      _envoi('rdv:$respondsToId:$accepted', {});

  @override
  Future<Map<String, dynamic>> grantPhotos(String offerId,
          {required String entrepriseUserId}) =>
      _envoi('photos:$offerId:$entrepriseUserId', {});

  @override
  Future<Map<String, dynamic>> updateClientProfile({
    Map<String, dynamic>? personal,
    String? profileKind,
    Map<String, dynamic>? pro,
    String? password,
    String? currentPassword,
  }) {
    profilEnvoye = {
      if (personal != null) 'personal': personal,
      if (profileKind != null) 'profileKind': profileKind,
      if (pro != null) 'pro': pro,
      if (password != null) 'password': password,
      if (currentPassword != null) 'currentPassword': currentPassword,
    };
    return _envoi('profil', profil);
  }

  @override
  Future<Uint8List> getAccountExportJson() =>
      _envoi('export', Uint8List.fromList('{}'.codeUnits));

  @override
  Future<void> requestAccountDeletion(String reason) =>
      _envoi('suppression', null);

  @override
  Future<void> sendSupportReport(String message) =>
      _envoi('signalement:$message', null);

  @override
  Future<Map<String, dynamic>> getChantierClient(String quoteId) async {
    appels.add('chantier:$quoteId');
    if (erreurLecture != null) throw erreurLecture!;
    return chantier;
  }

  @override
  Future<Map<String, dynamic>> getPaiementsClient() async {
    appels.add('paiements');
    if (erreurLecture != null) throw erreurLecture!;
    return paiements;
  }

  @override
  Future<Map<String, dynamic>> signerDevisClient(
    String quoteId, {
    required bool mentionTva,
    required bool demandeExpresse,
    required bool consent,
    required String signature,
  }) {
    signatureEnvoyee = {
      'mentionTva': mentionTva,
      'demandeExpresse': demandeExpresse,
      'consent': consent,
      'signature': signature,
    };
    return _envoi('signer:$quoteId', reponseSignature);
  }

  @override
  Future<void> signalerChantier({
    required String quoteId,
    required String projectId,
    required String message,
  }) =>
      _envoi('alerte:$quoteId:$projectId:$message', null);
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
