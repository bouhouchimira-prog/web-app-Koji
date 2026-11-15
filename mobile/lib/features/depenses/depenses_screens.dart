import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/avenant/pro_avenant_screens.dart' show ouvrirAvenant;
import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart' show prendrePhotoAppareil;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart';
import 'package:koji/features/depenses/depenses_repository.dart';
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;

const depensesRoute = '/depenses';
String coutChantierRoute(String id) => '/depenses/chantier/$id';

/// Prise de photo remplaçable dans les tests.
typedef PrisePhotoPiece = Future<List<int>?> Function();

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Widget _chargement(String t) => KojiPage(title: t, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);

// ---------------------------------------------------------------------------
// PRO-09 Dépenses (téléphone) : à ranger, factures reçues, coût des
// chantiers, export ; « Photo d'un ticket » lue par Koji.
// ---------------------------------------------------------------------------
class DepensesScreen extends ConsumerStatefulWidget {
  const DepensesScreen({super.key, this.onglet = 'ranger', this.prisePhoto});
  final String onglet;
  final PrisePhotoPiece? prisePhoto;

  @override
  ConsumerState<DepensesScreen> createState() => _DepensesScreenState();
}

class _DepensesScreenState extends ConsumerState<DepensesScreen> {
  late String _onglet = widget.onglet;
  String _depot = '';

  DepensesRepository get _repo => ref.read(depensesRepositoryProvider);

  Future<void> _envoyerPiece(String nom, String data) async {
    setState(() => _depot = 'Koji lit $nom…');
    try {
      final r = await _repo.deposer(nom: nom, data: data);
      ref.invalidate(depensesProvider);
      final piece = _liste(r['aRanger']).where((p) => p['id'] == r['pieceId']).firstOrNull;
      if (!mounted) return;
      setState(() => _depot = '');
      if (piece != null) await showPieceSheet(context, ref, piece, r);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _depot = '');
    }
  }

  Future<void> _photo() async {
    final octets = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (octets == null || !mounted) return;
    final n = DateTime.now();
    await _envoyerPiece('Ticket ${n.day}-${n.month} ${n.hour}h${'${n.minute}'.padLeft(2, '0')}.jpg', 'data:image/jpeg;base64,${base64Encode(octets)}');
  }

  Future<void> _pdf() async {
    final r = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf'], withData: true);
    final f = r?.files.singleOrNull;
    if (f == null || f.bytes == null || !mounted) return;
    if (f.size > 3 * 1024 * 1024) {
      showFacturesMessage(context, 'PDF trop lourd (3 Mo au plus).');
      return;
    }
    await _envoyerPiece(f.name, 'data:application/pdf;base64,${base64Encode(f.bytes!)}');
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(depensesProvider);
    if (async.hasError && !async.hasValue) {
      return KojiPage(title: 'Dépenses', appBarOnPhone: true, main: [KojiEmptyState(title: 'Dépenses indisponibles', subtitle: errorText(async.error!), icon: KojiIcons.comptabilite)]);
    }
    if (!async.hasValue) return _chargement('Dépenses');
    final d = async.value!;
    final aRanger = _liste(d['aRanger']);
    final recues = _liste(d['recues']);
    return KojiPage(
      title: 'Dépenses',
      subtitle: aRanger.isEmpty ? 'tout est rangé' : '${aRanger.length} pièce${aRanger.length > 1 ? 's' : ''} à ranger',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(depensesProvider);
        ref.invalidate(coutChantiersProvider);
        await ref.read(depensesProvider.future);
      },
      actions: [
        KojiButton(label: 'Facture PDF', variant: KojiButtonVariant.secondary, onPressed: _depot.isEmpty ? _pdf : null),
        KojiButton(label: "Photo d'un ticket", onPressed: _depot.isEmpty ? _photo : null),
      ],
      main: [
        KojiSegmented<String>(
          compact: true,
          options: {'ranger': 'À ranger ${aRanger.length}', 'recues': 'Reçues', 'chantiers': 'Coût', 'export': 'Export'},
          value: _onglet,
          onChanged: (v) => setState(() => _onglet = v),
        ),
        if (_depot.isNotEmpty) Row(children: [const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)), const SizedBox(width: 10), Expanded(child: Text(_depot))]),
        if (_onglet == 'ranger') ..._aRanger(context, d, aRanger),
        if (_onglet == 'recues') ..._recues(context, d, recues),
        if (_onglet == 'chantiers') const CoutChantiersListe(),
        if (_onglet == 'export') const ExportResume(),
      ],
    );
  }

  List<Widget> _aRanger(BuildContext context, Json d, List<Json> aRanger) {
    final p = context.koji;
    final sures = num2(d['sures']).round();
    final rm = Map<String, dynamic>.from(d['rangeesMois'] as Map? ?? const {});
    return [
      if (aRanger.isEmpty)
        const KojiEmptyState(compact: true, icon: KojiIcons.comptabilite, title: 'Rien à ranger', subtitle: 'Prenez en photo un ticket ou une facture : Koji la lit et propose le chantier.')
      else ...[
        if (sures > 0)
          KojiButton(
            label: sures > 1 ? 'Ranger les $sures sûres' : 'Ranger la pièce sûre',
            expand: true,
            onPressed: () async {
              try {
                await _repo.action('rangerSures');
                ref.invalidate(depensesProvider);
                if (context.mounted) showFacturesMessage(context, '$sures pièce${sures > 1 ? 's' : ''} rangée${sures > 1 ? 's' : ''}.');
              } catch (e) {
                if (context.mounted) showFacturesMessage(context, errorText(e));
              }
            },
          ),
        for (final x in aRanger)
          InkWell(
            onTap: () => showPieceSheet(context, ref, x, d),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${x['fournisseur'] ?? 'Pièce'} · ${euro(num2(x['ttc']))}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                    const SizedBox(height: 2),
                    Text(
                      '${x['doublonDe'] != null && '${x['doublonDe']}'.isNotEmpty ? 'doublon possible · ' : ''}${_destination(x)}',
                      style: TextStyle(fontSize: 12.5, color: '${x['doublonDe'] ?? ''}'.isNotEmpty ? p.toneFg(KojiTone.coral) : p.muted),
                    ),
                  ]),
                ),
                TextButton(
                  onPressed: () async {
                    final prop = x['proposition'] as Map?;
                    if ('${x['doublonDe'] ?? ''}'.isNotEmpty || prop == null) return showPieceSheet(context, ref, x, d);
                    try {
                      await _repo.action('ranger', {'id': x['id'], if (prop['fraisGeneraux'] == true) 'fraisGeneraux': true else ...{'projectId': prop['projectId'], 'lot': prop['lot'] ?? ''}});
                      ref.invalidate(depensesProvider);
                      if (context.mounted) showFacturesMessage(context, 'Rangée dans ${_destination(x)}.');
                    } catch (e) {
                      if (context.mounted) showFacturesMessage(context, errorText(e));
                    }
                  },
                  child: Text('${x['doublonDe'] ?? ''}'.isNotEmpty ? 'Vérifier' : x['proposition'] == null ? 'Choisir' : 'Ranger'),
                ),
              ]),
            ),
          ),
      ],
      Text('Déjà rangées ce mois : ${num2(rm['nombre']).round()} pièce${num2(rm['nombre']) > 1 ? 's' : ''} · ${euro(num2(rm['ht']))} HT', style: TextStyle(fontSize: 12, color: p.faint)),
    ];
  }

  List<Widget> _recues(BuildContext context, Json d, List<Json> recues) {
    final p = context.koji;
    final incertaine = recues.where((x) => x['statut'] != 'rangee').firstOrNull;
    return [
      const KojiAlertBox(title: 'Plateforme agréée : pas encore active', message: 'Déposez les factures en PDF ou en photo : Koji les lit et les rattache au chantier.', tone: KojiTone.grey),
      if (recues.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.factures, title: 'Aucune facture ces 30 derniers jours'),
      for (final x in recues)
        Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(x['statut'] == 'rangee' ? '${x['projectTitle'] ?? ''}${'${x['lot'] ?? ''}'.isNotEmpty ? ' · lot ${'${x['lot']}'.toLowerCase()}' : ''}' : 'à choisir', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .6, color: p.faint)),
            Text('${x['fournisseur']}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
            Text([x['numero'], x['autoliquidation'] == true ? '${euro(num2(x['ht']))} HT · autoliquidation' : '${euro(num2(x['ttc']))} TTC'].where((s) => '${s ?? ''}'.isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
          ]),
        ),
      if (incertaine != null) KojiButton(label: 'Ranger la facture incertaine', expand: true, onPressed: () => showPieceSheet(context, ref, incertaine, d)),
    ];
  }
}

String _destination(Json x) {
  final prop = x['proposition'] as Map?;
  if (prop == null) return 'à choisir';
  if (prop['fraisGeneraux'] == true) return 'Frais généraux';
  return '${prop['title'] ?? ''}';
}

/// Une pièce : ce que Koji a lu, où la ranger, doublon.
Future<void> showPieceSheet(BuildContext context, WidgetRef ref, Json piece, Json vue) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (_) => _PieceSheet(piece: piece, vue: vue),
    );

class _PieceSheet extends ConsumerStatefulWidget {
  const _PieceSheet({required this.piece, required this.vue});
  final Json piece;
  final Json vue;

  @override
  ConsumerState<_PieceSheet> createState() => _PieceSheetState();
}

class _PieceSheetState extends ConsumerState<_PieceSheet> {
  late final Map? _prop = widget.piece['proposition'] as Map?;
  late String _dest = _prop?['fraisGeneraux'] == true ? 'fg' : '${_prop?['projectId'] ?? ''}';
  late String _lot = '${_prop?['lot'] ?? ''}';
  bool _busy = false;

  Future<void> _faire(String action, Json extra, String ok) async {
    setState(() => _busy = true);
    try {
      await ref.read(depensesRepositoryProvider).action(action, {'id': widget.piece['id'], ...extra});
      ref.invalidate(depensesProvider);
      ref.invalidate(coutChantiersProvider);
      if (mounted) {
        Navigator.of(context).pop();
        showFacturesMessage(context, ok);
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
    final x = widget.piece;
    final chantiers = _liste(widget.vue['chantiers']);
    final choix = <(String, String, String)>[
      if (_prop != null && _prop['fraisGeneraux'] != true) ('${_prop['projectId']}', '${_prop['title']}', '${_prop['raison'] ?? ''}'),
      for (final a in _liste(_prop?['autres'])) ('${a['projectId']}', '${a['title']}', '${a['raison'] ?? ''}'),
      ('fg', 'Frais généraux', _prop?['fraisGeneraux'] == true ? '${_prop?['raison']}' : 'aucun chantier'),
    ];
    final autres = chantiers.where((c) => !choix.any((k) => k.$1 == c['projectId'])).toList();
    final lots = (chantiers.where((c) => c['projectId'] == _dest).firstOrNull?['lots'] as List? ?? const []).map((l) => '$l').toList();
    final doublon = '${x['doublonDe'] ?? ''}'.isNotEmpty;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('Lu par Koji · ${sourcesPiece[x['source']] ?? 'pièce'} · ${jourCourt(x['date'])}', style: TextStyle(fontSize: 12, color: p.faint)),
          Text('${x['fournisseur'] ?? 'Pièce'} · ${euro(num2(x['ttc']))} TTC', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
          Text(x['autoliquidation'] == true ? '${euro(num2(x['ht']))} HT · autoliquidation' : '${euro(num2(x['ht']))} HT · TVA ${nb(num2(x['tauxTva']))} % ${euro(num2(x['tva']))}', style: TextStyle(fontSize: 12.5, color: p.muted)),
          if (x['illisible'] == true) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Pièce difficile à lire : vérifiez les montants sur le site.', style: TextStyle(fontSize: 12.5, color: p.toneFg(KojiTone.coral)))),
          const SizedBox(height: 8),
          for (final l in _liste(x['lignes']).take(8)) FactureKv('${l['designation']}', l['montantHt'] != null ? euro(num2(l['montantHt'])) : ''),
          if (doublon) ...[
            const SizedBox(height: 8),
            const KojiAlertBox(title: 'Doublon possible', message: 'Même fournisseur, même montant, à quelques jours d\'écart.', tone: KojiTone.coral),
            TextButton(onPressed: _busy ? null : () => _faire('garder', const {}, 'Les deux pièces sont gardées.'), child: const Text('Garder les deux')),
          ],
          const SizedBox(height: 12),
          Text('Ranger dans', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: p.heading)),
          for (final (i, c) in choix.indexed)
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              selected: _dest == c.$1,
              leading: Icon(_dest == c.$1 ? Icons.radio_button_checked : Icons.radio_button_unchecked, size: 20),
              onTap: () => setState(() {
                _dest = c.$1;
                _lot = c.$1 == _prop?['projectId'] ? '${_prop?['lot'] ?? ''}' : '';
              }),
              title: Text(i == 0 && _prop != null && c.$1 != 'fg' ? '${c.$2} · proposé par Koji' : c.$2),
              subtitle: Text(c.$3),
            ),
          if (autres.isNotEmpty)
            DropdownButtonFormField<String>(
              initialValue: autres.any((c) => c['projectId'] == _dest) ? _dest : null,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Autre chantier', isDense: true),
              items: [for (final c in autres) DropdownMenuItem(value: '${c['projectId']}', child: Text('${c['title']}'))],
              onChanged: (v) => setState(() {
                _dest = v ?? '';
                _lot = '';
              }),
            ),
          if (lots.isNotEmpty) ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: lots.contains(_lot) ? _lot : '',
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Lot', isDense: true),
              items: [const DropdownMenuItem(value: '', child: Text('Sans lot')), for (final l in lots) DropdownMenuItem(value: l, child: Text(l))],
              onChanged: (v) => setState(() => _lot = v ?? ''),
            ),
          ],
          const SizedBox(height: 16),
          KojiButton(
            label: 'Ranger',
            expand: true,
            loading: _busy,
            onPressed: _busy || _dest.isEmpty ? null : () => _faire('ranger', _dest == 'fg' ? {'fraisGeneraux': true} : {'projectId': _dest, 'lot': _lot}, 'Pièce rangée.'),
          ),
          TextButton(onPressed: _busy ? null : () => _faire('supprimer', const {}, 'Pièce supprimée.'), child: const Text('Supprimer la pièce')),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PRO-09.1 Coût des chantiers (téléphone).
// ---------------------------------------------------------------------------
class CoutChantiersListe extends ConsumerWidget {
  const CoutChantiersListe({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final async = ref.watch(coutChantiersProvider);
    if (async.hasError) return KojiEmptyState(compact: true, title: 'Coût indisponible', subtitle: errorText(async.error!), icon: KojiIcons.chantiers);
    if (!async.hasValue) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    final d = async.value!;
    final chantiers = _liste(d['chantiers']);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (num2(d['coutHoraire']) <= 0) const KojiAlertBox(title: 'Coût horaire à renseigner', message: 'Sans le coût d\'une heure de votre équipe (Mes prix, sur le site), Koji n\'affiche pas de marge plutôt qu\'une marge fausse.'),
      if (chantiers.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.chantiers, title: 'Aucun chantier avec un devis'),
      for (final c in chantiers)
        InkWell(
          onTap: () => context.push(coutChantierRoute('${c['projectId']}')),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c['title']}', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                  const SizedBox(height: 2),
                  Text(resumeCarte(c), style: TextStyle(fontSize: 12.5, color: p.muted)),
                  Text('Dépensé ${euro0(num2(c['depense']))}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                ]),
              ),
              KojiPill(etatCout(c['etat']).label, tone: etatCout(c['etat']).ton),
            ]),
          ),
        ),
    ]);
  }
}

// ---------------------------------------------------------------------------
// PRO-09.2 Coût d'un chantier (téléphone) : marge prévue et aujourd'hui,
// lots, heures, historique, « Préparer un avenant ».
// ---------------------------------------------------------------------------
class CoutChantierScreen extends ConsumerStatefulWidget {
  const CoutChantierScreen({super.key, required this.projectId});
  final String projectId;

  @override
  ConsumerState<CoutChantierScreen> createState() => _CoutChantierScreenState();
}

class _CoutChantierScreenState extends ConsumerState<CoutChantierScreen> {
  String _filtre = 'tout';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(coutChantierProvider(widget.projectId));
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Coût du chantier', appBarOnPhone: true, main: [KojiEmptyState(title: 'Coût indisponible', subtitle: errorText(async.error!), icon: KojiIcons.chantiers)]);
    if (!async.hasValue) return _chargement('Coût du chantier');
    final d = async.value!;
    final p = context.koji;
    final c = Map<String, dynamic>.from(d['cout'] as Map);
    final ch = Map<String, dynamic>.from(d['chantier'] as Map);
    final mp = c['margePrevue'] as Map?;
    final mf = c['margeFinale'] as Map?;
    final mo = Map<String, dynamic>.from(c['mo'] as Map? ?? const {});
    final depasse = c['depasse'] as Map?;
    final devis = d['devis'] as Map?;
    final hist = _liste(d['historique']).where((h) => _filtre == 'tout' || h['type'] == _filtre || (_filtre == 'fournitures' && h['type'] == 'autres')).toList();
    return KojiPage(
      title: '${ch['title']}',
      subtitle: 'coût réel · ${num2(c['avancement']).round()} % fait',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(coutChantierProvider(widget.projectId));
        await ref.read(coutChantierProvider(widget.projectId).future);
      },
      main: [
        KojiKpiRow(children: [
          KojiKpi(label: 'Prévue', value: mp != null ? '${num2(mp['pct']).round()} %' : '—'),
          KojiKpi(label: 'Aujourd\'hui', value: mf != null ? '${num2(mf['pct']).round()} %' : '—', tone: mf != null && mp != null && num2(mf['pct']) < num2(mp['pct']) - 3 ? KojiTone.coral : KojiTone.navy),
          KojiKpi(label: 'Dépensé', value: euro0(num2(c['depense']))),
        ]),
        if (mp == null) const KojiAlertBox(title: 'Marge non calculée', message: 'Renseignez votre coût horaire dans Mes prix (site) : sans lui, Koji n\'affiche pas de marge.'),
        if (depasse != null) KojiAlertBox(title: '${depasse['lot']} : ${euro0(num2(depasse['depense']))} pour ${euro0(num2(depasse['prevu']))} prévus', message: (d['doublons'] as List? ?? const []).isNotEmpty ? 'Doublon probable dans les pièces. Si le changement vient du client, faites signer un avenant.' : 'Si le changement vient du client, faites signer un avenant.', tone: KojiTone.coral),
        KojiCard(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (final l in _liste(c['lots']))
              _ligne(context, '${l['lot']} · fournitures', 'prévu ${euro0(num2(l['prevu']))} · ${ecartLot(l)}', euro0(num2(l['depense'])), fort: lotDepasse(l)),
            if (num2(c['autres']) > 0) _ligne(context, 'Autres dépenses', 'sans lot', euro0(num2(c['autres']))),
            _ligne(context, 'Heures de l\'équipe', mo['suivi'] == true ? '${nb(num2(mo['heures']))} h pointées' : 'non pointées : comptées comme prévu', mo['suivi'] == true ? euro0(num2(mo['depense'])) : '—'),
          ]),
        ),
        if (depasse != null && devis != null)
          KojiButton(label: 'Préparer un avenant', expand: true, onPressed: () => ouvrirAvenant(context, ref, Map<String, dynamic>.from(devis))),
        Text('Historique', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
        KojiFilterChips<String>(options: const {'tout': 'Tout', 'fournitures': 'Fournitures', 'heures': 'Heures', 'encaissements': 'Encaissements'}, value: _filtre, onChanged: (v) => setState(() => _filtre = v)),
        if (hist.isEmpty) Text('Rien pour l\'instant.', style: TextStyle(color: p.muted)),
        for (final h in hist.take(40)) _ligne(context, '${h['titre']}', '${jourCourt(h['date'])} · ${h['detail'] ?? ''}', num2(h['montant']) < 0 ? '− ${euro(-num2(h['montant']))}' : '+ ${euro(num2(h['montant']))}'),
      ],
    );
  }

  Widget _ligne(BuildContext context, String titre, String sous, String montant, {bool fort = false}) {
    final p = context.koji;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: p.lineSoft))),
      child: Row(children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(titre, style: TextStyle(fontSize: 14, fontWeight: fort ? FontWeight.w800 : FontWeight.w600, color: p.heading)),
            Text(sous, style: TextStyle(fontSize: 12, color: p.muted)),
          ]),
        ),
        Text(montant, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: p.heading)),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// PRO-09.4 Export, résumé du mois (téléphone).
// ---------------------------------------------------------------------------
class ExportResume extends ConsumerStatefulWidget {
  const ExportResume({super.key});

  @override
  ConsumerState<ExportResume> createState() => _ExportResumeState();
}

class _ExportResumeState extends ConsumerState<ExportResume> {
  late final _periodes = periodesExport(DateTime.now());
  late String _periode = _periodes.first.$1;
  bool _busy = false;

  Future<void> _envoyer(String actuel) async {
    final c = TextEditingController(text: actuel);
    final to = actuel.isNotEmpty
        ? actuel
        : await showDialog<String>(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('E-mail du comptable'),
              content: TextField(controller: c, keyboardType: TextInputType.emailAddress, autofocus: true),
              actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')), TextButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Envoyer'))],
            ),
          );
    c.dispose();
    if (to == null || to.isEmpty) return;
    setState(() => _busy = true);
    try {
      final r = await ref.read(depensesRepositoryProvider).envoyer(_periode, to);
      ref.invalidate(exportComptableProvider(_periode));
      if (mounted) showFacturesMessage(context, 'Envoyé à ${(r['envoi'] as Map?)?['to'] ?? to}.');
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final async = ref.watch(exportComptableProvider(_periode));
    if (async.hasError) return KojiEmptyState(compact: true, title: 'Export indisponible', subtitle: errorText(async.error!), icon: KojiIcons.comptabilite);
    if (!async.hasValue) return const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()));
    final d = async.value!;
    if (d['business'] != true) {
      return const KojiEmptyState(compact: true, icon: KojiIcons.comptabilite, title: 'Export pour le comptable', subtitle: 'Journaux, relevé par chantier et justificatifs envoyés à votre comptable : c\'est dans l\'offre Business.');
    }
    final s = Map<String, dynamic>.from(d['synthese'] as Map);
    final t = Map<String, dynamic>.from(s['totaux'] as Map);
    final v = Map<String, dynamic>.from(t['ventes'] as Map);
    final a = Map<String, dynamic>.from(t['achats'] as Map);
    final e = Map<String, dynamic>.from(t['encaissements'] as Map);
    final manques = _liste(s['controles']).where((c) => c['ok'] != true).toList();
    final email = '${(d['reglages'] as Map?)?['comptableEmail'] ?? ''}';
    String pl(num n, String mot) => '${n.round()} $mot${n > 1 ? 's' : ''}';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      KojiFilterChips<String>(options: {for (final x in _periodes) x.$1: x.$2}, value: _periode, onChanged: (x) => setState(() => _periode = x)),
      const SizedBox(height: 8),
      Text('${s['libelle']}', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.heading)),
      FactureKv('Ventes · ${pl(num2(v['factures']), 'facture')} · ${pl(num2(v['avoirs']), 'avoir')}', euro(num2(v['ht']))),
      FactureKv('Achats · ${pl(num2(a['factures']), 'facture')} · ${pl(num2(a['tickets']), 'ticket')}', euro(num2(a['ht']))),
      FactureKv('Encaissements · ${pl(num2(e['nombre']), 'paiement')}', euro(num2(e['ttc']))),
      FactureKv('TVA à déclarer, indicatif', euro(num2((s['tva'] as Map?)?['solde'])), strong: true),
      for (final m in manques) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${m['texte']} avant envoi', style: TextStyle(fontSize: 12.5, color: p.toneFg(KojiTone.amber)))),
      const SizedBox(height: 12),
      KojiButton(label: 'Envoyer au comptable', expand: true, loading: _busy, onPressed: _busy ? null : () => _envoyer(email)),
      if (email.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('à $email · journaux CSV, relevé PDF et justificatifs', style: TextStyle(fontSize: 12, color: p.faint))),
      const SizedBox(height: 8),
      Text('Koji range et transmet vos pièces ; il ne tient pas la comptabilité (ni liasse ni FEC). Montants de TVA indicatifs.', style: TextStyle(fontSize: 12, color: p.faint)),
    ]);
  }
}
