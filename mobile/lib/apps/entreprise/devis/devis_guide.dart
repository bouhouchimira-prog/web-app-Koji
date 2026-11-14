import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'package:koji/features/quote/model/devis_line.dart';

// Devis guidé (maquette PRO-03.1, 13 nov) : port de lib/devis-guide.js
// (mêmes exemples dans test/devis_guide_test.dart et
// tests/unit/devis-guide.test.js) et de la conversation du site
// (components/DevisChatPanel.jsx). Koji ne chiffre rien lui-même : les
// prix viennent de la bibliothèque (/api/devis-chat), l'app ne fait
// qu'appliquer ses actions sur le devis ouvert puis l'enregistrer.

const questionsMax = 3;
const _questionLongueurMax = 140;

String _propre(Object? texte) =>
    (texte ?? '').toString().replaceAll(RegExp(r'\s+'), ' ').trim();

/// Questions oui / non de Koji : texte propre, « ? » final, sans doublon,
/// trois au plus.
List<String> questionsOuiNon(Object? brutes) {
  final vues = <String>{};
  final questions = <String>[];
  for (final brute in brutes is List ? brutes : const []) {
    var q = _propre(brute);
    if (q.length > _questionLongueurMax) q = q.substring(0, _questionLongueurMax);
    if (q.isEmpty) continue;
    if (!q.endsWith('?')) q = '${q.replaceAll(RegExp(r'[.!:;,\s]+$'), '')} ?';
    if (!vues.add(q.toLowerCase())) continue;
    questions.add(q);
    if (questions.length == questionsMax) break;
  }
  return questions;
}

String texteQuestions(List<String> questions) {
  final liste = questionsOuiNon(questions);
  if (liste.isEmpty) return '';
  return 'Questions posées (oui / non) :\n${liste.map((q) => '- $q').join('\n')}';
}

String texteReponses(List<String> questions, List<bool?> reponses) {
  final liste = questionsOuiNon(questions);
  return [
    for (var i = 0; i < liste.length; i++)
      if (i < reponses.length && reponses[i] != null)
        '${liste[i]} ${reponses[i]! ? 'Oui' : 'Non'}',
  ].join('\n');
}

bool toutesRepondues(List<String> questions, List<bool?> reponses) {
  final liste = questionsOuiNon(questions);
  return liste.isNotEmpty &&
      List.generate(liste.length, (i) => i < reponses.length && reponses[i] != null)
          .every((x) => x);
}

String _nombre(num n) {
  final arrondi = (n * 100).round() / 100;
  final entier = arrondi.truncateToDouble() == arrondi;
  final texte = entier ? arrondi.toInt().toString() : arrondi.toString();
  return texte.replaceAll('.', ',');
}

String _milliers(int n) {
  final s = n.toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return b.toString();
}

/// Montant « 1 203,00 » (espace fine des milliers, comme le site).
String montant(num n) {
  final centimes = (n.abs() * 100).round();
  final s = '${_milliers(centimes ~/ 100)},${(centimes % 100).toString().padLeft(2, '0')}';
  return n < 0 ? '−$s' : s;
}

String euros(num n) => '${montant(n)} €';

/// Ce que Koji est en train de faire : la ligne du chat (« Koji ajoute
/// « Ragréer le sol » au lot 01… ») et le bandeau (« Koji ajoute · lot 01 »,
/// « Ragréer le sol, 5,8 m² »).
@immutable
class KojiTravail {
  const KojiTravail(this.phrase, this.lab, this.texte);
  final String phrase;
  final String lab;
  final String texte;

  static const reflexion = KojiTravail('Koji réfléchit…', 'Koji travaille', '');

  @override
  bool operator ==(Object other) =>
      other is KojiTravail && other.phrase == phrase && other.lab == lab && other.texte == texte;

  @override
  int get hashCode => Object.hash(phrase, lab, texte);

  @override
  String toString() => 'KojiTravail($phrase | $lab | $texte)';
}

String _lotDe(List<Map<String, dynamic>> lots, Object? nom) {
  final cle = _propre(nom).toLowerCase();
  for (final lot in lots) {
    if (_propre(lot['nom']).toLowerCase() == cle) {
      final code = _propre(lot['code']);
      if (code.isNotEmpty) return code.replaceFirst(RegExp('^Lot '), 'lot ');
    }
  }
  return _propre(nom).isEmpty ? '' : 'lot « ${_propre(nom)} »';
}

Map<String, dynamic>? _ligneDe(List<Map<String, dynamic>> lots, Object? id) {
  for (final lot in lots) {
    for (final l in (lot['lignes'] as List? ?? const [])) {
      if (l is Map && l['id'] == id) return {...Map<String, dynamic>.from(l), 'lot': lot['nom']};
    }
  }
  return null;
}

KojiTravail? koji(Map<String, dynamic>? action, List<Map<String, dynamic>> lots) {
  if (action == null) return null;
  switch (action['subAction']) {
    case 'addOuvrage':
      final ouvrage = action['ouvrage'] is Map ? action['ouvrage'] as Map : const {};
      final libelle = _propre(ouvrage['label']).replaceFirst(RegExp(r'^À chiffrer manuellement\s*—\s*'), '');
      final lot = _lotDe(lots, action['room']);
      final q = action['quantity'];
      final unite = _propre(ouvrage['unit']);
      return KojiTravail(
        'Koji ajoute « $libelle »${lot.isEmpty ? '' : ' au $lot'}…',
        'Koji ajoute${lot.isEmpty ? '' : ' · $lot'}',
        q is num && q > 0 ? '$libelle, ${_nombre(q)}${unite.isEmpty ? '' : ' $unite'}' : libelle,
      );
    case 'addLot':
      final nom = _propre(action['lotName']);
      return KojiTravail('Koji crée le lot « $nom »…', 'Koji crée un lot', nom);
    case 'updateOuvrage':
      final ligne = _ligneDe(lots, action['id']);
      final libelle = _propre(ligne?['designation']).isEmpty ? 'la ligne' : _propre(ligne!['designation']);
      return KojiTravail('Koji corrige « $libelle »…',
          'Koji corrige${ligne == null ? '' : ' · ${_lotDe(lots, ligne['lot'])}'}', libelle);
    case 'removeOuvrage':
      final ligne = _ligneDe(lots, action['id']);
      final libelle = _propre(ligne?['designation']).isEmpty ? 'la ligne' : _propre(ligne!['designation']);
      return KojiTravail('Koji retire « $libelle »…', 'Koji retire', libelle);
    case 'setManualPrice':
      final m = action['amountHt'];
      return KojiTravail('Koji reporte ton prix sur la ligne…', 'Koji reporte ton prix',
          '${_nombre(m is num ? m : 0)} € HT');
    case 'setClientInfo':
      final client = action['client'] is Map ? action['client'] as Map : const {};
      final nom = _propre(client['nom']);
      return KojiTravail('Koji renseigne le client…', 'Koji renseigne le client',
          nom.isEmpty ? 'Client et chantier' : nom);
  }
  return null;
}

/// Écart de total du bandeau (« + 203,00 »).
String ecartTotal(num avant, num apres) {
  final d = ((apres - avant) * 100).round() / 100;
  if (d == 0) return '';
  return d > 0 ? '+ ${montant(d)}' : '− ${montant(-d)}';
}

/// Premier message de Koji, écrit sans IA.
String premierMessage(Map<String, dynamic> instantane) {
  final lots = [
    for (final l in (instantane['lots'] as List? ?? const []))
      if (l is Map && (l['lignes'] as List? ?? const []).isNotEmpty) l,
  ];
  if (lots.isEmpty) {
    return 'Bonjour, décris-moi le chantier en quelques mots. Je prépare le devis pendant que tu parles.';
  }
  final client = _propre((instantane['client'] as Map?)?['nom']);
  final noms = lots.map((l) => _propre(l['nom']).toLowerCase()).toList();
  final liste = noms.length > 1
      ? '${noms.sublist(0, noms.length - 1).join(', ')} et ${noms.last}'
      : noms.first;
  final lignes = lots.fold<int>(0, (n, l) => n + (l['lignes'] as List).length);
  return "J'ai repris le devis${client.isEmpty ? '' : ' de $client'} : $liste, $lignes ligne${lignes > 1 ? 's' : ''}. "
      'Dis-moi ce qui change, ajoute un ouvrage ou pose une question.';
}

// ─── Le devis vu par Koji, et ses actions ──────────────────────────────────

/// Les lots et lignes de l'éditeur (mêmes objets que l'écran), avec ce
/// qu'il faut pour que Koji les lise et les modifie.
class DevisGuideDonnees {
  DevisGuideDonnees({
    required this.linesByRoom,
    required this.roomOrder,
    required this.lotMeta,
    required this.tauxHoraire,
    required this.nouvelId,
    required this.nomPiece,
  });

  final Map<String, List<DevisLine>> linesByRoom;
  final List<String> roomOrder;
  final Map<String, Map<String, dynamic>> lotMeta;
  final double Function() tauxHoraire;
  final String Function(String prefixe) nouvelId;
  final String Function(String roomId) nomPiece;

  /// Dernière ligne ajoutée par Koji sans prix (cible de proposer_prix).
  String? derniereSansPrix;

  List<String> get lotsVisibles =>
      [for (final r in roomOrder) if (linesByRoom.containsKey(r)) r];

  String titreLot(String roomId) {
    final t = _propre(lotMeta[roomId]?['title']);
    return t.isNotEmpty ? t : nomPiece(roomId);
  }

  String codeLot(String roomId) {
    final n = (lotMeta[roomId]?['number'] as num?)?.toInt() ?? (lotsVisibles.indexOf(roomId) + 1);
    return 'Lot ${n.toString().padLeft(2, '0')}';
  }

  (String, DevisLine)? ligne(String id) {
    for (final e in linesByRoom.entries) {
      for (final l in e.value) {
        if (l.taskId == id) return (e.key, l);
      }
    }
    return null;
  }

  String? lotParNom(String nom) {
    final cle = _propre(nom).toLowerCase();
    for (final r in lotsVisibles) {
      if (titreLot(r).toLowerCase() == cle) return r;
    }
    return null;
  }

  String creerLot(String nom) {
    final existant = lotParNom(nom);
    if (existant != null) return existant;
    final roomId = nouvelId('lot');
    roomOrder.add(roomId);
    linesByRoom[roomId] = [];
    lotMeta[roomId] = {'number': lotsVisibles.length, 'title': _propre(nom)};
    return roomId;
  }

  static double prixUnitaire(DevisLine l) => l.qty > 0 ? l.totalLigne / l.qty : l.totalLigne;

  /// Ce que Koji relit à chaque message (même forme que le site).
  Map<String, dynamic> instantane({
    String? id,
    required Map<String, dynamic> client,
    required double sousTotal,
    required List<Map<String, dynamic>> majorations,
    required double totalHt,
    required double totalTtc,
  }) =>
      {
        'id': id,
        'lots': [
          for (final r in lotsVisibles)
            {
              'nom': titreLot(r),
              'code': codeLot(r),
              'lignes': [
                for (final l in linesByRoom[r]!)
                  if (!l.isComment)
                    {
                      'id': l.taskId,
                      'designation': l.label,
                      'quantite': l.qty,
                      'unite': l.unite,
                      'prixUnitaireHt': (prixUnitaire(l) * 100).round() / 100,
                      'totalHt': (l.totalLigne * 100).round() / 100,
                      'prixManquant': l.totalLigne == 0,
                      'variante': l.isVariante,
                    },
              ],
            },
        ],
        'client': client,
        'totaux': {
          'sousTotalLignes': (sousTotal * 100).round() / 100,
          'majorations': majorations,
          'totalHt': (totalHt * 100).round() / 100,
          'totalTtc': (totalTtc * 100).round() / 100,
        },
        'situationFactors': const <String, dynamic>{},
      };

  /// Applique une action de Koji et renvoie ce qu'il faudra vérifier une
  /// fois le devis enregistré ({tool, lineId | lotName | client}).
  Map<String, dynamic>? appliquer(Map<String, dynamic> action,
      {void Function(Map<String, dynamic> client)? onClient}) {
    switch (action['subAction']) {
      case 'addLot':
        final nom = _propre(action['lotName']);
        if (nom.isEmpty) return null;
        creerLot(nom);
        return {'tool': 'ajouter_lot', 'lotName': nom};
      case 'addOuvrage':
        final o = action['ouvrage'] is Map ? Map<String, dynamic>.from(action['ouvrage'] as Map) : <String, dynamic>{};
        final roomId = creerLot(_propre(action['room']).isEmpty ? 'Travaux' : _propre(action['room']));
        final q = (action['quantity'] as num?)?.toDouble() ?? 1;
        final trouve = o['matched'] == true;
        final temps = (o['normativeTime'] as num?)?.toDouble() ?? 0;
        final taux = (o['hourlyRate'] as num?)?.toDouble() ?? 0;
        final fourniture = (o['suppliesCost'] as num?)?.toDouble() ?? 0;
        final forfait = o['billingMode'] == 'fixed';
        final id = nouvelId('ouvrage');
        final ligne = DevisLine(
          taskId: id,
          label: _propre(o['label']).replaceFirst(RegExp(r'^À chiffrer manuellement\s*—\s*'), ''),
          code: _propre(o['code']),
          unite: _propre(o['unit']).isEmpty ? 'u' : _propre(o['unit']),
          qty: q,
          tempsHU: trouve ? temps : 0,
          tauxHoraire: taux > 0 ? taux : tauxHoraire(),
          fournituresQty: trouve && fourniture > 0 ? q : 0,
          fournituresUnitPrice: trouve ? fourniture : 0,
          forfaitEnabled: trouve && forfait,
          forfaitPrice: trouve && forfait ? ((o['fixedAmountHt'] as num?)?.toDouble() ?? 0) : 0,
        );
        linesByRoom[roomId]!.add(ligne);
        derniereSansPrix = trouve ? null : id;
        return {'tool': 'ajouter_ouvrage', 'lineId': id};
      case 'updateOuvrage':
        final trouvee = ligne(_propre(action['id']));
        if (trouvee == null) return {'tool': 'modifier_ouvrage', 'lineId': null};
        final l = trouvee.$2;
        final q = (action['quantite'] as num?)?.toDouble();
        if (q != null && q > 0) {
          // Fournitures comptées comme l'ouvrage : elles suivent la quantité.
          if (!l.isFourniture && (l.fournituresQty - l.qty).abs() < 1e-9) l.fournituresQty = q;
          l.qty = q;
        }
        final pu = (action['prixUnitaireHt'] as num?)?.toDouble();
        if (pu != null && pu > 0) _fixerPrixUnitaire(l, pu);
        return {'tool': 'modifier_ouvrage', 'lineId': l.taskId};
      case 'removeOuvrage':
        final id = _propre(action['id']);
        final trouvee = ligne(id);
        if (trouvee != null) {
          final lignes = linesByRoom[trouvee.$1]!;
          for (final x in lignes) {
            if (x.parentTaskId == id) x.parentTaskId = '';
          }
          lignes.remove(trouvee.$2);
        }
        if (derniereSansPrix == id) derniereSansPrix = null;
        return {'tool': 'supprimer_ouvrage', 'lineId': id, 'removed': true};
      case 'setManualPrice':
        final m = (action['amountHt'] as num?)?.toDouble() ?? 0;
        final cible = derniereSansPrix == null ? null : ligne(derniereSansPrix!);
        if (cible == null || m <= 0) return {'tool': 'proposer_prix', 'lineId': null};
        cible.$2
          ..forfaitEnabled = true
          ..forfaitPrice = m;
        derniereSansPrix = null;
        return {'tool': 'proposer_prix', 'lineId': cible.$2.taskId};
      case 'setClientInfo':
        final client = action['client'] is Map ? Map<String, dynamic>.from(action['client'] as Map) : <String, dynamic>{};
        onClient?.call(client);
        return {'tool': 'definir_client', 'client': client};
    }
    return null;
  }

  // Prix unitaire donné par l'entreprise : la main-d'œuvre s'ajuste pour
  // que main-d'œuvre + fournitures fasse ce prix (même idée que le site).
  void _fixerPrixUnitaire(DevisLine l, double pu) {
    final fourn = l.qty > 0 ? l.totalFournitures / l.qty : 0.0;
    final taux = l.tauxHoraire * (l.conditionCoeff == 0 ? 1 : l.conditionCoeff);
    if (l.forfaitEnabled || taux <= 0 || pu < fourn) {
      l
        ..forfaitEnabled = true
        ..forfaitPrice = pu * (l.qty > 0 ? l.qty : 1);
      return;
    }
    l.tempsHU = (pu - fourn) / taux;
  }

  /// Résultat réel envoyé à Koji après l'enregistrement (protocole de
  /// confirmation du site : jamais « c'est fait » avant).
  Map<String, dynamic> resultat(Map<String, dynamic> capture, ({bool ok, String devisId, String le, String erreur}) issue) {
    final base = {'action': capture['tool'], 'devisId': issue.devisId, 'enregistreLe': issue.le};
    if (!issue.ok) return {...base, 'success': false, 'error': issue.erreur.isEmpty ? 'Enregistrement impossible.' : issue.erreur};
    switch (capture['tool']) {
      case 'definir_client':
        return {...base, 'success': true, 'client': capture['client']};
      case 'ajouter_lot':
        return {...base, 'success': true, 'lotName': capture['lotName']};
      case 'supprimer_ouvrage':
        return {...base, 'success': true, 'id': capture['lineId'], 'supprime': true};
    }
    final trouvee = capture['lineId'] == null ? null : ligne(capture['lineId'] as String);
    if (trouvee == null) {
      return {...base, 'success': false, 'error': 'Ligne introuvable après enregistrement — relisez le devis avant de réessayer.'};
    }
    final l = trouvee.$2;
    return {
      ...base,
      'success': true,
      'id': l.taskId,
      'lot': titreLot(trouvee.$1),
      'designation': l.label,
      'quantite': l.qty,
      'unite': l.unite,
      'prixUnitaireHt': (prixUnitaire(l) * 100).round() / 100,
      'totalHt': (l.totalLigne * 100).round() / 100,
      'prixManquant': l.totalLigne == 0,
    };
  }
}

// ─── La conversation ───────────────────────────────────────────────────────

class GuideTour {
  GuideTour(this.role, this.text,
      {this.hidden = false, this.chips = false, List<String>? questions, this.photo})
      : questions = questions ?? const [],
        reponses = List<bool?>.filled((questions ?? const []).length, null);

  final String role;
  final String text;
  final bool hidden;
  final bool chips;
  final List<String> questions;
  final List<bool?> reponses;

  /// Photo du chantier (data URL JPEG), envoyée avec ce message.
  final String? photo;

  Map<String, dynamic> pourLeServeur({required bool dernier}) => {
        'role': role,
        'text': text,
        if (hidden) 'hidden': true,
        if (questions.isNotEmpty) 'questions': questions,
        if (photo != null) 'photo': dernier ? photo : true,
      };
}

typedef DevisChatFluxFn = Stream<(String, Map<String, dynamic>)> Function(Map<String, dynamic> corps);

/// Le chat du devis guidé, sans écran : messages, questions oui / non,
/// « Koji travaille », enregistrement puis confirmation.
class DevisGuideConversation extends ChangeNotifier {
  DevisGuideConversation({
    required this.flux,
    required this.instantane,
    required this.appliquer,
    required this.enregistrer,
    required this.resultat,
    this.onFin,
    String? conversationId,
  }) : conversationId = conversationId ?? 'devischat-app-${DateTime.now().microsecondsSinceEpoch}';

  final DevisChatFluxFn flux;
  final Map<String, dynamic> Function() instantane;
  final Map<String, dynamic>? Function(Map<String, dynamic> action) appliquer;
  final Future<({String id, String le})> Function() enregistrer;
  final Map<String, dynamic> Function(Map<String, dynamic> capture, ({bool ok, String devisId, String le, String erreur}) issue) resultat;
  final VoidCallback? onFin;
  final String conversationId;

  final List<GuideTour> tours = [];
  bool envoi = false;
  KojiTravail? travail;
  String enDirect = '';
  String erreur = '';
  String notice = '';

  /// Total HT au début du dernier échange (écart du bandeau).
  double? totalDebut;

  bool _ferme = false;

  @override
  void dispose() {
    _ferme = true;
    super.dispose();
  }

  void _maj() {
    if (!_ferme) notifyListeners();
  }

  /// Premier message : suit le devis tant que personne n'a parlé.
  void accueillir() {
    final texte = premierMessage(instantane());
    if (tours.isEmpty) {
      tours.add(GuideTour('assistant', texte));
      _maj();
    } else if (tours.length == 1 && tours.first.role == 'assistant' && tours.first.text != texte) {
      tours[0] = GuideTour('assistant', texte);
      _maj();
    }
  }

  List<Map<String, dynamic>> get _lots =>
      [for (final l in (instantane()['lots'] as List? ?? const [])) if (l is Map) Map<String, dynamic>.from(l)];

  bool verrouille(int index) => envoi || tours.skip(index + 1).any((t) => t.role == 'user');

  Future<void> envoyer(String texte, {String? photo}) async {
    final t = texte.trim();
    if ((t.isEmpty && photo == null) || envoi) return;
    tours.add(GuideTour('user', t, photo: photo));
    await _echange();
  }

  Future<void> repondre(int index, int numero, bool valeur) async {
    final tour = tours[index];
    if (verrouille(index) || numero >= tour.reponses.length) return;
    tour.reponses[numero] = valeur;
    if (!toutesRepondues(tour.questions, tour.reponses)) {
      _maj();
      return;
    }
    tours.add(GuideTour('user', texteReponses(tour.questions, tour.reponses), chips: true));
    await _echange();
  }

  Future<(List<Map<String, dynamic>>, GuideTour?)> _tour(List<GuideTour> pourCeTour) async {
    final captures = <Map<String, dynamic>>[];
    var questions = <String>[];
    GuideTour? reponse;
    var direct = '';
    final corps = {
      'turns': [
        for (var i = 0; i < pourCeTour.length; i++) pourCeTour[i].pourLeServeur(dernier: i == pourCeTour.length - 1),
      ],
      'quoteSnapshot': instantane(),
      'conversationId': conversationId,
    };
    await for (final (evenement, data) in flux(corps)) {
      switch (evenement) {
        case 'delta':
          direct += (data['text'] ?? '').toString();
          enDirect = direct;
          _maj();
        case 'action':
          if (data['subAction'] == 'askQuestions') {
            questions = questionsOuiNon(data['questions']);
            continue;
          }
          final enCours = koji(data, _lots);
          if (enCours != null) travail = enCours;
          final capture = appliquer(data);
          if (capture != null) captures.add(capture);
          _maj();
        case 'done':
          final texte = ((data['message'] ?? direct) as Object).toString().trim();
          if (texte.isNotEmpty || questions.isNotEmpty) {
            reponse = GuideTour('assistant', texte, questions: questions);
            tours.add(reponse);
          }
          enDirect = '';
          direct = '';
          if (data['finished'] == true) onFin?.call();
          _maj();
        case 'error':
          erreur = (data['message'] ?? "L'assistant n'a pas pu répondre.").toString();
          _maj();
      }
    }
    return (captures, reponse);
  }

  Future<void> _echange() async {
    envoi = true;
    travail = KojiTravail.reflexion;
    erreur = '';
    notice = '';
    enDirect = '';
    totalDebut = ((instantane()['totaux'] as Map?)?['totalHt'] as num?)?.toDouble() ?? 0;
    _maj();
    try {
      final envoyes = List<GuideTour>.of(tours);
      final (captures, reponse) = await _tour(envoyes);
      if (captures.isEmpty) return;
      ({bool ok, String devisId, String le, String erreur}) issue;
      try {
        final r = await enregistrer();
        issue = (ok: true, devisId: r.id, le: r.le, erreur: '');
        notice = 'Devis enregistré.';
      } catch (e) {
        issue = (ok: false, devisId: '', le: '', erreur: e.toString());
        notice = "Modifications appliquées, mais l'enregistrement automatique a échoué — pense à enregistrer.";
      }
      final resultats = [for (final c in captures) resultat(c, issue)];
      final tourResultat = GuideTour('user', '[RESULTAT_ECRITURE] ${jsonEncode(resultats)}', hidden: true);
      tours.add(tourResultat);
      _maj();
      await _tour([...envoyes, if (reponse != null) reponse, tourResultat]);
    } catch (e) {
      erreur = e.toString().isEmpty ? "L'assistant n'a pas pu répondre. Réessaie." : e.toString();
    } finally {
      envoi = false;
      travail = null;
      _maj();
    }
  }
}
