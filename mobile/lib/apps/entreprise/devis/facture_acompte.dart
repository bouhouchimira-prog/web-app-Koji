import 'package:intl/intl.dart';

// Facture d'acompte (maquette PRO-03.4) : port de lib/facture-acompte.js,
// mêmes exemples dans test/facture_acompte_test.dart.

const pourcentagesAcompte = [20, 30, 40, 50];

/// (id, libellé, jours).
const echeancesAcompte = [
  ('reception', 'À réception · avant le démarrage', 0),
  ('8', 'À 8 jours', 8),
  ('15', 'À 15 jours', 15),
  ('30', 'À 30 jours', 30),
];

double _arrondi(num n) => (n * 100).round() / 100;

double montantAcompte(num totalTtc, num pourcentage) => _arrondi(totalTtc * pourcentage / 100);

double tvaIncluse(num montantTtc, num taux) => _arrondi(montantTtc * taux / (100 + taux));

String dateEcheance(String aujourdhui, int jours) {
  final d = DateTime.tryParse(aujourdhui);
  return d == null ? '' : DateFormat('yyyy-MM-dd').format(DateTime.utc(d.year, d.month, d.day).add(Duration(days: jours)));
}

String _pct(num p) => (p == p.roundToDouble() ? p.toInt().toString() : p.toString()).replaceAll('.', ',');

String messageAcompte({String client = '', num pourcentage = 30, DateTime? debut}) {
  final demarrage = debut == null ? 'le démarrage du chantier' : 'le démarrage le ${DateFormat('d MMMM', 'fr_FR').format(debut)}';
  return 'Bonjour${client.isEmpty ? '' : ' $client'}, merci pour votre signature. '
      "Voici la facture d'acompte de ${_pct(pourcentage)} % prévue au devis. Son règlement confirme $demarrage.";
}

String erreurAcompte({
  required num pourcentage,
  required num montant,
  num? restant,
  bool envoyer = false,
  bool email = false,
  String adresse = '',
}) {
  if (pourcentage <= 0 || pourcentage > 100) return 'Choisis un pourcentage entre 1 et 100.';
  if (restant != null && montant > restant + 0.01) return 'Le montant dépasse ce qui reste à facturer sur ce devis.';
  if (envoyer && email && adresse.trim().isEmpty) return "Ajoute l'e-mail du client pour lui envoyer la facture.";
  return '';
}
