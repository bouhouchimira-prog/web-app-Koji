import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/bibliotheque/bibliotheque_logic.dart';

// Bibliothèque de Koji Pro sur l'API du site, la même que
// /bibliotheque-ouvrages sur le web : ouvrages (socle Koji + versions de
// l'entreprise), taux par métier, taux déduits des factures.
final bibliothequeRepositoryProvider = Provider<BibliothequeRepository>((ref) => BibliothequeRepository(ref.watch(kojiProApiProvider)));

final ouvragesProvider = FutureProvider.autoDispose<List<Json>>((ref) => ref.watch(bibliothequeRepositoryProvider).ouvrages());
final tauxProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(bibliothequeRepositoryProvider).taux());
final articlesBibliothequeProvider = FutureProvider.autoDispose<List<Json>>((ref) => ref.watch(bibliothequeRepositoryProvider).articles());
final analyseFacturesProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(bibliothequeRepositoryProvider).analyse());

class BibliothequeRepository {
  BibliothequeRepository(this._api);
  final KojiProApi _api;

  Future<List<Json>> ouvrages() async => listeJson((await _api.get('/api/ouvrages'))['ouvrages']);

  /// Modifie la version de l'entreprise (jamais le socle commun).
  Future<List<Json>> enregistrerOuvrage(String id, Json champs) async => listeJson((await _api.patch('/api/ouvrages', {...champs, 'id': id, 'perso': true}))['ouvrages']);

  Future<Json> creerOuvrage(Json ouvrage) async => Map<String, dynamic>.from((await _api.post('/api/ouvrages', ouvrage))['ouvrage'] as Map? ?? const {});

  /// Koji remplit la fiche depuis une description (même route que le site).
  Future<Json> proposer(String description) async => Map<String, dynamic>.from((await _api.post('/api/ouvrages/proposer', {'description': description}))['proposition'] as Map? ?? const {});

  Future<Json> taux() => _api.get('/api/entreprise/taux');

  /// Taux par métier ; `valider` pose la date de validation.
  Future<Json> enregistrerTaux(Map<String, num?> taux, {List<String> valider = const []}) => _api.put('/api/entreprise/taux', {'taux': taux, 'valider': valider});

  Future<List<Json>> articles() async => listeJson((await _api.get('/api/fournitures/articles'))['articles']);

  Future<Json> analyse() => _api.get('/api/bibliotheque/factures');

  /// Dépôt d'une facture (photo JPEG en data URL, PDF, ou texte CSV).
  Future<Json> deposer({required String nom, String? data, String? texte}) => _api.post('/api/bibliotheque/factures', {'nom': nom, if (data != null) 'data': data, if (texte != null) 'texte': texte});

  Future<Json> actionFactures(String action, [Json extra = const {}]) => _api.patch('/api/bibliotheque/factures', {'action': action, ...extra});
}
