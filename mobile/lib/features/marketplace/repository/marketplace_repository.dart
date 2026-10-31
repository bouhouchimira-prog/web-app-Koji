import 'dart:convert';
import 'dart:typed_data';

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

  // --- Détail d'une demande : messagerie, RDV, photos, paiement ---------
  // Gabarit web : app/client/radar/[id]/page.jsx, lu en entier. Les
  // "conversations" (une par entreprise) ne sont PAS un endpoint à part :
  // le site les reconstruit lui-même en groupant messages par
  // entrepriseUserId — ce repository fait pareil, voir
  // marketplace_offer_detail_screen.dart.

  /// Tous les fils de discussion de cette offre (toutes entreprises
  /// confondues, à regrouper par entrepriseUserId côté écran).
  Future<List<Map<String, dynamic>>> getMessages(String offerId) async {
    final data = await _api.get(
      '/api/marketplace/offres/$offerId/messages',
    ) as Map<String, dynamic>;
    return (data['messages'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> sendMessage(
    String offerId, {
    required String entrepriseUserId,
    required String message,
  }) async {
    final data = await _api.postJson('/api/marketplace/offres/$offerId/messages', {
      'entrepriseUserId': entrepriseUserId,
      'message': message,
    }) as Map<String, dynamic>;
    return data['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> proposeRdv(
    String offerId, {
    required String entrepriseUserId,
    required DateTime rdvDate,
  }) async {
    final data = await _api.postJson('/api/marketplace/offres/$offerId/messages', {
      'entrepriseUserId': entrepriseUserId,
      'kind': 'rdv_proposal',
      'rdvDate': rdvDate.toIso8601String(),
    }) as Map<String, dynamic>;
    return data['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> respondRdv(
    String offerId, {
    required String entrepriseUserId,
    required String respondsToId,
    required bool accepted,
  }) async {
    final data = await _api.postJson('/api/marketplace/offres/$offerId/messages', {
      'entrepriseUserId': entrepriseUserId,
      'kind': 'rdv_response',
      'respondsToId': respondsToId,
      'rdvStatus': accepted ? 'accepted' : 'declined',
    }) as Map<String, dynamic>;
    return data['message'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> grantPhotos(
    String offerId, {
    required String entrepriseUserId,
  }) async {
    final data = await _api.postJson('/api/marketplace/offres/$offerId/messages', {
      'entrepriseUserId': entrepriseUserId,
      'kind': 'photo_grant',
    }) as Map<String, dynamic>;
    return data['message'] as Map<String, dynamic>;
  }

  /// La carte de visite Koji d'une entreprise : un PDF, jamais un lien
  /// externe — la route exige le cookie de session (voir
  /// app/api/marketplace/offres/[id]/entreprise-card/route.js), qu'un
  /// navigateur externe n'a pas. On récupère les octets nous-mêmes et on
  /// les affiche avec `printing` (même façon que les devis, voir
  /// features/signature/client_devis_pdf.dart).
  Future<Uint8List> getEntrepriseCardPdf(
    String offerId, {
    required String entrepriseUserId,
  }) {
    return _api.getBytes(
      '/api/marketplace/offres/$offerId/entreprise-card',
      query: {'entrepriseUserId': entrepriseUserId, 'preview': '1'},
    );
  }

  Future<List<Map<String, dynamic>>> getPaiements(String offerId) async {
    final data = await _api.get(
      '/api/marketplace/offres/$offerId/paiement',
    ) as Map<String, dynamic>;
    return (data['paiements'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  /// Ouvre une session Stripe Checkout pour cette échéance — l'URL est à
  /// ouvrir dans le navigateur (jamais de clé Stripe côté app).
  Future<String> checkoutPaiement(String offerId, String paiementId) async {
    final data = await _api.postJson(
      '/api/marketplace/offres/$offerId/paiement/$paiementId/checkout',
      const {},
    ) as Map<String, dynamic>;
    return data['url'] as String;
  }

  Future<Map<String, dynamic>> validatePaiement(
    String offerId,
    String paiementId,
  ) async {
    final data = await _api.postJson(
      '/api/marketplace/offres/$offerId/paiement/$paiementId/valider',
      const {},
    ) as Map<String, dynamic>;
    return data['paiement'] as Map<String, dynamic>;
  }

  // --- Boîte de réception "Messages" -------------------------------------
  // Gabarit web : app/client/messages/page.jsx. Attention, ce n'est PAS la
  // même chose que la messagerie par devis (ClientChatScreen, table Supabase
  // quote_messages) : /client/messages sur le site regroupe les conversations
  // Radar des Chantiers (entreprise ↔ particulier à propos d'une offre, AVANT
  // tout devis), via /api/client/messages — un simple regroupement de ce qui
  // existe déjà dans db.chantierOffreMessages, pas un nouveau stockage.

  Future<List<Map<String, dynamic>>> getClientMessages() async {
    final data = await _api.get('/api/client/messages') as Map<String, dynamic>;
    return (data['conversations'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> getNotifications() async {
    final data = await _api.get('/api/notifications') as Map<String, dynamic>;
    return (data['notifications'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
  }

  Future<void> markNotificationRead(String id) {
    return _api.patchJson('/api/notifications', {'id': id, 'action': 'read'});
  }

  Future<void> markAllNotificationsRead() {
    return _api.patchJson('/api/notifications', {'action': 'read-all'});
  }

  Future<void> deleteNotification(String id) {
    return _api.patchJson('/api/notifications', {'id': id, 'action': 'delete'});
  }

  // --- Profil, paramètres (gabarit web : app/client/profil/page.jsx,
  // components/SettingsPanel.jsx, lus en entier) --------------------------
  // Attention : ces champs (personal/pro/profileKind/mot de passe) vivent
  // dans le même système cookie que tout ce qui précède (lib/particulier-
  // users.js), PAS dans la table Supabase `users` que lit/écrit l'écran
  // Profil actuel de l'app (userRepositoryProvider.updateClientProfile) —
  // même écart que pour la connexion (voir koji_web_api_client.dart).

  Future<Map<String, dynamic>> getClientProfile() async {
    final data = await _api.get('/api/client/profile') as Map<String, dynamic>;
    return data['user'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateClientProfile({
    Map<String, dynamic>? personal,
    String? profileKind,
    Map<String, dynamic>? pro,
    String? password,
    String? currentPassword,
  }) async {
    final data = await _api.patchJson('/api/client/profile', {
      if (personal != null) 'personal': personal,
      if (profileKind != null) 'profileKind': profileKind,
      if (pro != null) 'pro': pro,
      if (password != null) 'password': password,
      if (currentPassword != null) 'currentPassword': currentPassword,
    }) as Map<String, dynamic>;
    return data['user'] as Map<String, dynamic>;
  }

  /// Export RGPD (article 20) — renvoie les octets d'un fichier JSON à
  /// enregistrer/partager, jamais affiché directement.
  Future<Uint8List> getAccountExportJson() async {
    final data = await _api.get('/api/account/export') as Map<String, dynamic>;
    final bytes = const Utf8Encoder().convert(
      const JsonEncoder.withIndent('  ').convert(data['export']),
    );
    return Uint8List.fromList(bytes);
  }

  /// Demande de suppression de compte (RGPD article 17) — traitée
  /// manuellement par l'équipe koji, jamais une suppression instantanée.
  Future<void> requestAccountDeletion(String reason) {
    return _api.postJson('/api/account/deletion-request', {
      'reason': reason,
      'accountType': 'particulier',
    });
  }

  Future<void> sendSupportReport(String message) {
    return _api.postJson('/api/support/report', {
      'message': message,
      'accountType': 'particulier',
    });
  }
}
