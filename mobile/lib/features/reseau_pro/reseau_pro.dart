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
import 'package:koji/features/depenses/depenses_logic.dart' show Json, euro0, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;

// Réseau pro dans Koji Pro (maquettes PRO-14 et 14.1, téléphone) sur l'API
// du site (/api/reseau, /api/sous-traitance) : besoins de sous-traitance,
// pros disponibles, échanges, pro retenu, contrat de sous-traitance préparé
// par Koji. Offres Pro et Business ; Start voit la vitrine.
const reseauProRoute = '/reseau-pro';
String echangeReseauRoute(String id) => '/reseau-pro/echange/$id';
String contratReseauRoute(String id) => '/reseau-pro/contrat/$id';

final reseauRepositoryProvider = Provider<ReseauRepository>((ref) => ReseauRepository(ref.watch(kojiProApiProvider)));
final reseauProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(reseauRepositoryProvider).reseau());
final contratReseauProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(reseauRepositoryProvider).contrat(id));

class ReseauRepository {
  ReseauRepository(this._api);
  final KojiProApi _api;

  Future<Json> reseau() => _api.get('/api/reseau');
  Future<Json> agir(Json corps) => _api.post('/api/reseau', corps);
  Future<Json> contrat(String id) => _api.get('/api/sous-traitance', query: {'id': id});
  Future<Json> preparerContrat(String echangeId) => _api.post('/api/sous-traitance', {'action': 'preparer', 'echangeId': echangeId});
  Future<Json> majContrat(String id, Json corps) => _api.patch('/api/sous-traitance', {'id': id, ...corps});
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _km(Object? v) => v == null ? '' : '${num2(v).toStringAsFixed(1).replaceAll('.', ',')} km';
String _dates(Json b) {
  final d = _s(b['startDate']);
  final f = _s(b['endDate']);
  if (d.isEmpty) return 'dates à convenir';
  return f.isNotEmpty && f != d ? '${jourCourt(d)} → ${jourCourt(f)}' : jourCourt(d);
}

Widget _attente(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) return KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(a.error!), icon: KojiIcons.contacts)]);
  return KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
}

class ReseauProScreen extends ConsumerStatefulWidget {
  const ReseauProScreen({super.key});

  @override
  ConsumerState<ReseauProScreen> createState() => _ReseauProScreenState();
}

class _ReseauProScreenState extends ConsumerState<ReseauProScreen> {
  String _onglet = 'besoins';
  String _metier = '';
  bool _busy = false;

  Future<Json?> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(reseauRepositoryProvider).agir(corps);
      ref.invalidate(reseauProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
      return r;
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
      return null;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _message(String titre, {String hint = ''}) {
    final ctrl = TextEditingController();
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(titre, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          KojiField(label: 'Message', controller: ctrl, hint: hint, maxLines: 4),
          const SizedBox(height: 12),
          KojiButton(label: 'Envoyer', expand: true, onPressed: () => Navigator.pop(ctx, ctrl.text.trim())),
        ]),
      ),
    );
  }

  Future<void> _contacter(Json cible, {required bool besoin}) async {
    final t = await _message(besoin ? 'Répondre au besoin' : 'Contacter ${cible['companyName']}', hint: besoin ? 'Disponibilités, prix proposé, questions…' : 'Présentez votre demande');
    if (t == null || t.isEmpty) return;
    final r = await _agir({'action': 'contacter', 'text': t, if (besoin) 'besoinId': cible['id'] else 'profilId': cible['id']});
    final id = _s(_map(r?['echange'])['id']);
    if (id.isNotEmpty && mounted) context.push(echangeReseauRoute(id));
  }

  Future<void> _publier(Json d, {Json? lot}) async {
    final me = _map(d['me']);
    final titre = TextEditingController(text: _s(lot?['lot']));
    final metier = TextEditingController(text: (me['professions'] as List? ?? const []).isNotEmpty ? '${(me['professions'] as List).first}' : '');
    final budget = TextEditingController(text: num2(lot?['moHt']) > 0 ? '${num2(lot?['moHt']).round()}' : '');
    final message = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Publier un besoin', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            if (lot != null) ...[const SizedBox(height: 6), Text('Depuis le chantier ${lot['projectTitle']} · ${lot['lot']}${num2(lot['totalHt']) > 0 ? ' · ${euro0(num2(lot['totalHt']))} HT au devis' : ''}', style: const TextStyle(fontSize: 13))],
            const SizedBox(height: 12),
            KojiField(label: 'Besoin', controller: titre, hint: 'Création alimentation et évacuation'),
            const SizedBox(height: 10),
            KojiField(label: 'Métier', controller: metier, hint: 'Plomberie'),
            const SizedBox(height: 10),
            KojiField(label: "Budget main-d'œuvre HT · indicatif", controller: budget, keyboardType: TextInputType.number),
            const SizedBox(height: 10),
            KojiField(label: 'Message', controller: message, hint: 'Accès, contraintes, date de démarrage…', maxLines: 3),
            const SizedBox(height: 6),
            const Text('Le nom du chantier est masqué aux autres pros.', style: TextStyle(fontSize: 12)),
            const SizedBox(height: 12),
            KojiButton(label: 'Publier', expand: true, onPressed: () => Navigator.pop(ctx, true)),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    await _agir({
      'action': 'besoin', 'title': titre.text.trim(), 'metier': metier.text.trim(), 'budgetHt': budget.text.trim(), 'message': message.text.trim(), 'city': _s(me['city']), 'hideClient': true,
      if (lot != null) ...{'projectId': lot['projectId'], 'projectTitle': lot['projectTitle'], 'lotLabel': lot['lot'], 'startDate': lot['debut'], 'endDate': lot['fin']},
    }, ok: 'Besoin publié dans le Réseau pro.');
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(reseauProvider);
    if (!a.hasValue) return _attente('Réseau pro', a);
    final p = context.koji;
    final d = a.value!;
    if (d['locked'] == true) {
      final v = _map(d['vitrine']);
      final total = num2(v['total']).round();
      return KojiPage(title: 'Réseau pro', subtitle: 'Entre professionnels, à partir de Pro', appBarOnPhone: true, main: [
        KojiCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const KojiPill('Pro', tone: KojiTone.navy),
            const SizedBox(height: 8),
            Text(total > 0 ? '$total pro${total > 1 ? 's' : ''} dans le réseau' : 'Le réseau des pros Koji', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: p.heading)),
            if (_liste(v['parMetier']).isNotEmpty) Text(_liste(v['parMetier']).map((m) => '${m['metier']} ${num2(m['n']).round()}').join(' · '), style: TextStyle(color: p.muted)),
            const SizedBox(height: 6),
            Text('Publiez un besoin, trouvez un sous-traitant, proposez vos disponibilités. Sans jetons, sans quota. Le changement d\'offre se fait sur le site.', style: TextStyle(fontSize: 13, color: p.muted)),
          ]),
        ),
        const KojiSectionTitle('Comment ça marche'),
        for (final e in const [['1', 'Publiez un besoin', 'Depuis un lot de chantier ou librement'], ['2', 'Recevez des réponses', 'Kbis, URSSAF, décennale : dates déclarées par chaque entreprise'], ['3', 'Affectez le pro au lot', 'Il entre dans vos Contacts, avec son contrat']])
          ListTile(contentPadding: EdgeInsets.zero, leading: CircleAvatar(radius: 14, child: Text(e[0])), title: Text(e[1]), subtitle: Text(e[2])),
      ]);
    }
    final besoins = _liste(d['besoins']);
    final pros = _liste(d['pros']);
    final echanges = _liste(d['echanges']);
    final lots = _liste(d['lots']).where((l) => l['publie'] != true).toList();
    final metiers = <String>{for (final b in besoins) _s(b['metier']), for (final x in pros) ...((x['metiers'] as List? ?? const []).map((m) => '$m'))}.where((m) => m.isNotEmpty).take(4).toList();
    bool garde(String m) => _metier.isEmpty || m.toLowerCase().contains(_metier.toLowerCase());
    final vb = besoins.where((b) => garde(_s(b['metier']))).toList();
    final vp = pros.where((x) => _metier.isEmpty || (x['metiers'] as List? ?? const []).any((m) => garde('$m'))).toList();
    return KojiPage(
      title: 'Réseau pro',
      subtitle: 'Entre professionnels · sans jetons',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(reseauProvider);
        await ref.read(reseauProvider.future);
      },
      main: [
        KojiButton(label: 'Publier un besoin', expand: true, leadingIcon: KojiIcons.plus, onPressed: _busy ? null : () => _publier(d)),
        KojiSegmented<String>(options: {'besoins': 'Besoins ${vb.length}', 'pros': 'Pros ${vp.length}', 'echanges': 'Échanges ${echanges.length}'}, value: _onglet, onChanged: (v) => setState(() => _onglet = v)),
        if (_onglet != 'echanges' && metiers.isNotEmpty) KojiFilterChips<String>(options: {'': 'Tous métiers', for (final m in metiers) m: m}, value: _metier, onChanged: (v) => setState(() => _metier = v)),
        if (_onglet == 'besoins') ...[
          if (vb.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.contacts, title: 'Aucun besoin', subtitle: 'Publiez le vôtre : il apparaîtra ici pour les pros du réseau.'),
          for (final b in vb)
            KojiCard(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${b['metier']} · ${b['title']}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                Text(['${num2(b['days']).round()} j', _dates(b), _s(b['city']), _km(b['distanceKm'])].where((x) => x.isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
                Text(b['mine'] == true ? 'Votre besoin' : _s(b['companyName']), style: TextStyle(fontSize: 12.5, color: p.muted)),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: Text(num2(b['budgetHt']) > 0 ? '${euro0(num2(b['budgetHt']))} HT' : 'budget à proposer', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading))),
                  if (b['mine'] == true)
                    KojiButton(label: 'Réponses (${num2(b['responses']).round()})', variant: KojiButtonVariant.secondary, height: 36, onPressed: num2(b['responses']) > 0 ? () => setState(() => _onglet = 'echanges') : null)
                  else if (_s(b['myEchangeId']).isNotEmpty)
                    KojiButton(label: "Voir l'échange", variant: KojiButtonVariant.secondary, height: 36, onPressed: () => context.push(echangeReseauRoute(_s(b['myEchangeId']))))
                  else
                    KojiButton(label: 'Répondre', variant: KojiButtonVariant.secondary, height: 36, onPressed: _busy ? null : () => _contacter(b, besoin: true)),
                ]),
              ]),
            ),
          if (lots.isNotEmpty) ...[
            const KojiSectionTitle('Mes lots sans intervenant'),
            for (final l in lots)
              ListTile(contentPadding: EdgeInsets.zero, title: Text(_s(l['lot'])), subtitle: Text(_s(l['projectTitle'])), trailing: TextButton(onPressed: _busy ? null : () => _publier(d, lot: l), child: const Text('Sous-traiter'))),
          ],
        ],
        if (_onglet == 'pros') ...[
          if (vp.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.contacts, title: 'Aucun pro visible', subtitle: 'Les entreprises apparaissent ici quand elles activent leur profil réseau.'),
          for (final x in vp)
            KojiCard(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(x['companyName']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                  KojiPill(x['documentsOk'] == true ? 'Documents à jour' : 'Documents à jour requis', tone: x['documentsOk'] == true ? KojiTone.green : KojiTone.grey),
                  Text([(x['metiers'] as List? ?? const []).join(', '), _s(x['zone']), _km(x['distanceKm'])].where((v) => v.isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
                  if (_s(x['availableFrom']).isNotEmpty) Text('Disponible dès le ${jourCourt(x['availableFrom'])}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                ])),
                KojiButton(label: 'Contacter', variant: KojiButtonVariant.secondary, height: 36, onPressed: _busy ? null : () => _contacter(x, besoin: false)),
              ]),
            ),
        ],
        if (_onglet == 'echanges') ...[
          if (echanges.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.messages, title: 'Aucun échange', subtitle: 'Répondez à un besoin ou contactez un pro pour en démarrer un.'),
          for (final e in echanges)
            KojiCard(
              onTap: () => context.push(echangeReseauRoute(_s(e['id']))),
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(_map(e['other'])['companyName']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                  Text(_s(e['besoinTitle']).isEmpty ? 'Contact direct' : _s(e['besoinTitle']), style: TextStyle(fontSize: 12.5, color: p.muted)),
                  if (_liste(e['messages']).isNotEmpty) Text('${_liste(e['messages']).last['mine'] == true ? 'Vous : ' : ''}${_liste(e['messages']).last['text']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: p.muted)),
                ])),
                if (e['status'] == 'retenu') const KojiPill('Retenu', tone: KojiTone.navy),
              ]),
            ),
        ],
        Text('Documents : dates déclarées par chaque entreprise. Un échange déplacé se signale à Koji depuis le fil.', style: TextStyle(fontSize: 12, color: p.faint)),
      ],
    );
  }
}

class EchangeReseauScreen extends ConsumerStatefulWidget {
  const EchangeReseauScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<EchangeReseauScreen> createState() => _EchangeReseauScreenState();
}

class _EchangeReseauScreenState extends ConsumerState<EchangeReseauScreen> {
  final _texte = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _texte.dispose();
    super.dispose();
  }

  Future<void> _faire(Future<Json> Function() appel, {String? ok, void Function(Json r)? apres}) async {
    setState(() => _busy = true);
    try {
      final r = await appel();
      ref.invalidate(reseauProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
      apres?.call(r);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(reseauProvider);
    if (!a.hasValue) return _attente('Échange', a);
    final p = context.koji;
    final e = _liste(a.value!['echanges']).firstWhere((x) => x['id'] == widget.id, orElse: () => <String, dynamic>{});
    if (e.isEmpty) return const KojiPage(title: 'Échange', appBarOnPhone: true, main: [KojiEmptyState(title: 'Échange introuvable', subtitle: 'Il a peut-être été fermé.', icon: KojiIcons.messages)]);
    final repo = ref.read(reseauRepositoryProvider);
    final nom = _s(_map(e['other'])['companyName']);
    final retenu = e['status'] == 'retenu';
    return KojiPage(
      title: nom,
      subtitle: _s(e['besoinTitle']).isEmpty ? 'Contact direct' : 'À propos de : ${e['besoinTitle']}',
      appBarOnPhone: true,
      main: [
        if (retenu) const KojiPill('Retenu', tone: KojiTone.navy),
        for (final m in _liste(e['messages']))
          Align(
            alignment: m['mine'] == true ? Alignment.centerRight : Alignment.centerLeft,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 300),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                decoration: BoxDecoration(color: m['mine'] == true ? p.heading : p.lineSoft, borderRadius: BorderRadius.circular(4)),
                child: Text(_s(m['text']), style: TextStyle(fontSize: 14, color: m['mine'] == true ? p.surface : p.heading)),
              ),
            ),
          ),
        KojiField(label: 'Votre message', controller: _texte, maxLines: 3),
        KojiButton(
          label: 'Envoyer',
          expand: true,
          loading: _busy,
          onPressed: _busy
              ? null
              : () {
                  final t = _texte.text.trim();
                  if (t.isEmpty) return;
                  _texte.clear();
                  _faire(() => repo.agir({'action': 'message', 'echangeId': widget.id, 'text': t}));
                },
        ),
        if (e['iOwnBesoin'] == true && !retenu)
          KojiButton(label: 'Retenir ce pro', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _faire(() => repo.agir({'action': 'retenir', 'echangeId': widget.id}), ok: '$nom est retenu et ajouté à vos Contacts.')),
        if (e['iOwnBesoin'] == true && retenu)
          KojiButton(
            label: 'Préparer le contrat',
            variant: KojiButtonVariant.secondary,
            expand: true,
            onPressed: _busy ? null : () => _faire(() => repo.preparerContrat(widget.id), apres: (r) { if (mounted && _s(r['id']).isNotEmpty) context.push(contratReseauRoute(_s(r['id']))); }),
          ),
        TextButton(
          onPressed: _busy
              ? null
              : () async {
                  final ctrl = TextEditingController();
                  final motif = await showDialog<String>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Signaler à Koji'),
                      content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(hintText: 'Que voulez-vous signaler ?')),
                      actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')), TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Signaler'))],
                    ),
                  );
                  if (motif != null && motif.isNotEmpty) await _faire(() => repo.agir({'action': 'signaler', 'echangeId': widget.id, 'motif': motif}), ok: "Signalement envoyé à l'équipe Koji.");
                },
          child: const Text('Signaler'),
        ),
      ],
    );
  }
}

/// Contrat de sous-traitance (maquette PRO-14.1).
class ContratReseauScreen extends ConsumerStatefulWidget {
  const ContratReseauScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<ContratReseauScreen> createState() => _ContratReseauScreenState();
}

class _ContratReseauScreenState extends ConsumerState<ContratReseauScreen> {
  String _busy = '';

  Future<void> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = '${corps['action']}');
    try {
      await ref.read(reseauRepositoryProvider).majContrat(widget.id, corps);
      ref.invalidate(contratReseauProvider(widget.id));
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _modifier(Json c) async {
    final prix = TextEditingController(text: num2(c['prixHt']) > 0 ? '${num2(c['prixHt'])}'.replaceAll(RegExp(r'\.0$'), '') : '');
    final paiement = TextEditingController(text: _s(c['paiement']));
    DateTimeRange? dates = DateTime.tryParse(_s(c['debut'])) != null ? DateTimeRange(start: DateTime.parse(_s(c['debut'])), end: DateTime.tryParse(_s(c['fin'])) ?? DateTime.parse(_s(c['debut']))) : null;
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, maj) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Conditions', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            KojiField(label: 'Prix HT', controller: prix, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
            const SizedBox(height: 10),
            KojiField(label: 'Paiement', controller: paiement),
            const SizedBox(height: 10),
            KojiButton(
              label: dates == null ? 'Choisir les dates' : '${jourCourt(dates!.start.toIso8601String())} → ${jourCourt(dates!.end.toIso8601String())}',
              variant: KojiButtonVariant.secondary,
              onPressed: () async {
                final now = DateTime.now();
                final r = await showDateRangePicker(context: ctx, firstDate: now.subtract(const Duration(days: 30)), lastDate: now.add(const Duration(days: 365)), initialDateRange: dates, locale: const Locale('fr'));
                if (r != null) maj(() => dates = r);
              },
            ),
            const SizedBox(height: 12),
            KojiButton(label: 'Enregistrer', expand: true, onPressed: () => Navigator.pop(ctx, true)),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    String j(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
    await _agir({'action': 'modifier', 'prixHt': prix.text.trim().replaceAll(',', '.'), 'paiement': paiement.text.trim(), if (dates != null) 'debut': j(dates!.start), if (dates != null) 'fin': j(dates!.end)}, ok: 'Conditions enregistrées.');
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(contratReseauProvider(widget.id));
    if (!a.hasValue) return _attente('Contrat de sous-traitance', a);
    final p = context.koji;
    final c = _map(a.value!['contrat']);
    final etat = _s(_map(c['etat'])['cle']);
    final manques = (c['manques'] as List? ?? const []).map((x) => '$x').toList();
    final occupe = _busy.isNotEmpty;
    return KojiPage(
      title: 'Contrat de sous-traitance',
      subtitle: [c['chantier'], c['lot']].where((v) => _s(v).isNotEmpty).join(' · '),
      appBarOnPhone: true,
      main: [
        const Row(children: [Expanded(child: KojiSectionTitle('Préparé par Koji')), KojiPill('modèle à faire valider', tone: KojiTone.grey)]),
        for (final l in (c['lignes'] as List? ?? const [])) FactureKv('${(l as List)[0]}', '${l[1]}'),
        if (manques.isNotEmpty) KojiAlertBox(title: 'À compléter', message: 'Avant l\'envoi : ${manques.join(', ')}.', tone: KojiTone.amber),
        if (etat != 'accepte') KojiButton(label: 'Modifier les conditions', variant: KojiButtonVariant.secondary, expand: true, onPressed: occupe ? null : () => _modifier(c)),
        KojiButton(label: _s(c['envoyeLe']).isEmpty ? 'Envoyer à ${c['sousTraitant']}' : 'Renvoyer à ${c['sousTraitant']}', expand: true, loading: _busy == 'envoyer', onPressed: occupe || manques.isNotEmpty ? null : () => _agir({'action': 'envoyer'}, ok: 'Conditions envoyées.')),
        TextButton(onPressed: () => launchUrl(Uri.parse('${KojiWebApiConfig.baseUrl}/reseau-pro/contrat?id=${widget.id}'), mode: LaunchMode.externalApplication), child: const Text('Aperçu PDF sur le site')),
        const KojiSectionTitle('Acceptation par le client'),
        FactureKv('Sous-traitant présenté', _s(c['presenteLe']).isEmpty ? 'pas encore' : 'Koji Client · ${jourCourt(c['presenteLe'])}'),
        FactureKv('Accord du client', _s(c['accepteLe']).isNotEmpty ? 'accepté le ${jourCourt(c['accepteLe'])}' : _s(c['refuseLe']).isNotEmpty ? 'refusé le ${jourCourt(c['refuseLe'])}' : _s(c['presenteLe']).isNotEmpty ? 'en attente${_s(c['relance']).isNotEmpty ? ' · relance le ${jourCourt(c['relance'])}' : ''}' : 'après la présentation'),
        if (_s(c['presenteLe']).isEmpty)
          KojiButton(label: 'Présenter au client', variant: KojiButtonVariant.secondary, expand: true, loading: _busy == 'presenter', onPressed: occupe || manques.isNotEmpty ? null : () => _agir({'action': 'presenter'}, ok: 'Sous-traitant présenté au client.'))
        else if (_s(c['accepteLe']).isEmpty && _s(c['refuseLe']).isEmpty)
          KojiButton(label: 'Relancer le client', variant: KojiButtonVariant.secondary, expand: true, onPressed: occupe ? null : () => _agir({'action': 'relancer'}, ok: 'Client relancé.')),
        Text("Le sous-traitant doit être accepté et ses conditions de paiement agréées par le client (loi du 31 décembre 1975, art. 3).", style: TextStyle(fontSize: 12, color: p.faint)),
        const KojiSectionTitle('Garantie de paiement'),
        for (final g in _map(c['garanties']).entries)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(c['garantie'] == g.key ? Icons.radio_button_checked : Icons.radio_button_unchecked),
            title: Text('${g.value}'),
            onTap: occupe ? null : () => _agir({'action': 'garantie', 'garantie': g.key}),
          ),
        Text('À choisir avant le début des travaux du sous-traitant.', style: TextStyle(fontSize: 12, color: p.faint)),
      ],
    );
  }
}

