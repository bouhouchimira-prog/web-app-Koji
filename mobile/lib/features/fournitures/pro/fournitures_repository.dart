import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/fournitures/pro/fournitures_logic.dart';

// Fournitures de Koji Pro sur l'API du site (app/api/fournitures/*), la même
// que /fournitures sur le web.
final fournituresProRepositoryProvider = Provider<FournituresProRepository>((ref) => FournituresProRepository(ref.watch(kojiProApiProvider)));

final catalogueProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(fournituresProRepositoryProvider).catalogue());
final bonsProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(fournituresProRepositoryProvider).bons());
final chantierFournituresProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(fournituresProRepositoryProvider).chantier(id));
final stockProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(fournituresProRepositoryProvider).stock());
final partenairesProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(fournituresProRepositoryProvider).partenaires());
final partenaireProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(fournituresProRepositoryProvider).partenaire(id));

class FournituresProRepository {
  FournituresProRepository(this._api);
  final KojiProApi _api;

  Future<Json> catalogue() => _api.get('/api/fournitures/articles');
  Future<Json> enregistrer(Json article, {String? id}) async {
    final r = id == null ? await _api.post('/api/fournitures/articles', article) : await _api.patch('/api/fournitures/articles', {'id': id, ...article});
    return Map<String, dynamic>.from(r['article'] as Map);
  }

  Future<Json> scanner({String? photo, String? texte}) => _api.post('/api/fournitures/scanner', {if (photo != null) 'photo': photo, if (texte != null) 'texte': texte});
  Future<Json> chantier(String projectId) => _api.get('/api/fournitures/chantier', query: {'projet': projectId});

  Future<Json> bons() => _api.get('/api/fournitures/bons');
  Future<List<Json>> creerBons(Json corps) async => ((await _api.post('/api/fournitures/bons', corps))['bons'] as List).whereType<Map>().map((b) => Map<String, dynamic>.from(b)).toList();
  Future<Json> actionBon(String id, String action, [Json extra = const {}]) => _api.patch('/api/fournitures/bons', {'id': id, 'action': action, ...extra});
  Future<Uint8List> pdfBon(String id) => _api.getBytes('/api/fournitures/bons/pdf', query: {'id': id});

  Future<Json> lireLivraison(String bonId, String photo) => _api.post('/api/fournitures/livraisons', {'bonId': bonId, 'photo': photo});
  Future<Json> validerLivraison(Json corps) => _api.patch('/api/fournitures/livraisons', corps);

  Future<Json> stock() => _api.get('/api/fournitures/stock');
  Future<Json> cloture(String projectId) => _api.get('/api/fournitures/stock', query: {'cloture': projectId});
  Future<Json> actionStock(Json corps) => _api.post('/api/fournitures/stock', corps);

  Future<Json> partenaires() => _api.get('/api/fournitures/partenaires');
  Future<Json> partenaire(String id) => _api.get('/api/fournitures/partenaires', query: {'id': id});
  Future<Json> ajouterPartenaire(String partenaireId, String ref) => _api.post('/api/fournitures/partenaires', {'action': 'ajouter', 'partenaireId': partenaireId, 'ref': ref});
}
