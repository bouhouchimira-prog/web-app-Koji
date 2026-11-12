import 'package:intl/intl.dart';

/// Liste des chantiers (maquette PRO-02), mêmes règles que le site
/// (lib/chantiers-liste.js) : une ligne par chantier non archivé, calculée
/// avec le chantier, son devis, ses tâches, ses rendez-vous, ses factures et
/// les alertes. Rien n'est stocké : le statut se déduit à chaque lecture.
///
/// - Avancement : les lots du devis (lignes regroupées par pièce / lot), un
///   lot est fait quand toutes ses lignes ont leur tâche terminée ; sans
///   devis, les tâches du chantier.
/// - Étiquette : ce qui demande une action d'abord (Bloquant, À relancer,
///   En retard, Échéance), sinon l'état du chantier.

const ongletsChantiers = [
  ('en_cours', 'En cours'),
  ('a_planifier', 'À planifier'),
  ('termine', 'Clôturés'),
];

const _echeanceJours = 7;
const _urgences = {
  'degat': 'Dégât',
  'fuite': 'Fuite',
  'urgence': 'Urgence',
  'incendie': 'Incendie',
  'autre': 'Alerte',
};

/// Ton de l'étiquette : plein (Bloquant), gris, encre.
enum TonEtiquette { plein, gris, encre }

class Avancement {
  const Avancement(this.faits, this.total, this.unite);
  final int faits;
  final int total;

  /// « lots » ou « tâches ».
  final String unite;
  double get part => total == 0 ? 0 : faits / total;
  String get texte => '$faits / $total $unite';
}

class LigneChantier {
  const LigneChantier({
    required this.id,
    required this.titre,
    required this.ville,
    required this.client,
    required this.onglet,
    this.aLancer = false,
    required this.etiquette,
    required this.ton,
    required this.avancement,
    required this.jalon,
    required this.detail,
    required this.montant,
    required this.recherche,
  });

  final String id;
  final String titre;
  final String ville;
  final String client;
  final String onglet;

  /// Devis signé, rien de planifié ni facturé : « Lancer le chantier ».
  final bool aLancer;
  final String etiquette;
  final TonEtiquette ton;
  final Avancement? avancement;
  final String jalon;
  final String detail;
  final String montant;
  final String recherche;
}

final _euro = NumberFormat.decimalPattern('fr_FR');
String _euros(num n) =>
    '${_euro.format(n.round()).replaceAll(' ', ' ').replaceAll(' ', ' ')} €';

String _s(dynamic v) => v == null ? '' : '$v';
String _jour(String iso) => iso.length >= 10 ? iso.substring(0, 10) : iso;

String villeDe(String adresse) {
  final parties = adresse
      .split(',')
      .map((p) => p.trim())
      .where((p) => p.isNotEmpty)
      .toList();
  final derniere = parties.length > 1
      ? parties.last
      : (parties.isEmpty ? '' : parties.first);
  return derniere.replaceFirst(RegExp(r'^\d{5}\s*'), '');
}

String _jourCourt(String iso) {
  final d = DateTime.tryParse(_jour(iso));
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d);
}

String _jourJalon(String iso, String aujourdhui) {
  final d = DateTime.tryParse(_jour(iso));
  final t = DateTime.tryParse(aujourdhui);
  if (d == null || t == null) return '';
  final ecart = d.difference(t).inDays;
  if (ecart == 0) return "aujourd'hui";
  if (ecart == 1) return 'demain';
  return DateFormat('EEEE d MMM', 'fr_FR').format(d);
}

String _heure(String hhmm) {
  final p = hhmm.split(':');
  if (p.isEmpty || p.first.isEmpty) return '';
  final h = int.tryParse(p.first);
  if (h == null) return '';
  final m = p.length > 1 && p[1] != '00' ? ' ${p[1]}' : '';
  return ' $h h$m';
}

bool _signe(Map<String, dynamic>? devis) =>
    devis != null &&
    (devis['status'] == 'Signe' || devis['signatureStatus'] == 'Signe');

/// Même clé que la fiche chantier du site.
String cleLigne(Map<String, dynamic> ligne, int index) {
  final lot = _s(ligne['roomId']).isNotEmpty
      ? _s(ligne['roomId'])
      : (_s(ligne['room']).isNotEmpty ? _s(ligne['room']) : 'chantier');
  final id = _s(ligne['taskId']).isNotEmpty
      ? _s(ligne['taskId'])
      : (_s(ligne['code']).isNotEmpty ? _s(ligne['code']) : '$index');
  return '$lot-$id';
}

({int total, int faits, int lignes, int lignesFaites}) lotsDuDevis(
    Map<String, dynamic>? devis, List<Map<String, dynamic>> taches) {
  final lignes = devis?['items'] is List
      ? (devis!['items'] as List).whereType<Map>().toList()
      : const <Map>[];
  final lots = <String, List<int>>{}; // lot → [lignes, faites]
  for (final (index, brut) in lignes.indexed) {
    final ligne = Map<String, dynamic>.from(brut);
    final lot = _s(ligne['room']).trim().isEmpty
        ? 'Chantier'
        : _s(ligne['room']).trim();
    final cle = cleLigne(ligne, index);
    Map<String, dynamic>? tache;
    for (final t in taches) {
      if (t['quoteItemId'] == cle) {
        tache = t;
        break;
      }
    }
    if (tache == null) {
      for (final t in taches) {
        if (t['label'] == ligne['label'] &&
            _s(t['room']) == _s(ligne['room'])) {
          tache = t;
          break;
        }
      }
    }
    final compte = lots.putIfAbsent(lot, () => [0, 0]);
    compte[0]++;
    if (tache?['done'] == true) compte[1]++;
  }
  final faits = lots.values.where((c) => c[0] > 0 && c[1] == c[0]).length;
  final lignesFaites = lots.values.fold<int>(0, (n, c) => n + c[1]);
  return (
    total: lots.length,
    faits: faits,
    lignes: lignes.length,
    lignesFaites: lignesFaites
  );
}

String statutChantier(
    int progression, bool signe, String finPrevue, String aujourdhui) {
  if (progression >= 100) return 'termine';
  if (!signe) return 'a_planifier';
  if (finPrevue.isNotEmpty && _jour(finPrevue).compareTo(aujourdhui) < 0) {
    return 'retard';
  }
  if (progression >= 85) return 'finitions';
  return 'en_cours';
}

const _ongletDuStatut = {
  'en_cours': 'en_cours',
  'finitions': 'en_cours',
  'retard': 'en_cours',
  'a_planifier': 'a_planifier',
  'termine': 'termine',
};

const _etiquetteStatut = {
  'retard': ('En retard', TonEtiquette.plein),
  'a_planifier': ('À planifier', TonEtiquette.gris),
  'en_cours': ('En cours', TonEtiquette.encre),
  'finitions': ('Finitions', TonEtiquette.encre),
  'termine': ('Clôturé', TonEtiquette.gris),
};

List<LigneChantier> lignesChantiers({
  required List<Map<String, dynamic>> projects,
  List<Map<String, dynamic>> quotes = const [],
  List<Map<String, dynamic>> tasks = const [],
  List<Map<String, dynamic>> calendarEvents = const [],
  List<Map<String, dynamic>> invoices = const [],
  List<Map<String, dynamic>> alerts = const [],
  required DateTime maintenant,
}) {
  final aujourdhui = DateFormat('yyyy-MM-dd').format(maintenant);
  final sortie = <LigneChantier>[];
  for (final p in projects) {
    if (_s(p['status']).toLowerCase().contains('archive')) continue;
    final id = _s(p['id']);
    Map<String, dynamic>? devis;
    for (final q in quotes) {
      if (_s(q['projectId']) == id) {
        devis = q;
        break;
      }
    }
    final signe = _signe(devis);
    final taches = tasks.where((t) => _s(t['projectId']) == id).toList();
    final tachesFaites = taches.where((t) => t['done'] == true).length;
    final lots = lotsDuDevis(devis, taches);
    final progression = lots.lignes > 0
        ? (lots.lignesFaites * 100 / lots.lignes).round()
        : taches.isNotEmpty
            ? (tachesFaites * 100 / taches.length).round()
            : ((p['progress'] as num?)?.round() ?? 0);
    final fins = taches
        .map((t) =>
            _s(t['endDate']).isNotEmpty ? _s(t['endDate']) : _s(t['dueDate']))
        .where((s) => s.isNotEmpty)
        .toList()
      ..sort();
    final finPrevue = fins.isNotEmpty
        ? fins.last
        : (_s(p['endDate']).isNotEmpty ? _s(p['endDate']) : _s(p['dueDate']));
    // Devis signé, rien de planifié ni facturé (hors acompte) : « À
    // planifier » jusqu'au lancement (maquette PRO-02.1).
    final factureHorsAcompte = invoices.any((f) =>
        _s(f['projectId']) == id &&
        f['kind'] != 'acompte' &&
        f['status'] != 'Brouillon');
    final aLancer =
        signe && lots.lignes > 0 && taches.isEmpty && !factureHorsAcompte;
    final statut = aLancer
        ? 'a_planifier'
        : statutChantier(progression, signe, finPrevue, aujourdhui);

    final avancement = lots.total > 0
        ? Avancement(lots.faits, lots.total, 'lots')
        : taches.isNotEmpty
            ? Avancement(tachesFaites, taches.length, 'tâches')
            : null;

    // Prochain jalon : tâche non faite ou rendez-vous à venir.
    final aVenir = <(String, String, String)>[
      for (final t in taches)
        if (t['done'] != true)
          if ((_s(t['dueDate']).isNotEmpty
                      ? _s(t['dueDate'])
                      : _s(t['startDate']))
                  .compareTo(aujourdhui) >=
              0)
            (
              _s(t['label']).isEmpty ? 'Tâche' : _s(t['label']),
              _s(t['dueDate']).isNotEmpty
                  ? _s(t['dueDate'])
                  : _s(t['startDate']),
              ''
            ),
      for (final e in calendarEvents)
        if (_s(e['projectId']) == id)
          if ((DateTime.tryParse(_s(e['startAt']))?.isAfter(maintenant) ??
              false))
            (
              _s(e['title']).isEmpty ? 'Rendez-vous' : _s(e['title']),
              _jour(_s(e['startAt'])),
              _s(e['startAt']).length >= 16
                  ? _s(e['startAt']).substring(11, 16)
                  : ''
            ),
    ]..sort((a, b) => '${a.$2}${a.$3}'.compareTo('${b.$2}${b.$3}'));
    var jalon = aVenir.isEmpty
        ? ''
        : '${aVenir.first.$1}, ${_jourJalon(aVenir.first.$2, aujourdhui)}${_heure(aVenir.first.$3)}';

    Map<String, dynamic>? alerte;
    for (final a in alerts) {
      if (_s(a['projectId']) == id && a['status'] != 'resolved') {
        alerte = a;
        break;
      }
    }
    final echues = invoices
        .where((f) =>
            _s(f['projectId']) == id &&
            f['kind'] != 'avoir' &&
            (f['status'] == 'Emise' || f['status'] == 'Partielle') &&
            _s(f['dueDate']).isNotEmpty &&
            _jour(_s(f['dueDate'])).compareTo(aujourdhui) < 0)
        .toList()
      ..sort((a, b) => _s(a['dueDate']).compareTo(_s(b['dueDate'])));
    final debut = _jour(_s(devis?['startDate']).isNotEmpty
        ? _s(devis?['startDate'])
        : _s(p['startDate']));
    final dDebut = DateTime.tryParse(debut);
    final echeanceProche = statut == 'a_planifier' &&
        dDebut != null &&
        dDebut.difference(DateTime.parse(aujourdhui)).inDays <= _echeanceJours;

    var (etiquette, ton) = _etiquetteStatut[statut]!;
    var detail = '';
    final totalHt = (devis?['totalHt'] as num?) ?? (p['budgetHt'] as num?) ?? 0;
    var montant = totalHt > 0 ? '${_euros(totalHt)} HT' : '';
    if (alerte != null) {
      (etiquette, ton) = ('Bloquant', TonEtiquette.plein);
      final par = alerte['source'] == 'client'
          ? ' par le client'
          : _s(alerte['senderName']).isNotEmpty
              ? ' par ${alerte['senderName']}'
              : '';
      detail = '${_urgences[alerte['type']] ?? 'Alerte'} signalée$par';
    } else if (echues.isNotEmpty) {
      final f = echues.first;
      (etiquette, ton) = ('À relancer', TonEtiquette.gris);
      final reste = (f['amountTtc'] as num?) ?? 0;
      final numero = _s(f['invoiceNumber']);
      jalon =
          '${numero.isEmpty ? 'Facture' : 'Facture $numero'} : ${_euros(reste)} à encaisser';
      montant = '${_euros(reste)} en attente';
    } else if (statut == 'retard') {
      detail = 'Fin prévue dépassée (${_jourCourt(finPrevue)})';
    } else if (echeanceProche) {
      (etiquette, ton) = ('Échéance', TonEtiquette.encre);
      if (jalon.isEmpty) jalon = 'Démarrage à planifier, ${_jourCourt(debut)}';
    } else if (aLancer) {
      if (jalon.isEmpty) jalon = 'Chantier à lancer : planning à valider';
    } else if (statut == 'a_planifier' && !signe) {
      detail = 'Devis pas encore signé';
    }

    final client = _s(devis?['client']).isNotEmpty
        ? _s(devis?['client'])
        : _s(p['client']);
    sortie.add(LigneChantier(
      id: id,
      titre: _s(p['title']).isEmpty ? 'Chantier' : _s(p['title']),
      ville: villeDe(_s(p['address'])),
      client: client,
      onglet: _ongletDuStatut[statut]!,
      aLancer: aLancer,
      etiquette: etiquette,
      ton: ton,
      avancement: avancement,
      jalon: jalon,
      detail: detail,
      montant: montant,
      recherche: [p['title'], devis?['client'], p['client'], p['address']]
          .where((v) => v != null)
          .join(' ')
          .toLowerCase(),
    ));
  }
  return sortie;
}

Map<String, int> compterOnglets(List<LigneChantier> lignes) {
  final c = {'en_cours': 0, 'a_planifier': 0, 'termine': 0};
  for (final l in lignes) {
    c[l.onglet] = (c[l.onglet] ?? 0) + 1;
  }
  return c;
}

/// « 3 en cours · 1 à planifier ».
String resumeChantiers(Map<String, int> c) {
  final parts = [
    if ((c['en_cours'] ?? 0) > 0) '${c['en_cours']} en cours',
    if ((c['a_planifier'] ?? 0) > 0) '${c['a_planifier']} à planifier',
  ];
  return parts.isEmpty ? 'aucun chantier en cours' : parts.join(' · ');
}
