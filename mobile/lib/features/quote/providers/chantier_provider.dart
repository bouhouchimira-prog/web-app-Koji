import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/quote/repositories/document_repository.dart';
import 'package:koji/features/quote/repository/quote_task_repository.dart';

final chantierRepositoryProvider = Provider<ChantierRepository>((ref) {
  return ChantierRepository();
});

// One-shot REST fetch instead of a realtime `.stream()`. Realtime replication
// can't diff `json` columns (Postgres error 42883: "could not identify an
// equality operator for type json"), which surfaced as a hard error on the
// Archives screen. `.select()` is unaffected; we refresh via
// `ref.invalidate(userChantiersProvider(userId))` after each mutation (restore /
// delete / status change), keeping the list live without the broken realtime path.
final userChantiersProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, userId) {
  return ref.watch(chantierRepositoryProvider).getChantiersOnce(userId);
});

// FutureProvider (not Stream) because Supabase Realtime is not enabled on
// chantier_tasks — `.stream()` only emits the initial snapshot, so new rows
// inserted by the same client never appear until the screen is rebuilt.
// Using a Future + explicit `ref.invalidate(...)` after each mutation keeps
// the list in sync without depending on the realtime publication.
final chantierTasksProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(chantierRepositoryProvider).getTasks(chantierId);
});

// Tasks for the "À faire" screen. Shows the SAME tasks as the planning screen:
// the devis tasks (quote → rooms → quote_tasks) for this chantier, falling back
// to the manual chantier_tasks checklist when the chantier has no devis. This is
// why the À faire list now matches "Tâches du chantier" in the planner instead
// of staying empty after a devis is created.
final chantierAFaireTasksProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) async {
  final devisTasks =
      await QuoteTaskRepository().getDevisTasksForChantier(chantierId);
  // Manual tasks added via "Ajouter une tâche" live in chantier_tasks. Merge
  // them in so both sources show, deduped by label (a devis task and a manual
  // task with the same name shouldn't appear twice).
  final manualTasks =
      await ref.watch(chantierRepositoryProvider).getTasks(chantierId);

  final seenLabels = devisTasks
      .map((t) => (t['label'] ?? '').toString().trim().toLowerCase())
      .toSet();
  final merged = <Map<String, dynamic>>[...devisTasks];
  for (final t in manualTasks) {
    final label = (t['label'] ?? '').toString().trim().toLowerCase();
    if (label.isEmpty || seenLabels.contains(label)) continue;
    seenLabels.add(label);
    merged.add(t);
  }
  return merged;
});

final chantierBudgetProvider = StreamProvider.family<Map<String, dynamic>?, String>((ref, chantierId) {
  return ref.watch(chantierRepositoryProvider).streamBudget(chantierId);
});

// Itemized budget lines (Main d'œuvre / Fourniture / Divers) for a chantier.
final chantierBudgetLinesProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(chantierRepositoryProvider).streamBudgetLines(chantierId);
});

// Budget history (audit log of every add / delete / estimated change).
final chantierBudgetHistoryProvider =
    StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(chantierRepositoryProvider).streamBudgetHistory(chantierId);
});

final openChantierTasksProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, userId) {
  return ref.watch(chantierRepositoryProvider).getOpenTasksForUser(userId);
});

// --- Documents ---
final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  return DocumentRepository();
});

final chantierDocumentsProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(documentRepositoryProvider).streamChantierDocuments(chantierId);
});

final chantierQuotesProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(chantierRepositoryProvider).streamChantierQuotes(chantierId);
});
