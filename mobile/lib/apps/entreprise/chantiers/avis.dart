import 'package:intl/intl.dart';

/// Avis du client (maquette PRO-02.6), mêmes règles que le site
/// (lib/avis.js) : quatre critères, réponse proposée par Koji selon la
/// note, note moyenne de la KojiPage.

const criteresAvis = [
  ('ponctualite', 'Ponctualité'),
  ('proprete', 'Propreté'),
  ('communication', 'Communication'),
  ('prix', 'Respect du prix'),
];

String reponseProposee({String client = '', int note = 5}) {
  final merci =
      'Merci${client.isEmpty ? '' : ' $client'} pour votre confiance et votre accueil pendant les travaux.';
  if (note >= 4) {
    return "$merci Ravis que le résultat vous plaise ; n'hésitez pas à nous écrire dans Koji Client si besoin.";
  }
  if (note == 3) {
    return '$merci Merci aussi pour vos remarques : nous en tenons compte, et restons à votre disposition dans Koji Client.';
  }
  return "$merci Nous sommes désolés que tout n'ait pas été à la hauteur ; nous vous recontactons pour trouver une solution.";
}

String moyenneTexte(num moyenne) =>
    NumberFormat.decimalPatternDigits(locale: 'fr_FR', decimalDigits: 1)
        .format(moyenne);
