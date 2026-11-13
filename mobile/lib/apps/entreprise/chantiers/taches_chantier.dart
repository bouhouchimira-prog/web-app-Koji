import 'package:intl/intl.dart';

/// Tâches du chantier (maquette PRO-02.7), mêmes règles que le site
/// (lib/taches-chantier.js), testées sur les mêmes exemples : liste par
/// lot, « Fait », « Bloquant », filtres Aujourd'hui / Bloquées, ajout en
/// dictant.

String _s(dynamic v) => v == null ? '' : '$v';
String _j(dynamic v) {
  final t = _s(v);
  return t.length >= 10 ? t.substring(0, 10) : t;
}

const filtresTaches = [
  ('toutes', 'Toutes'),
  ('aujourdhui', "Aujourd'hui"),
  ('bloquees', 'Bloquées'),
];

String sansAccents(String t) {
  const de = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ';
  const vers = 'aaaaaaceeeeiiiinooooouuuuyyoa';
  final b = StringBuffer();
  for (final c in t.toLowerCase().split('')) {
    final i = de.indexOf(c);
    b.write(i >= 0 ? vers[i] : c);
  }
  return b.toString();
}

bool estAffectee(Map t) {
  final qui = _s(t['assignedTo']).trim();
  return qui.isNotEmpty && !RegExp(r'^(a|à) affecter$', caseSensitive: false).hasMatch(qui);
}

String _nomQui(Map t) =>
    RegExp(r'^(equipe|équipe)$', caseSensitive: false).hasMatch(_s(t['assignedTo']).trim())
        ? 'Équipe'
        : _s(t['assignedTo']);

String dateTache(Map t) => _j(_s(t['startDate']).isNotEmpty
    ? t['startDate']
    : _s(t['dueDate']).isNotEmpty
        ? t['dueDate']
        : t['endDate']);

String _fin(Map t) => _j(_s(t['endDate']).isNotEmpty
    ? t['endDate']
    : _s(t['dueDate']).isNotEmpty
        ? t['dueDate']
        : t['startDate']);

int semaine(String jour) {
  final d = DateTime.utc(int.parse(jour.substring(0, 4)),
      int.parse(jour.substring(5, 7)), int.parse(jour.substring(8, 10)));
  final jeudi = d.add(Duration(days: 3 - (d.weekday - 1)));
  final premier = DateTime.utc(jeudi.year, 1, 4);
  final jeudi1 = premier.add(Duration(days: 3 - (premier.weekday - 1)));
  return 1 + jeudi.difference(jeudi1).inDays ~/ 7;
}

String _jourCourt(String jour, String aujourdhui) {
  final d = DateTime.parse(jour);
  final memeMois = jour.substring(0, 7) == aujourdhui.substring(0, 7);
  return DateFormat(memeMois ? 'E d' : 'E d MMM', 'fr_FR').format(d);
}

/// « Rui C. · jeu. 30 », « à affecter · sem. 46 », « … · bloquant : … ».
String ligneTache(Map t, String aujourdhui) {
  final debut = dateTache(t);
  final fin = _fin(t);
  final qui = estAffectee(t) ? _nomQui(t) : 'à affecter';
  var quand = 'pas de date';
  if (debut.isNotEmpty) {
    if (!estAffectee(t)) {
      quand = 'sem. ${semaine(debut)}';
    } else if (fin.isNotEmpty && fin != debut) {
      quand = '${_jourCourt(debut, aujourdhui)} → ${_jourCourt(fin, aujourdhui)}';
    } else {
      quand = _jourCourt(debut, aujourdhui);
    }
  }
  final b = t['bloquant'];
  final bloque = t['done'] != true && b is Map && _s(b['raison']).isNotEmpty
      ? ' · bloquant : ${b['raison']}'
      : '';
  return '$qui · $quand$bloque';
}

bool estBloquee(Map t) {
  final b = t['bloquant'];
  return t['done'] != true && b is Map && _s(b['raison']).isNotEmpty;
}

/// « Fait », « Bloquant », « En retard », « À valider » ou rien.
String etatTache(Map t, String aujourdhui) {
  if (t['done'] == true) return 'Fait';
  if (estBloquee(t)) return 'Bloquant';
  if (t['pendingValidation'] == true) return 'À valider';
  final fin = _fin(t);
  if (fin.isNotEmpty && fin.compareTo(aujourdhui) < 0) return 'En retard';
  return '';
}

bool duJour(Map t, String aujourdhui) {
  final debut = dateTache(t);
  final fin = _fin(t).isEmpty ? debut : _fin(t);
  return t['done'] != true &&
      debut.isNotEmpty &&
      debut.compareTo(aujourdhui) <= 0 &&
      aujourdhui.compareTo(fin) <= 0;
}

List<Map<String, dynamic>> filtrerTaches(
        List<Map<String, dynamic>> taches, String filtre, String aujourdhui) =>
    switch (filtre) {
      'aujourdhui' => taches.where((t) => duJour(t, aujourdhui)).toList(),
      'bloquees' => taches.where(estBloquee).toList(),
      _ => taches,
    };

Map<String, int> compterTaches(
        List<Map<String, dynamic>> taches, String aujourdhui) =>
    {
      'toutes': taches.length,
      'faites': taches.where((t) => t['done'] == true).length,
      'aujourdhui': taches.where((t) => duJour(t, aujourdhui)).length,
      'bloquees': taches.where(estBloquee).length,
    };

class LotTaches {
  const LotTaches(this.nom, this.titre, this.taches);
  final String nom, titre;
  final List<Map<String, dynamic>> taches;
  int get faites => taches.where((t) => t['done'] == true).length;
}

/// Lots dans l'ordre du devis, puis les tâches hors devis ; par date.
List<LotTaches> tachesParLot(
    List<Map<String, dynamic>> taches, Map<String, dynamic>? devis) {
  final ordre = <String>[];
  for (final l in (devis?['items'] as List?) ?? const []) {
    final nom = _s((l as Map)['room']).trim().isEmpty ? 'Chantier' : _s(l['room']).trim();
    if (!ordre.contains(nom)) ordre.add(nom);
  }
  final groupes = <String, List<Map<String, dynamic>>>{};
  for (final t in taches) {
    final nom = _s(t['room']).trim().isEmpty ? 'Autres tâches' : _s(t['room']).trim();
    groupes.putIfAbsent(nom, () => []).add(t);
  }
  final noms = [
    ...ordre.where(groupes.containsKey),
    ...groupes.keys.where((n) => !ordre.contains(n)),
  ];
  return [
    for (final nom in noms)
      LotTaches(
          nom,
          ordre.contains(nom)
              ? 'Lot ${(ordre.indexOf(nom) + 1).toString().padLeft(2, '0')} · $nom'
              : nom,
          [...groupes[nom]!]..sort((a, b) {
              final da = dateTache(a).isEmpty ? '9999' : dateTache(a);
              final db = dateTache(b).isEmpty ? '9999' : dateTache(b);
              return da.compareTo(db);
            })),
  ];
}

const _jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const _vides = {'avec', 'pour', 'le', 'la', 'les', 'de', 'des', 'du', 'et', 'a', 'au', 'aux', 'en', 'un', 'une', 'sur', 'dans'};

List<String> _racines(String t) => sansAccents(t)
    .split(RegExp('[^a-z0-9]+'))
    .where((m) => m.length >= 4 && !_vides.contains(m))
    .map((m) => m.substring(0, m.length < 5 ? m.length : 5))
    .toList();

typedef TacheComprise = ({String label, String lot, String compagnonId, String compagnonNom, String jour});

/// « Poser les plinthes carrelées vendredi avec Rui » → tâche, lot,
/// compagnon, jour ; ce qui n'est pas compris reste vide.
TacheComprise comprendreDictee(String texte,
    {List<String> lots = const [],
    List<Map<String, dynamic>> compagnons = const [],
    required String aujourdhui}) {
  var reste = ' ${texte.replaceAll(RegExp('[«»"]'), ' ').trim()} ';
  // Les deux chaînes gardent la même longueur (accents remplacés un à un).
  String plat() => sansAccents(reste);
  void retirer(RegExp motif) {
    final m = motif.firstMatch(plat());
    if (m != null) reste = '${reste.substring(0, m.start)} ${reste.substring(m.end)}';
  }

  Map<String, dynamic>? compagnon;
  for (final c in compagnons) {
    final prenom = sansAccents(_s(c['name']).trim().split(RegExp(r'\s+')).first);
    if (prenom.length < 2) continue;
    final motif = RegExp('\\s(?:avec\\s+|par\\s+|pour\\s+)?${RegExp.escape(prenom)}\\b\\S*');
    if (motif.hasMatch(plat())) {
      compagnon = c;
      retirer(motif);
      break;
    }
  }

  var jour = '';
  final base = DateTime.parse(aujourdhui);
  String plus(int n) => DateFormat('yyyy-MM-dd').format(base.add(Duration(days: n)));
  final relatif = RegExp(r"\s(apres-demain|demain|aujourd'hui|aujourdhui|ce soir)\b");
  final semaineJ = RegExp('\\s(?:ce\\s+|le\\s+)?(${_jours.join('|')})(\\s+prochain)?\\b');
  final quantieme = RegExp(r'\sle\s+(\d{1,2})\b');
  final r = relatif.firstMatch(plat());
  if (r != null) {
    jour = plus(r.group(1) == 'apres-demain' ? 2 : r.group(1) == 'demain' ? 1 : 0);
    retirer(relatif);
  } else if (semaineJ.firstMatch(plat()) case final m?) {
    var ecart = (_jours.indexOf(m.group(1)!) + 1 - base.weekday + 7) % 7;
    if (ecart == 0 && m.group(2) != null) ecart = 7;
    jour = plus(ecart);
    retirer(semaineJ);
  } else if (quantieme.firstMatch(plat()) case final m?) {
    final n = int.parse(m.group(1)!);
    var d = DateTime(base.year, base.month, n);
    if (n < base.day) d = DateTime(base.year, base.month + 1, n);
    jour = DateFormat('yyyy-MM-dd').format(d);
    retirer(quantieme);
  }

  var lot = '';
  var meilleur = 0;
  final mots = _racines(reste);
  for (final l in lots) {
    final score = _racines(l).where(mots.contains).length;
    if (score > meilleur) {
      meilleur = score;
      lot = l;
    }
  }

  final label = reste
      .replaceAll(RegExp(r'\s+'), ' ')
      .replaceAllMapped(RegExp(r'\s+([,.;!?])'), (m) => m.group(1)!)
      .replaceAll(RegExp(r'[\s,.;]+$'), '')
      .trim();
  return (
    label: label.isEmpty ? '' : '${label[0].toUpperCase()}${label.substring(1)}',
    lot: lot,
    compagnonId: _s(compagnon?['id']),
    compagnonNom: _s(compagnon?['name']),
    jour: jour,
  );
}
