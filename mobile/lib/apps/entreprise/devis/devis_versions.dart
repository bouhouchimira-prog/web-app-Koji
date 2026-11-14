import 'package:koji/apps/entreprise/devis/devis_guide.dart' show montant;

// Versions du devis (maquette PRO-03.6) : port de lib/devis-versions.js,
// mêmes exemples dans test/devis_versions_test.dart.

double _arrondi(num n) => (n * 100).round() / 100;
String _s(dynamic v) => v == null ? '' : '$v';
double _n(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
String _cle(Map l) => _s(l['id']).isNotEmpty ? _s(l['id']) : '${_s(l['room'])}|${_s(l['label'])}';

class EcartLigne {
  const EcartLigne({
    required this.kind,
    required this.label,
    this.labelAvant = '',
    this.lot = '',
    this.avant,
    this.apres,
    required this.ecart,
    required this.ecartTtc,
  });

  /// del, mod, add.
  final String kind;
  final String label;
  final String labelAvant;
  final String lot;
  final double? avant;
  final double? apres;
  final double ecart;
  final double ecartTtc;
}

class EcartsVersions {
  const EcartsVersions({required this.lignes, required this.identiques, required this.totalHt, required this.totalTtc});
  final List<EcartLigne> lignes;
  final int identiques;

  /// (avant, après, écart).
  final (double, double, double) totalHt;
  final (double, double, double) totalTtc;
}

EcartsVersions ecartsVersions(Map avant, Map apres, {num tauxTva = 0}) {
  List<Map> lignesDe(Map v) => ((v['lines'] as List?) ?? const []).whereType<Map>().toList();
  final lAvant = {for (final l in lignesDe(avant)) _cle(l): l};
  final lApres = {for (final l in lignesDe(apres)) _cle(l): l};
  final retirees = <EcartLigne>[];
  final modifiees = <EcartLigne>[];
  final ajoutees = <EcartLigne>[];
  var identiques = 0;
  double ttc(double e) => _arrondi(e * (1 + tauxTva / 100));
  lApres.forEach((k, l) {
    final old = lAvant[k];
    final ht = _arrondi(_n(l['totalHt']));
    if (old == null) {
      ajoutees.add(EcartLigne(kind: 'add', label: _s(l['label']), lot: _s(l['room']), apres: ht, ecart: ht, ecartTtc: ttc(ht)));
    } else if (_s(old['label']) != _s(l['label']) ||
        (_n(old['quantity']) - _n(l['quantity'])).abs() > 0.005 ||
        (_n(old['totalHt']) - _n(l['totalHt'])).abs() > 0.005) {
      final e = _arrondi(_n(l['totalHt']) - _n(old['totalHt']));
      modifiees.add(EcartLigne(
        kind: 'mod',
        label: _s(l['label']),
        labelAvant: _s(old['label']) != _s(l['label']) ? _s(old['label']) : '',
        lot: _s(l['room']),
        avant: _arrondi(_n(old['totalHt'])),
        apres: ht,
        ecart: e,
        ecartTtc: ttc(e),
      ));
    } else {
      identiques++;
    }
  });
  lAvant.forEach((k, l) {
    if (!lApres.containsKey(k)) {
      final e = _arrondi(-_n(l['totalHt']));
      retirees.add(EcartLigne(kind: 'del', label: _s(l['label']), lot: _s(l['room']), avant: _arrondi(_n(l['totalHt'])), ecart: e, ecartTtc: ttc(e)));
    }
  });
  (double, double, double) tot(String k) =>
      (_arrondi(_n(avant[k])), _arrondi(_n(apres[k])), _arrondi(_n(apres[k]) - _n(avant[k])));
  return EcartsVersions(lignes: [...retirees, ...modifiees, ...ajoutees], identiques: identiques, totalHt: tot('totalHt'), totalTtc: tot('totalTtc'));
}

String resumeEcarts(EcartsVersions e) {
  final n = e.lignes.length;
  if (n == 0) return e.identiques > 0 ? 'Aucune ligne modifiée · les ${e.identiques} lignes sont identiques' : 'Aucune ligne modifiée';
  final concernees = '$n ligne${n > 1 ? 's' : ''} concernée${n > 1 ? 's' : ''}';
  if (e.identiques == 0) return concernees;
  return '$concernees · ${e.identiques > 1 ? 'les ${e.identiques} autres sont identiques' : "l'autre est identique"}';
}

String libelleEcart(String kind) => switch (kind) { 'del' => 'Retiré', 'mod' => 'Modifié', 'add' => 'Ajouté', _ => '' };

/// « + 181,20 », « − 396,00 », « — ».
String signe(num? n) {
  if (n == null) return '—';
  final v = _arrondi(n);
  if (v == 0) return '0,00';
  return '${v > 0 ? '+' : '−'} ${montant(v.abs())}';
}
