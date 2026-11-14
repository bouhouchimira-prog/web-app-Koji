import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/devis/devis_envoi.dart' show libelleReglement, soldeDe;
import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/devis/devis_liste.dart';

// Après l'envoi (maquette PRO-03.3) : port de lib/devis-suivi.js, mêmes
// exemples dans test/devis_suivi_test.dart et tests/unit/devis-suivi.test.js.

const retractationJours = 14;

String _s(dynamic v) => v == null ? '' : '$v';
String _j(dynamic v) {
  final t = _s(v);
  return t.length >= 10 ? t.substring(0, 10) : t;
}

String _plus(String jour, int n) {
  final d = DateTime.tryParse(_j(jour));
  return d == null ? '' : DateFormat('yyyy-MM-dd').format(DateTime.utc(d.year, d.month, d.day).add(Duration(days: n)));
}

String _court(String jour) {
  final d = DateTime.tryParse(_j(jour));
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d);
}

DateTime _dernierDimanche(int annee, int mois) {
  final d = DateTime.utc(annee, mois + 1, 0);
  return d.subtract(Duration(days: d.weekday % 7));
}

/// Heure de Paris d'un instant (heure d'été du dernier dimanche de mars au
/// dernier dimanche d'octobre, à 1 h UTC), sans dépendre du téléphone.
DateTime heureDeParis(DateTime instant) {
  final u = instant.toUtc();
  final ete = !u.isBefore(_dernierDimanche(u.year, 3).add(const Duration(hours: 1))) &&
      u.isBefore(_dernierDimanche(u.year, 10).add(const Duration(hours: 1)));
  return u.add(Duration(hours: ete ? 2 : 1));
}

({String jour, String heure})? _partsParis(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return null;
  final p = heureDeParis(d);
  return (jour: DateFormat('yyyy-MM-dd').format(p), heure: '${p.hour} h ${p.minute.toString().padLeft(2, '0')}');
}

/// « 28 oct., 19 h 50 ».
String quandParis(String iso) {
  final p = _partsParis(iso);
  return p == null ? '' : '${_court(p.jour)}, ${p.heure}';
}

/// « hier à 21 h 12 », « aujourd'hui à 9 h 04 », « le 28 oct. à 21 h 12 ».
String quandRelatif(String iso, String aujourdhui) {
  final p = _partsParis(iso);
  if (p == null) return '';
  if (p.jour == aujourdhui) return "aujourd'hui à ${p.heure}";
  if (_plus(p.jour, 1) == aujourdhui) return 'hier à ${p.heure}';
  return 'le ${_court(p.jour)} à ${p.heure}';
}

String _pourcent(num n) {
  final s = n == n.roundToDouble() ? n.toInt().toString() : n.toString();
  return '${s.replaceAll('.', ',')} %';
}

String _point(String t) => t.endsWith('.') ? t : '$t.';

bool _estSigne(Map q) => q['status'] == 'Signe' || q['signatureStatus'] == 'Signe';
bool _enLigne(Map q) => q['signatureProvider'] != 'manuel';

String prochaineRelance(Map q) {
  final relances = ((q['relances'] as List?) ?? const []).map((r) => _j((r as Map)['le'])).toList()..sort();
  final derniere = relances.isNotEmpty ? relances.last : _j(q['sentAt']);
  return derniere.isEmpty ? '' : _plus(derniere, relanceJours);
}

String retractationJusquau(Map q) {
  if (!_estSigne(q) || _s(q['signedAt']).isEmpty || !_enLigne(q) || q['clientType'] == 'societe') return '';
  return _plus(_partsParis(_s(q['signedAt']))?.jour ?? _s(q['signedAt']), retractationJours);
}

class EtapeSuivi {
  const EtapeSuivi(this.cle, this.label, this.etat, this.detail);
  final String cle;
  final String label;

  /// done, now, todo.
  final String etat;
  final String detail;
}

List<EtapeSuivi> etapesSuivi(Map q, {required String aujourdhui, bool chantierLance = false}) {
  final signe = _estSigne(q);
  final statut = statutDevis(q, aujourdhui);
  final fin = finValidite(q);
  final relance = prochaineRelance(q);
  EtapeSuivi signature;
  if (signe) {
    final comment = _enLigne(q)
        ? 'en ligne${q['mentionTva'] == true ? ', mention TVA certifiée' : ''}'
        : q['acceptanceReason'] == 'acompte'
            ? 'accord noté, acompte reçu'
            : 'accord noté';
    signature = EtapeSuivi('signature', 'Signé', 'done',
        [quandParis(_s(q['signedAt'])), comment].where((x) => x.isNotEmpty).join(' · '));
  } else if (statut.id == 'expire') {
    signature = EtapeSuivi('signature', 'Signature en attente', 'now', 'validité dépassée le ${_court(fin)}');
  } else {
    final suite = relance.isEmpty
        ? ''
        : statut.id == 'relancer'
            ? 'à relancer'
            : 'relance conseillée le ${_court(relance)}';
    signature = EtapeSuivi('signature', 'Signature en attente', 'now',
        [if (fin.isNotEmpty) "valable jusqu'au ${_court(fin)}", suite].where((x) => x.isNotEmpty).join(' · '));
  }
  return [
    EtapeSuivi('envoye', 'Envoyé', _s(q['sentAt']).isNotEmpty || signe ? 'done' : 'todo', quandParis(_s(q['sentAt']))),
    EtapeSuivi('vu', 'Vu par le client', _s(q['viewedAt']).isNotEmpty || signe ? 'done' : 'todo',
        _s(q['viewedAt']).isNotEmpty ? quandParis(_s(q['viewedAt'])) : ''),
    signature,
    EtapeSuivi('chantier', 'Chantier lancé', chantierLance ? 'done' : signe ? 'now' : 'todo', ''),
  ];
}

String noteSuivi(Map q, {required String aujourdhui, int messages = 0}) {
  if (_estSigne(q)) {
    final retract = retractationJusquau(q);
    return [
      _point('${_enLigne(q) ? 'Signé en ligne' : 'Accord noté'} le ${_court(_partsParis(_s(q['signedAt']))?.jour ?? _s(q['signedAt']))}'),
      if (q['mentionTva'] == true) 'Mention TVA ${_pourcent((q['vatRate'] as num?) ?? 20)} certifiée.',
      if (retract.isNotEmpty) _point("Rétractation possible jusqu'au ${_court(retract)}"),
    ].join(' ');
  }
  final vu = _s(q['viewedAt']).isNotEmpty
      ? 'Ouvert par le client ${quandRelatif(_s(q['viewedAt']), aujourdhui)}.'
      : 'Pas encore ouvert par le client.';
  final questions = messages > 0 ? '$messages message${messages > 1 ? 's' : ''} du client.' : 'Aucune question posée.';
  return '$vu $questions';
}

List<(String, String)> conditionsEnvoyees(Map q) {
  final jours = q['validityDays'] is num && (q['validityDays'] as num) > 0 ? (q['validityDays'] as num).toInt() : 30;
  final fin = finValidite(q);
  final jalons = (q['paymentMilestones'] as List?) ?? const [];
  final acompte = jalons.isNotEmpty ? ((jalons.first as Map)['percent'] as num?) ?? 0 : 0;
  final taux = (q['vatRate'] as num?) ?? 20;
  final ttc = (q['totalTtc'] as num?) ?? 0;
  final envoi = q['envoi'] is Map ? q['envoi'] as Map : const {};
  final canaux = [
    if (envoi['kojiClient'] == true) 'Koji Client',
    if (envoi['email'] == true) 'e-mail',
    if (envoi['sms'] == true) 'SMS',
  ];
  return [
    ('Validité', '$jours jours${fin.isEmpty ? '' : ", jusqu'au ${_court(fin)}"}'),
    ('Acompte', acompte > 0 ? '${_pourcent(acompte)} à la signature · ${euros(ttc * acompte / 100)} TTC' : 'Sans acompte'),
    ('Règlement', libelleReglement(jalons.length > 1 ? _s((jalons[1] as Map)['label']) : 'Solde — ${soldeDe('')}')),
    ('TVA', q['autoliquidation'] == true ? 'Autoliquidation, sans TVA' : taux == 10 || taux == 5.5 ? '${_pourcent(taux)}, mention certifiée à la signature' : _pourcent(taux)),
    if (canaux.isNotEmpty) ('Canaux', '${canaux.first[0].toUpperCase()}${canaux.join(', ').substring(1)}'),
  ];
}

({String titre, String detail}) versionDevis(Map q) {
  final versions = ((q['versions'] as List?) ?? const []).whereType<Map>().toList();
  final derniere = versions.isNotEmpty ? versions.last : null;
  final precedente = versions.length > 1 ? versions[versions.length - 2] : null;
  final numero = int.tryParse(_s(derniere?['number'] ?? q['versionNumber'])) ?? 1;
  final envoi = _s(derniere?['sentAt']).isNotEmpty ? _s(derniere!['sentAt']) : _s(q['sentAt']);
  return (
    titre: '$numero${envoi.isEmpty ? '' : ' · envoyée le ${_court(envoi)}'}',
    detail: precedente == null
        ? 'Lecture seule'
        : 'Lecture seule · v${int.tryParse(_s(precedente['number'])) ?? 1} du ${_court(_s(precedente['sentAt']))} remplacée',
  );
}
