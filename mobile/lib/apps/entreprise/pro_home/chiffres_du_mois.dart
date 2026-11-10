// PRO-01.2 : les trois chiffres du mois de l'accueil Koji Pro (Facturé HT,
// Encaissé TTC, Reste à encaisser TTC) et la ligne « depuis janvier ».
// Même calcul que le site (lib/chiffres-du-mois.js, testé des deux côtés) :
// - une facture compte dès qu'elle est émise (Emise / Payee), à sa date
//   d'émission ; brouillons et factures annulées ne comptent pas ;
// - un avoir (kind "avoir", montant négatif) vient en déduction ;
// - les factures ne stockent qu'un TTC : le HT est déduit du devis rattaché
//   (totalHt / totalTtc), sinon TVA 20 % appliquée et signalée (htEstimes).

const _tvaParDefaut = 1.2;
const _emises = {'Emise', 'Payee', 'Partielle'};
const _aEncaisser = {'Emise', 'Partielle'};
const _mois = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

String _majuscule(String s) =>
    s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

double _n(dynamic v) =>
    v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;

DateTime? _date(dynamic v) {
  final text = '${v ?? ''}';
  if (text.isEmpty) return null;
  return DateTime.tryParse(text)?.toLocal();
}

class Periode {
  const Periode({
    required this.cle,
    required this.annee,
    this.mois,
    required this.label,
    required this.titre,
  });

  final String cle;
  final int annee;

  /// 1-12, null pour l'année entière.
  final int? mois;
  final String label;
  final String titre;

  bool contient(DateTime? date) =>
      date != null &&
      date.year == annee &&
      (mois == null || date.month == mois);
}

/// Mois précédent, mois en cours, année.
List<Periode> periodesDisponibles(DateTime aujourdhui) {
  final courant = DateTime(aujourdhui.year, aujourdhui.month);
  final precedent = DateTime(courant.year, courant.month - 1);
  Periode mois(DateTime d) {
    final nom = _majuscule(_mois[d.month - 1]);
    return Periode(
      cle: '${d.year}-${d.month}',
      annee: d.year,
      mois: d.month,
      label: nom,
      titre: '$nom ${d.year}',
    );
  }

  return [
    mois(precedent),
    mois(courant),
    Periode(
      cle: 'annee-${courant.year}',
      annee: courant.year,
      label: 'Année',
      titre: 'Année ${courant.year}',
    ),
  ];
}

bool _estSigne(Map<String, dynamic> q) =>
    q['status'] == 'Signe' || q['signatureStatus'] == 'Signe';

/// Devis de référence d'un chantier : le signé, sinon le plus récent.
Map<String, dynamic>? devisDuChantier(
    String projectId, List<Map<String, dynamic>> quotes) {
  final lies = quotes.where((q) => '${q['projectId']}' == projectId).toList();
  for (final q in lies) {
    if (_estSigne(q)) return q;
  }
  lies.sort(
      (a, b) => '${b['updatedAt'] ?? ''}'.compareTo('${a['updatedAt'] ?? ''}'));
  return lies.isEmpty ? null : lies.first;
}

/// HT d'une facture et s'il est estimé (pas de devis exploitable).
({double ht, bool estime}) montantHt(Map<String, dynamic> facture,
    Map<String, Map<String, dynamic>> devisParId) {
  final ttc = _n(facture['amountTtc']);
  final devis = devisParId['${facture['quoteId'] ?? ''}'];
  final ht = _n(devis?['totalHt']);
  final totalTtc = _n(devis?['totalTtc']);
  if (ht > 0 && totalTtc > 0) return (ht: ttc * (ht / totalTtc), estime: false);
  return (ht: ttc / _tvaParDefaut, estime: true);
}

class Facture {
  const Facture(this.total, this.factures, this.avoirs, this.htEstimes);
  final double total;
  final int factures;
  final int avoirs;
  final int htEstimes;
}

class Reste {
  const Reste(this.total, this.impayees, this.echues, this.retardMax,
      [this.premiereEchue]);
  final double total;
  final int impayees;
  final int echues;
  final int retardMax;

  /// La facture échue depuis le plus longtemps (détail téléphone).
  final Map<String, dynamic>? premiereEchue;
}

class Marge {
  const Marge(this.taux, this.chantiers);
  final double taux;
  final int chantiers;
}

class ChiffresDuMois {
  const ChiffresDuMois({
    required this.facture,
    required this.encaisse,
    required this.paiements,
    required this.reste,
    required this.depuisJanvier,
    this.marge,
  });

  final Facture facture;
  final double encaisse;
  final int paiements;
  final Reste reste;
  final double depuisJanvier;
  final Marge? marge;
}

Facture _factureHt(List<Map<String, dynamic>> factures, Periode periode,
    Map<String, Map<String, dynamic>> devisParId) {
  var total = 0.0;
  var nb = 0, avoirs = 0, estimes = 0;
  for (final f in factures) {
    if (!_emises.contains(f['status'])) continue;
    if (!periode.contient(_date(f['issuedAt']))) continue;
    final m = montantHt(f, devisParId);
    total += m.ht;
    if (m.estime) estimes++;
    if (f['kind'] == 'avoir') {
      avoirs++;
    } else {
      nb++;
    }
  }
  return Facture(total, nb, avoirs, estimes);
}

/// Marge moyenne pondérée des chantiers qui ont des dépenses saisies.
Marge? margeMoyenne({
  required List<Map<String, dynamic>> projects,
  required List<Map<String, dynamic>> quotes,
  required List<Map<String, dynamic>> expenses,
}) {
  var devisHt = 0.0, depense = 0.0;
  var chantiers = 0;
  for (final p in projects) {
    final id = '${p['id']}';
    final spent = expenses
        .where((e) => '${e['projectId']}' == id)
        .fold<double>(0, (s, e) => s + _n(e['amount']));
    if (spent <= 0) continue;
    final ht = _n(devisDuChantier(id, quotes)?['totalHt']);
    if (ht <= 0) continue;
    devisHt += ht;
    depense += spent;
    chantiers++;
  }
  if (chantiers == 0) return null;
  return Marge((devisHt - depense) / devisHt, chantiers);
}

String _jour(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

ChiffresDuMois chiffresDuMois({
  required List<Map<String, dynamic>> invoices,
  required List<Map<String, dynamic>> quotes,
  List<Map<String, dynamic>> projects = const [],
  List<Map<String, dynamic>> expenses = const [],
  required Periode periode,
  required DateTime aujourdhui,
}) {
  final devisParId = {for (final q in quotes) '${q['id']}': q};
  final actives = invoices.where((f) => f['archived'] != true).toList();

  var encaisse = 0.0;
  var paiements = 0;
  for (final f in actives) {
    if (f['kind'] == 'avoir' || f['status'] != 'Payee') continue;
    if (!periode.contient(_date(f['paidAt']))) continue;
    encaisse += _n(f['amountTtc']);
    paiements++;
  }

  // Reste à encaisser : état à ce jour, avoirs déduits de leur facture.
  final credits = <String, double>{};
  for (final f in actives) {
    if (f['kind'] != 'avoir' || f['status'] == 'Annulee') continue;
    final ref = '${f['refInvoiceId'] ?? ''}';
    if (ref.isEmpty) continue;
    credits[ref] = (credits[ref] ?? 0) - _n(f['amountTtc']);
  }
  final jour = _jour(aujourdhui);
  var reste = 0.0;
  var impayees = 0, echues = 0, retardMax = 0;
  Map<String, dynamic>? premiereEchue;
  for (final f in actives) {
    if (f['kind'] == 'avoir' || !_aEncaisser.contains(f['status'])) continue;
    final du = _n(f['amountTtc']) - (credits['${f['id']}'] ?? 0);
    if (du <= 0.005) continue;
    reste += du;
    impayees++;
    final echeance = '${f['dueDate'] ?? ''}';
    if (echeance.length >= 10 &&
        echeance.substring(0, 10).compareTo(jour) < 0) {
      echues++;
      final retard = DateTime.parse('${jour}T00:00:00Z')
          .difference(DateTime.parse('${echeance.substring(0, 10)}T00:00:00Z'))
          .inDays;
      if (premiereEchue == null || retard > retardMax) {
        retardMax = retard;
        premiereEchue = {...f, 'resteDu': du, 'retard': retard};
      }
    }
  }

  final annee =
      Periode(cle: 'annee', annee: aujourdhui.year, label: 'Année', titre: '');

  return ChiffresDuMois(
    facture: _factureHt(actives, periode, devisParId),
    encaisse: encaisse,
    paiements: paiements,
    reste: Reste(reste, impayees, echues, retardMax, premiereEchue),
    depuisJanvier: _factureHt(actives, annee, devisParId).total,
    marge: margeMoyenne(projects: projects, quotes: quotes, expenses: expenses),
  );
}

String _pluriel(int n, String mot) => '$n $mot${n > 1 ? 's' : ''}';

/// « 2 factures, 1 avoir » / « aucune facture émise ».
String resumeFacture(Facture f) {
  if (f.factures == 0 && f.avoirs == 0) return 'aucune facture émise';
  return [
    if (f.factures > 0) _pluriel(f.factures, 'facture'),
    if (f.avoirs > 0) _pluriel(f.avoirs, 'avoir'),
  ].join(', ');
}

/// « 2 factures, 1 échue de 8 jours ».
String resumeReste(Reste r) {
  if (r.impayees == 0) return 'aucune facture en attente';
  final base = _pluriel(r.impayees, 'facture');
  if (r.echues == 0) return '$base, aucune échue';
  if (r.echues == 1) {
    return '$base, 1 échue de ${_pluriel(r.retardMax, 'jour')}';
  }
  return "$base, ${r.echues} échues (jusqu'à ${_pluriel(r.retardMax, 'jour')})";
}
