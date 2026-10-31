import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/repository/quote_task_repository.dart';

// Provider for the repository
final quoteTaskRepositoryProvider = Provider<QuoteTaskRepository>((ref) {
  return QuoteTaskRepository();
});

// Stream provider to listen to a specific quote's rooms (real-time)
// Actually we can use a FutureProvider for simplicity matching current architecture,
// or a StreamProvider if we use Supabase real-time channels.
// Let's use a standard FutureProvider for now, and we can invalidate it when needed.

final quoteRoomsProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, quoteId) async {
  final repo = ref.watch(quoteTaskRepositoryProvider);
  return await repo.getQuoteRooms(quoteId);
});

final quoteTasksProvider = FutureProvider.family<List<Map<String, dynamic>>, String>((ref, roomId) async {
  final repo = ref.watch(quoteTaskRepositoryProvider);
  return await repo.getQuoteTasks(roomId);
});

// Current Quote ID State Provider
// This tracks the Quote we are currently building.
final currentQuoteIdProvider = StateProvider<String?>((ref) => null);

// Current Rooms State Provider
// Used to store rooms while navigating the quote creation flow
final currentQuoteRoomsProvider = StateProvider<List<String>>((ref) => []);
