// Mon parcours v2 (maquettes PRO-26 et PRO-26.1) : règles d'affichage de
// l'app Koji Pro. Le calcul (expérience, niveau, hauts faits, talents) se
// fait sur le serveur (lib/parcours-grade.js, lib/parcours-talents.js) ;
// ces fonctions reprennent les mêmes règles pour l'écran et les tests.

typedef Json = Map<String, dynamic>;

class Grade {
  const Grade(this.id, this.label, this.de, this.a);
  final String id;
  final String label;
  final int de;
  final int a;
}

/// Grades de la maquette (niveaux 1 à 50).
const grades = <Grade>[
  Grade('apprenti', 'Apprenti', 1, 5),
  Grade('ouvrier', 'Ouvrier', 6, 12),
  Grade('compagnon', 'Compagnon', 13, 20),
  Grade('chef-equipe', "Chef d'équipe", 21, 30),
  Grade('chef-chantier', 'Chef de chantier', 31, 40),
  Grade('maitre', 'Maître', 41, 49),
  Grade('batisseur', 'Bâtisseur', 50, 50),
];

const niveauMax = 50;
const seuilsTalents = [1, 3, 6, 10];
const pointsMaxBranche = 10;

/// Points cumulés pour atteindre le niveau n (niveau n → n+1 : 100 × n).
int cumulNiveau(int n) => 50 * n * (n - 1);

Grade gradeDeNiveau(int niveau) =>
    grades.firstWhere((g) => niveau >= g.de && niveau <= g.a,
        orElse: () => grades.first);

int niveauDeXp(int xp) {
  var n = 1;
  while (n < niveauMax && cumulNiveau(n + 1) <= xp) {
    n++;
  }
  return n;
}

/// Nœud de talent : acquis, disponible (atteignable avec les points libres)
/// ou verrouillé.
String etatNoeud(int pointsBranche, int seuil, int libres) {
  if (pointsBranche >= seuil) return 'got';
  return seuil - pointsBranche <= libres ? 'avail' : 'lock';
}

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
  'déc.'
];

/// « 2026-12-01 » → « 1er déc. ».
String jourCourt(String jour) {
  final p = jour.split('-');
  if (p.length < 3) return '';
  final m = int.tryParse(p[1]) ?? 0;
  final j = int.tryParse(p[2].substring(0, p[2].length.clamp(0, 2))) ?? 0;
  if (m < 1 || m > 12 || j < 1) return '';
  return '${j == 1 ? '1er' : j} ${_mois[m - 1]}';
}

/// 1120 → « 1 120 ».
String nombre(num n) => n
    .round()
    .toString()
    .replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');

/// 200 → « + 200 », −60 → « − 60 ».
String signe(num n) => n < 0 ? '− ${nombre(-n)}' : '+ ${nombre(n)}';

String pluriel(int n, String un, String plusieurs) =>
    '$n ${n > 1 ? plusieurs : un}';

/// Onglets « Obtenus », « À venir », « Tous ».
List<Json> hautsFaitsDe(List<Json> faits, String onglet) => switch (onglet) {
      'obtenus' => faits.where((h) => h['obtenu'] == true).toList(),
      'avenir' => faits
          .where((h) => h['obtenu'] != true && h['atteignable'] == true)
          .toList(),
      _ => faits,
    };

/// Ce qui s'affiche à droite d'un haut fait (téléphone).
String droiteHautFait(Json h) {
  if (h['obtenu'] == true) {
    final j = jourCourt('${h['obtenuLe'] ?? ''}');
    return j.isEmpty ? 'obtenu' : j;
  }
  if (h['mesurable'] != true) return 'pas encore mesurable';
  if (h['atteignable'] != true) return 'non accessible';
  return '${h['pourcent'] ?? 0} %';
}

/// Distinctions : trois au plus, parmi les hauts faits publics obtenus.
List<String> basculerDistinction(List<String> choix, String id) {
  if (choix.contains(id)) return [...choix]..remove(id);
  if (choix.length >= 3) return choix;
  return [...choix, id];
}

/// Réorganisation en cours (brouillon local, validé par le serveur).
class BrouillonTalents {
  const BrouillonTalents({this.radar = 0, this.vitrine = 0});
  final int radar;
  final int vitrine;

  int get places => radar + vitrine;
  int de(String branche) => branche == 'radar' ? radar : vitrine;
  int libres(int points) => (points - places).clamp(0, points);

  bool peutPlacer(String branche, int points) =>
      libres(points) > 0 && de(branche) < pointsMaxBranche;

  BrouillonTalents placer(String branche, int points) {
    if (!peutPlacer(branche, points)) return this;
    return branche == 'radar'
        ? BrouillonTalents(radar: radar + 1, vitrine: vitrine)
        : BrouillonTalents(radar: radar, vitrine: vitrine + 1);
  }

  BrouillonTalents retirer(String branche) {
    if (de(branche) == 0) return this;
    return branche == 'radar'
        ? BrouillonTalents(radar: radar - 1, vitrine: vitrine)
        : BrouillonTalents(radar: radar, vitrine: vitrine - 1);
  }

  Json versJson() => {'radar': radar, 'vitrine': vitrine};
}
