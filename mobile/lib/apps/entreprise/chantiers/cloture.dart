import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/reserves.dart';

/// Réception et clôture d'un chantier (maquette PRO-02.4), mêmes règles que
/// le site (lib/cloture-chantier.js), testées sur les mêmes exemples :
/// réception (PV signé sur place), réserves levées, facture de solde,
/// dossier de fin de chantier, avis du client, retenue de garantie.

String _s(dynamic v) => v == null ? '' : '$v';
double _n(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
double _r2(double n) => (n * 100).roundToDouble() / 100;

const tauxRetenue = 5;
const typeFactureSolde = 'Facture finale';
const noteLiberationRetenue =
    'Libération de la retenue de garantie (loi n° 71-584).';
const _facturesActives = {'Brouillon', 'Emise', 'Payee'};

String euro(num n, [int decimales = 2]) {
  final f = NumberFormat.decimalPatternDigits(
      locale: 'fr_FR', decimalDigits: decimales);
  return '${f.format(n).replaceAll(RegExp('[  ]'), ' ')} €';
}

/// Jour (AAAA-MM-JJ) d'un instant, à l'heure du téléphone.
String jourLocal(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? '' : DateFormat('yyyy-MM-dd').format(d.toLocal());
}

String dateCourte(String jour, {bool annee = false}) {
  final d = DateTime.tryParse(jour.length >= 10 ? jour.substring(0, 10) : jour);
  return d == null
      ? ''
      : DateFormat(annee ? 'd MMM y' : 'd MMM', 'fr_FR').format(d);
}

String plusAns(String jour, int ans) {
  final d = DateTime.tryParse(jour.length >= 10 ? jour.substring(0, 10) : jour);
  if (d == null) return '';
  final dernier = DateTime.utc(d.year + ans, d.month + 1, 0).day;
  return DateFormat('yyyy-MM-dd').format(
      DateTime.utc(d.year + ans, d.month, d.day > dernier ? dernier : d.day));
}

List<Map<String, dynamic>> facturesDuChantier(
        List<Map<String, dynamic>> factures,
        {String projectId = '',
        String quoteId = ''}) =>
    factures
        .where((f) =>
            _facturesActives.contains(_s(f['status'])) &&
            ((projectId.isNotEmpty && _s(f['projectId']) == projectId) ||
                (quoteId.isNotEmpty && _s(f['quoteId']) == quoteId)))
        .toList();

bool _liberation(Map<String, dynamic> f) =>
    _s(f['notes']).startsWith('Libération de la retenue');

Map<String, dynamic>? factureDeSolde(List<Map<String, dynamic>> factures) {
  final l = factures
      .where((f) =>
          _s(f['type']) == typeFactureSolde &&
          _n(f['amountTtc']) > 0 &&
          !_liberation(f))
      .toList()
    ..sort((a, b) => _s(a['createdAt']).compareTo(_s(b['createdAt'])));
  return l.isEmpty ? null : l.first;
}

class Solde {
  const Solde({
    required this.avenants,
    required this.travauxHt,
    required this.travauxTtc,
    required this.dejaTtc,
    required this.dejaHt,
    required this.taux,
    required this.retenueHt,
    required this.retenueTtc,
    required this.soldeTtc,
    required this.soldeHt,
  });
  final List<String> avenants;
  final double travauxHt, travauxTtc, dejaTtc, dejaHt;
  final int taux;
  final double retenueHt, retenueTtc, soldeTtc, soldeHt;
}

/// Travaux (devis + avenants signés) − déjà facturé − retenue de garantie.
Solde montantsSolde({
  Map<String, dynamic>? devis,
  List<Map<String, dynamic>> avenants = const [],
  List<Map<String, dynamic>> factures = const [],
  int taux = 0,
}) {
  final signes = avenants.where((a) => _s(a['status']) == 'Signe').toList();
  final ht = _r2(_n(devis?['totalHt']) +
      signes.fold(0.0, (n, a) => n + _n(a['totalHtDelta'])));
  final ttc = _r2((_n(devis?['totalTtc']) > 0
          ? _n(devis?['totalTtc'])
          : _n(devis?['totalHt'])) +
      signes.fold(0.0, (n, a) => n + _n(a['totalTtcDelta'])));
  final ratio = ht > 0 && ttc > 0 ? ttc / ht : 1.0;
  final deja = _r2(factures
      .where(
          (f) => _s(f['type']) != typeFactureSolde || _n(f['amountTtc']) < 0)
      .fold(0.0, (n, f) => n + _n(f['amountTtc'])));
  final retenueTtc = _r2(ttc * taux / 100);
  final solde = _r2((ttc - deja - retenueTtc).clamp(0, double.infinity));
  return Solde(
    avenants: signes.map((a) => _s(a['numero'])).where((s) => s.isNotEmpty).toList(),
    travauxHt: ht,
    travauxTtc: ttc,
    dejaTtc: deja,
    dejaHt: _r2(deja / ratio),
    taux: taux,
    retenueHt: _r2(ht * taux / 100),
    retenueTtc: retenueTtc,
    soldeTtc: solde,
    soldeHt: _r2(solde / ratio),
  );
}

String noteSolde(Solde s, String receptionLe) {
  if (s.taux == 0) return 'Facture de solde des travaux.';
  final jour = receptionLe.isEmpty ? '' : jourLocal(receptionLe);
  final quand = jour.isEmpty
      ? 'libérable un an après la réception'
      : 'libérable le ${dateCourte(plusAns(jour, 1), annee: true)}';
  return 'Facture de solde. Retenue de garantie ${s.taux} % : ${euro(s.retenueTtc)} TTC, $quand si aucune réserve n\'est en cours (loi n° 71-584).';
}

/// « 4 lots · devis 2026-041 et avenant AV-1 ».
String travauxReceptionnes(
    Map<String, dynamic>? devis, int lots, List<String> avenants) {
  final l = lots > 0 ? '$lots lot${lots > 1 ? 's' : ''} · ' : '';
  final a = avenants.isEmpty
      ? ''
      : ' et avenant${avenants.length > 1 ? 's' : ''} ${avenants.join(', ')}';
  return '${l}devis ${_s(devis?['quoteNumber'])}$a'.trim();
}

class EtapeCloture {
  const EtapeCloture({
    required this.id,
    required this.titre,
    required this.ok,
    required this.court,
    this.etat = 'todo',
    this.action = '',
    this.reserve,
  });
  final String id, titre, court, etat, action;
  final bool ok;

  /// Première réserve à lever (étape « reserves »).
  final Reserve? reserve;

  EtapeCloture avecEtat(String e) => EtapeCloture(
      id: id,
      titre: titre,
      ok: ok,
      court: court,
      etat: e,
      action: action,
      reserve: reserve);
}

/// Avis du client (PRO-02.6) : programmé, demandé, reçu (note, réponse).
EtapeCloture _etapeAvis(
    Map avis, Map<String, dynamic>? recu, Map<String, dynamic>? solde) {
  if (recu != null) {
    final repondu = _s((recu['reponse'] as Map?)?['texte']).isNotEmpty;
    return EtapeCloture(
        id: 'avis',
        titre: 'Avis du client',
        ok: true,
        court: '${recu['note']} sur 5 · ${repondu ? 'répondu' : 'à répondre'}',
        action: repondu ? '' : "Répondre à l'avis");
  }
  if (_s(avis['demandeLe']).isNotEmpty) {
    return const EtapeCloture(
        id: 'avis', titre: 'Avis du client', ok: true, court: 'demandé');
  }
  if (solde != null && _s(solde['status']) != 'Brouillon') {
    return const EtapeCloture(
        id: 'avis',
        titre: 'Avis du client',
        ok: false,
        court: 'à demander',
        action: "Demander l'avis");
  }
  return EtapeCloture(
      id: 'avis',
      titre: 'Avis du client',
      ok: false,
      court: avis['programme'] == true
          ? 'programmé après le solde'
          : 'demandé après le solde',
      action: avis['programme'] == true ? '' : "Programmer la demande d'avis");
}

String _pl(int n, String mot) => '$n $mot${n > 1 ? 's' : ''}';

/// Les étapes du téléphone (maquette : réception, réserves, solde, dossier,
/// avis) ; la première non faite est « cur ».
List<EtapeCloture> etapesCloture({
  Map<String, dynamic>? cloture,
  List<Reserve> reserves = const [],
  required Solde solde,
  Map<String, dynamic>? factureSolde,
  Map<String, dynamic>? avisRecu,
}) {
  final pv = cloture?['pv'] is Map ? Map<String, dynamic>.from(cloture!['pv']) : null;
  final signe = _s(pv?['signeLe']).isNotEmpty;
  final inscrites = (pv?['reserves'] is List ? pv!['reserves'] as List : const [])
      .map((r) => _s((r as Map)['numero']))
      .toList();
  final ouvertes = reserves.where((r) => r.statut != 'levee').toList()
    ..sort((a, b) => (a.pourLe.isEmpty ? '9999' : a.pourLe)
        .compareTo(b.pourLe.isEmpty ? '9999' : b.pourLe));
  final levees = reserves.where((r) => r.statut == 'levee').length;
  final avis = cloture?['avis'] is Map ? cloture!['avis'] as Map : const {};
  final dossier = cloture?['dossier'] is Map ? cloture!['dossier'] as Map : const {};

  final etapes = <EtapeCloture>[
    EtapeCloture(
      id: 'reception',
      titre: 'Réception',
      ok: signe,
      court: signe
          ? 'PV signé le ${dateCourte(jourLocal(_s(pv!['signeLe'])))} · ${inscrites.isEmpty ? 'sans réserve' : '${_pl(inscrites.length, 'réserve')} (${inscrites.join(', ')})'}'
          : 'PV à faire signer sur place',
      action: signe ? '' : 'Faire signer le PV',
    ),
    EtapeCloture(
      id: 'reserves',
      titre: 'Réserves',
      ok: ouvertes.isEmpty,
      court: reserves.isEmpty
          ? 'aucune réserve'
          : ouvertes.isEmpty
              ? '$levees levée${levees > 1 ? 's' : ''} sur ${reserves.length}'
              : '$levees levée${levees > 1 ? 's' : ''} sur ${reserves.length} · ${ouvertes.first.numero} ${ouvertes.first.pourLe.isEmpty ? 'à lever' : 'avant le ${dateCourte(ouvertes.first.pourLe)}'}',
      action: ouvertes.isEmpty ? '' : 'Lever la réserve ${ouvertes.first.numero}',
      reserve: ouvertes.isEmpty ? null : ouvertes.first,
    ),
    factureSolde != null
        ? EtapeCloture(
            id: 'solde',
            titre: 'Facture de solde',
            ok: true,
            court:
                '${euro(_n(factureSolde['amountTtc']))} TTC · ${switch (_s(factureSolde['status'])) { 'Payee' => 'payée', 'Brouillon' => 'brouillon', _ => 'émise' }}')
        : solde.travauxTtc > 0 && solde.soldeTtc <= 0.01
            ? const EtapeCloture(
                id: 'solde', titre: 'Facture de solde', ok: true, court: 'déjà facturé')
            : EtapeCloture(
                id: 'solde',
                titre: 'Facture de solde',
                ok: false,
                court: solde.travauxTtc > 0
                    ? '${euro(solde.soldeTtc)} TTC · prête'
                    : 'pas de devis signé',
                action: solde.travauxTtc > 0 ? 'Émettre la facture de solde' : ''),
    EtapeCloture(
      id: 'dossier',
      titre: 'Dossier de fin de chantier',
      ok: _s(dossier['remisLe']).isNotEmpty,
      court: _s(dossier['remisLe']).isNotEmpty ? 'remis' : 'à préparer',
      action: _s(dossier['remisLe']).isNotEmpty ? '' : 'Préparer le dossier',
    ),
    _etapeAvis(avis, avisRecu, factureSolde),
  ];
  var cur = false;
  return [
    for (final e in etapes)
      if (e.ok)
        e.avecEtat('ok')
      else if (!cur && (cur = true))
        e.avecEtat('cur')
      else
        e.avecEtat('todo'),
  ];
}
