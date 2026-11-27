import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/chantiers/pro_fiche_chantier_screen.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

// KPRO-47 : la fiche d'un chantier s'ouvre en une seule requête
// (/api/fiche-chantier) ; si elle échoue, l'app retombe sur les dix
// lectures d'avant, qui donnent le même résultat.
final _fiche = <String, dynamic>{
  'project': {'id': 'c1', 'name': 'Salle de bain'},
  'quotes': [
    {'id': 'q1', 'projectId': 'c1', 'quoteNumber': '2026-041'}
  ],
  'tasks': [
    {'id': 't1', 'projectId': 'c1', 'title': 'Peindre les murs'}
  ],
  'invoices': [],
  'calendarEvents': [
    {'id': 'e1', 'projectId': 'c1'}
  ],
  'alerts': [],
  'projectDocuments': [
    {'id': 'd1', 'projectId': 'c1'}
  ],
  'photos': [
    {'id': 'p1', 'phase': 'avant', 'takenAt': '2026-11-20T08:00:00Z', 'author': 'Imed'}
  ],
  'reserves': [
    {'id': 'r1', 'numero': '1', 'titre': 'Joint à reprendre'}
  ],
  'access': {'email': 'client@exemple.fr'},
};

class _Serveur extends ProKojiWebClient {
  _Serveur({this.ficheEchoue = false}) : super(accessToken: () => 'jeton-test');
  final bool ficheEchoue;
  final appels = <String>[];

  @override
  Future<Map<String, dynamic>> ficheChantier(String projectId) async {
    appels.add('fiche');
    if (ficheEchoue) throw const ProKojiWebException('Erreur 404');
    return _fiche;
  }

  @override
  Future<List<Map<String, dynamic>>> liste(String path, String key) async {
    appels.add(path);
    final tous = <String, List<Map<String, dynamic>>>{
      'projects': [Map<String, dynamic>.from(_fiche['project'] as Map)],
      'quotes': [Map<String, dynamic>.from((_fiche['quotes'] as List).first as Map)],
      'tasks': [Map<String, dynamic>.from((_fiche['tasks'] as List).first as Map)],
    };
    return tous[key] ?? const [];
  }

  @override
  Future<Map<String, dynamic>?> accesClient(String projectId) async {
    appels.add('acces');
    return null;
  }

  @override
  Future<List<Map<String, dynamic>>> photosChantier(String projectId) async {
    appels.add('photos');
    return const [];
  }

  @override
  Future<List<Map<String, dynamic>>> reserves(String projectId) async {
    appels.add('reserves');
    return const [];
  }
}

Future<DonneesFiche?> _lire(_Serveur serveur) async {
  final conteneur = ProviderContainer(
      overrides: [proKojiWebProvider.overrideWithValue(serveur)]);
  addTearDown(conteneur.dispose);
  final abonnement = conteneur.listen(proFicheChantierProvider('c1'), (_, __) {});
  addTearDown(abonnement.close);
  return conteneur.read(proFicheChantierProvider('c1').future);
}

void main() {
  test('la réponse unique donne toute la fiche', () {
    final f = donneesFicheDepuis(_fiche)!;
    expect(f.projet['name'], 'Salle de bain');
    expect(f.devis?['quoteNumber'], '2026-041');
    expect(f.taches.single['title'], 'Peindre les murs');
    expect(f.rdv, hasLength(1));
    expect(f.documents, hasLength(1));
    expect(f.photos.single.phase, 'avant');
    expect(f.reserves.single.titre, 'Joint à reprendre');
    expect(f.acces?['email'], 'client@exemple.fr');
  });

  test('sans chantier dans la réponse : pas de fiche', () {
    expect(donneesFicheDepuis(const {}), isNull);
  });

  test('une seule requête quand le site répond', () async {
    final serveur = _Serveur();
    final f = await _lire(serveur);
    expect(serveur.appels, ['fiche']);
    expect(f?.reserves, hasLength(1));
  });

  test('en cas d\'échec, retour aux dix lectures d\'avant', () async {
    final serveur = _Serveur(ficheEchoue: true);
    final f = await _lire(serveur);
    expect(serveur.appels.first, 'fiche');
    expect(serveur.appels, containsAll(['/api/projects', '/api/quotes', 'acces', 'photos', 'reserves']));
    expect(f?.projet['id'], 'c1');
    expect(f?.taches.single['title'], 'Peindre les murs');
  });
}
