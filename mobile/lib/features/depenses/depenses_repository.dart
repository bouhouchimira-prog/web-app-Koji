import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/depenses/depenses_logic.dart';

// Dépenses de Koji Pro sur l'API du site (app/api/depenses/*), la même que
// /depenses sur le web.
final depensesRepositoryProvider = Provider<DepensesRepository>((ref) => DepensesRepository(ref.watch(kojiProApiProvider)));

final depensesProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(depensesRepositoryProvider).vue());
final coutChantiersProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(depensesRepositoryProvider).chantiers());
final coutChantierProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(depensesRepositoryProvider).chantier(id));
final exportComptableProvider = FutureProvider.autoDispose.family<Json, String>((ref, periode) => ref.watch(depensesRepositoryProvider).export(periode));

class DepensesRepository {
  DepensesRepository(this._api);
  final KojiProApi _api;

  Future<Json> vue() => _api.get('/api/depenses');

  /// Photo (data URL JPEG) ou PDF : Koji lit la pièce, propose le chantier.
  Future<Json> deposer({required String nom, required String data}) => _api.post('/api/depenses', {'nom': nom, 'data': data});

  Future<Json> action(String action, [Json extra = const {}]) => _api.patch('/api/depenses', {'action': action, ...extra});

  Future<Json> chantiers() => _api.get('/api/depenses/chantiers');
  Future<Json> chantier(String id) => _api.get('/api/depenses/chantiers', query: {'projet': id});

  Future<Json> export(String periode) => _api.get('/api/depenses/export', query: {'periode': periode});
  Future<Json> envoyer(String periode, String to) => _api.post('/api/depenses/export', {'periode': periode, 'to': to});
}
