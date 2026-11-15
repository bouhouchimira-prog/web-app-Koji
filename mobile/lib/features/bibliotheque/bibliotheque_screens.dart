import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart' show prendrePhotoAppareil;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/bibliotheque/bibliotheque_logic.dart';
import 'package:koji/features/bibliotheque/bibliotheque_repository.dart';
import 'package:koji/features/demarrage/demarrage_logic.dart' show activiteDe, metiersDemarrage, MetierDemarrage;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;

const bibliothequeRoute = '/bibliotheque';
const ficheOuvrageRoute = '/bibliotheque/ouvrage';
const nouvelOuvrageRoute = '/bibliotheque/nouveau';
const tauxFacturesRoute = '/bibliotheque/factures';

const champsHistorique = {'label': 'désignation', 'unit': 'unité', 'normativeTime': 'temps', 'fixedTime': 'temps fixe', 'hourlyRate': 'taux', 'coefficient': 'coefficient', 'discount': 'réduction', 'sensitivities': 'sensibilité', 'synonyms': 'synonymes', 'triggers': 'déclenche', 'questions': 'questions'};

/// Prise de photo remplaçable dans les tests.
typedef PrisePhotoFacture = Future<List<int>?> Function();

double _tauxFamille(Json taux, String famille) => num2((taux['parFamille'] as Map?)?[famille]);
double _defautFamille(Json taux, String famille) => num2((taux['defautsFamille'] as Map?)?[famille]);
double tauxDeLigne(Json o, Json taux) => tauxOuvrage(o, tauxFamille: _tauxFamille(taux, familleDe(o)), tauxDefaut: _defautFamille(taux, familleDe(o)));

Widget _chargement(String titre) => KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
Widget _erreur(String titre, Object e) => KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(e), icon: KojiIcons.bibliotheque)]);

// ---------------------------------------------------------------------------
// PRO-08 Bibliothèque (téléphone) : familles, recherche, une ligne par ouvrage
// « CAR-010 · 0,6 h/m² × 55 €/h  33,00 € » ; onglet Mes prix (PRO-08.2).
// ---------------------------------------------------------------------------
class BibliothequeProScreen extends ConsumerStatefulWidget {
  const BibliothequeProScreen({super.key, this.onglet = 'ouvrages'});
  final String onglet;

  @override
  ConsumerState<BibliothequeProScreen> createState() => _BibliothequeProScreenState();
}

class _BibliothequeProScreenState extends ConsumerState<BibliothequeProScreen> {
  late String _onglet = widget.onglet;
  String _famille = '';
  String _recherche = '';

  @override
  Widget build(BuildContext context) {
    final ouvrages = ref.watch(ouvragesProvider);
    final taux = ref.watch(tauxProvider);
    if (ouvrages.hasError) return _erreur('Bibliothèque', ouvrages.error!);
    if (!ouvrages.hasValue || !taux.hasValue && !taux.hasError) return _chargement('Bibliothèque');
    final liste = ouvrages.value!;
    final t = taux.valueOrNull ?? const <String, dynamic>{};
    return KojiPage(
      title: 'Bibliothèque',
      subtitle: '${liste.length} ouvrage${liste.length > 1 ? 's' : ''}',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(ouvragesProvider);
        ref.invalidate(tauxProvider);
        await ref.read(ouvragesProvider.future);
      },
      actions: [
        KojiButton(label: 'Mes factures', variant: KojiButtonVariant.secondary, onPressed: () => context.push(tauxFacturesRoute)),
        KojiButton(label: 'Nouvel ouvrage', onPressed: () => context.push(nouvelOuvrageRoute)),
      ],
      main: [
        KojiSegmented<String>(compact: true, options: const {'ouvrages': 'Ouvrages', 'prix': 'Mes prix'}, value: _onglet, onChanged: (v) => setState(() => _onglet = v)),
        if (_onglet == 'ouvrages') ..._ouvrages(context, liste, t) else MesPrixVue(taux: t),
      ],
    );
  }

  List<Widget> _ouvrages(BuildContext context, List<Json> liste, Json taux) {
    final p = context.koji;
    final familles = <String, String>{};
    final compte = <String, int>{};
    for (final o in liste) {
      final f = familleDe(o);
      if (f.isEmpty) continue;
      familles.putIfAbsent(f, () => '${o['family'] ?? f}');
      compte[f] = (compte[f] ?? 0) + 1;
    }
    final codes = familles.keys.toList()..sort((a, b) => familles[a]!.compareTo(familles[b]!));
    final filtres = rechercherOuvrages(_famille.isEmpty ? liste : liste.where((o) => familleDe(o) == _famille).toList(), _recherche);
    return [
      TextField(
        decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Ouvrage, code, synonyme', isDense: true),
        onChanged: (v) => setState(() => _recherche = v),
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: KojiFilterChips<String>(
          options: {'': 'Toutes', for (final c in codes) c: '${familles[c]} ${compte[c]}'},
          value: _famille,
          onChanged: (v) => setState(() => _famille = v),
        ),
      ),
      if (filtres.isEmpty)
        const KojiEmptyState(compact: true, icon: KojiIcons.bibliotheque, title: 'Aucun ouvrage ne correspond', subtitle: 'Essayez un autre mot, ou créez l\'ouvrage.')
      else
        for (final o in filtres.take(300))
          InkWell(
            onTap: () => context.push(ficheOuvrageRoute, extra: '${o['id']}'),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${o['label']}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                    const SizedBox(height: 2),
                    Text('${o['code']} · ${detailMo(o, tauxDeLigne(o, taux))}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                  ]),
                ),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(euro(moOuvrage(o, tauxDeLigne(o, taux)).parUnite), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.heading)),
                  Text(o['isCustom'] == true ? 'à vous · ${o['confidence'] ?? 'C'}' : 'confiance ${o['confidence'] ?? 'C'}', style: TextStyle(fontSize: 11.5, color: p.faint)),
                ]),
              ]),
            ),
          ),
      if (filtres.length > 300) Text('${filtres.length - 300} autres : précisez la recherche.', style: TextStyle(fontSize: 12, color: p.faint)),
    ];
  }
}

// ---------------------------------------------------------------------------
// Fiche d'un ouvrage : temps, taux, MO, sensibilité, fournitures liées, Koji.
// Enregistrer crée la version de l'entreprise (le socle Koji ne change pas).
// ---------------------------------------------------------------------------
class FicheOuvrageScreen extends ConsumerWidget {
  const FicheOuvrageScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ouvrages = ref.watch(ouvragesProvider);
    final taux = ref.watch(tauxProvider);
    if (ouvrages.hasError) return _erreur('Ouvrage', ouvrages.error!);
    if (!ouvrages.hasValue || !taux.hasValue && !taux.hasError) return _chargement('Ouvrage');
    final o = ouvrages.value!.where((x) => '${x['id']}' == id).firstOrNull;
    if (o == null) return const KojiPage(title: 'Ouvrage', appBarOnPhone: true, main: [KojiEmptyState(title: 'Ouvrage introuvable', icon: KojiIcons.bibliotheque)]);
    return _FicheOuvrage(key: ValueKey('${o['id']}:${o['updatedAt']}'), ouvrage: o, taux: taux.valueOrNull ?? const {});
  }
}

class _FicheOuvrage extends ConsumerStatefulWidget {
  const _FicheOuvrage({super.key, required this.ouvrage, required this.taux});
  final Json ouvrage;
  final Json taux;

  @override
  ConsumerState<_FicheOuvrage> createState() => _FicheOuvrageState();
}

class _FicheOuvrageState extends ConsumerState<_FicheOuvrage> {
  late final _temps = TextEditingController(text: nb(num2(widget.ouvrage['normativeTime'])));
  late final _fixe = TextEditingController(text: num2(widget.ouvrage['fixedTime']) > 0 ? nb(num2(widget.ouvrage['fixedTime'])) : '');
  late final _taux = TextEditingController(text: widget.ouvrage['tauxSource'] == 'metier' || !(num2(widget.ouvrage['hourlyRate']) > 0) ? '' : nb(num2(widget.ouvrage['hourlyRate'])));
  late final _synonymes = TextEditingController(text: (widget.ouvrage['synonyms'] as List? ?? const []).join(', '));
  late final Map<String, double> _sens = {for (final f in facteursFiche) f.key: niveauSensibilite((widget.ouvrage['sensitivities'] as Map?)?[f.key]).valeur};
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_temps, _fixe, _taux, _synonymes]) {
      c.dispose();
    }
    super.dispose();
  }

  Json get _essai => {
        ...widget.ouvrage,
        'normativeTime': num2(_temps.text),
        'fixedTime': num2(_fixe.text),
        'hourlyRate': num2(_taux.text) > 0 ? num2(_taux.text) : (widget.ouvrage['tauxSource'] == 'metier' ? 0 : widget.ouvrage['hourlyRate']),
      };

  Future<void> _enregistrer() async {
    setState(() => _busy = true);
    try {
      await ref.read(bibliothequeRepositoryProvider).enregistrerOuvrage('${widget.ouvrage['id']}', {
        'normativeTime': num2(_temps.text),
        'fixedTime': num2(_fixe.text),
        if (num2(_taux.text) > 0) 'hourlyRate': num2(_taux.text),
        'sensitivities': {...Map<String, dynamic>.from(widget.ouvrage['sensitivities'] as Map? ?? const {}), ..._sens},
        'synonyms': _synonymes.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      });
      ref.invalidate(ouvragesProvider);
      if (mounted) {
        showFacturesMessage(context, 'Enregistré pour votre entreprise.');
        setState(() => _busy = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showFacturesMessage(context, errorText(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final o = widget.ouvrage;
    final taux = tauxDeLigne(_essai, widget.taux);
    final mo = moOuvrage(_essai, taux);
    final unite = '${o['unit'] ?? 'u'}';
    final articles = ref.watch(articlesBibliothequeProvider).valueOrNull ?? const <Json>[];
    final lies = articles.where((a) => (a['ouvrages'] as List? ?? const []).any((x) => x is Map && x['code'] == o['code'])).toList();
    final historique = listeJson(o['historique']);
    return KojiPage(
      title: '${o['label']}',
      subtitle: '${o['code']} · ${o['family'] ?? familleDe(o)} · $unite',
      appBarOnPhone: true,
      main: [
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text("Main-d'œuvre", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            const SizedBox(height: 10),
            KojiField(label: 'Temps de base · h/$unite', controller: _temps, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
            const SizedBox(height: 10),
            KojiField(label: 'Temps fixe · h par intervention', controller: _fixe, hint: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
            const SizedBox(height: 10),
            KojiField(label: 'Taux horaire · €/h', controller: _taux, hint: '${nb(tauxDeLigne({...o, 'hourlyRate': 0}, widget.taux))} · taux du métier', keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
            const SizedBox(height: 12),
            FactureKv("Main-d'œuvre par $unite", euro(mo.parUnite), strong: true),
            if (mo.fixe > 0) FactureKv('Temps fixe, une fois', euro(mo.fixe)),
            Text('${detailMo(_essai, taux)}${mo.facteur != 1 ? ' × ${nb(mo.facteur)}' : ''} · confiance ${o['confidence'] ?? 'C'}', style: TextStyle(fontSize: 12, color: p.faint)),
          ]),
        ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Sensibilité à la situation', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            Text('Combien ce temps augmente quand le chantier est difficile.', style: TextStyle(fontSize: 12.5, color: p.muted)),
            for (final f in facteursFiche) ...[
              const SizedBox(height: 10),
              Text('${f.nom} · ${f.aide}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.heading)),
              const SizedBox(height: 4),
              KojiSegmented<double>(
                compact: true,
                options: {for (final n in niveauxSensibilite) n.valeur: n.label},
                value: _sens[f.key] ?? 0,
                onChanged: (v) => setState(() => _sens[f.key] = v),
              ),
            ],
          ]),
        ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Fournitures liées', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            const SizedBox(height: 6),
            if (lies.isEmpty) Text('Aucune : à lier depuis le site ou la fiche de l\'article.', style: TextStyle(fontSize: 12.5, color: p.muted)),
            for (final a in lies)
              FactureKv('${a['name']}', '${nb(num2(((a['ouvrages'] as List).firstWhere((x) => x is Map && x['code'] == o['code']) as Map)['conso'], 1))} ${a['unit'] ?? 'u'} / $unite'),
          ]),
        ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Pour Koji', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            const SizedBox(height: 8),
            KojiField(label: 'Synonymes · séparés par des virgules', controller: _synonymes, maxLines: 2),
            if ((o['triggers'] as List? ?? const []).isNotEmpty) ...[const SizedBox(height: 8), FactureKv('Déclenche', (o['triggers'] as List).join(', '))],
            if (historique.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('Historique', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.heading)),
              for (final h in historique.reversed.take(4)) Text('${jourCourt('${h['date'] ?? ''}')} · ${(h['champs'] as List? ?? const []).map((c) => champsHistorique['$c'] ?? '$c').join(', ')} modifié', style: TextStyle(fontSize: 12, color: p.faint)),
            ],
          ]),
        ),
        KojiButton(label: 'Enregistrer', expand: true, loading: _busy, onPressed: _busy ? null : _enregistrer),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// PRO-08.1 Nouvel ouvrage : Koji remplit la fiche depuis une description,
// l'artisan vérifie, prix des fournitures pris dans son catalogue.
// ---------------------------------------------------------------------------
class NouvelOuvrageScreen extends ConsumerStatefulWidget {
  const NouvelOuvrageScreen({super.key});

  @override
  ConsumerState<NouvelOuvrageScreen> createState() => _NouvelOuvrageScreenState();
}

class _NouvelOuvrageScreenState extends ConsumerState<NouvelOuvrageScreen> {
  final _description = TextEditingController();
  final _label = TextEditingController();
  final _unite = TextEditingController(text: 'u');
  final _temps = TextEditingController();
  final _fixe = TextEditingController();
  String _famille = '';
  String _nomFamille = '';
  String _lot = '';
  Map<String, double> _sens = {for (final f in facteursFiche) f.key: 0};
  List<Json> _fournitures = [];
  List<String> _synonymes = [];
  List<String> _declenche = [];
  List<String> _questions = [];
  String _note = '';
  bool _koji = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_description, _label, _unite, _temps, _fixe]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _remplir() async {
    setState(() {
      _koji = true;
      _note = '';
    });
    try {
      final r = await ref.read(bibliothequeRepositoryProvider).proposer(_description.text.trim());
      setState(() {
        _label.text = '${r['label'] ?? ''}';
        _famille = '${r['familyCode'] ?? ''}';
        _nomFamille = '${r['family'] ?? ''}';
        _lot = '${r['defaultLot'] ?? ''}';
        _unite.text = '${r['unit'] ?? 'u'}';
        _temps.text = nb(num2(r['normativeTime']));
        _fixe.text = num2(r['fixedTime']) > 0 ? nb(num2(r['fixedTime'])) : '';
        final s = Map<String, dynamic>.from(r['sensitivities'] as Map? ?? const {});
        _sens = {for (final f in facteursFiche) f.key: niveauSensibilite(s[f.key]).valeur};
        _fournitures = listeJson(r['fournitures']);
        _synonymes = List<String>.from((r['synonyms'] as List? ?? const []).map((x) => '$x'));
        _declenche = List<String>.from((r['triggers'] as List? ?? const []).map((x) => '$x'));
        _questions = List<String>.from((r['questions'] as List? ?? const []).map((x) => '$x'));
        _note = 'Koji a rempli la fiche : vérifiez chaque champ, surtout le temps (estimé, confiance C).';
        _koji = false;
      });
    } catch (e) {
      setState(() {
        _koji = false;
        _note = errorText(e);
      });
    }
  }

  Future<void> _enregistrer(List<Json> ouvrages) async {
    if (_label.text.trim().isEmpty || !(num2(_temps.text) > 0)) {
      showFacturesMessage(context, 'Indiquez au moins la désignation et le temps de base.');
      return;
    }
    setState(() => _busy = true);
    try {
      final code = prochainCode(_famille.isEmpty ? 'PERSO' : _famille, ouvrages.map((o) => '${o['code']}'));
      await ref.read(bibliothequeRepositoryProvider).creerOuvrage({
        'code': code,
        'label': _label.text.trim(),
        'family': _nomFamille.isEmpty ? 'Autre' : _nomFamille,
        'familyCode': _famille,
        'category': _nomFamille.isEmpty ? 'Autre' : _nomFamille,
        'unit': _unite.text.trim().isEmpty ? 'u' : _unite.text.trim(),
        'defaultLot': _lot,
        'normativeTime': num2(_temps.text),
        'fixedTime': num2(_fixe.text),
        'confidence': 'C',
        'sensitivities': _sens,
        'synonyms': _synonymes,
        'triggers': _declenche,
        'questions': _questions,
        'fournitures': [for (final f in _fournitures.where((f) => '${f['articleId'] ?? ''}'.isNotEmpty)) {'articleId': f['articleId'], 'conso': num2(f['conso'], 1)}],
      });
      ref.invalidate(ouvragesProvider);
      if (mounted) {
        showFacturesMessage(context, '$code enregistré.');
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        showFacturesMessage(context, errorText(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final ouvrages = ref.watch(ouvragesProvider).valueOrNull ?? const <Json>[];
    final familles = <String, String>{};
    for (final o in ouvrages) {
      final f = familleDe(o);
      if (f.isNotEmpty) familles.putIfAbsent(f, () => '${o['family'] ?? f}');
    }
    final codes = familles.keys.toList()..sort((a, b) => familles[a]!.compareTo(familles[b]!));
    return KojiPage(
      title: 'Nouvel ouvrage',
      subtitle: _famille.isEmpty ? null : 'sera ${prochainCode(_famille, ouvrages.map((o) => '${o['code']}'))}',
      appBarOnPhone: true,
      main: [
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text("Décrivez l'ouvrage à Koji", style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            const SizedBox(height: 8),
            KojiField(label: 'Description', controller: _description, hint: 'Pose d\'un receveur de douche extra-plat 90 × 120, avec bonde', maxLines: 3, onChanged: (_) => setState(() {})),
            const SizedBox(height: 10),
            KojiButton(label: _koji ? 'Koji remplit…' : 'Remplir avec Koji', variant: KojiButtonVariant.secondary, loading: _koji, onPressed: _koji || _description.text.trim().length < 8 ? null : _remplir),
            if (_note.isNotEmpty) ...[const SizedBox(height: 8), Text(_note, style: TextStyle(fontSize: 12.5, color: p.muted))],
          ]),
        ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            KojiField(label: 'Désignation', controller: _label, hint: 'Poser…'),
            const SizedBox(height: 10),
            DropdownButtonFormField<String>(
              initialValue: codes.contains(_famille) ? _famille : null,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Famille', isDense: true),
              items: [for (final c in codes) DropdownMenuItem(value: c, child: Text('${familles[c]} · $c'))],
              onChanged: (v) => setState(() {
                _famille = v ?? '';
                _nomFamille = familles[v] ?? '';
              }),
            ),
            const SizedBox(height: 10),
            KojiField(label: 'Unité', controller: _unite),
            const SizedBox(height: 10),
            KojiField(label: 'Temps de base · h par unité', controller: _temps, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 10),
            KojiField(label: 'Temps fixe · h par intervention', controller: _fixe, hint: '0', keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          ]),
        ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Sensibilité à la situation', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            for (final f in facteursFiche) ...[
              const SizedBox(height: 10),
              Text(f.nom, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.heading)),
              const SizedBox(height: 4),
              KojiSegmented<double>(compact: true, options: {for (final n in niveauxSensibilite) n.valeur: n.label}, value: _sens[f.key] ?? 0, onChanged: (v) => setState(() => _sens[f.key] = v)),
            ],
          ]),
        ),
        if (_fournitures.isNotEmpty)
          KojiCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Fournitures liées', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              for (final f in _fournitures)
                FactureKv('${f['articleNom'] ?? f['nom']}', '${f['articleId'] != null && '${f['articleId']}'.isNotEmpty ? '' : 'à créer · '}${nb(num2(f['conso'], 1))} ${f['unite'] ?? ''}'),
              Text('Les articles « à créer » ne sont pas liés : ajoutez-les dans Fournitures.', style: TextStyle(fontSize: 12, color: p.faint)),
            ]),
          ),
        if (_synonymes.isNotEmpty || _questions.isNotEmpty)
          KojiCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Pour Koji', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              if (_synonymes.isNotEmpty) FactureKv('Synonymes', _synonymes.join(', ')),
              if (_declenche.isNotEmpty) FactureKv('Déclenche', _declenche.join(', ')),
              for (final q in _questions) Text('· $q', style: TextStyle(fontSize: 12.5, color: p.muted)),
            ]),
          ),
        KojiButton(label: 'Enregistrer', expand: true, loading: _busy, onPressed: _busy ? null : () => _enregistrer(ouvrages)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// PRO-08.2 Mes prix (téléphone) : un taux par métier, son état, Modifier /
// Valider ; renvoi vers le calcul d'après les factures.
// ---------------------------------------------------------------------------
class MesPrixVue extends ConsumerStatefulWidget {
  const MesPrixVue({super.key, required this.taux});
  final Json taux;

  @override
  ConsumerState<MesPrixVue> createState() => _MesPrixVueState();
}

class _MesPrixVueState extends ConsumerState<MesPrixVue> {
  bool _busy = false;

  Map<String, num?> get _actuels => {for (final e in (widget.taux['taux'] as Map? ?? const {}).entries) '${e.key}': e.value is num ? e.value as num : null};

  Future<void> _enregistrer(String metier, num valeur) async {
    setState(() => _busy = true);
    try {
      await ref.read(bibliothequeRepositoryProvider).enregistrerTaux({..._actuels, metier: valeur}, valider: [metier]);
      ref.invalidate(tauxProvider);
      ref.invalidate(ouvragesProvider);
      ref.invalidate(analyseFacturesProvider);
      if (mounted) showFacturesMessage(context, '${activiteDe(metier)} : ${nb(valeur)} € HT/h validé.');
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _modifier(MetierDemarrage m, double actuel, double defaut) async {
    final c = TextEditingController(text: actuel > 0 ? nb(actuel) : (defaut > 0 ? nb(defaut) : ''));
    final v = await showDialog<double>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(m.activite),
        content: TextField(controller: c, autofocus: true, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(suffixText: '€ HT/h')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(ctx, num2(c.text)), child: const Text('Valider')),
        ],
      ),
    );
    c.dispose();
    if (v != null && v > 0 && v <= 500) await _enregistrer(m.metier, v);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final analyse = ref.watch(analyseFacturesProvider).valueOrNull;
    final appris = listeJson(analyse?['metiers']).where((m) => m['ecart'] is num && (m['ecart'] as num).abs() >= 5).toList();
    final valides = Map<String, dynamic>.from(widget.taux['valides'] as Map? ?? const {});
    final defauts = Map<String, dynamic>.from(widget.taux['defautsMetier'] as Map? ?? const {});
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      KojiCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Taux horaire par métier', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
          Text('€ HT de l\'heure, appliqués aux ouvrages sans taux propre.', style: TextStyle(fontSize: 12.5, color: p.muted)),
          for (final m in metiersDemarrage.where((m) => m.familles.isNotEmpty)) _ligne(context, m, num2(_actuels[m.metier]), '${valides[m.metier] ?? ''}', num2(defauts[m.metier])),
        ]),
      ),
      const SizedBox(height: 12),
      KojiCard(
        onTap: () => context.push(tauxFacturesRoute),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Calculer depuis mes factures', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.heading)),
              Text(analyse == null || listeJson(analyse['fichiers']).isEmpty ? 'Photographiez 3 à 10 factures : Koji en déduit votre taux par métier.' : '${listeJson(analyse['fichiers']).length} facture(s) lue(s) · ${num2((analyse['lignes'] as Map?)?['comprises']).round()} lignes comprises', style: TextStyle(fontSize: 12.5, color: p.muted)),
            ]),
          ),
          Icon(Icons.chevron_right, color: p.faint),
        ]),
      ),
      if (appris.isNotEmpty) ...[
        const SizedBox(height: 12),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Ce que Koji a appris', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            for (final m in appris)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  num2(m['ecart']) > 0 ? 'Vos devis ${'${m['activite']}'.toLowerCase()} sont trop bas d\'environ ${num2(m['ecart']).round()} % : vos factures donnent ${nb(num2(m['taux']))} €/h.' : 'Vos factures ${'${m['activite']}'.toLowerCase()} sont sous votre taux d\'environ ${(-num2(m['ecart'])).round()} %.',
                  style: TextStyle(fontSize: 12.5, color: p.muted),
                ),
              ),
          ]),
        ),
      ],
    ]);
  }

  Widget _ligne(BuildContext context, MetierDemarrage m, double taux, String valideLe, double defaut) {
    final p = context.koji;
    final e = etatTaux(taux: taux, valideLe: valideLe.isEmpty ? '' : jourCourt(valideLe), defaut: defaut);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(m.activite, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
            Text(e.texte, style: TextStyle(fontSize: 12, color: e.etat == 'valide' ? p.muted : p.toneFg(e.etat == 'a_regler' ? KojiTone.coral : KojiTone.amber))),
          ]),
        ),
        Text(taux > 0 ? '${nb(taux)} €' : '—', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.heading)),
        const SizedBox(width: 6),
        if (e.etat == 'a_confirmer')
          TextButton(onPressed: _busy ? null : () => _enregistrer(m.metier, taux), child: const Text('Valider'))
        else
          TextButton(onPressed: _busy ? null : () => _modifier(m, taux, defaut), child: Text(e.etat == 'a_regler' ? 'Régler' : 'Modifier')),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// PRO-08.3 Taux d'après mes factures (téléphone) : factures photographiées
// ou importées, taux déduit par métier, « Passer à X €/h ? », questions.
// Jamais appliqué sans validation.
// ---------------------------------------------------------------------------
class TauxFacturesScreen extends ConsumerStatefulWidget {
  const TauxFacturesScreen({super.key, this.prisePhoto});
  final PrisePhotoFacture? prisePhoto;

  @override
  ConsumerState<TauxFacturesScreen> createState() => _TauxFacturesScreenState();
}

class _TauxFacturesScreenState extends ConsumerState<TauxFacturesScreen> {
  String _depot = '';

  Future<void> _patch(String action, Json extra, String message) async {
    try {
      await ref.read(bibliothequeRepositoryProvider).actionFactures(action, extra);
      ref.invalidate(analyseFacturesProvider);
      if (action == 'appliquer') {
        ref.invalidate(tauxProvider);
        ref.invalidate(ouvragesProvider);
      }
      if (mounted) showFacturesMessage(context, message);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    }
  }

  Future<void> _envoyer(String nom, {String? data, String? texte}) async {
    setState(() => _depot = 'Koji lit $nom…');
    try {
      final r = await ref.read(bibliothequeRepositoryProvider).deposer(nom: nom, data: data, texte: texte);
      ref.invalidate(analyseFacturesProvider);
      if (mounted) showFacturesMessage(context, '$nom : ${num2(r['lues']).round()} lignes lues, ${num2(r['comprises']).round()} comprises.');
    } catch (e) {
      if (mounted) showFacturesMessage(context, '$nom : ${errorText(e)}');
    } finally {
      if (mounted) setState(() => _depot = '');
    }
  }

  Future<void> _photo() async {
    final octets = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (octets == null || !mounted) return;
    final nom = 'Facture ${DateTime.now().day}-${DateTime.now().month} ${DateTime.now().hour}h${'${DateTime.now().minute}'.padLeft(2, '0')}.jpg';
    await _envoyer(nom, data: 'data:image/jpeg;base64,${base64Encode(octets)}');
  }

  Future<void> _fichier() async {
    final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf', 'csv'], withData: true);
    final f = r?.files.singleOrNull;
    if (f == null || f.bytes == null || !mounted) return;
    if (f.size > 6 * 1024 * 1024) {
      showFacturesMessage(context, 'Fichier trop lourd (6 Mo au plus).');
      return;
    }
    if (f.name.toLowerCase().endsWith('.csv')) {
      await _envoyer(f.name, texte: utf8.decode(f.bytes!, allowMalformed: true));
    } else {
      await _envoyer(f.name, data: 'data:application/pdf;base64,${base64Encode(f.bytes!)}');
    }
  }

  Future<void> _repondre(Json q) async {
    final code = TextEditingController();
    final quantite = TextEditingController(text: num2(q['quantite']) > 0 ? nb(num2(q['quantite'])) : '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${q['question'] ?? q['designation']}'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('${q['designation']} · ${euro(num2(q['total']))}', style: const TextStyle(fontSize: 13)),
          TextField(controller: code, textCapitalization: TextCapitalization.characters, decoration: const InputDecoration(labelText: 'Code de l\'ouvrage (ex. CAR-010)')),
          TextField(controller: quantite, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Quantité')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Écarter la ligne')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Valider')),
        ],
      ),
    );
    final c = code.text.trim().toUpperCase();
    final qte = num2(quantite.text);
    code.dispose();
    quantite.dispose();
    if (ok == null) return;
    if (ok == false) return _patch('repondre', {'ligneId': q['id'], 'ecarter': true}, 'Ligne écartée.');
    if (c.isEmpty || !(qte > 0)) {
      if (mounted) showFacturesMessage(context, 'Indiquez le code et la quantité.');
      return;
    }
    await _patch('repondre', {'ligneId': q['id'], 'code': c, 'quantite': qte}, 'Ligne comprise.');
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(analyseFacturesProvider);
    if (async.hasError && !async.hasValue) return _erreur('Taux d\'après mes factures', async.error!);
    if (!async.hasValue) return _chargement('Taux d\'après mes factures');
    final d = async.value!;
    final p = context.koji;
    final metiers = listeJson(d['metiers']);
    final propositions = metiers.where((m) => (m['proposition'] as Map?)?['action'] == 'appliquer').toList();
    final fichiers = listeJson(d['fichiers']);
    final questions = listeJson(d['questions']);
    final lignes = Map<String, dynamic>.from(d['lignes'] as Map? ?? const {});
    return KojiPage(
      title: 'Taux d\'après mes factures',
      subtitle: '${fichiers.length} facture${fichiers.length > 1 ? 's' : ''} · ${num2(lignes['comprises']).round()} lignes comprises${'${d['periode'] ?? ''}'.isNotEmpty ? ' · ${d['periode']}' : ''}',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(analyseFacturesProvider);
        await ref.read(analyseFacturesProvider.future);
      },
      main: [
        if (_depot.isNotEmpty) Row(children: [const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 10), Expanded(child: Text(_depot, style: TextStyle(color: p.muted)))]),
        Row(children: [
          Expanded(child: KojiButton(label: 'Photographier', variant: KojiButtonVariant.secondary, expand: true, onPressed: _depot.isNotEmpty ? null : _photo)),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'PDF ou CSV', variant: KojiButtonVariant.secondary, expand: true, onPressed: _depot.isNotEmpty ? null : _fichier)),
        ]),
        if (metiers.isEmpty)
          const KojiEmptyState(compact: true, icon: KojiIcons.factures, title: 'Aucune facture lue', subtitle: 'Ajoutez 3 à 10 factures de travaux récentes : Koji rattache chaque ligne à un ouvrage de votre bibliothèque et en déduit votre taux par métier.')
        else ...[
          if (propositions.isNotEmpty)
            KojiButton(
              label: propositions.length > 1 ? 'Appliquer les ${propositions.length} propositions' : 'Appliquer la proposition',
              expand: true,
              onPressed: () => _patch('appliquer', {'metiers': [for (final m in propositions) {'metier': m['metier'], 'taux': (m['proposition'] as Map)['taux']}]}, '${propositions.length} taux appliqué${propositions.length > 1 ? 's' : ''}.'),
            ),
          for (final m in metiers) _metier(context, m),
        ],
        if (questions.isNotEmpty)
          KojiCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('${questions.length} ligne${questions.length > 1 ? 's' : ''} à vérifier', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              Text('forfaits sans quantité, lignes « divers »', style: TextStyle(fontSize: 12.5, color: p.muted)),
              for (final q in questions.take(3))
                InkWell(
                  onTap: () => _repondre(q),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      Expanded(child: Text('${q['question'] ?? q['designation']}', style: TextStyle(fontSize: 13, color: p.heading))),
                      Text(euro(num2(q['total'])), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.heading)),
                    ]),
                  ),
                ),
            ]),
          ),
        if (fichiers.isNotEmpty)
          KojiCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Factures lues', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              for (final f in fichiers)
                Row(children: [
                  Expanded(child: Text('${f['nom']} · ${num2(f['lignes']).round()} ligne${num2(f['lignes']) > 1 ? 's' : ''}', style: TextStyle(fontSize: 13, color: p.muted))),
                  TextButton(onPressed: () => _patch('supprimer', {'fichierId': f['id']}, '${f['nom']} retiré de l\'analyse.'), child: const Text('Retirer')),
                ]),
            ]),
          ),
        KojiCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Vos données', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
            Text('Noms, adresses et coordonnées de vos clients ne sont pas gardés : Koji garde seulement les lignes, quantités et prix.', style: TextStyle(fontSize: 12.5, color: p.muted)),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Garder les factures dans mes documents'),
              subtitle: const Text('sinon supprimées après l\'analyse'),
              value: d['garder'] == true,
              onChanged: (v) => _patch('reglages', {'garder': v}, v ? 'Les prochaines factures seront gardées.' : 'Les factures gardées sont supprimées.'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Aider Koji à fixer des prix justes'),
              subtitle: const Text('vos prix, anonymes, mélangés à ceux d\'au moins 10 entreprises. Désactivé par défaut, retirable à tout moment.'),
              value: d['partage'] == true,
              onChanged: (v) => _patch('reglages', {'partage': v}, v ? 'Accord enregistré.' : 'Accord retiré.'),
            ),
          ]),
        ),
      ],
    );
  }

  Widget _metier(BuildContext context, Json m) {
    final p = context.koji;
    final prop = Map<String, dynamic>.from(m['proposition'] as Map? ?? const {});
    final tone = m['confiance'] == 'forte' ? KojiTone.green : m['confiance'] == 'moyenne' ? KojiTone.amber : KojiTone.coral;
    final action = '${prop['action'] ?? ''}';
    return KojiCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text('${m['activite']}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading))),
          KojiPill('confiance ${m['confiance']}', tone: tone),
        ]),
        const SizedBox(height: 6),
        FactureKv('Taux déduit', '${nb(num2(m['taux']))} €/h', strong: true),
        FactureKv('Fourchette', '${nb(num2(m['bas']))} à ${nb(num2(m['haut']))} €'),
        FactureKv('Lignes', '${num2(m['lignes']).round()}'),
        FactureKv('Réglé', num2(m['regle']) > 0 ? '${nb(num2(m['regle']))} €' : '—'),
        Text('${prop['texte'] ?? ''}', style: TextStyle(fontSize: 12.5, color: p.muted)),
        if (action == 'appliquer' || action == 'confirmer') ...[
          const SizedBox(height: 8),
          KojiButton(
            label: action == 'appliquer' ? 'Passer à ${nb(num2(m['taux']))} €/h ?' : 'Confirmer ${nb(num2(m['taux']))} €/h',
            variant: action == 'appliquer' ? KojiButtonVariant.primary : KojiButtonVariant.secondary,
            expand: true,
            onPressed: () => _patch('appliquer', {'metiers': [{'metier': m['metier'], 'taux': m['taux']}]}, '${m['activite']} : ${nb(num2(m['taux']))} € HT/h appliqué.'),
          ),
        ],
      ]),
    );
  }
}
