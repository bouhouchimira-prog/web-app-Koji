import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart' show estOuvre;
import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;

// Signature et rétractation (maquette PRO-03.7) : port de
// lib/signature-lieu.js, mêmes exemples dans test/signature_lieu_test.dart
// et tests/unit/signature-lieu.test.js. Textes à faire relire par un avocat.
//
// Au domicile : 14 jours de rétractation à partir de la signature,
// information et formulaire obligatoires, aucun paiement avant 7 jours,
// démarrage anticipé sur demande expresse. En ligne : 14 jours aussi,
// paiement possible. Dans les locaux de l'entreprise, ou client
// professionnel : pas de rétractation. Un délai qui finit un samedi, un
// dimanche ou un jour férié est reporté au jour ouvrable suivant.

const lieuxSignature = [
  ('en-ligne', 'En ligne'),
  ('domicile', 'Chez le client'),
  ('locaux', 'Dans vos locaux'),
];

const retractationJours = 14;
const sansPaiementJours = 7;

String _j(String v) => v.length >= 10 ? v.substring(0, 10) : v;

String plusJours(String jour, int n) {
  final d = DateTime.tryParse(_j(jour));
  if (d == null) return '';
  return DateFormat('yyyy-MM-dd').format(DateTime.utc(d.year, d.month, d.day).add(Duration(days: n)));
}

String _long(String jour) {
  final d = DateTime.tryParse(_j(jour));
  return d == null ? '' : DateFormat('d MMMM', 'fr_FR').format(d);
}

String _court(String jour) {
  final d = DateTime.tryParse(_j(jour));
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d);
}

bool estProfessionnel(String? clientType) => clientType == 'societe';

class ReglesSignature {
  const ReglesSignature(this.retractation, this.paiementAvant7Jours, this.formulaire, this.demarrageAvantFin);
  final bool retractation;

  /// possible, interdit.
  final String paiementAvant7Jours;
  final bool formulaire;

  /// libre, demande-expresse.
  final String demarrageAvantFin;
}

/// Règles par lieu (tableau « Ce que Koji applique selon le lieu »).
ReglesSignature reglesSignature(String lieu, [String? clientType = 'particulier']) {
  if (estProfessionnel(clientType) || lieu == 'locaux') {
    return const ReglesSignature(false, 'possible', false, 'libre');
  }
  if (lieu == 'domicile') return const ReglesSignature(true, 'interdit', true, 'demande-expresse');
  return const ReglesSignature(true, 'possible', true, 'demande-expresse');
}

/// Dernier jour pour se rétracter (inclus), ou ''.
String finRetractation(String jourSignature, String lieu, [String? clientType = 'particulier']) {
  if (!reglesSignature(lieu, clientType).retractation || jourSignature.isEmpty) return '';
  var fin = plusJours(jourSignature, retractationJours);
  for (var i = 0; i < 10 && !estOuvre(fin); i++) {
    fin = plusJours(fin, 1);
  }
  return fin;
}

/// Premier jour où l'acompte peut être demandé, ou '' sans attente.
String acompteAPartirDu(String jourSignature, String lieu, [String? clientType = 'particulier']) {
  if (reglesSignature(lieu, clientType).paiementAvant7Jours != 'interdit' || jourSignature.isEmpty) return '';
  return plusJours(jourSignature, sansPaiementJours + 1);
}

bool demarrageAvantFin(String? debut, String fin) =>
    (debut ?? '').isNotEmpty && fin.isNotEmpty && _j(debut!).compareTo(fin) <= 0;

/// « Décaler au lundi 16 nov. » : premier lundi après la fin du délai.
String lundiApres(String fin) {
  var j = plusJours(fin, 1);
  for (var i = 0; i < 7 && DateTime.parse(j).weekday != DateTime.monday; i++) {
    j = plusJours(j, 1);
  }
  return j;
}

String libelleLundi(String jour) => 'lundi ${_court(jour)}';
String jourCourt(String jour) => _court(jour);

String texteRetractation(String fin) =>
    "Vous pouvez annuler sans motif jusqu'au ${_long(fin)} inclus, avec le formulaire joint ou depuis votre espace Koji. Les sommes versées sont remboursées sous 14 jours.";

String texteDemandeExpresse(String debut) =>
    'Je demande que les travaux commencent le ${_long(debut)}, avant la fin du délai de rétractation. Si je me rétracte ensuite, je paierai les travaux déjà réalisés.';

String texteAcompte(num pct, num montantTtc, String aPartirDu) {
  final p = pct == pct.roundToDouble() ? pct.toInt().toString() : pct.toString().replaceAll('.', ',');
  return 'Acompte $p % : ${euros(montantTtc.abs())}${aPartirDu.isNotEmpty ? ', demandé à partir du ${_long(aPartirDu)}' : ''}';
}

/// « s••••.k@••••.fr » : l'e-mail lisible par le client, masqué à l'écran.
String masquerEmail(String? email) {
  final parts = (email ?? '').split('@');
  if (parts.length != 2 || parts[0].isEmpty || parts[1].isEmpty) return '';
  final nom = parts[0];
  final domaine = parts[1];
  final ext = domaine.contains('.') ? domaine.substring(domaine.lastIndexOf('.')) : '';
  final finNom = nom.length > 2 ? nom.substring(nom.length - 2) : '';
  return '${nom[0]}••••$finNom@••••$ext';
}

const informationRetractation =
    "Droit de rétractation : vous disposez d'un délai de quatorze jours à compter de la signature du présent devis pour exercer votre droit de rétractation, sans avoir à motiver votre décision ni à supporter d'autres coûts que ceux prévus par la loi. Pour l'exercer, notifiez-nous votre décision par une déclaration dénuée d'ambiguïté, par exemple au moyen du formulaire ci-dessous. Les sommes versées vous seront remboursées au plus tard quatorze jours après réception de votre décision. Si vous avez demandé que les travaux commencent pendant le délai, vous paierez un montant proportionnel aux travaux réalisés jusqu'à votre rétractation.";

List<String> formulaireRetractation({String entreprise = '', String adresse = '', String email = ''}) {
  final dest = [entreprise, adresse, email].where((x) => x.isNotEmpty).join(', ');
  return [
    'Formulaire de rétractation',
    '(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)',
    "À l'attention de ${dest.isEmpty ? "l'entreprise" : dest} :",
    'Je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous :',
    'Devis n° : ..................   Signé le : ..................',
    'Nom du client : ..................',
    'Adresse du client : ..................',
    'Signature du client (uniquement en cas de notification sur papier) :',
    'Date : ..................',
  ];
}
