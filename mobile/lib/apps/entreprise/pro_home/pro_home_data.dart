import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import 'package:koji/app/koji_web_api_config.dart';
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

  Future<List<Map<String, dynamic>>> offres() async =>
      _list(await _send('GET', '/api/marketplace/offres'), 'offres');

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

/// Invoices past their due date and not fully paid (same query as the
/// overdue-invoice notification).
final proOverdueInvoicesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final userId = SupabaseConfig.client.auth.currentUser?.id;
  if (userId == null) return const [];
  try {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final rows = await SupabaseConfig.client
        .from('invoices')
        .select('id, reference, amount, paid_amount, due_date, client_name')
        .eq('user_id', userId)
        .lt('due_date', today);
    return (rows as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((r) {
      final amount = (r['amount'] as num?)?.toDouble() ?? 0;
      final paid = (r['paid_amount'] as num?)?.toDouble() ?? 0;
      return amount - paid > 0.009;
    }).toList();
  } catch (_) {
    return const [];
  }
});
