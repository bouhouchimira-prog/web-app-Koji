import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_web_api_client.dart';

final marketplaceRepositoryProvider = Provider<MarketplaceRepository>((ref) {
  return MarketplaceRepository(ref.read(kojiWebApiClientProvider));
});

/// Talks to koji-web's Radar des Chantiers endpoints on behalf of the
/// logged-in particulier (see KojiWebApiClient for why this goes over HTTP
/// to koji-web rather than straight to Supabase). Rows are returned as
/// `Map<String, dynamic>` — same convention as the rest of this app's client
/// repositories (see client_repository.dart).
class MarketplaceRepository {
  MarketplaceRepository(this._api);
  final KojiWebApiClient _api;

  /// "Mes demandes" — every chantier the particulier has published.
  Future<List<Map<String, dynamic>>> getMyOffers() async {
    final data = await _api.get('/api/chantier-offres') as Map<String, dynamic>;
    return (data['offres'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> getOfferDetail(String offerId) async {
    final data =
        await _api.get('/api/chantier-offres/$offerId') as Map<String, dynamic>;
    return data['offre'] as Map<String, dynamic>;
  }

  /// Entreprises that positioned themselves on this offer (read-only here —
  /// accepting/declining a position is a later step of the plan).
  Future<List<Map<String, dynamic>>> getPositions(String offerId) async {
    final data = await _api.get(
      '/api/marketplace/offres/$offerId/positionner',
    ) as Map<String, dynamic>;
    return (data['positionnements'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// One turn of the AI publishing assistant (gabarit web :
  /// app/client/radar/new/page.jsx's sendToEngine). `turns` must be the
  /// FULL conversation so far ({role, text}), not just the latest message —
  /// koji-web rebuilds the whole prompt from it on every call.
  Stream<SseEvent> sendChatTurn({
    required List<Map<String, dynamic>> turns,
    required String conversationId,
    String? draftId,
    List<String> photos = const [],
    String prenom = '',
  }) {
    return _api.postSse('/api/radar-chat', {
      'turns': turns,
      'conversationId': conversationId,
      if (draftId != null && draftId.isNotEmpty) 'draftId': draftId,
      'photos': photos,
      'prenom': prenom,
    });
  }

  /// Fetches the finished draft once the assistant calls terminer_collecte
  /// (SSE "done" event, finished: true) — its `data` is the recap shown to
  /// the particulier before launching the expertise.
  Future<Map<String, dynamic>> getChatDraft(String draftId) async {
    final data =
        await _api.get('/api/radar-chat/draft/$draftId') as Map<String, dynamic>;
    return (data['draft'] as Map<String, dynamic>?) ?? const {};
  }

  /// POST /api/expertise-koji — turns the recap answers into priced
  /// ouvrages (never shown to the particulier) + conseils + an estimated
  /// delay. Returns the full body: expertiseId, metier, description,
  /// breakdown, delaiEstimeJours, conseils, missingPriceItems.
  Future<Map<String, dynamic>> launchExpertise({
    required Map<String, dynamic> answers,
    List<String> photos = const [],
  }) async {
    final data = await _api.postJson('/api/expertise-koji', {
      'answers': answers,
      'photos': photos,
    }) as Map<String, dynamic>;
    return data;
  }

  /// PATCH /api/expertise-koji/:id — the particulier fills in a price for
  /// an ouvrage missing from koji's own price library. Returns the updated
  /// missingPriceItems list.
  Future<List<Map<String, dynamic>>> submitMissingPrices(
    String expertiseId,
    List<Map<String, dynamic>> prices,
  ) async {
    final data = await _api.patchJson(
      '/api/expertise-koji/$expertiseId',
      {'prices': prices},
    ) as Map<String, dynamic>;
    return (data['missingPriceItems'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// POST /api/chantier-offres — publishes the offer for entreprises to see.
  Future<Map<String, dynamic>> publishOffer({
    required String expertiseId,
    required List<String> conseilsSelectionnes,
    required String description,
    required String metier,
    required String address,
    String city = '',
    String postalCode = '',
    double? lat,
    double? lon,
    List<String> photos = const [],
    String? conversationId,
  }) async {
    final data = await _api.postJson('/api/chantier-offres', {
      'expertiseId': expertiseId,
      'conseilsSelectionnes': conseilsSelectionnes,
      'photos': photos,
      'description': description,
      'metier': metier,
      'address': address,
      'city': city,
      'postalCode': postalCode,
      'lat': lat,
      'lon': lon,
      if (conversationId != null) 'conversationId': conversationId,
    }) as Map<String, dynamic>;
    return data['offre'] as Map<String, dynamic>;
  }
}
