import 'dart:math' as math;

import 'package:shared_preferences/shared_preferences.dart';

/// Démarrage guidé Koji Pro (maquette PRO-01.1), même logique que le site
/// (lib/demarrage.js, lib/iban.js) : six étapes lues dans le profil, les
/// trois premières suffisent pour envoyer un premier devis.

const demarragePasseKey = 'koji-demarrage-passe';

/// « Plus tard » choisi sur cet appareil (SharedPreferences).
Future<bool> demarragePasse() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(demarragePasseKey) != null;
  } catch (_) {
    return false;
  }
}

class MetierDemarrage {
  const MetierDemarrage(this.metier, this.activite, this.familles);

  /// Valeur enregistrée (la même que le site et le Radar).
  final String metier;

  /// Libellé de la maquette (« Électricité »).
  final String activite;

  /// Familles de la bibliothèque dont ce métier fixe le taux.
  final List<String> familles;
}

const metiersDemarrage = [
  MetierDemarrage('Electricien', 'Électricité', ['ELEC']),
  MetierDemarrage('Peintre', 'Peinture', ['PEI']),
  MetierDemarrage('Carreleur', 'Carrelage, faïence', ['CAR']),
  MetierDemarrage('Plombier', 'Plomberie', ['PLO']),
  MetierDemarrage('Plaquiste', 'Plâtrerie, isolation', ['PLA', 'ISO']),
  MetierDemarrage('Menuisier', 'Menuiserie', ['MEI', 'MEX']),
  MetierDemarrage('Maçon', 'Maçonnerie', ['GRO']),
  MetierDemarrage('Chauffagiste', 'Chauffage', ['CHA']),
  MetierDemarrage('Climaticien', 'Climatisation, ventilation', ['VEN']),
  MetierDemarrage('Couvreur', 'Couverture', ['COU']),
  MetierDemarrage("Tout corps d'etat", "Tous corps d'état", []),
];

const rayonsZone = [5, 10, 20, 30, 50];

String activiteDe(String metier) {
  for (final m in metiersDemarrage) {
    if (m.metier == metier) return m.activite;
  }
  return metier;
}

/// Métiers qui ont un taux propre (pas « Tous corps d'état »).
bool metierAvecTaux(String metier) =>
    metiersDemarrage.any((m) => m.metier == metier && m.familles.isNotEmpty);

/// Taux minimum en 4 questions : (charges + revenu) / (heures × semaines),
/// arrondi à l'euro supérieur ; null si une réponse manque.
int? tauxMinimum({
  required double? charges,
  required double? revenu,
  required double? heuresParSemaine,
  required double? semaines,
}) {
  final c = charges ?? 0, r = revenu ?? 0;
  final h = heuresParSemaine ?? 0, s = semaines ?? 0;
  if (c < 0 || r < 0 || h <= 0 || s <= 0 || c + r <= 0) return null;
  return ((c + r) / (h * s)).ceil();
}

/// « 992651123 » → « 992 ••• 123 ».
String masquerSiren(String? siren) {
  final s = (siren ?? '').replaceAll(RegExp(r'\D'), '');
  return s.length == 9 ? '${s.substring(0, 3)} ••• ${s.substring(6)}' : '';
}

/// Clé du SIREN (Luhn), comme lib/sirene.js.
bool sirenValide(String saisie) {
  final s = saisie.replaceAll(RegExp(r'\s'), '');
  if (!RegExp(r'^\d{9}$').hasMatch(s)) return false;
  var somme = 0;
  for (var i = 0; i < 9; i++) {
    var n = int.parse(s[8 - i]);
    if (i.isOdd) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    somme += n;
  }
  return somme % 10 == 0;
}

String normaliserIban(String saisie) =>
    saisie.replaceAll(RegExp(r'\s+'), '').toUpperCase();

/// Clé ISO 13616 (modulo 97).
bool ibanValide(String saisie) {
  final iban = normaliserIban(saisie);
  if (!RegExp(r'^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$').hasMatch(iban)) return false;
  if (iban.startsWith('FR') && iban.length != 27) return false;
  final reordonne = iban.substring(4) + iban.substring(0, 4);
  var reste = 0;
  for (final c in reordonne.split('')) {
    final valeur = RegExp(r'\d').hasMatch(c) ? c : '${c.codeUnitAt(0) - 55}';
    for (final chiffre in valeur.split('')) {
      reste = (reste * 10 + int.parse(chiffre)) % 97;
    }
  }
  return reste == 1;
}

String formaterIban(String saisie) => normaliserIban(saisie)
    .replaceAllMapped(RegExp(r'.{4}'), (m) => '${m[0]} ')
    .trim();

double tauxHoraireDe(Map<String, dynamic> business) {
  final daily = (business['dailyRate'] as num?)?.toDouble() ?? 0;
  final heures = (business['hoursPerDay'] as num?)?.toDouble() ?? 7;
  return daily > 0
      ? (daily / (heures > 0 ? heures : 7) * 100).round() / 100
      : 0;
}

String _euros(num n) {
  final entier = n == n.roundToDouble();
  return '${entier ? n.round() : n.toStringAsFixed(2).replaceAll('.', ',')} €';
}

class EtapeDemarrage {
  const EtapeDemarrage({
    required this.id,
    required this.titre,
    required this.debloque,
    required this.detail,
    required this.resume,
    required this.faite,
  });

  final String id;
  final String titre;
  final String debloque;
  final String detail;
  final String resume;
  final bool faite;
}

/// Profil au format du site (GET /api/auth/profile) : `business`,
/// `professions`, `logoUrl`.
List<EtapeDemarrage> etapesDemarrage(Map<String, dynamic> user,
    {Map<String, num> taux = const {}}) {
  final business = Map<String, dynamic>.from(user['business'] as Map? ?? {});
  final professions =
      (user['professions'] as List? ?? const []).map((e) => '$e').toList();
  String champ(String cle) => '${business[cle] ?? ''}'.trim();
  final zone = (business['zoneRadiusKm'] as num?)?.toInt() ?? 0;
  final tauxDefaut = tauxHoraireDe(business);
  final iban = normaliserIban(champ('iban'));
  return [
    EtapeDemarrage(
      id: 'entreprise',
      titre: 'Votre entreprise',
      debloque: 'remplit vos devis',
      detail: "votre SIREN suffit, Koji remplit le reste depuis l'annuaire",
      resume: [
        if (champ('siren').isNotEmpty)
          'SIREN ${masquerSiren(champ('siren'))}'
        else if (champ('siret').isNotEmpty)
          'SIRET ${champ('siret')}',
        [champ('raisonSociale'), champ('formeJuridique'), champ('city')]
            .where((s) => s.isNotEmpty)
            .join(', '),
      ].where((s) => s.isNotEmpty).join(' · '),
      faite: champ('raisonSociale').isNotEmpty &&
          (champ('siret').isNotEmpty || champ('siren').isNotEmpty),
    ),
    EtapeDemarrage(
      id: 'metiers',
      titre: 'Vos métiers et votre zone',
      debloque: 'débloque le Radar',
      detail: "ce que vous faites, et jusqu'où vous vous déplacez",
      resume: [
        if (professions.isNotEmpty)
          '${professions.length} métier${professions.length > 1 ? 's' : ''}',
        if (zone > 0) '$zone km autour de votre adresse',
      ].join(' · '),
      faite: professions.isNotEmpty &&
          (champ('zoneAddress').isNotEmpty || business['zoneLat'] != null),
    ),
    EtapeDemarrage(
      id: 'prix',
      titre: 'Vos prix',
      debloque: 'débloque le Devis guidé',
      detail: 'votre taux par métier, ou calculez-le en 4 questions',
      resume: [
        for (final p in professions.where((p) => (taux[p] ?? 0) > 0).take(3))
          '${_euros(taux[p]!)}/h ${activiteDe(p).toLowerCase()}',
        if (tauxDefaut > 0) '${_euros(tauxDefaut)}/h autres postes',
      ].join(' · '),
      faite: ((business['dailyRate'] as num?) ?? 0) > 0,
    ),
    EtapeDemarrage(
      id: 'decennale',
      titre: 'Votre décennale',
      debloque: 'obligatoire sur vos devis',
      detail: 'assureur, numéro de contrat et date de fin',
      resume: [
        champ('decennaleInsurer'),
        if (champ('decennaleUntil').isNotEmpty)
          "jusqu'au ${champ('decennaleUntil')}",
      ].where((s) => s.isNotEmpty).join(' · '),
      faite: champ('decennaleInsurer').isNotEmpty &&
          champ('decennaleUntil').isNotEmpty,
    ),
    EtapeDemarrage(
      id: 'logo',
      titre: 'Votre logo',
      debloque: 'KojiPage et carte de visite',
      detail: 'une image carrée suffit ; sans logo, Koji affiche vos initiales',
      resume: 'logo ajouté',
      faite: champ('logoDataUrl').isNotEmpty ||
          '${user['logoUrl'] ?? ''}'.isNotEmpty,
    ),
    EtapeDemarrage(
      id: 'iban',
      titre: 'Votre IBAN',
      debloque: 'sur vos factures',
      detail: 'pour être payé plus vite par virement',
      resume: iban.length > 8
          ? 'IBAN ${iban.substring(0, 4)} ••• ${iban.substring(iban.length - 4)}'
          : '',
      faite: iban.isNotEmpty,
    ),
  ];
}

bool essentielsFaits(List<EtapeDemarrage> etapes) =>
    etapes.take(3).every((e) => e.faite);

/// Même règle depuis la ligne Supabase `users` (écran de démarrage de
/// l'app) : business_info porte les champs du site, `_professions` les
/// métiers.
bool essentielsFaitsDepuisLigne(Map<String, dynamic>? ligne) {
  if (ligne == null) return false;
  final info = Map<String, dynamic>.from(ligne['business_info'] as Map? ?? {});
  final professions = info['_professions'] is List
      ? (info['_professions'] as List)
      : ['${ligne['profession'] ?? ''}'].where((p) => p.isNotEmpty).toList();
  return essentielsFaits(etapesDemarrage({
    'business': info,
    'professions': professions,
    'logoUrl': ligne['logo_url'],
  }));
}

/// Réduction d'un nombre saisi (« 41,5 » → 41.5).
double? nombre(String saisie) =>
    double.tryParse(saisie.replaceAll(RegExp(r'\s'), '').replaceAll(',', '.'));

/// Pour l'affichage d'un taux enregistré dans un champ.
String tauxTexte(num? t) {
  if (t == null || t <= 0) return '';
  return t == t.roundToDouble() ? '${t.round()}' : '$t'.replaceAll('.', ',');
}

/// Valeur minimale, pour les tests de progression (étapes faites / 6).
double progression(List<EtapeDemarrage> etapes) =>
    math.min(1, etapes.where((e) => e.faite).length / 6);
