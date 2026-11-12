import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart';

/// Fiche chantier (maquette PRO-02.1, téléphone « 2 · Fiche chantier »),
/// mêmes règles que la fiche du site (app/chantiers/page.jsx) : les lignes
/// du devis regroupées par lot, chacune avec sa tâche ; avancement, facturé,
/// fin prévue ; ce qui demande une action.

String _s(dynamic v) => v == null ? '' : '$v';
String _jour(String iso) => iso.length >= 10 ? iso.substring(0, 10) : iso;
String jourCourt(String iso) {
  final d = DateTime.tryParse(_jour(iso));
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d);
}

String eurosFiche(num n) => NumberFormat.currency(locale: 'fr_FR', symbol: '€')
    .format(n)
    .replaceAll(' ', ' ')
    .replaceAll(' ', ' ');

class LigneFiche {
  const LigneFiche(this.cle, this.label, this.montant, this.tache);
  final String cle;
  final String label;
  final double montant;
  final Map<String, dynamic>? tache;
  bool get faite => tache?['done'] == true;
}

class LotFiche {
  const LotFiche({
    required this.numero,
    required this.nom,
    required this.lignes,
    required this.montant,
    required this.debut,
    required this.fin,
    required this.equipe,
    required this.pourcent,
    required this.etat,
  });

  final String numero;
  final String nom;
  final List<LigneFiche> lignes;
  final double montant;
  final String debut;
  final String fin;
  final String equipe;
  final int pourcent;

  /// « À démarrer », « En cours », « Terminé », « Non planifié ».
  final String etat;
  String get dates => debut.isEmpty
      ? 'Non planifié'
      : '${jourCourt(debut)} → ${jourCourt(fin)}';
}

bool _enCours(Map<String, dynamic> t) {
  final s = _s(t['status']).toLowerCase();
  return s.contains('cours') || t['startedAt'] != null;
}

List<LotFiche> lotsFiche(
    Map<String, dynamic>? devis, List<Map<String, dynamic>> taches) {
  final items = devis?['items'] is List
      ? (devis!['items'] as List).whereType<Map>().toList()
      : const <Map>[];
  final noms = <String>[];
  final parLot = <String, List<LigneFiche>>{};
  for (final (i, brut) in items.indexed) {
    final ligne = Map<String, dynamic>.from(brut);
    final cle = cleLigne(ligne, i);
    Map<String, dynamic>? tache;
    for (final t in taches) {
      if (t['quoteItemId'] == cle ||
          (t['label'] == ligne['label'] &&
              _s(t['room']) == _s(ligne['room']))) {
        tache = t;
        break;
      }
    }
    final room = _s(ligne['room']).trim();
    final nom = room.isEmpty ? 'Chantier' : room;
    if (!parLot.containsKey(nom)) noms.add(nom);
    parLot.putIfAbsent(nom, () => []).add(LigneFiche(cle, _s(ligne['label']),
        (ligne['totalHt'] as num?)?.toDouble() ?? 0, tache));
  }
  return [
    for (final (i, nom) in noms.indexed)
      () {
        final lignes = parLot[nom]!;
        final ts = lignes.map((l) => l.tache).whereType<Map<String, dynamic>>();
        final debuts = ts
            .map((t) => _s(t['startDate']))
            .where((s) => s.isNotEmpty)
            .toList()
          ..sort();
        final fins = ts
            .map((t) => _s(t['endDate']).isNotEmpty
                ? _s(t['endDate'])
                : _s(t['dueDate']))
            .where((s) => s.isNotEmpty)
            .toList()
          ..sort();
        final equipes = <String>{
          for (final t in ts)
            if (_s(t['assignedTo']).isNotEmpty && t['assignedTo'] != 'Equipe')
              '${t['assignedTo']}${t['participantType'] == 'Sous-traitants' ? ' · sous-traitant' : ''}',
        };
        final faites = lignes.where((l) => l.faite).length;
        final etat = faites == lignes.length && faites > 0
            ? 'Terminé'
            : ts.any((t) => t['done'] == true || _enCours(t))
                ? 'En cours'
                : debuts.isNotEmpty
                    ? 'À démarrer'
                    : 'Non planifié';
        return LotFiche(
          numero: (i + 1).toString().padLeft(2, '0'),
          nom: nom,
          lignes: lignes,
          montant: lignes.fold(0.0, (n, l) => n + l.montant),
          debut: debuts.isEmpty ? '' : debuts.first,
          fin: fins.isEmpty ? '' : fins.last,
          equipe: equipes.isEmpty
              ? (ts.isEmpty ? 'Non assigné' : 'Équipe')
              : equipes.join(', '),
          pourcent: lignes.isEmpty ? 0 : (faites * 100 / lignes.length).round(),
          etat: etat,
        );
      }(),
  ];
}

class ResumeFiche {
  const ResumeFiche({
    required this.avancement,
    required this.facturePourcent,
    required this.factureTtc,
    required this.fin,
    required this.sousAvancement,
    required this.sousFacture,
  });

  final int avancement;
  final int facturePourcent;
  final double factureTtc;
  final String fin;
  final String sousAvancement;
  final String sousFacture;
}

ResumeFiche resumeFiche({
  Map<String, dynamic>? devis,
  required List<LotFiche> lots,
  required List<Map<String, dynamic>> taches,
  required List<Map<String, dynamic>> factures,
}) {
  final lignes = lots.expand((l) => l.lignes).toList();
  final faites = lignes.where((l) => l.faite).length;
  final avancement = lignes.isNotEmpty
      ? (faites * 100 / lignes.length).round()
      : taches.isEmpty
          ? 0
          : (taches.where((t) => t['done'] == true).length *
                  100 /
                  taches.length)
              .round();
  final emises = factures.where((f) => f['status'] != 'Brouillon').toList();
  final ttc = emises.fold(0.0, (n, f) => n + ((f['amountTtc'] as num?) ?? 0));
  final totalTtc = (devis?['totalTtc'] as num?)?.toDouble() ?? 0;
  final pourcent = totalTtc > 0 ? (ttc * 100 / totalTtc).round() : 0;
  final nonRegle = emises.where((f) => f['status'] != 'Payee').isNotEmpty;
  final debut = lots.map((l) => l.debut).where((s) => s.isNotEmpty).toList()
    ..sort();
  final fin = lots.map((l) => l.fin).where((s) => s.isNotEmpty).toList()
    ..sort();
  final demarre = taches.any((t) => t['done'] == true || _enCours(t));
  final lotsFaits = lots.where((l) => l.pourcent == 100).length;
  return ResumeFiche(
    avancement: avancement,
    facturePourcent: pourcent,
    factureTtc: ttc,
    fin: fin.isEmpty ? '' : fin.last,
    sousAvancement: !demarre && debut.isNotEmpty
        ? 'démarrage le ${jourCourt(debut.first)}'
        : lots.isEmpty
            ? 'aucune tâche planifiée'
            : '$lotsFaits lot${lotsFaits > 1 ? 's' : ''} terminé${lotsFaits > 1 ? 's' : ''} sur ${lots.length}',
    sousFacture: emises.isEmpty
        ? 'aucune facture'
        : nonRegle
            ? '${eurosFiche(ttc)} · non réglé'
            : '${eurosFiche(ttc)} · réglé',
  );
}

class ATraiterFiche {
  const ATraiterFiche(this.titre, this.detail, this.etiquette, this.bloquant);
  final String titre;
  final String detail;
  final String etiquette;
  final bool bloquant;
}

const _urgences = {
  'degat': 'Dégât',
  'fuite': 'Fuite',
  'urgence': 'Urgence',
  'incendie': 'Incendie',
  'autre': 'Alerte',
};

List<ATraiterFiche> aTraiterFiche({
  required List<Map<String, dynamic>> alertes,
  required List<Map<String, dynamic>> factures,
  required List<Map<String, dynamic>> taches,
  required String aujourdhui,
}) =>
    [
      for (final a in alertes)
        if (a['status'] != 'resolved')
          ATraiterFiche(
              '${_urgences[a['type']] ?? 'Alerte'} signalée',
              [
                a['source'] == 'client' ? 'par le client' : _s(a['senderName']),
                _s(a['message'] ?? a['description']),
              ].where((s) => s.isNotEmpty).join(' · '),
              'Bloquant',
              true),
      for (final f in factures)
        if (f['kind'] != 'avoir' &&
            (f['status'] == 'Emise' || f['status'] == 'Partielle') &&
            _s(f['dueDate']).isNotEmpty &&
            _jour(_s(f['dueDate'])).compareTo(aujourdhui) < 0)
          ATraiterFiche(
              _s(f['invoiceNumber']).isEmpty
                  ? 'Facture'
                  : 'Facture ${f['invoiceNumber']}',
              '${eurosFiche((f['amountTtc'] as num?) ?? 0)} · échue le ${jourCourt(_s(f['dueDate']))}',
              'À relancer',
              false),
      for (final t in taches)
        if (t['done'] != true)
          if (() {
            final fin = _s(t['endDate']).isNotEmpty
                ? _s(t['endDate'])
                : _s(t['dueDate']);
            return fin.isNotEmpty && _jour(fin).compareTo(aujourdhui) < 0;
          }())
            ATraiterFiche(
                _s(t['label']).isEmpty ? 'Tâche' : _s(t['label']),
                'prévue jusqu\'au ${jourCourt(_s(t['endDate']).isNotEmpty ? _s(t['endDate']) : _s(t['dueDate']))}',
                'En retard',
                false),
    ];

/// Photo avant / après / pendant (maquette PRO-02.2), lue sur le site :
/// date, heure et auteur posés par le serveur à la prise.
class PhotoChantier {
  const PhotoChantier({
    required this.id,
    required this.lot,
    required this.phase,
    required this.takenAt,
    required this.author,
    this.url = '',
    this.legende = '',
  });

  factory PhotoChantier.fromJson(Map<String, dynamic> j) => PhotoChantier(
        id: _s(j['id']),
        lot: _s(j['lot']),
        phase: _s(j['phase']).isEmpty ? 'pendant' : _s(j['phase']),
        takenAt: _s(j['takenAt']),
        author: _s(j['author']),
        url: _s(j['url']),
        legende: _s(j['caption'] ?? j['taskTitle']),
      );

  final String id;
  final String lot;

  /// « avant », « pendant » ou « apres ».
  final String phase;
  final String takenAt;
  final String author;
  final String url;
  final String legende;
}

/// « 14/11 08:02 » à l'heure du téléphone.
String horodatage(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? '' : DateFormat('dd/MM HH:mm').format(d.toLocal());
}

/// Photos d'un lot et ce qui manque (mêmes règles que lib/photos-chantier.js).
({PhotoChantier? avant, PhotoChantier? apres, String etat}) photosDuLot(
    List<PhotoChantier> photos, String lot,
    {required int faites, required int total}) {
  final duLot = photos.where((p) => p.lot == lot).toList()
    ..sort((a, b) => a.takenAt.compareTo(b.takenAt));
  PhotoChantier? avant;
  PhotoChantier? apres;
  for (final p in duLot) {
    if (p.phase == 'avant') avant ??= p;
    if (p.phase == 'apres') apres = p;
  }
  final termine = total > 0 && faites == total;
  final etat = termine && apres != null
      ? 'termine'
      : termine
          ? 'apres_manquante'
          : (avant != null || faites > 0)
              ? 'en_cours'
              : 'a_faire';
  return (avant: avant, apres: apres, etat: etat);
}
