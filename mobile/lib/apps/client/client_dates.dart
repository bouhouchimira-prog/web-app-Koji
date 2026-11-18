// Dates courtes de l'app Koji, en français, sans dépendre des données de
// langue d'intl : « 09:12 », « hier », « lun. », « 28 oct. ».

const _jours = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const _mois = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

/// Date ISO du site, en heure locale ; nulle si absente ou illisible.
DateTime? lireDate(dynamic valeur) =>
    valeur is String ? DateTime.tryParse(valeur)?.toLocal() : null;

/// Nombre de jours de calendrier entre [d] et [maintenant] (0 = même jour).
int joursDepuis(DateTime d, DateTime maintenant) =>
    DateTime.utc(maintenant.year, maintenant.month, maintenant.day)
        .difference(DateTime.utc(d.year, d.month, d.day))
        .inDays;

String heureCourte(DateTime d) =>
    '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

String _jourMois(DateTime d, DateTime maintenant) =>
    '${d.day} ${_mois[d.month - 1]}'
    '${d.year == maintenant.year ? '' : ' ${d.year}'}';

/// Colonne de droite d'une liste : l'heure aujourd'hui et hier, le jour
/// dans la semaine, sinon la date (« 28 oct. »).
String dateDeListe(DateTime d, DateTime maintenant) {
  final ecart = joursDepuis(d, maintenant);
  if (ecart <= 1) return heureCourte(d);
  if (ecart < 7) return _jours[d.weekday - 1];
  return _jourMois(d, maintenant);
}

/// Date et heure : « 07:52 », « hier 18:42 », « lun. 09:12 »,
/// « 28 oct. 09:12 ». [aujourdhui] préfixe l'heure du jour même.
String horodatage(DateTime d, DateTime maintenant, {bool aujourdhui = false}) {
  final ecart = joursDepuis(d, maintenant);
  final heure = heureCourte(d);
  if (ecart <= 0) return aujourdhui ? "aujourd'hui $heure" : heure;
  if (ecart == 1) return 'hier $heure';
  if (ecart < 7) return '${_jours[d.weekday - 1]} $heure';
  return '${_jourMois(d, maintenant)} $heure';
}

/// Groupe d'une liste par jour : « Aujourd'hui », « Hier », « Cette
/// semaine », « Plus tôt ».
String groupeDuJour(DateTime? d, DateTime maintenant) {
  if (d == null) return 'Plus tôt';
  final ecart = joursDepuis(d, maintenant);
  if (ecart <= 0) return "Aujourd'hui";
  if (ecart == 1) return 'Hier';
  if (ecart < 7) return 'Cette semaine';
  return 'Plus tôt';
}
