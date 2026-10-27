import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/repositories/document_repository.dart';

final documentRepositoryProvider = Provider<DocumentRepository>((ref) {
  return DocumentRepository();
});

final chantierDocumentsProvider = StreamProvider.family<List<Map<String, dynamic>>, String>((ref, chantierId) {
  return ref.watch(documentRepositoryProvider).streamChantierDocuments(chantierId);
});
