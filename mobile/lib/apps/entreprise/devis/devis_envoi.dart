import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;

// Envoyer le devis (maquette PRO-03.2) : port de lib/devis-envoi.js, mêmes
// exemples dans test/devis_envoi_test.dart et tests/unit/devis-envoi.test.js.

const validites = [15, 30, 45, 60, 90];
const acomptes = [0, 10, 20, 30, 40, 50];

/// Taux proposés dans l'app (le 5,5 % arrive avec le lot TVA, PRO-03.5).
const tauxTvaApp = [20, 10];

/// Règlement du solde : (fin du libellé « Solde — … », libellé affiché).
const reglements = [
  ('à la réception des travaux', 'Solde à la réception'),
  ('par situations mensuelles, à 30 jours', 'Situation mensuelle, 30 jours'),
  ('à 30 jours après la réception', 'Solde à 30 jours de la réception'),
];

DateTime _jour(DateTime d) => DateTime.utc(d.year, d.month, d.day, 12);

String _pourcent(num n) {
  final s = n == n.roundToDouble() ? n.toInt().toString() : n.toString();
  return '${s.replaceAll('.', ',')} %';
}

/// « 30 jours · jusqu'au 27 nov. » (la validité court depuis l'envoi).
String libelleValidite(int jours, DateTime aujourdhui) {
  final fin = _jour(aujourdhui).add(Duration(days: jours));
  return '$jours jours · jusqu\'au ${DateFormat('d MMM', 'fr_FR').format(fin)}';
}

int joursDe(String validite) =>
    int.tryParse(RegExp(r'\d+').firstMatch(validite)?.group(0) ?? '') ?? 30;

String libelleAcompte(num pct, num totalTtc) =>
    pct <= 0 ? 'Sans acompte' : '${_pourcent(pct)} · ${euros(totalTtc * pct / 100)} TTC';

String soldeDe(String? label) {
  final s = (label ?? '').replaceFirst(RegExp(r'^Solde(\s*—\s*)?', caseSensitive: false), '').trim();
  return s.isEmpty ? reglements.first.$1 : s;
}

String libelleReglement(String? label) {
  final solde = soldeDe(label);
  for (final (s, libelle) in reglements) {
    if (s == solde) return libelle;
  }
  return 'Solde $solde';
}

String libelleTva(num taux) {
  if (taux == 10 || taux == 5.5) return '${_pourcent(taux)} · mention certifiée par le client';
  if (taux == 20) return '20 % · taux normal';
  return _pourcent(taux);
}

/// « Devis_2026-041_Lefèvre.pdf ».
String nomFichierDevis(String numero, String client) {
  final mots = client.replaceAll(RegExp(r'[\\/:*?"<>|]'), ' ').trim().split(RegExp(r'\s+')).where((m) => m.isNotEmpty).toList();
  final nom = [
    'Devis',
    numero.replaceAll(RegExp(r'[\\/:*?"<>|\s]+'), '-'),
    if (mots.isNotEmpty) mots.last,
  ].where((x) => x.isNotEmpty).join('_');
  return '$nom.pdf';
}

String messageEnvoi({String client = '', String projet = '', DateTime? debut}) {
  final bonjour = 'Bonjour${client.isEmpty ? '' : ' $client'},';
  final devis = 'voici le devis${projet.isEmpty ? '' : ' pour « $projet »'}.';
  final dispo = 'Je reste disponible pour en parler'
      '${debut == null ? '' : ', et je peux démarrer le ${DateFormat('d MMMM', 'fr_FR').format(debut)}'}.';
  return '$bonjour $devis $dispo';
}

String resumePdf(int lignes, int lots) =>
    '$lignes ligne${lignes > 1 ? 's' : ''} · $lots lot${lots > 1 ? 's' : ''} · mentions légales et conditions de paiement';

String erreurEnvoi({
  required bool kojiClient,
  required bool email,
  required bool sms,
  String adresse = '',
  String telephone = '',
}) {
  if (!kojiClient && !email && !sms) return "Choisis au moins une façon d'envoyer le devis.";
  if (email && adresse.trim().isEmpty) return "Ajoute l'e-mail du client pour l'envoi par e-mail.";
  if (sms && telephone.replaceAll(RegExp(r'[^\d]'), '').isEmpty) return 'Ajoute le téléphone du client pour le SMS.';
  if (kojiClient && !email && !sms) return "Le lien de signature part par e-mail ou par SMS : coche l'un des deux.";
  return '';
}

String texteSms({String message = '', String lien = '', String identifiant = '', String motDePasse = '', bool kojiClient = true}) => [
      message,
      if (kojiClient && lien.isNotEmpty) 'Lien : $lien',
      if (kojiClient && identifiant.isNotEmpty)
        'Identifiant : $identifiant${motDePasse.isEmpty ? '' : ' · Mot de passe : $motDePasse'}',
    ].where((x) => x.isNotEmpty).join('\n');

/// Ligne « Modalités de paiement » des mentions du devis, tenue à jour
/// quand l'acompte ou le règlement change.
String mentionsAvecPaiement(String mentions, int acompte, String solde) {
  final ligne = acompte > 0
      ? 'Modalités de paiement : $acompte % à la signature, solde $solde.'
      : 'Modalités de paiement : solde $solde.';
  final lignes = mentions.split('\n');
  final i = lignes.indexWhere((l) => l.trim().startsWith('Modalités de paiement'));
  if (i >= 0) {
    lignes[i] = ligne;
    return lignes.join('\n');
  }
  return mentions.trim().isEmpty ? ligne : '$ligne\n$mentions';
}

/// Ce que l'artisan a choisi dans l'écran d'envoi.
class EnvoiDevisChoix {
  const EnvoiDevisChoix({
    required this.validite,
    required this.acompte,
    required this.solde,
    required this.tva,
    required this.message,
    required this.adresse,
    required this.telephone,
    required this.kojiClient,
    required this.email,
    required this.sms,
  });

  final int validite;
  final int acompte;
  final String solde;
  final num tva;
  final String message;
  final String adresse;
  final String telephone;
  final bool kojiClient;
  final bool email;
  final bool sms;
}
