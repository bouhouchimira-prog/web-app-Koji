import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart' show ProKojiWebClient, ProKojiWebException;
import 'package:koji/apps/entreprise/visite/visite_mode.dart';

/// Où le téléphone garde les visites et leurs photos (Hive + fichiers ;
/// en mémoire dans les tests).
abstract class VisiteStockage {
  Future<Map<String, String>> tout();
  Future<void> ecrire(String cle, String json);
  Future<String> garderPhoto(String cle, List<int> octets);
  Future<List<int>?> lirePhoto(String ref);
}

class HiveVisiteStockage implements VisiteStockage {
  static const _boite = 'visites_pro';

  Future<Box> _box() async {
    await Hive.initFlutter();
    if (Hive.isBoxOpen(_boite)) return Hive.box(_boite);
    return Hive.openBox(_boite);
  }

  @override
  Future<Map<String, String>> tout() async {
    final b = await _box();
    return {for (final k in b.keys) '$k': '${b.get(k)}'};
  }

  @override
  Future<void> ecrire(String cle, String json) async => (await _box()).put(cle, json);

  @override
  Future<String> garderPhoto(String cle, List<int> octets) async {
    final dossier = Directory('${(await getApplicationDocumentsDirectory()).path}/visites');
    await dossier.create(recursive: true);
    final f = File('${dossier.path}/${cle.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_')}.jpg');
    await f.writeAsBytes(octets, flush: true);
    return f.path;
  }

  @override
  Future<List<int>?> lirePhoto(String ref) async {
    final f = File(ref);
    return await f.exists() ? f.readAsBytes() : null;
  }
}

class MemoireVisiteStockage implements VisiteStockage {
  final Map<String, String> donnees = {};
  final Map<String, List<int>> photos = {};

  @override
  Future<Map<String, String>> tout() async => Map.of(donnees);

  @override
  Future<void> ecrire(String cle, String json) async => donnees[cle] = json;

  @override
  Future<String> garderPhoto(String cle, List<int> octets) async {
    photos[cle] = octets;
    return 'memoire:$cle';
  }

  @override
  Future<List<int>?> lirePhoto(String ref) async => photos[ref.replaceFirst('memoire:', '')];
}

/// Ce que le serveur reçoit (koji-web /api/visites) ; remplacé dans les
/// tests.
abstract class VisiteServeur {
  Future<Map<String, dynamic>> enregistrer(Visite visite);
  Future<void> photo({required String visiteId, required String photoId, required String pieceId, required List<int> octets, String pointId, String prisLe});
  Future<Map<String, dynamic>> resume(String id, {required String message, required String devisPromis, String email, bool envoyer});
}

class WebVisiteServeur implements VisiteServeur {
  WebVisiteServeur(this.api);
  final ProKojiWebClient api;

  @override
  Future<Map<String, dynamic>> enregistrer(Visite visite) => api.enregistrerVisite(visite);

  @override
  Future<void> photo({required String visiteId, required String photoId, required String pieceId, required List<int> octets, String pointId = '', String prisLe = ''}) =>
      api.envoyerPhotoVisite(visiteId: visiteId, photoId: photoId, pieceId: pieceId, octets: octets, pointId: pointId, prisLe: prisLe);

  @override
  Future<Map<String, dynamic>> resume(String id, {required String message, required String devisPromis, String email = '', bool envoyer = true}) =>
      api.resumeVisite(id, message: message, devisPromis: devisPromis, email: email, envoyer: envoyer);
}

/// Les visites du compte connecté, gardées sur le téléphone et envoyées à
/// Koji au retour du réseau, sans action. Clés préfixées par le compte :
/// jamais de visite d'un autre compte sur le même téléphone.
class VisiteStore extends ChangeNotifier {
  VisiteStore({required this.compte, required this.stockage, required this.serveur, this.surveillerReseau = true, DateTime Function()? maintenant})
      : maintenant = maintenant ?? DateTime.now;

  final String compte;
  final VisiteStockage stockage;
  final VisiteServeur serveur;
  final bool surveillerReseau;
  final DateTime Function() maintenant;

  final Map<String, Visite> _visites = {};
  bool charge = false;

  /// Dernier envoi raté faute de réseau.
  bool horsLigne = false;
  String? dernierEnvoi;
  int? ecartSecondes;
  StreamSubscription? _reseau;
  Timer? _attente;
  bool _envoiEnCours = false;
  bool _ferme = false;

  String _cle(String id) => '$compte:$id';

  Future<void> charger() async {
    Map<String, String> tout = const {};
    try {
      tout = await stockage.tout();
    } catch (_) {
      // Stockage indisponible : la visite vit en mémoire le temps de l'écran.
    }
    for (final e in tout.entries) {
      if (!e.key.startsWith('$compte:')) continue;
      try {
        _visites[e.key.substring(compte.length + 1)] = Map<String, dynamic>.from(jsonDecode(e.value) as Map);
      } catch (_) {}
    }
    charge = true;
    if (surveillerReseau) {
      try {
        _reseau = Connectivity().onConnectivityChanged.listen((r) {
          if (!r.contains(ConnectivityResult.none)) envoyerTout();
        }, onError: (_) {});
      } catch (_) {}
    }
    _maj();
  }

  @override
  void dispose() {
    _ferme = true;
    _reseau?.cancel();
    _attente?.cancel();
    super.dispose();
  }

  void _maj() {
    if (!_ferme) notifyListeners();
  }

  List<Visite> get visites => _visites.values.toList()..sort((a, b) => '${b['rdvLe'] ?? b['creeLe']}'.compareTo('${a['rdvLe'] ?? a['creeLe']}'));

  Visite? lire(String id) => _visites[id];

  /// Nouvelle visite, prête hors ligne : demande et liste à vérifier.
  Future<Visite> creer({required String client, String email = '', String adresse = '', String demande = '', String rdvLe = '', String eventId = '', String piece = '', String offreId = ''}) async {
    final v = <String, dynamic>{
      'id': const Uuid().v4(),
      'eventId': eventId,
      if (offreId.isNotEmpty) 'offreId': offreId,
      'client': client.trim(),
      'email': email.trim(),
      'adresse': adresse.trim(),
      'demande': demande.trim(),
      'rdvLe': rdvLe,
      'creeLe': maintenant().toUtc().toIso8601String(),
      'debut': '',
      'fin': '',
      'propositions': <String, dynamic>{},
      'pieces': [
        <String, dynamic>{'id': 'p1', 'nom': piece.trim().isEmpty ? pieceProbable(demande) : piece.trim(), 'cotes': [], 'points': listeAVerifier(demande), 'notes': [], 'photos': []},
      ],
    };
    await enregistrer(v, envoyer: false);
    return v;
  }

  /// Enregistre sur le téléphone, puis tente l'envoi (sans bloquer).
  Future<void> enregistrer(Visite v, {bool envoyer = true}) async {
    _visites['${v['id']}'] = v;
    try {
      await stockage.ecrire(_cle('${v['id']}'), jsonEncode(v));
    } catch (_) {}
    _maj();
    if (envoyer && '${v['debut']}'.isNotEmpty) {
      _attente?.cancel();
      _attente = Timer(const Duration(milliseconds: 600), () => envoyer_('${v['id']}'));
    }
  }

  Future<String> garderPhoto(String visiteId, String photoId, List<int> octets) => stockage.garderPhoto('$compte-$visiteId-$photoId', octets);

  Future<void> envoyerTout() async {
    for (final v in _visites.values.where((v) => '${v['debut']}'.isNotEmpty && enAttente(v) > 0).toList()) {
      await envoyer_('${v['id']}');
    }
  }

  /// Envoie la visite puis les photos pas encore parties. Hors ligne :
  /// tout reste sur le téléphone, nouvel essai au retour du réseau.
  Future<bool> envoyer_(String id) async {
    final v = _visites[id];
    if (v == null || _envoiEnCours) return false;
    _envoiEnCours = true;
    try {
      // Ce qui part : la visite sans les chemins locaux des photos.
      final copie = jsonDecode(jsonEncode(v)) as Map<String, dynamic>;
      for (final p in (copie['pieces'] as List)) {
        for (final ph in (p['photos'] as List)) {
          (ph as Map).remove('local');
        }
      }
      final r = await serveur.enregistrer(copie);
      ecartSecondes = r['ecartSecondes'] is num ? (r['ecartSecondes'] as num).toInt() : null;
      for (final p in (v['pieces'] as List)) {
        for (final k in ['cotes', 'notes', 'points']) {
          for (final x in (p[k] as List)) {
            if (k != 'points' || '${(x as Map)['reponse']}'.isNotEmpty) (x as Map)['envoye'] = true;
          }
        }
        for (final ph in (p['photos'] as List)) {
          final m = ph as Map;
          if (m['envoye'] == true) continue;
          final octets = await stockage.lirePhoto('${m['local'] ?? ''}');
          if (octets == null) continue;
          await serveur.photo(visiteId: id, photoId: '${m['id']}', pieceId: '${p['id']}', octets: octets, pointId: '${m['pointId'] ?? ''}', prisLe: '${m['le'] ?? ''}');
          m['envoye'] = true;
        }
      }
      horsLigne = false;
      dernierEnvoi = maintenant().toUtc().toIso8601String();
      v['envoyeLe'] = dernierEnvoi;
      await stockage.ecrire(_cle(id), jsonEncode(v));
      return true;
    } on ProKojiWebException {
      // Refus du serveur (session…) : on garde tout, sans parler de réseau.
      return false;
    } catch (_) {
      horsLigne = true;
      return false;
    } finally {
      _envoiEnCours = false;
      _maj();
    }
  }
}

/// « Salle de bain » si la demande le dit, sinon « Pièce ».
String pieceProbable(String demande) {
  final t = sansAccents(demande);
  if (RegExp(r"douche|baignoire|salle de bain|salle d'eau|vasque").hasMatch(t)) return 'Salle de bain';
  if (t.contains('cuisine')) return 'Cuisine';
  if (RegExp(r'\bwc\b|toilette').hasMatch(t)) return 'WC';
  if (t.contains('salon') || t.contains('sejour')) return 'Séjour';
  if (t.contains('chambre')) return 'Chambre';
  return 'Pièce';
}

@visibleForTesting
String cleVisite(String compte, String id) => '$compte:$id';
