import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/quote/models/task_note.dart';
import 'package:koji/features/quote/repositories/task_note_repository.dart';

/// Notes (+ their reply threads) for one task. Supabase Realtime is not
/// reliably enabled on this project (see quote_message_provider.dart), so
/// this follows the FutureProvider + ref.invalidate(...) pattern.
final taskNotesProvider =
    FutureProvider.family<List<TaskNote>, String>((ref, taskId) {
  return ref.read(taskNoteRepositoryProvider).getForTask(taskId);
});
