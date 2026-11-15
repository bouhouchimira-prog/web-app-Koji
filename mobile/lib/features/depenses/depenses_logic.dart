// Dépenses Koji Pro (maquettes PRO-09 à 09.4) : règles d'affichage. Les
// calculs (chantier proposé, doublons, coût par lot, marges, journaux)
// sont faits par le site (lib/depenses.js) et lus par l'API.
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/fournitures/pro/fournitures_logic.dart' show Json, nb, num2;

export 'package:koji/features/fournitures/pro/fournitures_logic.dart' show Json, euro, nb, num2;

const sourcesPiece = {'photo': 'photo', 'pdf': 'facture PDF', 'commande': 'commande Koji', 'manuel': 'saisie', 'csv': 'fichier'};

class EtatCout {
  const EtatCout(this.label, this.ton);
  final String label;
  final KojiTone ton;
}

const etatsCout = {
  'regarder': EtatCout('À regarder', KojiTone.coral),
  'prevu': EtatCout('Dans le prévu', KojiTone.green),
  'tot': EtatCout('Trop tôt pour juger', KojiTone.grey),
  'cloture': EtatCout('Clôturé', KojiTone.grey),
  'sans_cout': EtatCout('Marge non calculée', KojiTone.amber),
  'sans_devis': EtatCout('Sans devis', KojiTone.grey),
};

EtatCout etatCout(Object? etat) => etatsCout['$etat'] ?? etatsCout['prevu']!;

/// « 22 281 € » : euros sans centimes.
String euro0(num? v) => '${nb((v ?? 0).round())} €';

/// « + 2 300 » / « − 120 ».
String signeEuro(num v) => '${v >= 0 ? '+' : '−'} ${nb(v.abs().round())}';

/// « 60 % fait · marge 28 % → 21 % ».
String resumeCarte(Json c) {
  final mp = c['margePrevue'] as Map?;
  final mf = c['margeFinale'] as Map?;
  final avance = c['etat'] == 'cloture' ? 'clôturé' : '${num2(c['avancement']).round()} % fait';
  if (mp == null) return avance;
  if (c['etat'] == 'cloture') return '$avance · marge ${num2(mf?['pct']).round()} %';
  return '$avance · marge ${num2(mp['pct']).round()} % → ${num2(mf?['pct']).round()} %';
}

/// État d'un lot : écart quand il est fait ou dépassé, sinon en cours.
String ecartLot(Json l) {
  final prevu = num2(l['prevu']);
  final depense = num2(l['depense']);
  if (l['etat'] == 'fait' || depense > prevu) return signeEuro(depense - prevu);
  return l['etat'] == 'a_venir' ? 'à venir' : 'en cours';
}

bool lotDepasse(Json l) => num2(l['prevu']) > 0 && num2(l['depense']) > num2(l['prevu']) * 1.1;

const moisFr = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/// « 2026-10-28 » → « 28 oct. ».
String jourCourt(Object? iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch('${iso ?? ''}');
  if (m == null) return '';
  return '${int.parse(m[3]!)} ${moisFr[int.parse(m[2]!) - 1]}';
}

/// Périodes proposées pour l'export : mois précédent, mois en cours, trimestre.
List<(String, String)> periodesExport(DateTime aujourdhui) {
  const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  final prec = DateTime(aujourdhui.year, aujourdhui.month - 1);
  String cle(DateTime d) => '${d.year}-${'${d.month}'.padLeft(2, '0')}';
  return [
    (cle(prec), mois[prec.month - 1]),
    (cle(aujourdhui), mois[aujourdhui.month - 1]),
    ('${aujourdhui.year}-T${((aujourdhui.month - 1) ~/ 3) + 1}', 'Trimestre'),
  ];
}
