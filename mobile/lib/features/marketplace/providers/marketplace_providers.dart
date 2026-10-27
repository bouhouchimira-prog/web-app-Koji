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

final marketplaceOfferPositionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, offerId) {
  return ref.read(marketplaceRepositoryProvider).getPositions(offerId);
});
