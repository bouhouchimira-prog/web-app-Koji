import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart' show PrisePhoto, prendrePhotoAppareil;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/features/fournitures/pro/fournitures_logic.dart';
import 'package:koji/features/fournitures/pro/fournitures_pro_screen.dart';
import 'package:koji/features/fournitures/pro/fournitures_repository.dart';

String clotureRoute(String projectId) => '/fournitures/cloture/$projectId';

List<Json> _maps(Object? l) => (l as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();

/// Fournitures du chantier (maquette PRO-07.1, téléphone) : achat HT, à
/// compléter, livraison ; un groupe par fournisseur ; « Préparer les
/// commandes » prend le stock d'abord puis crée un bon par fournisseur.
class ChantierFournituresScreen extends ConsumerWidget {
  const ChantierFournituresScreen({super.key, required this.projectId});
  final String projectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(chantierFournituresProvider(projectId)).when(
          loading: () => const KojiPage(title: 'Fournitures', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
          error: (e, _) => KojiPage(title: 'Fournitures', appBarOnPhone: true, main: [KojiEmptyState(title: 'Fournitures indisponibles', subtitle: errorText(e), icon: KojiIcons.fournitures)]),
          data: (d) => _contenu(context, ref, d),
        );
  }

  Widget _contenu(BuildContext context, WidgetRef ref, Json d) {
    final p = context.koji;
    final c = Map<String, dynamic>.from(d['chantier'] as Map);
    final quote = c['quote'] is Map ? Map<String, dynamic>.from(c['quote'] as Map) : null;
    final ranges = Map<String, dynamic>.from(c['ranges'] as Map? ?? const {});
    final aCompleter = _maps(ranges['aCompleter']);
    final groupes = _maps(ranges['fournisseurs']);
    final besoins = _maps(c['besoins']);
    final commandables = besoins.where((b) => (b['manques'] as List? ?? const []).isEmpty && num2(b['reste']) > 0).toList();
    final livres = _maps(c['bons']).any((b) => b['etat'] == 'livre' || b['etat'] == 'partiel');
    return KojiPage(
      title: 'Fournitures',
      subtitle: '${c['title']}${quote == null ? '' : quote['signe'] == true ? ' · devis signé' : ' · estimation'}',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(chantierFournituresProvider(projectId));
        await ref.read(chantierFournituresProvider(projectId).future);
      },
      top: [
        if (quote != null)
          KojiKpiRow(children: [
            KojiKpi(label: 'Achat HT', value: euro(num2(ranges['totalHt'])), sub: '${groupes.length} fournisseur${groupes.length > 1 ? 's' : ''}'),
            KojiKpi(label: 'À compléter', value: '${aCompleter.length}', tone: aCompleter.isEmpty ? KojiTone.green : KojiTone.coral),
            KojiKpi(label: 'Livraison', value: '${quote['startDate'] ?? ''}'.isEmpty ? '—' : shortDay(quote['startDate']), sub: 'démarrage'),
          ]),
      ],
      main: [
        if (quote == null)
          const KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Pas encore de devis', subtitle: 'La liste des fournitures se calcule depuis les lignes du devis.')
        else ...[
          KojiButton(label: 'Préparer les commandes', expand: true, onPressed: commandables.isEmpty ? null : () => showPreparerSheet(context, ref, d)),
          if (d['business'] == true && livres) KojiButton(label: 'Ce qui reste', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => context.push(clotureRoute(projectId))),
          if (aCompleter.isNotEmpty)
            KojiAlertBox(
              title: '${aCompleter.length} article${aCompleter.length > 1 ? 's' : ''} à compléter',
              message: '${aCompleter.map((a) => a['name']).join(', ')} : fournisseur ou prix manquant.',
              tone: KojiTone.coral,
            ),
          if (groupes.isEmpty && aCompleter.isEmpty)
            const KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Aucune fourniture au devis', subtitle: 'Ajoutez des fournitures aux lignes du devis ou liez des articles aux ouvrages.'),
          for (final g in groupes)
            KojiCard(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(child: Text('${g['supplierName']}', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading))),
                  Text(euro(num2(g['totalHt'])), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
                ]),
                Text('${_maps(g['lignes']).length} article${_maps(g['lignes']).length > 1 ? 's' : ''}', style: TextStyle(fontSize: 12, color: p.faint)),
                for (final l in _maps(g['lignes']).take(3)) FactureKv('${l['name']}', qte(num2(l['quantite']), '${l['unit'] ?? ''}')),
                if (_maps(g['lignes']).length > 3) Text('+ ${_maps(g['lignes']).length - 3} articles', style: TextStyle(fontSize: 12.5, color: p.muted)),
              ]),
            ),
        ],
      ],
    );
  }
}

Future<void> showPreparerSheet(BuildContext context, WidgetRef ref, Json d) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (_) => _PreparerSheet(data: d),
    );

class _PreparerSheet extends ConsumerStatefulWidget {
  const _PreparerSheet({required this.data});
  final Json data;
  @override
  ConsumerState<_PreparerSheet> createState() => _PreparerSheetState();
}

class _PreparerSheetState extends ConsumerState<_PreparerSheet> {
  late final Json _c = Map<String, dynamic>.from(widget.data['chantier'] as Map);
  late final List<Json> _lignes = _maps(_c['besoins']).where((b) => (b['manques'] as List? ?? const []).isEmpty && num2(b['reste']) > 0).toList();
  late final List<Json> _stock = _maps(widget.data['stock']);
  late final Map<String, bool> _choix = {for (final l in _lignes) '${l['cle']}': true};
  late final Map<String, bool> _pris = {for (final s in _stock) '${s['cle']}': s['coche'] == true};
  bool _busy = false;
  String _erreur = '';

  Json? _stockDe(Json l) => _stock.where((s) => s['cle'] == l['cle']).firstOrNull;
  double _prisDe(Json l) {
    final s = _stockDe(l);
    return s != null && _pris['${l['cle']}'] == true ? (num2(s['utiliser']) < num2(l['reste']) ? num2(s['utiliser']) : num2(l['reste'])) : 0;
  }

  Future<void> _creer() async {
    setState(() {
      _busy = true;
      _erreur = '';
    });
    final retenues = _lignes.where((l) => _choix['${l['cle']}'] == true).toList();
    final stockPris = <Json>[];
    for (final l in retenues) {
      var reste = _prisDe(l);
      for (final s in _maps(_stockDe(l)?['ids'])) {
        if (reste <= 0) break;
        final q = num2(s['quantite']) < reste ? num2(s['quantite']) : reste;
        stockPris.add({'id': s['id'], 'quantite': q});
        reste = r2(reste - q);
      }
    }
    final quote = Map<String, dynamic>.from(_c['quote'] as Map);
    try {
      final bons = await ref.read(fournituresProRepositoryProvider).creerBons({
        'projectId': _c['projectId'],
        'livraisonLe': quote['startDate'] ?? '',
        'livraisonAdresse': _c['address'] ?? '',
        'stock': stockPris,
        'lignes': [
          for (final l in retenues)
            if (resteACommander(l, pris: _prisDe(l)).quantite > 0)
              {
                'articleId': l['articleId'], 'name': l['name'], 'ref': l['ref'], 'unit': l['unit'],
                'quantite': resteACommander(l, pris: _prisDe(l)).quantite,
                'quantiteBesoin': num2(l['reste']),
                'paquets': resteACommander(l, pris: _prisDe(l)).paquets,
                'uniteCond': l['uniteCond'], 'contenance': l['contenance'], 'prixHt': l['prixHt'], 'venteHt': l['vente'],
                'lot': (l['lots'] as List? ?? const ['']).first, 'supplierId': l['supplierId'],
              },
        ],
      });
      ref.invalidate(bonsProvider);
      ref.invalidate(chantierFournituresProvider('${_c['projectId']}'));
      if (!mounted) return;
      Navigator.of(context).pop();
      showFacturesMessage(context, '${bons.length} bon${bons.length > 1 ? 's' : ''} en brouillon : vérifiez puis envoyez.');
      if (bons.length == 1) context.push(bonRoute('${bons.first['id']}'));
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _erreur = errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final retenues = _lignes.where((l) => _choix['${l['cle']}'] == true).toList();
    final prisHt = r2(retenues.fold<double>(0, (s, l) => s + _prisDe(l) * num2(l['prixHt'])));
    final total = r2(retenues.fold<double>(0, (s, l) => s + resteACommander(l, pris: _prisDe(l)).quantite * num2(l['prixHt'])));
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('Préparer les commandes', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
          if (_stock.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('Utiliser ton stock avant de commander', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.heading)),
            for (final l in _lignes.where((l) => _stockDe(l) != null))
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                value: _pris['${l['cle']}'] == true,
                onChanged: (v) => setState(() => _pris['${l['cle']}'] = v == true),
                title: Text('${l['name']}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading, fontSize: 14)),
                subtitle: Text('besoin ${qte(num2(l['reste']), '${l['unit']}')} · en stock ${qte(num2(_stockDe(l)!['enStock']), '${l['unit']}')}${_stockDe(l)!['teinte'] == true ? ' · lot de teinte à vérifier' : ''}'),
              ),
          ],
          const SizedBox(height: 10),
          Text('À commander · par fournisseur', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.heading)),
          for (final l in _lignes)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _choix['${l['cle']}'] == true,
              onChanged: (v) => setState(() => _choix['${l['cle']}'] = v == true),
              title: Text('${l['name']}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading, fontSize: 14)),
              subtitle: Text('${l['supplierName']} · ${resteACommander(l, pris: _prisDe(l)).quantite > 0 ? quantiteBon({...l, 'quantite': resteACommander(l, pris: _prisDe(l)).quantite, 'paquets': resteACommander(l, pris: _prisDe(l)).paquets}) : 'pris dans le stock'}'),
            ),
          if (prisHt > 0) FactureKv('Pris dans le stock', '− ${euro(prisHt)}'),
          FactureKv('À commander', euroHt(total), strong: true),
          Text('Les bons sont créés en brouillon : rien ne part avant votre envoi.', style: TextStyle(fontSize: 12, color: p.faint)),
          if (_erreur.isNotEmpty) ...[const SizedBox(height: 8), Text(_erreur, style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600))],
          const SizedBox(height: 14),
          KojiButton(label: 'Continuer vers les bons de commande', expand: true, loading: _busy, onPressed: _busy || total <= 0 ? null : _creer),
        ]),
      ),
    );
  }
}

/// Nouvel article (maquette PRO-07.2, téléphone) : scanner l'étiquette ou
/// la facture, unité, conditionnement, achat, prix public, mode, vente.
class ArticleFormScreen extends ConsumerStatefulWidget {
  const ArticleFormScreen({super.key, this.articleId, this.prisePhoto});
  final String? articleId;
  final PrisePhoto? prisePhoto;
  @override
  ConsumerState<ArticleFormScreen> createState() => _ArticleFormScreenState();
}

class _ArticleFormScreenState extends ConsumerState<ArticleFormScreen> {
  final _nom = TextEditingController();
  final _unite = TextEditingController(text: 'm²');
  final _cond = TextEditingController(text: 'boîte');
  final _contenance = TextEditingController(text: '1');
  final _achat = TextEditingController();
  final _public = TextEditingController();
  final _manuel = TextEditingController();
  final _coef = TextEditingController();
  String _mode = 'public';
  String _supplierId = '';
  Json _extra = {};
  bool _charge = false;
  bool _busy = false;
  String _note = '';

  @override
  void dispose() {
    for (final c in [_nom, _unite, _cond, _contenance, _achat, _public, _manuel, _coef]) {
      c.dispose();
    }
    super.dispose();
  }

  void _remplir(Json a) {
    _nom.text = '${a['name'] ?? ''}';
    _unite.text = '${a['unit'] ?? 'u'}';
    _cond.text = '${a['uniteCond'] ?? ''}';
    _contenance.text = nb(num2(a['contenance'], 1));
    final f = fournisseurPrefere(a);
    _supplierId = '${f?['supplierId'] ?? _supplierId}';
    final achatCond = num2(f?['achatCond']);
    _achat.text = achatCond > 0 ? nb(achatCond) : (num2(f?['achat']) > 0 ? nb(r2(num2(f?['achat']) * num2(a['contenance'], 1))) : '');
    _public.text = num2(a['prixPublic']) > 0 ? nb(num2(a['prixPublic'])) : '';
    _mode = '${a['modePrix'] ?? 'public'}';
    _manuel.text = num2(a['prixManuel']) > 0 ? nb(num2(a['prixManuel'])) : '';
    _coef.text = num2(a['coef']) > 0 ? nb(num2(a['coef'])) : '';
    _extra = a;
  }

  Json _article() {
    final contenance = num2(_contenance.text, 1) > 0 ? num2(_contenance.text, 1) : 1.0;
    final achatCond = num2(_achat.text);
    return {
      ..._extra,
      'name': _nom.text.trim(),
      'unit': _unite.text.trim().isEmpty ? 'u' : _unite.text.trim(),
      'uniteCond': _cond.text.trim(),
      'contenance': contenance,
      'prixPublic': num2(_public.text),
      'modePrix': _mode,
      'prixManuel': num2(_manuel.text),
      'coef': num2(_coef.text) > 0 ? num2(_coef.text) : null,
      'fournisseurs': _supplierId.isEmpty
          ? <Json>[]
          : [
              {...?fournisseurPrefere(_extra), 'supplierId': _supplierId, 'achatCond': achatCond, 'achat': achatParUnite(achatCond, contenance), 'prefere': true},
              ...fournisseursDe(_extra).where((f) => f['prefere'] != true && f['supplierId'] != _supplierId),
            ],
    };
  }

  Future<void> _scanner() async {
    final bytes = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (bytes == null) return;
    setState(() {
      _busy = true;
      _note = '';
    });
    try {
      final r = await ref.read(fournituresProRepositoryProvider).scanner(photo: 'data:image/jpeg;base64,${base64Encode(bytes)}');
      setState(() {
        _remplir({..._article(), ...Map<String, dynamic>.from(r['proposition'] as Map)});
        _note = 'Koji a rempli l\'article : vérifiez chaque champ.';
      });
    } catch (e) {
      setState(() => _note = errorText(e));
    }
    setState(() => _busy = false);
  }

  Future<void> _enregistrer() async {
    setState(() => _busy = true);
    final a = _article();
    try {
      await ref.read(fournituresProRepositoryProvider).enregistrer({
        ...a,
        'fournisseurs': fournisseursDe(a).map((f) => {'supplierId': f['supplierId'], 'ref': f['ref'] ?? '', 'achatCond': f['achatCond'] ?? 0, 'prefere': f['prefere'] == true}).toList(),
      }, id: widget.articleId);
      ref.invalidate(catalogueProvider);
      if (!mounted) return;
      showFacturesMessage(context, '« ${a['name']} » enregistré.');
      context.pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _note = errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return ref.watch(catalogueProvider).when(
          loading: () => const KojiPage(title: 'Nouvel article', appBarOnPhone: true, main: [Center(child: CircularProgressIndicator())]),
          error: (e, _) => KojiPage(title: 'Nouvel article', appBarOnPhone: true, main: [KojiEmptyState(title: 'Catalogue indisponible', subtitle: errorText(e), icon: KojiIcons.fournitures)]),
          data: (d) {
            final fours = _maps(d['fournisseurs']);
            final coef = num2((d['reglage'] as Map?)?['coef'], coefCompteDefaut);
            if (!_charge) {
              _charge = true;
              final a = _maps(d['articles']).where((x) => x['id'] == widget.articleId).firstOrNull;
              if (a != null) _remplir(a);
              if (_supplierId.isEmpty && fours.isNotEmpty && a == null) _supplierId = '${fours.first['id']}';
            }
            final m = marge(_article(), coefCompte: coef);
            return KojiPage(
              title: widget.articleId == null ? 'Nouvel article' : 'Modifier l\'article',
              subtitle: 'Fournitures',
              appBarOnPhone: true,
              main: [
                KojiButton(label: _busy ? 'Lecture…' : 'Scanner l\'étiquette ou la facture', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : _scanner),
                if (_note.isNotEmpty) Text(_note, style: TextStyle(fontSize: 12.5, color: p.muted)),
                KojiField(label: 'Désignation', controller: _nom, onChanged: (_) => setState(() {})),
                Row(children: [
                  // « Conditionnement » a la place qu'il lui faut (retours du
                  // build 64 : le mot coupé décalait son champ).
                  Expanded(flex: 5, child: KojiField(label: 'Unité client', controller: _unite, onChanged: (_) => setState(() {}))),
                  const SizedBox(width: 10),
                  Expanded(flex: 7, child: KojiField(label: 'Conditionnement', controller: _cond)),
                  const SizedBox(width: 10),
                  Expanded(flex: 5, child: KojiField(label: 'Contenance', controller: _contenance, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {}))),
                ]),
                if (fours.isEmpty)
                  Text('Aucun fournisseur : ajoutez-en un depuis le site (Fournitures › Fournisseurs).', style: TextStyle(fontSize: 12.5, color: p.toneFg(KojiTone.coral)))
                else
                  DropdownButtonFormField<String>(
                    initialValue: fours.any((f) => f['id'] == _supplierId) ? _supplierId : null,
                    decoration: const InputDecoration(labelText: 'Fournisseur préféré'),
                    items: [for (final f in fours) DropdownMenuItem(value: '${f['id']}', child: Text('${f['name']}'))],
                    onChanged: (v) => setState(() => _supplierId = v ?? ''),
                  ),
                KojiField(label: 'Achat HT par ${_cond.text.trim().isEmpty ? 'conditionnement' : _cond.text.trim()}', controller: _achat, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
                KojiField(label: 'Prix public HT (€/${_unite.text.trim()})', controller: _public, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
                KojiSegmented<String>(compact: true, options: modesPrix, value: _mode, onChanged: (v) => setState(() => _mode = v)),
                if (_mode == 'coefficient') KojiField(label: 'Coefficient sur achat', controller: _coef, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
                if (_mode == 'manuel') KojiField(label: 'Prix de vente HT (€/${_unite.text.trim()})', controller: _manuel, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
                FactureKv('Vente HT', '${euro(m.vente)}/${_unite.text.trim()}${m.pct != null ? ' · marge ${m.pct} %' : ''}', strong: true),
                if ((_extra['ouvrages'] as List? ?? const []).isNotEmpty)
                  for (final o in _maps(_extra['ouvrages'])) FactureKv('${o['code']} ${o['label'] ?? ''}'.trim(), '${nb(num2(o['conso'], 1))} ${_unite.text.trim()}/${o['unite'] ?? 'u'}'),
                Text('Ouvrages liés, rendement, synonymes : sur le site, fiche de l\'article.', style: TextStyle(fontSize: 12, color: p.faint)),
                KojiButton(label: 'Enregistrer', expand: true, loading: _busy, onPressed: _busy || _nom.text.trim().isEmpty ? null : _enregistrer),
              ],
            );
          },
        );
  }
}
