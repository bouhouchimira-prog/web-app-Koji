import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

final marketplaceOffersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(marketplaceRepositoryProvider).getMyOffers();
});

final marketplaceOfferDetailProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getOfferDetail(offerId);
});

/// « Vos projets » (/api/client/projets) : `bonjour`, `projets`, `attendus`.
final clientProjetsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(marketplaceRepositoryProvider).getProjets();
});

/// « Propositions reçues » d'une demande (/api/client/projets/{offerId}).
final clientPropositionsProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getPropositions(offerId);
});

final marketplaceOfferPositionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getPositions(offerId);
});

final marketplaceOfferMessagesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getMessages(offerId);
});

final marketplaceOfferPaiementsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getPaiements(offerId);
});

/// Boîte de réception "Messages" (/client/messages) — conversations Radar
/// des Chantiers, PAS la messagerie par devis (clientQuotesProvider).
final clientMessagesInboxProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(marketplaceRepositoryProvider).getClientMessages();
});

final clientNotificationsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(marketplaceRepositoryProvider).getNotifications();
});

final clientPortalProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(marketplaceRepositoryProvider).getClientProfile();
});
