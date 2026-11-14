import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/devis/devis_liste.dart';
import 'package:koji/apps/entreprise/entreprise_search.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/design/koji_brand_marks.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';
import 'package:koji/features/quote/repository/quote_repository.dart';

String _s(dynamic v) => v == null ? '' : '$v';

typedef DonneesDevis = ({List<Map<String, dynamic>> devis, Set<String> chantiersEnCours});

/// Devis et chantiers lus sur le site (mêmes routes que la liste web).
final proDevisProvider = FutureProvider.autoDispose<DonneesDevis>((ref) async {
  final api = ref.watch(proKojiWebProvider);
  final devis = await api.liste('/api/quotes', 'quotes');
  final projets = await api.liste('/api/projects', 'projects').catchError((_) => <Map<String, dynamic>>[]);
  return (
    devis: devis.where((q) => q['status'] != 'Archive').toList(),
    chantiersEnCours: {for (final p in projets) if (p['status'] == 'En cours') _s(p['id'])},
  );
});

/// Ouvre un devis dans l'éditeur de l'app (fiche Supabase du devis).
typedef OuvrirDevis = Future<void> Function(BuildContext context, WidgetRef ref, Map<String, dynamic> devis);

Future<void> ouvrirDevisApp(BuildContext context, WidgetRef ref, Map<String, dynamic> devis) async {
  final user = ref.read(authRepositoryProvider).currentUser;
  if (user == null) return;
  final tous = await ref.read(quoteRepositoryProvider).getUserQuotesOnce(user.id);
  final brut = tous.where((q) => _s(q['id']) == _s(devis['id'])).firstOrNull;
  if (brut == null || !context.mounted) return;
  context.push('/quote/detail', extra: QuoteDetailArgs(data: brut));
}

/// Relancer un devis envoyé (maquettes PRO-03 et PRO-03.3) : message
/// proposé par Koji, modifiable, envoyé par e-mail avec le lien de
/// signature. Renvoie true si la relance est partie.
Future<bool> ouvrirRelanceDevis(BuildContext context, WidgetRef ref, Map<String, dynamic> q) async {
  final entreprise = ref.read(currentAccountProvider).valueOrNull?.displayName ?? '';
  final texte = TextEditingController(text: messageRelance(q, entreprise: entreprise));
  final da = ProDa.of(context);
  final messenger = ScaffoldMessenger.of(context);
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: da.page,
    builder: (c) => Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.viewInsetsOf(c).bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Relancer le devis ${q['quoteNumber']}', style: da.text(17, weight: FontWeight.w700)),
          Text([_s(q['client']), _s(q['clientEmail'])].where((x) => x.isNotEmpty).join(' · '), style: da.text(12, color: da.grey)),
          const SizedBox(height: 12),
          Text('MESSAGE · PROPOSÉ PAR KOJI', style: da.text(11, weight: FontWeight.w700, color: da.grey)),
          const SizedBox(height: 6),
          TextField(
            controller: texte,
            minLines: 6,
            maxLines: 10,
            style: da.text(14),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFFD9D9D4))),
            ),
          ),
          const SizedBox(height: 6),
          Text('Koji ajoute le lien pour consulter et signer le devis.', style: da.text(12, color: da.grey)),
          const SizedBox(height: 12),
          ProPrimaryButton(label: 'Envoyer la relance', expand: true, onPressed: _s(q['clientEmail']).isEmpty ? null : () => Navigator.of(c).pop(true)),
        ],
      ),
    ),
  );
  if (ok != true) return false;
  try {
    await ref.read(proKojiWebProvider).relancerDevis(_s(q['id']), texte.text.trim());
    messenger.showSnackBar(SnackBar(content: Text('Relance envoyée à ${q['clientEmail']}.')));
    return true;
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(e is ProKojiWebException ? e.message : "La relance n'est pas partie.")));
    return false;
  }
}

/// Koji Pro, Devis (maquette PRO-03, téléphone) : « Devis », le résumé,
/// « Démarrer un devis guidé », la recherche, les onglets Tous / Brouillons
/// / Envoyés / Signés, une carte par devis (statut, montant, dernière
/// action) ; Relancer et Dupliquer comme sur le site.
class ProDevisScreen extends ConsumerStatefulWidget {
  const ProDevisScreen({
    super.key,
    this.barre = true,
    this.ouvrir = ouvrirDevisApp,
    this.maintenant = DateTime.now,
  });

  final bool barre;
  final OuvrirDevis ouvrir;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProDevisScreen> createState() => _ProDevisScreenState();
}

class _ProDevisScreenState extends ConsumerState<ProDevisScreen> {
  String _onglet = 'tous';
  final _recherche = TextEditingController();
  bool _envoi = false;

  @override
  void dispose() {
    _recherche.dispose();
    super.dispose();
  }

  void _dire(String t) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  Future<void> _relancer(Map<String, dynamic> q) async {
    setState(() => _envoi = true);
    final ok = await ouvrirRelanceDevis(context, ref, q);
    if (!mounted) return;
    setState(() => _envoi = false);
    if (ok) ref.invalidate(proDevisProvider);
  }

  Future<void> _dupliquer(Map<String, dynamic> q) async {
    setState(() => _envoi = true);
    try {
      final nouveau = await ref.read(proKojiWebProvider).dupliquerDevis(q);
      ref.invalidate(proDevisProvider);
      if (mounted) _dire('Devis dupliqué : ${nouveau['quoteNumber'] ?? 'nouveau brouillon'}.');
    } catch (e) {
      if (mounted) _dire(e is ProKojiWebException ? e.message : "Le devis n'a pas pu être dupliqué.");
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _agir(Map<String, dynamic> q, String aujourdhui) async {
    switch (actionDevis(q, aujourdhui).id) {
      case 'relancer':
        await _relancer(q);
      case 'dupliquer':
        await _dupliquer(q);
      default:
        await widget.ouvrir(context, ref, q);
        ref.invalidate(proDevisProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncD = ref.watch(proDevisProvider);
    final d = asyncD.valueOrNull;
    final aujourdhui = DateFormat('yyyy-MM-dd').format(widget.maintenant());
    final devis = d?.devis ?? const <Map<String, dynamic>>[];
    final comptes = compterDevis(devis, aujourdhui);
    final cherche = _recherche.text.trim().toLowerCase();
    final visibles = devis
        .where((q) => _onglet == 'tous' || ongletDevis(q, aujourdhui) == _onglet)
        .where((q) => cherche.isEmpty || [q['quoteNumber'], q['client'], q['project']].any((v) => _s(v).toLowerCase().contains(cherche)))
        .toList()
      ..sort((a, b) => _s(b['createdAtIso']).compareTo(_s(a['createdAtIso'])));

    final contenu = RefreshIndicator(
      color: da.ink,
      onRefresh: () async => ref.invalidate(proDevisProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Text('Devis', style: da.text(26, weight: FontWeight.w700, height: 1.2)),
          const SizedBox(height: 2),
          Text(asyncD.isLoading && devis.isEmpty ? 'Chargement…' : resumeDevis(comptes, avecTotal: false), style: da.text(13, color: da.grey)),
          const SizedBox(height: 14),
          ProPrimaryButton(
            label: 'Démarrer un devis guidé',
            icon: Icons.add,
            expand: true,
            // Maquette PRO-03.1 : le devis guidé s'ouvre vide, Koji demande
            // de décrire le chantier ; les lots se créent au fil du chat.
            onPressed: () {
              ref.read(quoteCreationProvider.notifier).reset();
              context.push('/quote/detail', extra: const QuoteDetailArgs(data: <String, dynamic>{}));
            },
          ),
          const SizedBox(height: 12),
          _champRecherche(da),
          const SizedBox(height: 12),
          _onglets(da, comptes),
          const SizedBox(height: 12),
          if (asyncD.hasError && devis.isEmpty)
            Text('Devis indisponibles pour le moment. Tirez la liste vers le bas.', style: da.text(13, color: da.grey))
          else if (asyncD.isLoading && devis.isEmpty)
            const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))))
          else if (visibles.isEmpty)
            Text(cherche.isNotEmpty ? 'Aucun devis ne correspond à cette recherche.' : 'Aucun devis dans cet onglet.', style: da.text(13, color: da.grey))
          else
            for (final q in visibles) ...[
              _carte(da, q, aujourdhui, d!.chantiersEnCours.contains(_s(q['projectId']))),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );

    return ColoredBox(
      color: da.page,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.barre) _barre(da),
          Expanded(child: contenu),
        ],
      ),
    );
  }

  Widget _barre(ProDa da) {
    final entreprise = ref.watch(currentAccountProvider).valueOrNull?.displayName ?? '';
    return Container(
      color: const Color(0xFF171B1E),
      padding: EdgeInsets.fromLTRB(18, MediaQuery.paddingOf(context).top + 12, 8, 12),
      child: Row(children: [
        const KojiWordmark(height: 14, color: Colors.white),
        const SizedBox(width: 12),
        Expanded(child: Text(entreprise, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: const Color(0xFFA7ABB2)))),
        IconButton(tooltip: 'Rechercher', onPressed: () => showEntrepriseSearch(context, ref), icon: const Icon(Icons.search, color: Colors.white, size: 22)),
      ]),
    );
  }

  Widget _champRecherche(ProDa da) {
    OutlineInputBorder bord(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: _recherche,
      onChanged: (_) => setState(() {}),
      style: da.text(14),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: da.card,
        hintText: 'Rechercher',
        hintStyle: da.text(14, color: da.grey),
        prefixIcon: Icon(Icons.search, size: 18, color: da.grey),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        enabledBorder: bord(da.frame),
        focusedBorder: bord(da.ink, 2),
      ),
    );
  }

  Widget _onglets(ProDa da, Map<String, int> comptes) {
    Widget onglet(String id, String label) {
      final on = id == _onglet;
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          child: GestureDetector(
            onTap: () => setState(() => _onglet = id),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.fromLTRB(2, 8, 2, 7),
              decoration: BoxDecoration(
                color: on ? Colors.white : const Color(0xFFDEDED6),
                border: Border(
                  top: BorderSide(color: on ? ProDa.prim : Colors.transparent, width: 3),
                  left: const BorderSide(color: Color(0xFFCFCFC9)),
                  right: const BorderSide(color: Color(0xFFCFCFC9)),
                ),
              ),
              alignment: Alignment.center,
              child: Text('$label ${comptes[id] ?? 0}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: da.text(12, weight: on ? FontWeight.w700 : FontWeight.w600, color: on ? const Color(0xFF171B1E) : const Color(0xFF3A3F44))),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(6, 8, 6, 0),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFCFCFC9)))),
      child: Row(children: [
        for (final (i, (id, label)) in ongletsDevisTelephone.indexed) ...[
          if (i > 0) const SizedBox(width: 3),
          onglet(id, label),
        ],
      ]),
    );
  }

  Widget _carte(ProDa da, Map<String, dynamic> q, String aujourdhui, bool enCours) {
    final statut = statutDevis(q, aujourdhui);
    final action = actionDevis(q, aujourdhui);
    final montant = NumberFormat.currency(locale: 'fr_FR', symbol: '€', decimalDigits: 2).format((q['totalHt'] as num?) ?? 0).replaceAll(RegExp('[  ]'), ' ');
    final tag = statut.ton == 'sceau'
        ? Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 18,
              height: 18,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: da.ink, width: 1.5)),
              child: Icon(Icons.check, size: 12, color: da.ink),
            ),
            const SizedBox(width: 6),
            Text('Signé', style: da.text(12, weight: FontWeight.w700)),
          ])
        : ProTag(statut.label, tone: statut.ton == 'graphite' ? ProTagTone.ink : ProTagTone.grey);
    return Semantics(
      button: true,
      label: '${_s(q['project'])}, ${statut.label}',
      child: GestureDetector(
        onTap: _envoi ? null : () => _agir(q, aujourdhui),
        behavior: HitTestBehavior.opaque,
        child: ProCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(q['project']).isEmpty ? _s(q['quoteNumber']) : _s(q['project']), style: da.text(15, weight: FontWeight.w600)),
                  Text('${q['quoteNumber']} · ${_s(q['client']).isEmpty ? 'Client' : q['client']}', style: da.text(12, color: da.grey)),
                ]),
              ),
              const SizedBox(width: 10),
              tag,
            ]),
            const SizedBox(height: 8),
            Row(children: [
              Text(montant, style: da.text(14, weight: FontWeight.w700)),
              const SizedBox(width: 10),
              Expanded(child: Text(derniereAction(q, aujourdhui, chantierEnCours: enCours), textAlign: TextAlign.right, style: da.text(12, color: da.grey))),
            ]),
            if (action.id == 'relancer' || action.id == 'dupliquer') ...[
              const SizedBox(height: 8),
              Align(alignment: Alignment.centerRight, child: Text('${action.label} ›', style: da.text(13, weight: FontWeight.w700))),
            ],
          ]),
        ),
      ),
    );
  }
}
