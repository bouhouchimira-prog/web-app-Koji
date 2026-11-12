import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/entreprise/pro_home/radar_carte.dart';
import 'package:koji/core/supabase_config.dart';

/// Data of the Koji Pro home that lives on koji-web rather than in Supabase
/// tables the app already reads: Radar des chantiers (offers, positions,
/// conversation follow-up) and urgent alerts. Called with the pro's Supabase
/// session as a Bearer token, which koji-web verifies against Supabase Auth
/// (lib/server-auth.js) — the same account as on the website.
class ProKojiWebException implements Exception {
  const ProKojiWebException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ProKojiWebClient {
  ProKojiWebClient({http.Client? httpClient, String? Function()? accessToken})
      : _http = httpClient ?? http.Client(),
        _accessToken = accessToken ??
            (() => SupabaseConfig.client.auth.currentSession?.accessToken);

  final http.Client _http;
  final String? Function() _accessToken;

  Future<dynamic> _send(String method, String path,
      [Map<String, dynamic>? body]) async {
    final token = _accessToken();
    if (token == null || token.isEmpty) {
      throw const ProKojiWebException('Session expirée. Reconnectez-vous.');
    }
    final uri = Uri.parse('${KojiWebApiConfig.baseUrl}$path');
    final headers = {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };
    final res = method == 'POST'
        ? await _http.post(uri, headers: headers, body: jsonEncode(body))
        : await _http.get(uri, headers: headers);
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(res.body);
    } on FormatException {
      data = null;
    }
    if (res.statusCode >= 400) {
      final message = data is Map ? data['error']?.toString() : null;
      throw ProKojiWebException(message ?? 'Erreur ${res.statusCode}');
    }
    return data;
  }

  /// Zone de travail renvoyée avec la dernière liste d'offres (carte).
  RadarZone? zone;

  Future<List<Map<String, dynamic>>> offres() async {
    final data = await _send('GET', '/api/marketplace/offres');
    zone = RadarZone.fromJson(data is Map ? data['zone'] : null);
    return _list(data, 'offres');
  }

  Future<bool> estPositionne(String offreId) async {
    final data =
        await _send('GET', '/api/marketplace/offres/$offreId/positionner');
    if (data is! Map) return false;
    final positionnement = data['positionnement'];
    return data['positionnee'] == true ||
        (positionnement is Map && positionnement['status'] == 'Active');
  }

  Future<void> positionner(String offreId) =>
      _send('POST', '/api/marketplace/offres/$offreId/positionner', const {});

  Future<List<Map<String, dynamic>>> messages(String offreId) async => _list(
      await _send('GET', '/api/marketplace/offres/$offreId/messages'),
      'messages');

  Future<List<Map<String, dynamic>>> alertesUrgentes() async =>
      _list(await _send('GET', '/api/urgent-alerts'), 'alerts');

  /// Any list route of the site (factures, devis, chantiers, dépenses).
  Future<List<Map<String, dynamic>>> liste(String path, String key) async =>
      _list(await _send('GET', path), key);

  static List<Map<String, dynamic>> _list(dynamic data, String key) {
    final raw = data is Map ? data[key] : null;
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }
}

/// Where a position stands, read from the offer's conversation (same rules
/// as the website's home).
class RadarSuivi {
  const RadarSuivi({this.clientARepondu = false, this.visite, this.visiteLe});

  final bool clientARepondu;

  /// 'confirmee' | 'proposee' | 'refusee', or null when no visit was proposed.
  final String? visite;
  final DateTime? visiteLe;

  factory RadarSuivi.depuisMessages(List<Map<String, dynamic>> fil) {
    if (fil.isEmpty) return const RadarSuivi();
    final dernier = fil.last;
    final propositions = fil
        .where((m) => m['kind'] == 'rdv_proposal' && m['rdvDate'] != null)
        .toList();
    final proposition = propositions.isEmpty ? null : propositions.last;
    Map<String, dynamic>? reponse;
    if (proposition != null) {
      for (final m in fil) {
        if (m['kind'] == 'rdv_response' &&
            m['respondsToId'] == proposition['id']) {
          reponse = m;
          break;
        }
      }
    }
    final statut = reponse?['rdvStatus'];
    return RadarSuivi(
      clientARepondu: dernier['senderType'] == 'particulier' &&
          (dernier['kind'] ?? 'text') == 'text',
      visite: proposition == null
          ? null
          : statut == 'accepted'
              ? 'confirmee'
              : statut == 'declined'
                  ? 'refusee'
                  : 'proposee',
      visiteLe:
          DateTime.tryParse('${proposition?['rdvDate'] ?? ''}')?.toLocal(),
    );
  }
}

class RadarOffre {
  const RadarOffre({required this.data, this.prise = false, this.suivi});

  final Map<String, dynamic> data;
  final bool prise;
  final RadarSuivi? suivi;

  String get id => '${data['id']}';
  String get description => (data['description'] ?? '').toString();
  String get metier => (data['metier'] ?? '').toString().trim();
  String get adresse => (data['address'] ?? '').toString();
  int get photos => (data['photosCount'] as num?)?.toInt() ?? 0;
  int? get delaiJours => (data['delaiEstimeJours'] as num?)?.toInt();
  DateTime? get publieeLe =>
      DateTime.tryParse('${data['createdAt'] ?? ''}')?.toLocal();

  /// Prix recommandé calculé par le site avec la bibliothèque et le taux de
  /// l'entreprise (lib/prix-recommande.js) : TTC arrondi à la centaine, null
  /// quand aucun poste n'a pu être chiffré. Jamais montré au particulier.
  Map<String, dynamic>? get _prix => data['prixRecommande'] is Map
      ? Map<String, dynamic>.from(data['prixRecommande'] as Map)
      : null;
  int? get prixTtc => (_prix?['ttc'] as num?)?.round();
  int get prixManquants => (_prix?['manquants'] as num?)?.toInt() ?? 0;
  int get prixPostes => (_prix?['postes'] as num?)?.toInt() ?? 0;
  bool get tauxManquant => _prix?['tauxManquant'] == true;

  /// Prix calculé sur une partie des postes seulement.
  bool get prixPartiel => prixTtc != null && prixManquants > 0;

  /// Centre de la maille de ~2 km du chantier (jamais l'adresse), null sans
  /// géocodage : le chantier reste dans la liste, pas sur la carte.
  ({double lat, double lon})? get position {
    final p = data['position'];
    if (p is! Map) return null;
    final lat = (p['lat'] as num?)?.toDouble();
    final lon = (p['lon'] as num?)?.toDouble();
    if (lat == null || lon == null) return null;
    return (lat: lat, lon: lon);
  }
}

final _euro =
    NumberFormat.currency(locale: 'fr_FR', symbol: '€', decimalDigits: 0);

/// « 6 000 € » ou « À chiffrer » (même texte que le site).
String prixCourt(RadarOffre offre) =>
    offre.prixTtc == null ? 'À chiffrer' : _euro.format(offre.prixTtc);

/// Ce qui a servi au calcul et ce qui manque (lib/radar-display.js::notePrix).
String notePrix(RadarOffre offre) {
  final postes = offre.prixPostes;
  if (postes == 0) return '';
  final n = offre.prixManquants;
  if (n > 0 && offre.tauxManquant) {
    return "Renseignez votre taux de main-d'œuvre (Bibliothèque › Mes prix) : "
        'sans lui, Koji ne chiffre pas les ouvrages au temps.';
  }
  if (offre.prixTtc == null) {
    return "Aucun poste de ce chantier n'a de prix dans votre bibliothèque : "
        "Koji n'invente pas de montant.";
  }
  if (n > 0) {
    return '$n poste${n > 1 ? 's' : ''} sur $postes sans prix dans votre '
        "bibliothèque : ${n > 1 ? 'ils ne sont pas comptés' : "il n'est pas compté"}.";
  }
  return 'Calculé avec vos prix sur $postes poste${postes > 1 ? 's' : ''}, '
      'TTC arrondi à la centaine.';
}

/// Tri « Prix recommandé, du plus haut » ; sans prix en dernier, puis le
/// plus récent.
int comparerPrix(RadarOffre a, RadarOffre b) {
  final prix = (b.prixTtc ?? 0).compareTo(a.prixTtc ?? 0);
  if (prix != 0) return prix;
  return (b.publieeLe ?? DateTime(0)).compareTo(a.publieeLe ?? DateTime(0));
}

final proKojiWebProvider =
    Provider<ProKojiWebClient>((ref) => ProKojiWebClient());

/// Offers of the pro's zone and trades, with their position status and, for
/// taken ones, the conversation follow-up. A single unreadable offer does not
/// fail the list.
final proRadarProvider =
    FutureProvider.autoDispose<List<RadarOffre>>((ref) async {
  final api = ref.watch(proKojiWebProvider);
  final offres = await api.offres();
  return Future.wait(offres.map((data) async {
    final id = '${data['id']}';
    final prise = await api.estPositionne(id).catchError((_) => false);
    if (!prise) return RadarOffre(data: data);
    final suivi = await api
        .messages(id)
        .then(RadarSuivi.depuisMessages)
        .catchError((_) => const RadarSuivi());
    return RadarOffre(data: data, prise: true, suivi: suivi);
  }));
});

/// Zone de travail de l'entreprise, lue avec les offres (centre et légende
/// de la carte du Radar).
final proRadarZoneProvider = Provider.autoDispose<RadarZone?>((ref) {
  ref.watch(proRadarProvider);
  return ref.watch(proKojiWebProvider).zone;
});

/// Urgent alerts raised by clients or workers on the pro's chantiers. Empty on
/// error: the home must still open when koji-web is unreachable.
final proUrgentAlertsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    return await ref.watch(proKojiWebProvider).alertesUrgentes();
  } catch (_) {
    return const [];
  }
});

/// Données des chiffres du mois (PRO-01.2), lues sur le site comme la page
/// Factures : factures, devis, chantiers et dépenses de l'entreprise.
class ChiffresSource {
  const ChiffresSource({
    this.invoices = const [],
    this.quotes = const [],
    this.projects = const [],
    this.expenses = const [],
  });
  final List<Map<String, dynamic>> invoices;
  final List<Map<String, dynamic>> quotes;
  final List<Map<String, dynamic>> projects;
  final List<Map<String, dynamic>> expenses;
}

final proChiffresSourceProvider =
    FutureProvider.autoDispose<ChiffresSource>((ref) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(String path, String key) =>
      api.liste(path, key).catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    api.liste('/api/invoices', 'invoices'),
    lire('/api/quotes', 'quotes'),
    lire('/api/projects', 'projects'),
    lire('/api/expenses', 'expenses'),
  ]);
  return ChiffresSource(
      invoices: r[0], quotes: r[1], projects: r[2], expenses: r[3]);
});

/// Factures envoyées, échues et pas encore payées (mêmes règles que
/// l'« À traiter » du site). Lues sur le site : c'est là que vivent les
/// factures depuis le passage de Factures sur l'API (a2de5f5). Vide en cas
/// d'erreur : l'accueil doit s'ouvrir même sans réseau.
final proOverdueInvoicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  try {
    final source = await ref.watch(proChiffresSourceProvider.future);
    final now = DateTime.now();
    final today =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    return source.invoices.where((f) {
      final echeance = '${f['dueDate'] ?? ''}';
      return f['kind'] != 'avoir' &&
          f['archived'] != true &&
          (f['status'] == 'Emise' || f['status'] == 'Partielle') &&
          echeance.length >= 10 &&
          echeance.substring(0, 10).compareTo(today) < 0;
    }).toList();
  } catch (_) {
    return const [];
  }
});
