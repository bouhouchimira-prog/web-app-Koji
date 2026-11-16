// Fournitures Koji Pro (maquettes PRO-07 à 07.6), mêmes règles que
// lib/fournitures-pro.js, lib/fournitures-bons.js du site : prix de vente
// selon le mode, marge, conditionnement, état d'un bon, réclamation.
import 'dart:math' as math;

import 'package:koji/features/factures/factures_logic.dart' show euro, shortDay;

export 'package:koji/features/factures/factures_logic.dart' show euro, shortDay, longDay, parseDay;

typedef Json = Map<String, dynamic>;

const modesPrix = {'public': 'Public', 'coefficient': 'Coefficient', 'manuel': 'Manuel'};
const coefCompteDefaut = 1.3;

double num2(Object? v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  final t = '${v ?? ''}'.replaceAll(RegExp('[\\s  ]'), '').replaceAll(',', '.');
  return double.tryParse(t) ?? fallback;
}

double r2(num v) => (v * 100).roundToDouble() / 100;

/// « 1,44 », « 6,1 », « 25 » : nombres à la française.
String nb(num? v, [int max = 2]) {
  final x = r2((v ?? 0).toDouble());
  var s = x.toStringAsFixed(max);
  if (s.contains('.')) s = s.replaceAll(RegExp(r'0+$'), '').replaceAll(RegExp(r'\.$'), '');
  final parts = s.split('.');
  final ent = parts[0].replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]} ');
  return parts.length > 1 ? '$ent,${parts[1]}' : ent;
}

String qte(num? v, [String unit = '']) => '${nb(v)} $unit'.trim();

List<Json> fournisseursDe(Json a) => (a['fournisseurs'] as List? ?? const []).whereType<Map>().map((f) => Map<String, dynamic>.from(f)).toList();

Json? fournisseurPrefere(Json a) {
  final l = fournisseursDe(a);
  if (l.isEmpty) return null;
  return l.firstWhere((f) => f['prefere'] == true, orElse: () => l.first);
}

double prixAchat(Json a) {
  final f = fournisseurPrefere(a);
  if (f != null && num2(f['achat']) > 0) return r2(num2(f['achat']));
  return r2(num2(a['achat']));
}

String modeEffectif(Json a) {
  final mode = modesPrix.containsKey(a['modePrix']) ? a['modePrix'] as String : 'public';
  if (mode == 'public' && !(num2(a['prixPublic']) > 0)) return 'coefficient';
  return mode;
}

double prixVente(Json a, {double coefCompte = coefCompteDefaut}) {
  final mode = modeEffectif(a);
  if (mode == 'manuel') return r2(num2(a['prixManuel']));
  if (mode == 'coefficient') {
    final c = a['modePrix'] == 'coefficient' && num2(a['coef']) > 0 ? num2(a['coef']) : coefCompte;
    return r2(prixAchat(a) * c);
  }
  return r2(num2(a['prixPublic']));
}

({double vente, double achat, double euros, int? pct, double? ecartPublic}) marge(Json a, {double coefCompte = coefCompteDefaut}) {
  final vente = prixVente(a, coefCompte: coefCompte);
  final achat = prixAchat(a);
  final euros = r2(vente - achat);
  final pub = num2(a['prixPublic']);
  return (vente: vente, achat: achat, euros: euros, pct: vente > 0 && achat > 0 ? (euros / vente * 100).round() : null, ecartPublic: pub > 0 ? r2(vente - pub) : null);
}

String libelleMode(Json a, {double coefCompte = coefCompteDefaut}) {
  final mode = modeEffectif(a);
  if (mode == 'manuel') return 'Manuel';
  if (mode == 'public') return 'Public';
  final c = a['modePrix'] == 'coefficient' && num2(a['coef']) > 0 ? num2(a['coef']) : coefCompte;
  return '× ${c.toStringAsFixed(2).replaceAll('.', ',')}';
}

List<String> manquesArticle(Json a) => [
      if (fournisseurPrefere(a) == null && '${a['supplierId'] ?? ''}'.isEmpty) 'fournisseur',
      if (!(prixAchat(a) > 0)) 'prix',
    ];

double achatParUnite(num prixConditionnement, num contenance) => r2(prixConditionnement / (contenance > 0 ? contenance : 1));

double avecPerte(num quantite, num pertePct) => (r2(quantite * (1 + pertePct / 100)) * 10 - 1e-9).ceilToDouble() / 10;

({int paquets, double quantite, double ecart}) arrondiConditionnement(num quantite, num contenance, {bool venteUnite = false}) {
  if (venteUnite || !(contenance > 0) || contenance == 1) {
    final u = (quantite - 1e-9).ceil();
    return (paquets: math.max(0, u), quantite: math.max(0, u).toDouble(), ecart: r2(u - quantite));
  }
  final p = (quantite / contenance - 1e-9).ceil();
  final t = r2(p * contenance);
  return (paquets: math.max(0, p), quantite: t, ecart: r2(t - quantite));
}

String condLibelle(Json a) {
  final c = num2(a['contenance'], 1);
  final u = '${a['uniteCond'] ?? ''}';
  if (u.isNotEmpty && c > 0 && c != 1) return '$u ${nb(c)} ${a['unit'] ?? ''}'.trim();
  if (u.isNotEmpty) return u;
  final p = '${a['packaging'] ?? ''}';
  return p.isNotEmpty ? p : 'unité';
}

/// « 5 boîtes · 7,2 m² » ou « 4 sac ».
String quantiteBon(Json l) {
  final paquets = num2(l['paquets']).round();
  final cont = num2(l['contenance'], 1);
  final cond = '${l['uniteCond'] ?? ''}';
  if (paquets > 0 && cont != 1 && cond.isNotEmpty) {
    final pl = paquets > 1 && !cond.endsWith('s') ? 's' : '';
    return '$paquets $cond$pl · ${qte(num2(l['quantite']), '${l['unit'] ?? ''}')}';
  }
  return qte(num2(l['quantite']), '${l['unit'] ?? ''}');
}

const etatsBon = {'brouillon': 'Brouillon', 'envoye': 'Envoyé', 'partiel': 'Livré en partie', 'livre': 'Livré', 'annule': 'Annulé'};

({double ht, double tva, double ttc}) totauxBon(List<Json> lignes, [double taux = 20]) {
  final ht = r2(lignes.fold<double>(0, (s, l) => s + r2(num2(l['quantite']) * num2(l['prixHt']))));
  final tva = r2(ht * taux / 100);
  return (ht: ht, tva: tva, ttc: r2(ht + tva));
}

List<Json> lignesDe(Json bon) => (bon['lignes'] as List? ?? const []).whereType<Map>().map((l) => Map<String, dynamic>.from(l)).toList();

const statutsChantier = {'a_completer': 'À compléter', 'a_commander': 'À commander', 'commande': 'Commandé', 'livre': 'Livré', 'aucun': 'Rien à commander'};

String statutChantier(Json c) {
  final s = '${c['statut'] ?? 'aucun'}';
  if (s == 'a_completer') return 'À compléter ${c['aCompleter'] ?? ''}'.trim();
  if (s == 'commande' && '${c['prochaineLivraison'] ?? ''}'.isNotEmpty) return 'Commandé, livraison ${shortDay(c['prochaineLivraison'])}';
  return statutsChantier[s] ?? s;
}

const etatsLivraison = {'conforme': 'conforme', 'manquant': 'manquant', 'partiel': 'partiel', 'casse': 'cassé', 'en_plus': 'non commandé'};

/// Le reste à commander d'une ligne une fois le stock coché pris.
({double besoin, int paquets, double quantite, double prisHt}) resteACommander(Json b, {double pris = 0}) {
  final besoin = r2(math.max(0, num2(b['reste'] ?? b['quantite']) - pris));
  final a = arrondiConditionnement(besoin, num2(b['contenance'], 1), venteUnite: b['venteUnite'] == true);
  return (besoin: besoin, paquets: a.paquets, quantite: a.quantite, prisHt: r2(pris * num2(b['prixHt'])));
}

String euroHt(num v) => '${euro(v)} HT';
