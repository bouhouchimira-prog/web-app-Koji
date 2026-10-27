import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/features/quote/repositories/quote_message_repository.dart';

final quoteMessageRepositoryProvider = Provider<QuoteMessageRepository>((ref) {
  return QuoteMessageRepository(SupabaseConfig.client);
});

/// Messages (with resolved attachment URLs) for one devis discussion.
///
/// A FutureProvider + explicit `ref.invalidate(...)` after each send is used
/// instead of a realtime stream because Supabase Realtime is not reliably
/// enabled on these tables in this project (see the note in chantier_provider).
final quoteMessagesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, quoteId) {
  return ref.watch(quoteMessageRepositoryProvider).getMessages(quoteId);
});
