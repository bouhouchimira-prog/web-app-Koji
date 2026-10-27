import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/client/repository/client_repository.dart';

/// All devis addressed to the logged-in client (matched by email), newest
/// first. Invalidate after signing to refresh the lists.
final clientQuotesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(clientRepositoryProvider).getQuotes();
});

/// Only the signed / finalized devis — feeds the Documents tab.
final clientDocumentsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(clientRepositoryProvider).getSignedDocuments();
});

/// Read-only works (tasks) across the client's chantiers, for follow-up.
final clientTasksProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(clientRepositoryProvider).getTasks();
});
