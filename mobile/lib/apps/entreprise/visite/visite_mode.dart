import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart' show estOuvre;

// Mode visite (maquette PRO-03.8) : port de lib/visite-mode.js, mêmes
// exemples dans test/visite_mode_test.dart et tests/unit/visite-mode.test.js.
// Aucune IA ici, des règles fixes ; aucun prix (bibliothèque, Devis guidé).
// La visite est une Map JSON, la même que celle envoyée au site.

typedef Visite = Map<String, dynamic>;

String _s(dynamic v) => v == null ? '' : '$v';

String sansAccents(String t) {
  const de = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ';
  const vers = 'aaaaaaceeeeiiiinooooouuuuyyoa';
  final b = StringBuffer();
  for (final c in t.toLowerCase().split('')) {
    final i = de.indexOf(c);
    b.write(i >= 0 ? vers[i] : (c == '’' ? "'" : c));
  }
  return b.toString();
}

final _pieceEau = RegExp(r"douche|baignoire|\bwc\b|toilette|lavabo|vasque|evier|receveur|plomberie|salle de bain|salle d'eau|cuisine");

class _Point {
  const _Point(this.id, this.libelle, this.court, this.si, this.question, this.choix, {this.toujours = false});
  final String id;
  final String libelle;
  final String court;
  final RegExp? si;
  final String question;
  final List<String> choix;
  final bool toujours;
}

final _points = [
  _Point('evacuations', 'Évacuations : diamètre et pente', 'Évacuations', _pieceEau, 'Évacuations : quel diamètre ?', ['Ø 32', 'Ø 40', 'Ø 100 (WC)', 'Je ne sais pas']),
  _Point('arrivees', "Arrivées d'eau et robinet d'arrêt", "Arrivées d'eau", _pieceEau, "Arrivées d'eau : en quoi ?", ['Cuivre', 'PER', 'Multicouche', 'Je ne sais pas']),
  _Point('support', 'Support des murs', 'Support des murs', RegExp(r'faience|carrel|peint|peind|enduit|platre|cloison|\bmurs?\b'), 'Support des murs : quel état ?',
      ['Plâtre sain', 'À reprendre', 'Carreaux de plâtre', 'Je ne sais pas']),
  _Point('sol', 'Planéité et nature du sol', 'Sol', RegExp(r'parquet|\bsols?\b|ragreage|chape|stratifie'), 'Sol existant : quel état ?', ['Plan, sain', 'À ragréer', 'Je ne sais pas']),
  _Point('electricite', 'Différentiel 30 mA au tableau', 'Électricité',
      RegExp(r"electri|prise|eclairage|luminaire|tableau|radiateur|chauffe|douche|baignoire|salle de bain|salle d'eau|cuisine"),
      'Y a-t-il un différentiel 30 mA au tableau ?', ['Oui', 'Non', 'Je ne sais pas']),
  _Point('chauffage', 'Chauffage existant', 'Chauffage', RegExp(r'chauffage|chaudiere|pompe a chaleur|\bpac\b'), 'Chauffage existant ?', ['Gaz', 'Électrique', 'Pompe à chaleur', 'Je ne sais pas']),
  _Point('menuiseries', 'Dimensions des tableaux et état des appuis', 'Menuiseries', RegExp(r'fenetre|menuiser|volet|baie|porte-fenetre'), 'Appuis de fenêtre : quel état ?',
      ['Sains', 'À reprendre', 'Je ne sais pas']),
  _Point('toiture', 'Accès au toit et état de la charpente', 'Toiture', RegExp(r'toit|toiture|couverture|tuile|gouttiere|charpente'), 'Accès au toit ?',
      ['Échelle', 'Échafaudage nécessaire', 'Je ne sais pas']),
  const _Point('acces', 'Accès, stockage et évacuation des gravats', 'Accès et gravats', null, 'Accès au chantier ?', ['Ascenseur', 'Escalier seulement', 'Plain-pied'], toujours: true),
  _Point('ventilation', 'Ventilation existante', 'Ventilation', RegExp(r"douche|baignoire|salle de bain|salle d'eau|\bwc\b|toilette|cuisine"), 'Ventilation : y a-t-il une VMC ?',
      ['Oui', 'Non, fenêtre seulement', 'Je ne sais pas']),
];

/// Points « À vérifier sur place », tirés de la demande et des lots prévus.
List<Map<String, dynamic>> listeAVerifier(String demande, [List<String> lots = const []]) {
  final texte = sansAccents([demande, ...lots].join(' '));
  final faience = texte.contains('faience');
  return [
    for (final p in _points)
      if (p.toujours || p.si!.hasMatch(texte))
        {
          'id': p.id,
          'libelle': p.id == 'support' && faience ? 'Support des murs, faïence à déposer' : p.libelle,
          'court': p.court,
          'question': p.question,
          'choix': [...p.choix],
          'reponse': '',
          'detail': '',
        },
  ];
}

List<Map<String, dynamic>> _liste(dynamic v) => [for (final x in (v as List?) ?? const []) if (x is Map) Map<String, dynamic>.from(x)];

/// Prochaine question de Koji : le premier point sans réponse.
Map<String, dynamic>? prochaineQuestion(List<Map<String, dynamic>> points) {
  for (final p in points) {
    if (_s(p['reponse']).isEmpty) return p;
  }
  return null;
}

bool _inconnu(String r) => r.isEmpty || RegExp('je ne sais pas', caseSensitive: false).hasMatch(r);

/// Ce que la réponse dit, en clair (résumé envoyé au client).
String constat(Map<String, dynamic> point) {
  final r = _s(point['reponse']);
  if (_inconnu(r)) return '';
  final n = sansAccents(r);
  switch (point['id']) {
    case 'ventilation':
      return n.startsWith('non') ? 'pas de VMC' : 'VMC présente';
    case 'electricite':
      return n.startsWith('non') ? 'pas de différentiel 30 mA' : 'différentiel 30 mA présent';
    case 'evacuations':
      return 'évacuation $r';
    case 'arrivees':
      return "arrivées d'eau en ${r.toLowerCase()}";
    case 'support':
      return n.contains('reprendre') ? 'murs à reprendre' : n.contains('carreaux') ? 'murs en carreaux de plâtre' : 'murs sains';
    case 'sol':
      return n.contains('ragreer') ? 'sol à ragréer' : 'sol sain';
    case 'acces':
      return n.contains('escalier') ? "accès par l'escalier" : n.contains('ascenseur') ? 'accès par ascenseur' : 'accès de plain-pied';
    case 'chauffage':
      return 'chauffage ${r.toLowerCase()}';
    case 'menuiseries':
      return n.contains('reprendre') ? 'appuis à reprendre' : 'appuis sains';
    case 'toiture':
      return n.contains('echafaudage') ? 'échafaudage nécessaire' : "toit accessible à l'échelle";
    default:
      return r;
  }
}

/// Une vérification qui change le devis donne une proposition.
List<Map<String, dynamic>> propositions(List<Map<String, dynamic>> points, [String piece = '']) {
  final ici = piece.isNotEmpty ? 'dans la ${piece.toLowerCase()}' : 'dans la pièce';
  final out = <Map<String, dynamic>>[];
  for (final p in points) {
    final n = sansAccents(_s(p['reponse']));
    if (p['id'] == 'ventilation' && n.startsWith('non')) {
      out.add({
        'id': 'extracteur', 'pointId': p['id'], 'court': 'extracteur', 'option': true, 'ligne': "Fourniture et pose d'un extracteur d'air",
        'texte': "Pas de VMC : Koji propose un extracteur d'air $ici, en option sur le devis. Une photo de la fenêtre suffit.",
      });
    }
    if (p['id'] == 'electricite' && n.startsWith('non')) {
      out.add({
        'id': 'differentiel', 'pointId': p['id'], 'court': 'différentiel 30 mA', 'option': false,
        'ligne': "Fourniture et pose d'un interrupteur différentiel 30 mA",
        'texte': "Pas de différentiel 30 mA : Koji propose de l'ajouter au tableau, obligatoire pour une pièce d'eau.",
      });
    }
    if (p['id'] == 'acces' && n.contains('escalier')) {
      out.add({
        'id': 'gravats', 'pointId': p['id'], 'court': 'évacuation des gravats', 'option': false, 'ligne': "Évacuation des gravats par l'escalier",
        'texte': "Sans ascenseur : Koji propose une ligne pour descendre les gravats par l'escalier.",
      });
    }
    if (p['id'] == 'support' && n.contains('reprendre')) {
      out.add({
        'id': 'reprise-murs', 'pointId': p['id'], 'court': 'reprise des murs', 'option': false, 'ligne': 'Reprise des murs avant la pose',
        'texte': 'Murs à reprendre : Koji propose une ligne de reprise avant la pose.',
      });
    }
  }
  return out;
}

// ── Cotes dictées ─────────────────────────────────────────────────────────
const _mots = {
  'zero': 0, 'un': 1, 'une': 1, 'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5, 'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'onze': 11, 'douze': 12, 'treize': 13, 'quatorze': 14, 'quinze': 15, 'seize': 16, 'vingt': 20, 'vingts': 20, 'trente': 30,
  'quarante': 40, 'cinquante': 50, 'soixante': 60, 'cent': 100, 'cents': 100,
};
final _metre = RegExp(r'^(m|metres?|metre)$');
final _centi = RegExp(r'^(cm|centimetres?)$');

class _Groupe {
  _Groupe(this.valeur, {this.decimal = false});
  num valeur;
  final bool decimal;
  String unite = '';
}

List<_Groupe> _groupes(List<String> mots) {
  final out = <_Groupe>[];
  _Groupe? courant;
  void fermer() {
    if (courant != null) out.add(courant!);
    courant = null;
  }

  for (final m in mots) {
    if (m == 'et' && courant != null && !courant!.decimal) continue;
    if (RegExp(r'^\d+([.,]\d+)?$').hasMatch(m)) {
      fermer();
      courant = _Groupe(num.parse(m.replaceAll(',', '.')), decimal: RegExp('[.,]').hasMatch(m));
      fermer();
      continue;
    }
    if (_metre.hasMatch(m) || _centi.hasMatch(m)) {
      final dernier = courant ?? (out.isNotEmpty ? out.last : null);
      fermer();
      if (dernier != null) dernier.unite = _metre.hasMatch(m) ? 'm' : 'cm';
      continue;
    }
    final v = _mots[m];
    if (v == null) {
      fermer();
      continue;
    }
    if (courant == null) {
      courant = _Groupe(v);
    } else if (v == 100) {
      courant!.valeur = (courant!.valeur == 0 ? 1 : courant!.valeur) * 100;
    } else if (v == 20 && courant!.valeur % 100 == 4) {
      courant!.valeur += 76; // quatre-vingt
    } else if (courant!.valeur > 0 && courant!.valeur < 10 && v >= 10) {
      fermer();
      courant = _Groupe(v);
    } else {
      courant!.valeur += v;
    }
  }
  fermer();
  return out;
}

double _r2(num n) => (n * 100).round() / 100;

double? _enMetres(List<_Groupe> g) {
  if (g.isEmpty) return null;
  final a = g[0];
  final b = g.length > 1 ? g[1] : null;
  if (b != null && b.unite.isEmpty && b.valeur < 100 && (a.unite == 'm' || (a.unite.isEmpty && !a.decimal && a.valeur < 10))) {
    return _r2(a.valeur + b.valeur / 100);
  }
  if (a.unite == 'cm') return a.valeur / 100;
  if (a.unite == 'm' || a.decimal) return a.valeur.toDouble();
  return a.valeur >= 10 ? a.valeur / 100 : a.valeur.toDouble();
}

String _premiereLettre(String t) => t.isEmpty ? t : t[0].toUpperCase() + t.substring(1);

/// « Mur du fond deux mètres quarante » → {libelle: Mur du fond, valeur:
/// 2.4}. « Porte quatre-vingt-trois par deux cent quatre » → {libelle:
/// Porte, largeur: 0.83, hauteur: 2.04}. null si aucun nombre.
Map<String, dynamic>? comprendreCote(String texte) {
  final brut = texte.trim();
  final mots = sansAccents(brut)
      .replaceAllMapped(RegExp(r'(^|\s|\d)[×x*](?=\s|\d|$)'), (m) => '${m[1]} par ')
      .replaceAllMapped(RegExp(r'(\d)\s*(cm|m)(?=\d|\s|$)'), (m) => '${m[1]} ${m[2]} ')
      .replaceAll('-', ' ')
      .split(RegExp(r'\s+'))
      .where((m) => m.isNotEmpty)
      .toList();
  final premier = mots.indexWhere((m) => RegExp(r'^\d').hasMatch(m) || (_mots.containsKey(m) && m != 'une'));
  if (premier < 0) return null;
  final motsBruts = brut.replaceAll('-', ' ').split(RegExp(r'\s+')).where((m) => m.isNotEmpty).toList();
  final libelle = _premiereLettre(motsBruts.take(premier).join(' ').replaceAll(RegExp('[«»"“”:]'), '').trim());
  final reste = mots.sublist(premier);
  final sep = reste.indexWhere((m) => m == 'par' || m == 'sur');
  if (sep > 0) {
    final largeur = _enMetres(_groupes(reste.sublist(0, sep)));
    final hauteur = _enMetres(_groupes(reste.sublist(sep + 1)));
    if (largeur != null && largeur > 0 && hauteur != null && hauteur > 0) return {'libelle': libelle, 'largeur': largeur, 'hauteur': hauteur};
  }
  final valeur = _enMetres(_groupes(reste));
  return valeur != null && valeur > 0 ? {'libelle': libelle, 'valeur': valeur} : null;
}

// ── Surfaces et quantités ─────────────────────────────────────────────────
String nombre(num n) => _r2(n).toStringAsFixed(2).replaceAll('.', ',');

String _role(Map<String, dynamic> c) {
  final l = sansAccents(_s(c['libelle']));
  for (final r in ['longueur', 'largeur', 'hauteur', 'porte', 'fenetre']) {
    if (l.startsWith(r)) return r;
  }
  return '';
}

double? _num(dynamic v) => v is num ? v.toDouble() : null;

class Surfaces {
  Surfaces({this.sol, this.perimetre, this.murs, this.bande, this.longueur, this.largeur, this.hauteur, this.portes = 0, this.fenetres = 0});
  final double? sol;
  final double? perimetre;
  final double? murs;
  final double? bande;
  final double? longueur;
  final double? largeur;
  final double? hauteur;
  final int portes;
  final int fenetres;
}

Surfaces surfaces(List<Map<String, dynamic>> cotes) {
  List<Map<String, dynamic>> de(String r) => cotes.where((c) => _role(c) == r).toList();
  final l1 = de('longueur').isEmpty ? null : _num(de('longueur').first['valeur']);
  final l2 = de('largeur').isEmpty ? null : _num(de('largeur').first['valeur']);
  final h = de('hauteur').isEmpty ? null : _num(de('hauteur').first['valeur']);
  final portes = de('porte').where((c) => _num(c['largeur']) != null && _num(c['hauteur']) != null).toList();
  final fenetres = de('fenetre').where((c) => _num(c['largeur']) != null && _num(c['hauteur']) != null).toList();
  if (l1 == null || l2 == null) return Surfaces(portes: portes.length, fenetres: fenetres.length);
  final perimetre = 2 * (l1 + l2);
  final ouvertures = [...portes, ...fenetres].fold<double>(0, (s, o) => s + _num(o['largeur'])! * _num(o['hauteur'])!);
  return Surfaces(
    sol: _r2(l1 * l2),
    perimetre: _r2(perimetre),
    bande: _r2(perimetre - portes.fold<double>(0, (s, p) => s + _num(p['largeur'])!)),
    murs: h == null ? null : _r2(perimetre * h - ouvertures),
    longueur: l1,
    largeur: l2,
    hauteur: h,
    portes: portes.length,
    fenetres: fenetres.length,
  );
}

/// « sol 5,81 m² · murs 21,93 m² ».
String resumeSurfaces(List<Map<String, dynamic>> cotes) {
  final s = surfaces(cotes);
  return [if (s.sol != null) 'sol ${nombre(s.sol!)} m²', if (s.murs != null) 'murs ${nombre(s.murs!)} m²'].join(' · ');
}

/// Quantités reprises dans le Devis guidé, avec leur formule.
List<Map<String, dynamic>> quantitesCalculees(Map<String, dynamic> piece, [String demande = '']) {
  final s = surfaces(_liste(piece['cotes']));
  final t = sansAccents(demande);
  final support = _liste(piece['points']).where((p) => p['id'] == 'support').firstOrNull;
  final reponseSupport = sansAccents(_s(support?['reponse']));
  final out = <Map<String, dynamic>>[];
  if (s.sol != null) {
    out.add({
      'id': 'sol',
      'libelle': RegExp(r'carrel|italienne|\bsols?\b|douche').hasMatch(t) ? 'Sol à carreler' : RegExp('parquet|stratifie').hasMatch(t) ? 'Sol, parquet' : 'Surface au sol',
      'formule': '${nombre(s.longueur!)} × ${nombre(s.largeur!)}',
      'valeur': s.sol,
      'unite': 'm²',
    });
  }
  if (s.murs != null) {
    final moins = [for (var i = 0; i < s.portes; i++) ' − porte', for (var i = 0; i < s.fenetres; i++) ' − fenêtre'].join();
    final libelle = t.contains('faience')
        ? (t.contains('toute hauteur') ? 'Faïence toute hauteur' : 'Faïence murale')
        : RegExp('peint|peind').hasMatch(t)
            ? 'Murs à peindre'
            : 'Surface des murs';
    out.add({'id': 'murs', 'libelle': libelle, 'formule': 'périmètre ${nombre(s.perimetre!)} × ${nombre(s.hauteur!)}$moins', 'valeur': s.murs, 'unite': 'm²'});
  }
  if (s.bande != null && RegExp('douche|italienne|baignoire|receveur').hasMatch(t)) {
    out.add({'id': 'bande', 'libelle': "Bande d'angle d'étanchéité", 'formule': s.portes > 0 ? 'périmètre − porte' : 'périmètre', 'valeur': s.bande, 'unite': 'ml'});
  }
  if (s.murs != null && t.contains('faience') && (RegExp('depos|a la place|remplac|refaire').hasMatch(t) || reponseSupport.contains('depos'))) {
    out.add({'id': 'depose', 'libelle': 'Dépose faïence existante', 'formule': 'même surface', 'valeur': s.murs, 'unite': 'm²'});
  }
  if (s.bande != null && RegExp('parquet|plinthe|stratifie').hasMatch(t)) {
    out.add({'id': 'plinthes', 'libelle': 'Plinthes', 'formule': s.portes > 0 ? 'périmètre − porte' : 'périmètre', 'valeur': s.bande, 'unite': 'ml'});
  }
  if (s.sol != null && t.contains('plafond')) {
    out.add({'id': 'plafond', 'libelle': 'Plafond', 'formule': 'même surface que le sol', 'valeur': s.sol, 'unite': 'm²'});
  }
  return out;
}

/// « 2,40 m » ou « 0,83 × 2,04 m ».
String texteCote(Map<String, dynamic> c) {
  final l = _num(c['largeur']);
  final h = _num(c['hauteur']);
  if (l != null && h != null) return '${nombre(l)} × ${nombre(h)} m';
  final v = _num(c['valeur']);
  return v == null ? '' : '${nombre(v)} m';
}

/// « 83 × 204 » (porte, fenêtre, en cm) ou « 2,40 m » : ligne des cotes.
String texteCoteCourt(Map<String, dynamic> c) {
  final l = _num(c['largeur']);
  final h = _num(c['hauteur']);
  if (l != null && h != null) return '${(l * 100).round()} × ${(h * 100).round()}';
  return texteCote(c);
}

// ── Fin de visite ─────────────────────────────────────────────────────────
DateTime _jour(String j) => DateTime.parse('${j.substring(0, 10)}T12:00:00Z');
String _iso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String _plus(String j, int n) => _iso(_jour(j).add(Duration(days: n)));
const _joursSemaine = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const _moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

String _ouvreApres(String jour, int n) {
  var j = jour;
  var reste = n;
  while (reste > 0) {
    j = _plus(j, 1);
    if (estOuvre(j)) reste--;
  }
  return j;
}

/// Devis promis pour : le jour ouvré suivant la visite, ou deux jours
/// ouvrés plus tard (« Lundi 26 oct. », « Mercredi 28 »).
List<({String jour, String label})> datesPromises(String jourVisite) {
  final d1 = _ouvreApres(jourVisite, 1);
  final d2 = _ouvreApres(d1, 2);
  final a = _jour(d1);
  final b = _jour(d2);
  return [
    (jour: d1, label: '${_joursSemaine[a.weekday - 1]} ${a.day} ${_moisCourts[a.month - 1]}'),
    (jour: d2, label: '${_joursSemaine[b.weekday - 1]} ${b.day}${b.month == a.month ? '' : ' ${_moisCourts[b.month - 1]}'}'),
  ];
}

String veille(String jour) => _plus(jour, -1);

String jourLong(String jour) {
  final d = _jour(jour);
  return '${_joursSemaine[d.weekday - 1].toLowerCase()} ${d.day} ${_moisCourts[d.month - 1]}';
}

/// Le résumé envoyé au client : information, jamais de prix.
String resumeClient(Visite visite, [String jourPromis = '']) {
  final pieces = _liste(visite['pieces']);
  final decisions = (visite['propositions'] as Map?) ?? const {};
  final props = [for (final p in pieces) ...propositions(_liste(p['points']), _s(p['nom']))];
  final vus = <String>[];
  for (final pt in pieces.expand((p) => _liste(p['points']))) {
    final c = constat(pt);
    if (c.isEmpty) continue;
    final prop = props.where((x) => x['pointId'] == pt['id'] && decisions[x['id']] == 'acceptee').firstOrNull;
    final t = prop != null ? '$c (${prop['court']} proposé${prop['option'] == true ? ' en option' : ''})' : c;
    if (!vus.contains(t)) vus.add(t);
  }
  final client = _s(visite['client']);
  final quand = jourPromis.isNotEmpty ? " d'ici ${_joursSemaine[_jour(jourPromis).weekday - 1].toLowerCase()}" : ' très vite';
  return [
    client.isNotEmpty ? 'Bonjour $client,' : 'Bonjour,',
    '',
    'Merci pour la visite.${vus.isNotEmpty ? ' Points vus : ${vus.join(', ')}.' : ''} Vous recevrez le devis$quand.',
  ].join('\n');
}

/// « 18 photos, 9 cotes, 6 vérifications, 2 notes ».
({int photos, int cotes, int verifications, int notes, String texte}) compteVisite(Visite visite) {
  final pieces = _liste(visite['pieces']);
  final photos = pieces.fold<int>(0, (s, p) => s + _liste(p['photos']).length);
  final cotes = pieces.fold<int>(0, (s, p) => s + _liste(p['cotes']).length);
  final verifs = pieces.fold<int>(0, (s, p) => s + _liste(p['points']).where((x) => _s(x['reponse']).isNotEmpty).length);
  final notes = pieces.fold<int>(0, (s, p) => s + _liste(p['notes']).length);
  String mot(int n, String un, String plusieurs) => '$n ${n > 1 ? plusieurs : un}';
  return (
    photos: photos,
    cotes: cotes,
    verifications: verifs,
    notes: notes,
    texte: [mot(photos, 'photo', 'photos'), mot(cotes, 'cote', 'cotes'), mot(verifs, 'vérification', 'vérifications'), mot(notes, 'note', 'notes')].join(', '),
  );
}

String dureeVisite(String debut, String fin) {
  final a = DateTime.tryParse(debut);
  final b = DateTime.tryParse(fin);
  if (a == null || b == null || b.isBefore(a)) return '';
  final min = (b.difference(a).inSeconds / 60).round();
  return min < 60 ? '$min min' : '${min ~/ 60} h ${(min % 60).toString().padLeft(2, '0')}';
}

/// Ce que Koji reçoit pour préparer le Devis guidé.
String demandeDevisGuide(Visite visite) {
  final client = _s(visite['client']);
  final adresse = _s(visite['adresse']);
  final lignes = ['Compte rendu de visite${client.isNotEmpty ? ' chez $client' : ''}${adresse.isNotEmpty ? ' ($adresse)' : ''}.'];
  if (_s(visite['demande']).isNotEmpty) lignes.add('Demande du client : ${visite['demande']}');
  final decisions = (visite['propositions'] as Map?) ?? const {};
  for (final p in _liste(visite['pieces'])) {
    lignes.add('${p['nom']} :');
    final q = quantitesCalculees(p, _s(visite['demande']));
    if (q.isNotEmpty) lignes.add('- Quantités : ${q.map((x) => '${x['libelle']} ${nombre(x['valeur'] as num)} ${x['unite']}').join(' ; ')}.');
    final cotes = _liste(p['cotes']);
    if (cotes.isNotEmpty) lignes.add('- Cotes : ${cotes.map((c) => '${c['libelle']} ${texteCote(c)}').join(' ; ')}.');
    final verifs = _liste(p['points'])
        .where((x) => _s(x['reponse']).isNotEmpty)
        .map((x) => '${x['court']} : ${[_s(x['reponse']), _s(x['detail'])].where((y) => y.isNotEmpty).join(', ')}');
    if (verifs.isNotEmpty) lignes.add('- Vérifications : ${verifs.join(' ; ')}.');
    final acceptees = propositions(_liste(p['points']), _s(p['nom'])).where((x) => decisions[x['id']] == 'acceptee');
    if (acceptees.isNotEmpty) lignes.add('- À ajouter : ${acceptees.map((x) => '${x['ligne']}${x['option'] == true ? ' (en option)' : ''}').join(' ; ')}.');
    final notes = _liste(p['notes']);
    if (notes.isNotEmpty) lignes.add('- Notes : ${notes.map((n) => '« ${n['texte']} »').join(' ')}');
  }
  lignes.add('Prépare le devis avec ces quantités et les prix de ma bibliothèque ; pose-moi les questions qui restent.');
  return lignes.join('\n');
}

/// Questions restantes : points sans réponse ou « Je ne sais pas ».
int questionsRestantes(Visite visite) =>
    _liste(visite['pieces']).expand((p) => _liste(p['points'])).where((x) => _inconnu(_s(x['reponse']))).length;

/// Éléments pas encore envoyés à Koji (bandeau hors ligne).
int enAttente(Visite visite) => _liste(visite['pieces']).fold<int>(
    0,
    (s, p) =>
        s +
        _liste(p['photos']).where((x) => x['envoye'] != true).length +
        _liste(p['cotes']).where((x) => x['envoye'] != true).length +
        _liste(p['notes']).where((x) => x['envoye'] != true).length +
        _liste(p['points']).where((x) => _s(x['reponse']).isNotEmpty && x['envoye'] != true).length);
