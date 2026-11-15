import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;

// Calendrier de Koji Pro (maquettes PRO-11 à 11.4, téléphone) sur l'API du
// site (/api/calendrier) : agenda du jour avec la semaine en bandeau,
// conflit en tête avec une proposition, à régler, à planifier, planning
// d'un chantier, « Planifier un lot ».
const calendrierProRoute = '/calendrier';
String planningChantierRoute(String id) => '/calendrier/chantier/$id';

final calendrierRepositoryProvider = Provider<CalendrierRepository>((ref) => CalendrierRepository(ref.watch(kojiProApiProvider)));
final calendrierJourProvider = FutureProvider.autoDispose.family<Json, String>((ref, jour) => ref.watch(calendrierRepositoryProvider).jour(jour));
final tachesChantierProvider = FutureProvider.autoDispose.family<List<Json>, String>((ref, id) => ref.watch(calendrierRepositoryProvider).taches(id));

class CalendrierRepository {
  CalendrierRepository(this._api);
  final KojiProApi _api;

  Future<Json> jour(String jour) {
    final lundi = lundiDe(jour);
    return _api.get('/api/calendrier', query: {'jour': jour, 'debut': lundi, 'fin': plusJours(lundi, 6)});
  }

  Future<List<Json>> taches(String projectId) async => (await _api.list('/api/tasks', 'tasks')).where((t) => t['projectId'] == projectId).toList();
  Future<Json> action(Json corps) => _api.post('/api/calendrier', corps);
}

String isoDe(DateTime d) => '${d.year}-${'${d.month}'.padLeft(2, '0')}-${'${d.day}'.padLeft(2, '0')}';
DateTime _date(String j) => DateTime.utc(int.parse(j.substring(0, 4)), int.parse(j.substring(5, 7)), int.parse(j.substring(8, 10)));
String plusJours(String j, int n) => isoDe(_date(j).add(Duration(days: n)));
String lundiDe(String j) => plusJours(j, -(_date(j).weekday - 1));
const _joursCourts = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const _joursLongs = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
String jourLong(String j) => '${_joursLongs[_date(j).weekday - 1]} ${jourCourt(j)}';

/// Semaine ISO d'un jour.
int semaineIso(String j) {
  final d = _date(j);
  final jeudi = d.add(Duration(days: 4 - d.weekday));
  final premier = DateTime.utc(jeudi.year, 1, 1);
  return ((jeudi.difference(premier).inDays) / 7).floor() + 1;
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
String _s(Object? v) => v == null ? '' : '$v';

// ---------------------------------------------------------------------------
// PRO-11 Agenda du jour.
// ---------------------------------------------------------------------------
class CalendrierProScreen extends ConsumerStatefulWidget {
  const CalendrierProScreen({super.key, this.aujourdhui});
  final String? aujourdhui;

  @override
  ConsumerState<CalendrierProScreen> createState() => _CalendrierProScreenState();
}

class _CalendrierProScreenState extends ConsumerState<CalendrierProScreen> {
  late String _jour = widget.aujourdhui ?? isoDe(DateTime.now());
  String _vue = 'jour';
  bool _busy = false;

  Future<void> _action(Json corps, String ok) async {
    setState(() => _busy = true);
    try {
      await ref.read(calendrierRepositoryProvider).action(corps);
      ref.invalidate(calendrierJourProvider(_jour));
      if (mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(calendrierJourProvider(_jour));
    final lundi = lundiDe(_jour);
    final titre = 'Semaine ${semaineIso(_jour)} · ${jourCourt(lundi).split(' ').first} → ${jourCourt(plusJours(lundi, 6))}';
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Calendrier', appBarOnPhone: true, main: [KojiEmptyState(title: 'Calendrier indisponible', subtitle: errorText(async.error!), icon: KojiIcons.calendrier)]);
    if (!async.hasValue) return KojiPage(title: 'Calendrier', subtitle: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final d = async.value!;
    final p = context.koji;
    final feries = _liste(d['semaine']).where((x) => x['ferie'] == true).map((x) => x['jour']).toSet();
    final conflits = _liste(d['conflits']);
    final items = _liste((d['agenda'] as Map?)?['items']);
    return KojiPage(
      title: 'Calendrier',
      subtitle: titre,
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(calendrierJourProvider(_jour));
        await ref.read(calendrierJourProvider(_jour).future);
      },
      actions: [KojiButton(label: 'Planifier', onPressed: () => ouvrirPlanifierLot(context, ref, d, onFait: () => ref.invalidate(calendrierJourProvider(_jour))))],
      main: [
        Row(children: [
          IconButton(onPressed: () => setState(() => _jour = plusJours(_jour, -7)), icon: const Icon(Icons.chevron_left), tooltip: 'Semaine précédente'),
          for (var i = 0; i < 7; i++)
            Expanded(
              child: InkWell(
                onTap: () => setState(() => _jour = plusJours(lundi, i)),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: plusJours(lundi, i) == _jour ? p.heading : Colors.transparent,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Column(children: [
                    Text(_joursCourts[i], style: TextStyle(fontSize: 11, color: plusJours(lundi, i) == _jour ? p.surface : p.faint)),
                    Text(plusJours(lundi, i).substring(8).replaceFirst(RegExp(r'^0'), ''), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: plusJours(lundi, i) == _jour ? p.surface : feries.contains(plusJours(lundi, i)) ? p.faint : p.heading)),
                    Text(feries.contains(plusJours(lundi, i)) ? 'férié' : '•' * (num2(_liste(d['semaine']).where((x) => x['jour'] == plusJours(lundi, i)).firstOrNull?['n']).round().clamp(0, 3)), style: TextStyle(fontSize: 10, color: plusJours(lundi, i) == _jour ? p.surface : p.muted)),
                  ]),
                ),
              ),
            ),
          IconButton(onPressed: () => setState(() => _jour = plusJours(_jour, 7)), icon: const Icon(Icons.chevron_right), tooltip: 'Semaine suivante'),
        ]),
        KojiSegmented<String>(compact: true, options: const {'jour': 'Jour', 'chantiers': 'Par chantier'}, value: _vue, onChanged: (v) => setState(() => _vue = v)),
        if (_vue == 'jour') ...[
          for (final c in conflits.take(1)) ...[
            KojiAlertBox(
              title: '${c['worker']} sur deux chantiers',
              message: '${jourLong(_s(c['jour']))} : ${_liste(c['taches']).map((t) => '${t['chantier']} ${t['label']}').join(' et ')}.',
              tone: KojiTone.coral,
            ),
            KojiButton(
              label: 'Décaler ${(c['proposition'] as Map)['chantier']} au ${jourLong(_s((c['proposition'] as Map)['debut']))}',
              variant: KojiButtonVariant.secondary,
              expand: true,
              loading: _busy,
              onPressed: _busy ? null : () => _action({'action': 'decaler', 'taskId': (c['proposition'] as Map)['taskId'], 'debut': (c['proposition'] as Map)['debut']}, 'Décalé.'),
            ),
          ],
          Text(jourLong(_jour), style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
          if (items.isEmpty) Text('Rien de prévu ce jour-là.', style: TextStyle(color: p.muted)),
          for (final it in items)
            InkWell(
              onTap: it['type'] == 'rdv' && it['id'] != null ? () => context.push('/calendrier/detail/${it['id']}') : null,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  SizedBox(width: 46, child: Text(_s(it['heure']).isEmpty ? '—' : _s(it['heure']), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: p.heading))),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_s(it['titre']), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
                    if (_s(it['detail']).isNotEmpty) Text(_s(it['detail']), style: TextStyle(fontSize: 12.5, color: p.muted)),
                  ])),
                ]),
              ),
            ),
          ..._aRegler(context, d),
          ..._aPlanifier(context, d),
        ] else
          for (final c in _liste(d['chantiers']))
            KojiCard(
              onTap: () => context.push(planningChantierRoute(_s(c['projectId'])), extra: _s(c['title'])),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(c['title']), style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
                  Text('${_liste(c['lots']).length} lots${_s(c['address']).isNotEmpty ? ' · ${c['address']}' : ''}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                ])),
                Icon(Icons.chevron_right, color: p.faint),
              ]),
            ),
      ],
    );
  }

  List<Widget> _aRegler(BuildContext context, Json d) {
    final p = context.koji;
    final livs = _liste(d['livraisonsBloquantes']);
    final docs = _liste(d['documents']);
    if (livs.isEmpty && docs.isEmpty) return const [];
    return [
      const SizedBox(height: 6),
      Text('À régler', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
      for (final l in livs) FactureKv('Livraison ${l['fournisseur']}, ${jourLong(_s(l['date']))}', _s(l['raison'])),
      for (final x in docs) FactureKv('${x['nom']} · ${x['worker']}', '${x['texte']}, avant ${x['avant']}'),
    ];
  }

  List<Widget> _aPlanifier(BuildContext context, Json d) {
    final p = context.koji;
    final lots = _liste(d['aPlanifier']);
    if (lots.isEmpty) return const [];
    return [
      const SizedBox(height: 6),
      Text('À planifier', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
      for (final l in lots)
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['chantier']} · ${l['lot']}', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.heading)),
            Text('${num2(l['jours']).round()} j${_s(l['lotPrecedent']).isNotEmpty ? ' · après ${l['lotPrecedent']}' : ''}', style: TextStyle(fontSize: 12, color: p.muted)),
          ])),
          TextButton(onPressed: () => ouvrirPlanifierLot(context, ref, d, lot: l, onFait: () => ref.invalidate(calendrierJourProvider(_jour))), child: const Text('Placer')),
        ]),
    ];
  }
}

// ---------------------------------------------------------------------------
// PRO-11.2 Planifier un lot (feuille).
// ---------------------------------------------------------------------------
Future<void> ouvrirPlanifierLot(BuildContext context, WidgetRef ref, Json d, {Json? lot, required VoidCallback onFait}) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (_) => _PlanifierLot(d: d, lot: lot, onFait: onFait),
    );

class _PlanifierLot extends ConsumerStatefulWidget {
  const _PlanifierLot({required this.d, this.lot, required this.onFait});
  final Json d;
  final Json? lot;
  final VoidCallback onFait;

  @override
  ConsumerState<_PlanifierLot> createState() => _PlanifierLotState();
}

class _PlanifierLotState extends ConsumerState<_PlanifierLot> {
  late String _projet = _s(widget.lot?['projectId']).isNotEmpty ? _s(widget.lot!['projectId']) : _s(_liste(widget.d['chantiers']).firstOrNull?['projectId']);
  late String _lot = _s(widget.lot?['lot']);
  late String _worker = _s((widget.lot?['workerIds'] as List?)?.firstOrNull);
  late int _jours = num2(widget.lot?['jours'], 1).round().clamp(1, 120);
  String _debut = '';
  bool _prevenir = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _proposer();
  }

  Future<void> _proposer() async {
    try {
      final r = await ref.read(calendrierRepositoryProvider).action({'action': 'proposer', 'workerIds': _worker.isEmpty ? <String>[] : [_worker], 'jours': _jours, 'apres': _s(widget.lot?['apres'])});
      if (mounted) setState(() => _debut = _s((r['creneau'] as Map?)?['debut']));
    } catch (_) {/* proposition indisponible : date à choisir */}
  }

  Future<void> _planifier() async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(calendrierRepositoryProvider).action({'action': 'planifier-lot', 'projectId': _projet, 'lot': _lot, 'workerIds': _worker.isEmpty ? <String>[] : [_worker], 'debut': _debut, 'jours': _jours, 'creneau': 'journee', 'prevenir': _prevenir});
      widget.onFait();
      if (mounted) {
        Navigator.of(context).pop();
        showFacturesMessage(context, '$_lot planifié du ${jourLong(_s(r['debut']))} au ${jourLong(_s(r['fin']))}.');
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
    final chantiers = _liste(widget.d['chantiers']);
    final lots = (chantiers.where((c) => c['projectId'] == _projet).firstOrNull?['lots'] as List? ?? const []).map((x) => '$x').toList();
    final workers = _liste(widget.d['workers']);
    final docs = _liste(widget.d['documents']).where((x) => x['workerId'] == _worker).toList();
    final nomWorker = _s(workers.where((w) => w['id'] == _worker).firstOrNull?['name']);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('Planifier un lot', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(
            initialValue: chantiers.any((c) => c['projectId'] == _projet) ? _projet : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Chantier', isDense: true),
            items: [for (final c in chantiers) DropdownMenuItem(value: _s(c['projectId']), child: Text(_s(c['title'])))],
            onChanged: (v) => setState(() {
              _projet = v ?? '';
              _lot = '';
            }),
          ),
          DropdownButtonFormField<String>(
            initialValue: lots.contains(_lot) ? _lot : null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Lot', isDense: true),
            items: [for (final l in lots) DropdownMenuItem(value: l, child: Text(l))],
            onChanged: (v) => setState(() => _lot = v ?? ''),
          ),
          DropdownButtonFormField<String>(
            initialValue: workers.any((w) => w['id'] == _worker) ? _worker : '',
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Intervenant', isDense: true),
            items: [const DropdownMenuItem(value: '', child: Text('À attribuer')), for (final w in workers) DropdownMenuItem(value: _s(w['id']), child: Text('${w['name']}${w['type'] == 'Sous-traitant' ? ' · sous-traitant' : ''}'))],
            onChanged: (v) {
              setState(() => _worker = v ?? '');
              _proposer();
            },
          ),
          const SizedBox(height: 10),
          if (_debut.isNotEmpty) KojiAlertBox(title: 'Proposé : ${jourLong(_debut)}', message: [if (_s(widget.lot?['lotPrecedent']).isNotEmpty) 'Après ${widget.lot!['lotPrecedent']}', if (nomWorker.isNotEmpty) '$nomWorker est libre'].join(', ').ifEmptyDot(), tone: KojiTone.grey),
          Row(children: [
            Expanded(child: Text('Durée : $_jours jour${_jours > 1 ? 's' : ''} ouvré${_jours > 1 ? 's' : ''}', style: TextStyle(color: p.heading))),
            IconButton(onPressed: _jours > 1 ? () => setState(() => _jours -= 1) : null, icon: const Icon(Icons.remove)),
            IconButton(onPressed: () => setState(() => _jours += 1), icon: const Icon(Icons.add)),
          ]),
          for (final x in docs) Text('${x['nom']} : ${x['texte']} · à demander', style: TextStyle(fontSize: 12.5, color: p.toneFg(KojiTone.coral))),
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _prevenir, onChanged: (v) => setState(() => _prevenir = v), title: Text('Prévenir ${nomWorker.isEmpty ? 'l\'intervenant' : nomWorker}')),
          KojiButton(label: 'Planifier', expand: true, loading: _busy, onPressed: _busy || _lot.isEmpty || _debut.isEmpty ? null : _planifier),
          TextButton(onPressed: () => context.push('/calendrier/new-event'), child: const Text('Un rendez-vous plutôt')),
        ]),
      ),
    );
  }
}

extension on String {
  String ifEmptyDot() => isEmpty ? '' : '$this.';
}

// ---------------------------------------------------------------------------
// Planning d'un chantier (liste des lots et mini-frise).
// ---------------------------------------------------------------------------
class PlanningChantierScreen extends ConsumerWidget {
  const PlanningChantierScreen({super.key, required this.projectId, this.titre = ''});
  final String projectId;
  final String titre;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(tachesChantierProvider(projectId));
    final p = context.koji;
    if (!async.hasValue) {
      return KojiPage(title: titre.isEmpty ? 'Planning' : titre, appBarOnPhone: true, main: [async.hasError ? KojiEmptyState(title: 'Planning indisponible', subtitle: errorText(async.error!), icon: KojiIcons.calendrier) : const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    }
    final lots = <String, Json>{};
    for (final t in async.value!) {
      final d = _s(t['startDate']).isNotEmpty ? _s(t['startDate']) : _s(t['dueDate']);
      if (d.isEmpty) continue;
      final f = _s(t['endDate']).isNotEmpty ? _s(t['endDate']) : d;
      final cle = _s(t['room']).isNotEmpty ? _s(t['room']) : _s(t['label']);
      final l = lots.putIfAbsent(cle, () => {'lot': cle, 'debut': d, 'fin': f, 'faites': 0, 'total': 0});
      if (d.compareTo(_s(l['debut'])) < 0) l['debut'] = d;
      if (f.compareTo(_s(l['fin'])) > 0) l['fin'] = f;
      l['total'] = (l['total'] as int) + 1;
      if (t['done'] == true) l['faites'] = (l['faites'] as int) + 1;
    }
    final liste = lots.values.toList()..sort((a, b) => _s(a['debut']).compareTo(_s(b['debut'])));
    final faits = liste.where((l) => l['faites'] == l['total']).length;
    final enCours = liste.where((l) => l['faites'] != l['total'] && _s(l['debut']).compareTo(isoDe(DateTime.now())) <= 0).length;
    return KojiPage(
      title: titre.isEmpty ? 'Planning' : titre,
      subtitle: 'Planning du chantier',
      appBarOnPhone: true,
      main: [
        KojiKpiRow(children: [
          KojiKpi(label: 'Avancement', value: '$faits / ${liste.length}'),
          KojiKpi(label: 'En cours', value: '$enCours lot${enCours > 1 ? 's' : ''}'),
          KojiKpi(label: 'Fin prévue', value: liste.isEmpty ? '—' : jourCourt(liste.map((l) => _s(l['fin'])).reduce((a, b) => a.compareTo(b) > 0 ? a : b))),
        ]),
        if (liste.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.calendrier, title: 'Aucun lot daté', subtitle: 'Planifiez les lots depuis le calendrier.'),
        for (final l in liste)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_s(l['lot']), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: l['faites'] == l['total'] ? p.faint : p.heading)),
                Text(l['faites'] == l['total'] ? 'terminé' : '${l['faites']} / ${l['total']} tâches faites', style: TextStyle(fontSize: 12, color: p.muted)),
              ])),
              Text('${jourCourt(l['debut'])} → ${jourCourt(l['fin'])}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: p.heading)),
            ]),
          ),
        KojiButton(
          label: 'Exporter en PDF',
          variant: KojiButtonVariant.secondary,
          expand: true,
          onPressed: () => launchUrl(Uri.parse('${KojiWebApiConfig.baseUrl}/calendrier/export?model=chantier&project=$projectId'), mode: LaunchMode.externalApplication),
        ),
      ],
    );
  }
}
