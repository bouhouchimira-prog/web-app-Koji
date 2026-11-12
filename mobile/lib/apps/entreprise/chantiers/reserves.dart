import 'package:intl/intl.dart';

/// Réserves d'un chantier (maquette PRO-02.3), mêmes règles que le site
/// (lib/reserves.js) : « a_faire » → « faite » (photo de levée à vérifier)
/// → « levee » ; « proposee » par la cliente ; refuser remet « a_faire ».

String _s(dynamic v) => v == null ? '' : '$v';

class Reserve {
  const Reserve(this.data);
  final Map<String, dynamic> data;

  String get id => _s(data['id']);
  String get numero => _s(data['numero']);
  String get titre => _s(data['titre']);
  String get lieu => _s(data['lieu']);
  String get statut =>
      _s(data['statut']).isEmpty ? 'a_faire' : _s(data['statut']);
  String get attribueeNom => _s(data['attribueeNom']);
  String get pourLe => _s(data['pourLe']);
  String get note => _s(data['note']);
  String get leveeLe => _s(data['leveeLe']);
}

const filtresReserves = [
  ('toutes', 'Toutes'),
  ('a_faire', 'À faire'),
  ('faite', 'À vérifier'),
  ('levee', 'Levées'),
];

String _jour(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d.toLocal());
}

/// Étiquette courte du téléphone et ton : « À faire », « En retard », « À
/// vérifier », « Levée », « De la cliente ».
({String label, bool plein}) etiquetteReserve(Reserve r, String aujourdhui) =>
    switch (r.statut) {
      'levee' => (label: 'Levée', plein: false),
      'faite' => (label: 'À vérifier', plein: false),
      'proposee' => (label: 'De la cliente', plein: false),
      _ => r.pourLe.isNotEmpty &&
              r.pourLe.substring(0, 10).compareTo(aujourdhui) < 0
          ? (label: 'En retard', plein: true)
          : (label: 'À faire', plein: false),
    };

/// « Rui C. · pour le 2 déc. », « Levée le 28 nov. », « à attribuer ».
String ligneReserve(Reserve r) {
  if (r.statut == 'levee') {
    return r.leveeLe.isEmpty ? 'Levée' : 'Levée le ${_jour(r.leveeLe)}';
  }
  final qui = r.attribueeNom.isEmpty ? 'à attribuer' : r.attribueeNom;
  return r.pourLe.isEmpty ? qui : '$qui · pour le ${_jour(r.pourLe)}';
}

Map<String, int> compterReserves(List<Reserve> reserves) {
  final c = {
    'toutes': reserves.length,
    'a_faire': 0,
    'faite': 0,
    'levee': 0,
    'proposee': 0
  };
  for (final r in reserves) {
    if (c.containsKey(r.statut)) c[r.statut] = c[r.statut]! + 1;
  }
  c['badge'] = c['a_faire']! + c['faite']! + c['proposee']!;
  return c;
}
