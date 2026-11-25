// Bibliothèque Koji Pro (maquettes PRO-08 à 08.3), mêmes règles que
// lib/bibliotheque-pro.js du site : main-d'œuvre d'un ouvrage, niveaux de
// sensibilité, code proposé, recherche, état d'un taux par métier.
import 'dart:math' as math;

import 'package:koji/features/fournitures/pro/fournitures_logic.dart' show Json, nb, num2, r2;

export 'package:koji/features/fournitures/pro/fournitures_logic.dart' show Json, euro, nb, num2, r2;

class NiveauSensibilite {
  const NiveauSensibilite(this.id, this.label, this.valeur);
  final String id;
  final String label;
  final double valeur;
}

const niveauxSensibilite = [
  NiveauSensibilite('nulle', 'Nulle', 0),
  NiveauSensibilite('faible', 'Faible', 0.3),
  NiveauSensibilite('moyenne', 'Moyenne', 0.5),
  NiveauSensibilite('forte', 'Forte', 1),
];

NiveauSensibilite niveauSensibilite(Object? valeur) {
  final v = num2(valeur);
  var best = niveauxSensibilite.first;
  for (final x in niveauxSensibilite) {
    if ((x.valeur - v).abs() < (best.valeur - v).abs()) best = x;
  }
  return best;
}

class FacteurFiche {
  const FacteurFiche(this.key, this.nom, this.aide);
  final String key;
  final String nom;
  final String aide;
}

/// Facteurs de situation, dans l'ordre de la maquette.
const facteursFiche = [
  FacteurFiche('ACC', 'Accès', 'étage sans ascenseur, stationnement'),
  FacteurFiche('EXI', 'Exiguïté', 'pièce'),
  FacteurFiche('HSP', 'Hauteur', '> 2,70 m sous plafond'),
  FacteurFiche('OCC', 'Occupation', 'logement occupé'),
  FacteurFiche('SUP', 'Support', 'ancien revêtement conservé'),
  FacteurFiche('STO', 'Stockage', 'pas de zone de stockage'),
  FacteurFiche('HOR', 'Horaires', 'horaires contraints'),
];

String familleDe(Json o) {
  final f = '${o['familyCode'] ?? ''}';
  return f.isNotEmpty ? f : '${o['code'] ?? ''}'.split('-').first;
}

/// Taux appliqué : propre à l'ouvrage, sinon celui du métier, sinon défaut.
double tauxOuvrage(Json o, {double tauxFamille = 0, double tauxDefaut = 0}) {
  final propre = num2(o['hourlyRate']);
  if (propre > 0) return propre;
  if (tauxFamille > 0) return tauxFamille;
  return tauxDefaut;
}

/// Taux « par défaut » d'un ouvrage sans taux propre ni taux de métier : le
/// taux horaire du profil de l'entreprise, celui que le devis applique. Le
/// taux de référence de la famille ne sert que si le profil n'en a pas
/// (retours du build 64 : 13,00 € dans la bibliothèque, 19,50 € dans le devis).
double tauxParDefaut({double tauxProfil = 0, double defautFamille = 0}) =>
    tauxProfil > 0 ? tauxProfil : defautFamille;

/// Fiabilité du temps d'un ouvrage, en clair (retours du build 64 :
/// « confiance C » n'était expliqué nulle part). Mêmes mots que le site :
/// A chronométré, B recalé, C estimé.
String libelleConfiance(dynamic confiance) => switch ('${confiance ?? 'C'}') {
      'A' => 'temps chronométré',
      'B' => 'temps recalé',
      _ => 'temps estimé',
    };

class MoOuvrage {
  const MoOuvrage(this.parUnite, this.fixe, this.facteur);
  final double parUnite;
  final double fixe;
  final double facteur;
}

/// Temps × taux × coefficient × (1 − réduction) ; temps fixe à part.
MoOuvrage moOuvrage(Json o, double taux) {
  final c = num2(o['coefficient'], 1);
  final coef = c == 0 ? 1.0 : c;
  final reduction = math.min(100.0, math.max(0.0, num2(o['discount'])));
  final facteur = coef * (1 - reduction / 100);
  return MoOuvrage(r2(num2(o['normativeTime']) * taux * facteur), r2(num2(o['fixedTime']) * taux * facteur), facteur);
}

/// « 0,6 h/m² × 55 €/h » sous le libellé d'une ligne.
String detailMo(Json o, double taux) => '${nb(num2(o['normativeTime']))} h/${o['unit'] ?? 'u'} × ${nb(taux)} €/h';

/// Code proposé : préfixe de la famille et numéro libre de 10 en 10.
String prochainCode(String familyCode, Iterable<String> codes) {
  final p = (familyCode.isEmpty ? 'PERSO' : familyCode).toUpperCase();
  final pris = codes.map((c) => c.toUpperCase()).toSet();
  final re = RegExp('^${RegExp.escape(p)}-(\\d+)\$');
  final nums = pris.map((c) => re.firstMatch(c)).whereType<RegExpMatch>().map((m) => int.parse(m[1]!)).toList();
  var next = nums.isEmpty ? 10 : (((nums.reduce(math.max) + 1) / 10).ceil() * 10);
  String code(int n) => '$p-${'$n'.padLeft(3, '0')}';
  while (pris.contains(code(next))) {
    next += 10;
  }
  return code(next);
}

String sansAccents(String s) {
  const de = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ';
  const vers = 'aaaaaaceeeeiiiinooooouuuuyyoa';
  final b = StringBuffer();
  for (final ch in s.toLowerCase().split('')) {
    final i = de.indexOf(ch);
    b.write(i >= 0 ? vers[i] : ch);
  }
  return b.toString().trim();
}

/// Recherche : code, libellé, synonymes, famille ; tous les mots doivent
/// apparaître (« carreler » trouve « carrelage »).
List<Json> rechercherOuvrages(List<Json> ouvrages, String q) {
  final t = sansAccents(q);
  if (t.isEmpty) return ouvrages;
  final mots = t.split(RegExp(r'\s+')).where((m) => m.isNotEmpty).toList();
  return ouvrages.where((o) {
    final texte = sansAccents([o['code'], o['label'], o['family'], ...(o['synonyms'] as List? ?? const [])].join(' '));
    return mots.every((m) => texte.contains(m) || texte.contains(m.replaceAll(RegExp(r'er$'), '')));
  }).toList();
}

class EtatTaux {
  const EtatTaux(this.etat, this.texte);
  final String etat;
  final String texte;
}

/// Validé (date), à confirmer, ou à régler (Koji prend le taux de
/// référence de la famille en attendant).
EtatTaux etatTaux({double taux = 0, String valideLe = '', double defaut = 0}) {
  if (taux > 0 && valideLe.isNotEmpty) return EtatTaux('valide', 'validé le $valideLe');
  if (taux > 0) return const EtatTaux('a_confirmer', 'à confirmer');
  return EtatTaux('a_regler', 'Koji utilise ${nb(defaut)} € en attendant');
}

/// « 2026-11-15 » → « 15/11 ».
String jourCourt(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  return m == null ? iso : '${m[3]}/${m[2]}';
}

List<Json> listeJson(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
