import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/features/fournitures/pro/fournitures_extra_screens.dart';
import 'package:koji/features/fournitures/pro/fournitures_logic.dart';
import 'package:koji/features/fournitures/pro/fournitures_repository.dart';

const fournituresRoute = '/fournitures';
const articleRoute = '/fournitures/article';
String chantierFournituresRoute(String id) => '/fournitures/chantier/$id';
String bonRoute(String id) => '/fournitures/bons/$id';
String livraisonRoute(String bonId) => '/fournitures/livraison/$bonId';
String partenaireRoute(String id) => '/fournitures/partenaires/$id';

/// Fournitures (maquette PRO-07, téléphone) : catalogue avec achat, vente et
/// marge ; commandes par chantier ; bons ; partenaires Koji ; stock.
class FournituresProScreen extends ConsumerStatefulWidget {
  const FournituresProScreen({super.key, this.onglet = 'catalogue'});
  final String onglet;

  @override
  ConsumerState<FournituresProScreen> createState() => _FournituresProScreenState();
}

class _FournituresProScreenState extends ConsumerState<FournituresProScreen> {
  late String _onglet = widget.onglet;
  String _recherche = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(catalogueProvider);
    return async.when(
      loading: () => const KojiPage(title: 'Fournitures', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
      error: (e, _) => KojiPage(title: 'Fournitures', appBarOnPhone: true, main: [KojiEmptyState(title: 'Fournitures indisponibles', subtitle: errorText(e), icon: KojiIcons.fournitures)]),
      data: (d) => _contenu(context, d),
    );
  }

  Widget _contenu(BuildContext context, Json d) {
    final articles = (d['articles'] as List? ?? const []).whereType<Map>().map((a) => Map<String, dynamic>.from(a)).toList();
    final chantiers = (d['commandesParChantier'] as List? ?? const []).whereType<Map>().map((a) => Map<String, dynamic>.from(a)).toList();
    final c = Map<String, dynamic>.from(d['chiffres'] as Map? ?? const {});
    final coef = num2((d['reglage'] as Map?)?['coef'], coefCompteDefaut);
    final aCommander = chantiers.where((x) => x['statut'] == 'a_commander' || x['statut'] == 'a_completer').toList();
    final sous = [
      if (num2(c['aCommander']) > 0) '${num2(c['aCommander']).round()} chantier${num2(c['aCommander']) > 1 ? 's' : ''} à commander',
      if (num2(c['incomplets']) > 0) '${num2(c['incomplets']).round()} article${num2(c['incomplets']) > 1 ? 's' : ''} incomplet${num2(c['incomplets']) > 1 ? 's' : ''}',
    ].join(' · ');
    return KojiPage(
      title: 'Fournitures',
      subtitle: sous.isEmpty ? '${articles.length} article${articles.length > 1 ? 's' : ''}' : sous,
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(catalogueProvider);
        await ref.read(catalogueProvider.future);
      },
      actions: [
        KojiButton(label: 'Nouvel article', variant: KojiButtonVariant.secondary, onPressed: () => context.push(articleRoute)),
        KojiButton(
          label: 'Préparer les commandes',
          onPressed: aCommander.isEmpty ? () => setState(() => _onglet = 'chantiers') : () => context.push(chantierFournituresRoute('${aCommander.first['projectId']}')),
        ),
      ],
      main: [
        KojiSegmented<String>(
          compact: true,
          options: {'catalogue': 'Catalogue', 'chantiers': 'Commandes ${chantiers.length}', 'bons': 'Bons', 'partenaires': 'Partenaires', 'stock': 'Stock'},
          value: _onglet,
          onChanged: (v) => setState(() => _onglet = v),
        ),
        if (_onglet == 'catalogue') ..._catalogue(context, articles, coef),
        if (_onglet == 'chantiers') ..._chantiers(context, chantiers),
        if (_onglet == 'bons') const BonsListe(),
        if (_onglet == 'partenaires') const PartenairesListe(),
        if (_onglet == 'stock') const StockListe(),
      ],
    );
  }

  List<Widget> _catalogue(BuildContext context, List<Json> articles, double coef) {
    final p = context.koji;
    final q = _recherche.trim().toLowerCase();
    final liste = articles.where((a) => q.isEmpty || '${a['name']} ${a['ref']} ${a['codeInterne']} ${fournisseurPrefere(a)?['supplierName'] ?? ''}'.toLowerCase().contains(q)).toList()
      ..sort((a, b) => manquesArticle(a).length.compareTo(manquesArticle(b).length));
    return [
      TextField(
        decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Article, référence', isDense: true),
        onChanged: (v) => setState(() => _recherche = v),
      ),
      if (liste.isEmpty)
        KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: q.isEmpty ? 'Aucun article' : 'Aucun article ne correspond', subtitle: 'Ajoutez un article ou importez un tarif depuis le site.')
      else
        for (final a in liste)
          InkWell(
            onTap: () => showArticleSheet(context, ref, a, coef),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${a['name']}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                    const SizedBox(height: 2),
                    Text(
                      manquesArticle(a).isEmpty ? '${fournisseurPrefere(a)?['supplierName'] ?? ''} · achat ${euro(prixAchat(a))}' : 'À compléter : ${manquesArticle(a).join(' et ')} manquant${manquesArticle(a).length > 1 ? 's' : ''}',
                      style: TextStyle(fontSize: 12.5, color: manquesArticle(a).isEmpty ? p.muted : p.toneFg(KojiTone.coral)),
                    ),
                  ]),
                ),
                const SizedBox(width: 10),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(euro(prixVente(a, coefCompte: coef)), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: p.heading)),
                  Text('Vente : ${libelleMode(a, coefCompte: coef)}${marge(a, coefCompte: coef).pct != null ? ' · marge ${marge(a, coefCompte: coef).pct} %' : ''}', style: TextStyle(fontSize: 11.5, color: p.faint)),
                ]),
              ]),
            ),
          ),
    ];
  }

  List<Widget> _chantiers(BuildContext context, List<Json> chantiers) {
    final p = context.koji;
    if (chantiers.isEmpty) {
      return const [KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Aucun chantier avec des fournitures', subtitle: 'Les fournitures des lignes du devis et les articles liés aux ouvrages apparaissent ici.')];
    }
    return [
      for (final c in chantiers)
        InkWell(
          onTap: () => context.push(chantierFournituresRoute('${c['projectId']}')),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c['title']}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                  Text('${(c['fournisseurs'] as List? ?? const []).length} fournisseur${(c['fournisseurs'] as List? ?? const []).length > 1 ? 's' : ''} · ${euroHt(num2(c['totalHt']))}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                ]),
              ),
              KojiPill(statutChantier(c), tone: c['statut'] == 'a_completer' ? KojiTone.coral : c['statut'] == 'a_commander' ? KojiTone.amber : KojiTone.green),
            ]),
          ),
        ),
    ];
  }
}

/// Fiche d'un article : trois prix, mode de vente, marge, fournisseurs.
Future<void> showArticleSheet(BuildContext context, WidgetRef ref, Json a, double coef) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (_) => _ArticleSheet(article: a, coef: coef),
    );

class _ArticleSheet extends ConsumerStatefulWidget {
  const _ArticleSheet({required this.article, required this.coef});
  final Json article;
  final double coef;

  @override
  ConsumerState<_ArticleSheet> createState() => _ArticleSheetState();
}

class _ArticleSheetState extends ConsumerState<_ArticleSheet> {
  late String _mode = '${widget.article['modePrix'] ?? 'public'}';
  late final _prix = TextEditingController(text: nb(num2(widget.article['prixManuel']) > 0 ? num2(widget.article['prixManuel']) : num2(widget.article['vente'])));
  late final _coef = TextEditingController(text: nb(num2(widget.article['coef']) > 0 ? num2(widget.article['coef']) : widget.coef));
  bool _busy = false;

  @override
  void dispose() {
    _prix.dispose();
    _coef.dispose();
    super.dispose();
  }

  Json get _essai => {...widget.article, 'modePrix': _mode, 'prixManuel': num2(_prix.text), 'coef': num2(_coef.text)};

  Future<void> _enregistrer() async {
    setState(() => _busy = true);
    try {
      await ref.read(fournituresProRepositoryProvider).enregistrer({'modePrix': _mode, 'prixManuel': num2(_prix.text), 'coef': num2(_coef.text)}, id: '${widget.article['id']}');
      ref.invalidate(catalogueProvider);
      if (mounted) Navigator.of(context).pop();
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
    final a = widget.article;
    final m = marge(_essai, coefCompte: widget.coef);
    final unite = '${a['uniteCond'] ?? ''}'.isNotEmpty && num2(a['contenance'], 1) == 1 ? '${a['uniteCond']}' : '${a['unit'] ?? 'u'}';
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text([a['codeInterne'], a['famille']].where((x) => '${x ?? ''}'.isNotEmpty).join(' · '), style: TextStyle(fontSize: 12, color: p.faint)),
          Text('${a['name']}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
          Text('${fournisseurPrefere(a)?['supplierName'] ?? 'Fournisseur à choisir'} · conditionnement ${condLibelle(a)}', style: TextStyle(fontSize: 12.5, color: p.muted)),
          const SizedBox(height: 12),
          FactureKv("Prix d'achat HT", prixAchat(a) > 0 ? '${euro(prixAchat(a))} / $unite' : '—'),
          FactureKv('Prix public HT', num2(a['prixPublic']) > 0 ? '${euro(num2(a['prixPublic']))} / $unite' : '—'),
          const SizedBox(height: 12),
          Text('Prix de vente au client', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.heading)),
          const SizedBox(height: 6),
          KojiSegmented<String>(compact: true, options: modesPrix, value: _mode, onChanged: (v) => setState(() => _mode = v)),
          if (_mode == 'coefficient') ...[const SizedBox(height: 10), KojiField(label: 'Coefficient sur achat', controller: _coef, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {}))],
          if (_mode == 'manuel') ...[const SizedBox(height: 10), KojiField(label: 'Prix de vente HT (€ / $unite)', controller: _prix, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {}))],
          if (_mode == 'public' && !(num2(a['prixPublic']) > 0)) Text('Pas de prix public : coefficient du compte (× ${nb(widget.coef)}).', style: TextStyle(fontSize: 12, color: p.faint)),
          const SizedBox(height: 6),
          FactureKv('Vente HT', '${euro(m.vente)} / $unite', strong: true),
          FactureKv('Marge', '${euro(m.euros)}${m.pct != null ? ' · ${m.pct} %' : ''}'),
          if (m.ecartPublic != null && m.ecartPublic!.abs() >= 0.01)
            Text(m.ecartPublic! < 0 ? 'sous le prix public de ${euro(-m.ecartPublic!)}' : 'au-dessus du prix public de ${euro(m.ecartPublic!)}', style: TextStyle(fontSize: 12, color: p.faint)),
          const SizedBox(height: 10),
          for (final f in fournisseursDe(a)) FactureKv('${f['supplierName'] ?? 'Fournisseur'}', '${euro(num2(f['achat']))}${f['prefere'] == true ? ' · préféré' : ''}'),
          if ((a['ouvrages'] as List? ?? const []).isNotEmpty) FactureKv('Ouvrages liés', (a['ouvrages'] as List).map((o) => '${(o as Map)['code']}').join(', ')),
          const SizedBox(height: 16),
          KojiButton(label: 'Enregistrer', expand: true, loading: _busy, onPressed: _busy ? null : _enregistrer),
          const SizedBox(height: 8),
          KojiButton(
            label: 'Modifier l\'article',
            variant: KojiButtonVariant.secondary,
            expand: true,
            onPressed: () {
              Navigator.of(context).pop();
              context.push(articleRoute, extra: '${a['id']}');
            },
          ),
        ]),
      ),
    );
  }
}
