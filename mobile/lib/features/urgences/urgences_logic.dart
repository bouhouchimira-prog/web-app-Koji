import 'dart:convert';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart';

// Urgences : dépannage immédiat (maquette PRO-17), règles communes aux deux
// apps. Mêmes textes que lib/urgences.js du site (tests/unit/urgences.test.js
// vérifie qu'ils ne divergent pas). L'attribution, les prix et les états
// sont calculés par le site ; l'app affiche et envoie.

const numeroGaz = '0 800 47 33 33';
const texteGaz =
    'Sortez, n\'actionnez aucun interrupteur, appelez Urgence sécurité gaz au $numeroGaz.';
const notePro =
    'Vous acceptez ou refusez chaque urgence librement. Refuser ne change ni votre visibilité ni vos prochaines demandes.';
const noteSerrure =
    'Serrurerie : demandez une pièce d\'identité et un justificatif de domicile avant d\'ouvrir la porte.';

class QuestionUrgence {
  const QuestionUrgence(this.id, this.label, this.court, this.options);
  final String id;
  final String label;
  final String court;
  final List<String> options;
}

class CategorieUrgence {
  const CategorieUrgence(
      this.id, this.label, this.pro, this.icone, this.questions);
  final String id;

  /// Libellé côté particulier (tuile de l'écran A).
  final String label;

  /// Libellé côté artisan (« Canalisation bouchée »).
  final String pro;
  final String icone;
  final List<QuestionUrgence> questions;
}

const categoriesUrgence = [
  CategorieUrgence(
      'fuite', 'Fuite d\'eau', 'Fuite d\'eau', 'M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z', [
    QuestionUrgence('ou', 'Où ?', 'Où', ['Sous l\'évier', 'WC', 'Chauffe-eau', 'Plafond']),
    QuestionUrgence('coupee', 'L\'eau est-elle coupée ?', 'Eau coupée', ['Oui', 'Non', 'Je ne sais pas']),
  ]),
  CategorieUrgence('bouche', 'WC ou évier bouché', 'Canalisation bouchée',
      'M3 7h9a5 5 0 0 1 5 5v9M3 11h8a2 2 0 0 1 2 2v8', [
    QuestionUrgence('quoi', 'Qu\'est-ce qui est bouché ?', 'Bouché',
        ['WC', 'Évier', 'Douche ou baignoire', 'Toute l\'évacuation']),
    QuestionUrgence('deborde', 'L\'eau déborde-t-elle ?', 'Débordement', ['Oui', 'Non']),
  ]),
  CategorieUrgence('electricite', 'Panne d\'électricité', 'Panne d\'électricité',
      'M13 3L5 14h6l-1 7 8-11h-6z', [
    QuestionUrgence('ou', 'Où est la panne ?', 'Panne',
        ['Tout le logement', 'Une pièce', 'Une prise ou un appareil']),
    QuestionUrgence('disjoncteur', 'Le disjoncteur se réarme-t-il ?', 'Disjoncteur',
        ['Oui', 'Non', 'Je ne sais pas']),
  ]),
  CategorieUrgence('serrure', 'Porte claquée, serrure', 'Porte claquée, serrure',
      'M8 15a4 4 0 1 1 3.5-6L21 9v3h-2v2h-2v-2h-5.5A4 4 0 0 1 8 15z', [
    QuestionUrgence('quoi', 'Que se passe-t-il ?', 'Situation',
        ['Porte claquée', 'Clé perdue ou volée', 'Serrure bloquée', 'Après une effraction']),
    QuestionUrgence('porte', 'Quelle porte ?', 'Porte', ['Standard', 'Blindée', 'Je ne sais pas']),
  ]),
  CategorieUrgence('eau_chaude', 'Plus d\'eau chaude', 'Plus d\'eau chaude',
      'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-3 2-4.5 2.5-7 1.5 1 2.5 2.5 2.5 4.5', [
    QuestionUrgence('appareil', 'Quel appareil ?', 'Appareil',
        ['Chauffe-eau électrique', 'Chaudière', 'Je ne sais pas']),
    QuestionUrgence('fuite', 'Y a-t-il une fuite ?', 'Fuite', ['Oui', 'Non']),
  ]),
  CategorieUrgence('vitre', 'Vitre cassée', 'Vitre cassée',
      'M4 4h16v16H4zM4 12h16M12 4v16M14 6l-3 4 2 1-2 3', [
    QuestionUrgence('quoi', 'Quelle vitre ?', 'Vitre',
        ['Fenêtre', 'Porte-fenêtre', 'Porte d\'entrée', 'Vitrine']),
    QuestionUrgence('ouvert', 'Le logement est-il ouvert sur l\'extérieur ?',
        'Ouvert sur l\'extérieur', ['Oui', 'Non']),
  ]),
];

/// Ordre des urgences côté artisan (maquette ordinateur).
const ordrePro = ['fuite', 'bouche', 'eau_chaude', 'electricite', 'serrure', 'vitre'];

CategorieUrgence? categorieUrgence(String id) {
  for (final c in categoriesUrgence) {
    if (c.id == id) return c;
  }
  return null;
}

bool reponsesCompletes(CategorieUrgence c, Map<String, String> reponses) =>
    c.questions.every((q) => (reponses[q.id] ?? '').isNotEmpty);

bool telephoneValide(String t) => t.replaceAll(RegExp(r'\D'), '').length >= 10;

// ── Lecture des réponses du site ───────────────────────────────────────────

String texteDe(Object? v) => v == null ? '' : '$v';
Map<String, dynamic> mapDe(Object? v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Map<String, dynamic>> listeDe(Object? v) => (v as List? ?? const [])
    .whereType<Map>()
    .map((x) => Map<String, dynamic>.from(x))
    .toList();

/// Secondes avant la fin d'une proposition (60 s pour accepter).
int secondesRestantes(String finLe, DateTime maintenant) {
  final fin = DateTime.tryParse(finLe);
  if (fin == null) return 0;
  final s = (fin.difference(maintenant).inMilliseconds / 1000).round();
  return s < 0 ? 0 : s;
}

/// « 0:42 » dans l'anneau de l'alerte.
String compteARebours(int secondes) {
  final s = secondes.clamp(0, 59);
  return '0:${s.toString().padLeft(2, '0')}';
}

/// États où l'écran du particulier se rafraîchit souvent.
const etatsFinis = {'terminee', 'annulee'};
Duration intervalleSuivi(String etat) =>
    etat == 'recherche' || etat == 'acceptee'
        ? const Duration(seconds: 4)
        : const Duration(seconds: 15);

/// Titre et sous-titre de l'écran du particulier quand aucun artisan n'est
/// (encore) affiché.
(String, String) titreEtat(String etat) => switch (etat) {
      'recherche' => ('Recherche d\'un artisan', 'les plus proches sont prévenus'),
      'sans_artisan' => ('Aucun artisan disponible', 'pour l\'instant'),
      'expiree' => ('Délai dépassé', 'l\'artisan a été libéré'),
      'annulee' => ('Urgence annulée', 'sans frais'),
      'terminee' => ('Intervention terminée', ''),
      _ => ('Urgence', ''),
    };

/// Photo prise pour l'urgence : seulement un JPEG (le site retire la
/// position GPS avant de la montrer à l'artisan).
bool estJpeg(List<int> b) => b.length > 3 && b[0] == 0xFF && b[1] == 0xD8;
String dataUrlJpeg(List<int> b) => 'data:image/jpeg;base64,${base64Encode(b)}';

/// « 101,00 € ».
String euros2(num n) {
  final p = n.toStringAsFixed(2).split('.');
  final ent =
      p[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
  return '$ent,${p[1]} €';
}

/// « 89 € », « 89,50 € ».
String eurosCourt(num n) {
  final r = (n * 100).round() / 100;
  return r == r.roundToDouble()
      ? '${r.toInt()} €'
      : '${r.toStringAsFixed(2).replaceAll('.', ',')} €';
}

// ── Accès au site ──────────────────────────────────────────────────────────

/// Côté artisan : /api/urgences (session Koji Pro).
class UrgencesProRepository {
  UrgencesProRepository(this._api);
  final KojiProApi _api;

  Future<Map<String, dynamic>> vue() => _api.get('/api/urgences');
  Future<Map<String, dynamic>> alertes() =>
      _api.get('/api/urgences', query: {'alertes': 1});
  Future<Map<String, dynamic>> agir(Map<String, dynamic> corps) =>
      _api.post('/api/urgences', corps);
}

/// Côté particulier : /api/client/urgences (session du site).
class UrgencesClientRepository {
  UrgencesClientRepository(this._api);
  final KojiWebApiClient _api;

  bool get connecte => _api.isLoggedIn;
  Future<Map<String, dynamic>> accueil() async =>
      mapDe(await _api.get('/api/client/urgences'));
  Future<Map<String, dynamic>> prix(String categorie, String adresse) async =>
      mapDe(await _api.get('/api/client/urgences',
          query: {'prix': 1, 'categorie': categorie, 'adresse': adresse}));
  Future<Map<String, dynamic>> une(String id) async =>
      mapDe(mapDe(await _api.get('/api/client/urgences', query: {'id': id}))['urgence']);
  Future<Map<String, dynamic>> agir(Map<String, dynamic> corps) async =>
      mapDe(mapDe(await _api.postJson('/api/client/urgences', corps))['urgence']);
}
