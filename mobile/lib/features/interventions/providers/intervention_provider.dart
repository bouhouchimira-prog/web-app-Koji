import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/interventions/models/intervention.dart';
import 'package:koji/features/interventions/repositories/intervention_repository.dart';

final interventionsProvider = FutureProvider<List<Intervention>>((ref) {
  return ref.read(interventionRepositoryProvider).getAll();
});

final interventionByIdProvider =
    FutureProvider.family<Intervention?, String>((ref, id) {
  return ref.read(interventionRepositoryProvider).getById(id);
});
