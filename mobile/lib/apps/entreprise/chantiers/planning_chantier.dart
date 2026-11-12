/// Lancer le chantier (maquette PRO-02.1), mêmes règles que le site
/// (lib/planning-chantier.js) : planning proposé à partir des lots du devis
/// et des durées de la bibliothèque, lots enchaînés en jours ouvrés
/// (samedi, dimanche et jours fériés exclus).
library;

String isoJour(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime _date(String iso) {
  final p = iso.substring(0, 10).split('-').map(int.parse).toList();
  return DateTime.utc(p[0], p[1], p[2]);
}

DateTime _paques(int annee) {
  final a = annee % 19, b = annee ~/ 100, c = annee % 100;
  final d = b ~/ 4, e = b % 4, f = (b + 8) ~/ 25, g = (b - f + 1) ~/ 3;
  final h = (19 * a + b - d - g + 15) % 30;
  final i = c ~/ 4, k = c % 4;
  final l = (32 + 2 * e + 2 * i - h - k) % 7;
  final m = (a + 11 * h + 22 * l) ~/ 451;
  final mois = (h + l - 7 * m + 114) ~/ 31;
  final jour = ((h + l - 7 * m + 114) % 31) + 1;
  return DateTime.utc(annee, mois, jour);
}

/// Jours fériés en métropole.
Set<String> joursFeries(int annee) {
  final p = _paques(annee);
  return {
    for (final md in [
      '01-01',
      '05-01',
      '05-08',
      '07-14',
      '08-15',
      '11-01',
      '11-11',
      '12-25'
    ])
      '$annee-$md',
    for (final n in [1, 39, 50]) isoJour(p.add(Duration(days: n))),
  };
}

bool estOuvre(String iso) {
  final d = _date(iso);
  if (d.weekday == DateTime.saturday || d.weekday == DateTime.sunday) {
    return false;
  }
  return !joursFeries(d.year).contains(isoJour(d));
}

String premierOuvre(String iso) {
  var d = _date(iso);
  while (!estOuvre(isoJour(d))) {
    d = d.add(const Duration(days: 1));
  }
  return isoJour(d);
}

String finApres(String debut, int jours) {
  var d = _date(premierOuvre(debut));
  var restants = (jours < 1 ? 1 : jours) - 1;
  while (restants > 0) {
    d = d.add(const Duration(days: 1));
    if (estOuvre(isoJour(d))) restants--;
  }
  return isoJour(d);
}

String lendemainOuvre(String iso) =>
    premierOuvre(isoJour(_date(iso).add(const Duration(days: 1))));

int joursOuvresEntre(String debut, String fin) {
  if (fin.compareTo(debut) < 0) return 0;
  var n = 0;
  for (var d = _date(debut);
      isoJour(d).compareTo(fin) <= 0;
      d = d.add(const Duration(days: 1))) {
    if (estOuvre(isoJour(d))) n++;
  }
  return n;
}

String demarragePropose(String aujourdhui, [int delai = 3]) {
  var d = aujourdhui;
  for (var i = 0; i < delai; i++) {
    d = lendemainOuvre(d);
  }
  return d;
}

double _n(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;

double heuresLigne(Map<String, dynamic> ligne) {
  final directes = _n(ligne['correctedTimeHours']) > 0
      ? _n(ligne['correctedTimeHours'])
      : _n(ligne['totalTimeHours']) > 0
          ? _n(ligne['totalTimeHours'])
          : _n(ligne['normativeTime']) * _n(ligne['quantity']);
  if (directes > 0) return directes;
  final sous = ligne['subItems'];
  if (sous is! List) return 0;
  return sous
      .whereType<Map>()
      .fold(0.0, (n, s) => n + heuresLigne(Map<String, dynamic>.from(s)));
}

/// Même clé que la fiche chantier du site.
String cleLigne(Map<String, dynamic> ligne, int index) {
  String s(dynamic v) => v == null ? '' : '$v';
  final lot = s(ligne['roomId']).isNotEmpty
      ? s(ligne['roomId'])
      : (s(ligne['room']).isNotEmpty ? s(ligne['room']) : 'chantier');
  final id = s(ligne['taskId']).isNotEmpty
      ? s(ligne['taskId'])
      : (s(ligne['code']).isNotEmpty ? s(ligne['code']) : '$index');
  return '$lot-$id';
}

class LigneLot {
  const LigneLot(this.cle, this.ligne, this.heures);
  final String cle;
  final Map<String, dynamic> ligne;
  final double heures;
}

class LotPlanifie {
  const LotPlanifie({
    required this.numero,
    required this.nom,
    required this.lignes,
    required this.heures,
    required this.montantHt,
    required this.jours,
    required this.debut,
    required this.fin,
  });

  final String numero;
  final String nom;
  final List<LigneLot> lignes;
  final double heures;
  final double montantHt;
  final int jours;
  final String debut;
  final String fin;
}

class PlanningPropose {
  const PlanningPropose(this.debut, this.fin, this.joursOuvres, this.lots);
  final String debut;
  final String fin;
  final int joursOuvres;
  final List<LotPlanifie> lots;
}

PlanningPropose proposerPlanning(
  Map<String, dynamic>? devis, {
  required String debut,
  double heuresParJour = 7,
  Map<String, int> durees = const {},
}) {
  final items = devis?['items'] is List
      ? (devis!['items'] as List).whereType<Map>().toList()
      : const <Map>[];
  final noms = <String>[];
  final parLot = <String, List<LigneLot>>{};
  final montants = <String, double>{};
  for (final (i, brut) in items.indexed) {
    final ligne = Map<String, dynamic>.from(brut);
    final room = '${ligne['room'] ?? ''}'.trim();
    final nom = room.isEmpty ? 'Chantier' : room;
    if (!parLot.containsKey(nom)) noms.add(nom);
    parLot
        .putIfAbsent(nom, () => [])
        .add(LigneLot(cleLigne(ligne, i), ligne, heuresLigne(ligne)));
    montants[nom] = (montants[nom] ?? 0) + _n(ligne['totalHt']);
  }
  final depart = premierOuvre(debut);
  var curseur = depart;
  final lots = <LotPlanifie>[];
  for (final (i, nom) in noms.indexed) {
    final lignes = parLot[nom]!;
    final heures = lignes.fold(0.0, (n, l) => n + l.heures);
    final jours = durees[nom] ??
        (heures / (heuresParJour < 1 ? 1 : heuresParJour)).ceil().clamp(1, 999);
    final debutLot = i == 0 ? curseur : lendemainOuvre(curseur);
    final finLot = finApres(debutLot, jours);
    curseur = finLot;
    lots.add(LotPlanifie(
      numero: (i + 1).toString().padLeft(2, '0'),
      nom: nom,
      lignes: lignes,
      heures: (heures * 100).round() / 100,
      montantHt: ((montants[nom] ?? 0) * 100).round() / 100,
      jours: jours < 1 ? 1 : jours,
      debut: debutLot,
      fin: finLot,
    ));
  }
  final fin = lots.isEmpty ? depart : lots.last.fin;
  return PlanningPropose(depart, fin, joursOuvresEntre(depart, fin), lots);
}
