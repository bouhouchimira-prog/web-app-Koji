import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, num2;
import 'package:koji/features/factures/factures_widgets.dart' show errorText, showFacturesMessage;

// Messages de Koji Pro (maquette PRO-12, téléphone) sur l'API du site
// (/api/messages) : conversations des devis et du Radar, non lus, fil avec
// le contexte du chantier, Koji qui propose de reporter une information
// (l'artisan valide), réponses enregistrées.
const messagesProRoute = '/messages';
String filRoute(String cle) => '/messages/fil/${Uri.encodeComponent(cle)}';

final messagesRepositoryProvider = Provider<MessagesRepository>((ref) => MessagesRepository(ref.watch(kojiProApiProvider)));
final conversationsProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(messagesRepositoryProvider).liste());
final filProvider = FutureProvider.autoDispose.family<Json, String>((ref, cle) => ref.watch(messagesRepositoryProvider).fil(cle));

class MessagesRepository {
  MessagesRepository(this._api);
  final KojiProApi _api;

  Future<Json> liste() => _api.get('/api/messages');
  Future<Json> fil(String cle) => _api.get('/api/messages', query: {'fil': cle});
  Future<Json> envoyer(Json fil, String texte) => _s(fil['leadId']).isNotEmpty
      ? _api.post('/api/kojipage/demandes', {'action': 'repondre', 'id': fil['leadId'], 'texte': texte})
      : _s(fil['quoteId']).isNotEmpty
      ? _api.post('/api/quotes/${fil['quoteId']}/messages', {'texte': texte})
      : _api.post('/api/marketplace/offres/${fil['offreId']}/messages', {'message': texte});
  Future<Json> suggestion(String cle, String decision) => _api.patch('/api/messages', {'action': 'suggestion', 'fil': cle, 'decision': decision});
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
String _s(Object? v) => v == null ? '' : '$v';

class MessagesProScreen extends ConsumerStatefulWidget {
  const MessagesProScreen({super.key});

  @override
  ConsumerState<MessagesProScreen> createState() => _MessagesProScreenState();
}

class _MessagesProScreenState extends ConsumerState<MessagesProScreen> {
  String _filtre = 'tous';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(conversationsProvider);
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Messages', appBarOnPhone: true, main: [KojiEmptyState(title: 'Messages indisponibles', subtitle: errorText(async.error!), icon: KojiIcons.messages)]);
    if (!async.hasValue) return const KojiPage(title: 'Messages', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final p = context.koji;
    final d = async.value!;
    final k = Map<String, dynamic>.from(d['compteurs'] as Map? ?? const {});
    final q = _q.trim().toLowerCase();
    final fils = _liste(d['fils']).where((f) {
      final ok = _filtre == 'tous' || (_filtre == 'nonlus' && num2(f['nonLus']) > 0) || (_filtre == 'clients' && f['pro'] != true) || (_filtre == 'pros' && f['pro'] == true);
      return ok && (q.isEmpty || '${f['titre']} ${f['sousTitre']} ${(f['dernier'] as Map?)?['texte'] ?? ''}'.toLowerCase().contains(q));
    }).toList()
      ..sort((a, b) => _s((b['dernier'] as Map?)?['le']).compareTo(_s((a['dernier'] as Map?)?['le'])));
    final nonLus = num2(k['nonLus']).round();
    return KojiPage(
      title: 'Messages',
      subtitle: nonLus > 0 ? '$nonLus non lu${nonLus > 1 ? 's' : ''}' : 'tout est lu',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(conversationsProvider);
        await ref.read(conversationsProvider.future);
      },
      main: [
        TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Nom, chantier, mot', isDense: true), onChanged: (v) => setState(() => _q = v)),
        KojiFilterChips<String>(
          options: {'tous': 'Tous', 'nonlus': 'Non lus${num2(k['filsNonLus']) > 0 ? ' ${num2(k['filsNonLus']).round()}' : ''}', 'clients': 'Clients', 'pros': 'Pros'},
          value: _filtre,
          onChanged: (v) => setState(() => _filtre = v),
        ),
        if (fils.isEmpty)
          KojiEmptyState(compact: true, icon: KojiIcons.messages, title: 'Aucune conversation', subtitle: _filtre == 'pros' ? 'Les échanges avec les sous-traitants et les fournisseurs arriveront avec le Réseau pro.' : 'Vos clients vous écrivent depuis leur devis ; les demandes du Radar arrivent ici aussi.'),
        for (final f in fils)
          InkWell(
            onTap: () async {
              await context.push(filRoute(_s(f['cle'])));
              ref.invalidate(conversationsProvider);
            },
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(width: 36, height: 36, alignment: Alignment.center, decoration: BoxDecoration(color: p.lineSoft, borderRadius: BorderRadius.circular(4)), child: Text(_s(f['initiales']), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: p.heading))),
                const SizedBox(width: 10),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(_s(f['titre']), overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: num2(f['nonLus']) > 0 ? FontWeight.w800 : FontWeight.w500, color: p.heading))),
                    Text(_s((f['dernier'] as Map?)?['quand']), style: TextStyle(fontSize: 11.5, fontWeight: num2(f['nonLus']) > 0 ? FontWeight.w800 : FontWeight.w400, color: num2(f['nonLus']) > 0 ? p.heading : p.faint)),
                  ]),
                  Text('${(f['dernier'] as Map?)?['entreprise'] == true ? 'Vous : ' : ''}${(f['dernier'] as Map?)?['texte'] ?? ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 13, color: num2(f['nonLus']) > 0 ? p.heading : p.muted)),
                  Text(_s(f['sousTitre']), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: p.faint)),
                ])),
              ]),
            ),
          ),
      ],
    );
  }
}

class FilScreen extends ConsumerStatefulWidget {
  const FilScreen({super.key, required this.cle});
  final String cle;

  @override
  ConsumerState<FilScreen> createState() => _FilScreenState();
}

class _FilScreenState extends ConsumerState<FilScreen> {
  final _texte = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _texte.dispose();
    super.dispose();
  }

  Future<void> _faire(Future<Json> Function() appel, {String? ok}) async {
    setState(() => _busy = true);
    try {
      await appel();
      ref.invalidate(filProvider(widget.cle));
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(filProvider(widget.cle));
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Conversation', appBarOnPhone: true, main: [KojiEmptyState(title: 'Conversation indisponible', subtitle: errorText(async.error!), icon: KojiIcons.messages)]);
    if (!async.hasValue) return const KojiPage(title: 'Conversation', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final p = context.koji;
    final d = async.value!;
    final fil = Map<String, dynamic>.from(d['fil'] as Map);
    final ctx = Map<String, dynamic>.from(d['contexte'] as Map? ?? const {});
    final s = d['suggestion'] as Map?;
    final rapides = <String>[...((s?['reponses'] as List?) ?? const []).map((x) => '$x'), ...((d['reponses'] as List?) ?? const []).map((x) => '$x')].take(4).toList();
    final repo = ref.read(messagesRepositoryProvider);
    return KojiPage(
      title: _s(fil['titre']),
      subtitle: _s(fil['sousTitre']),
      appBarOnPhone: true,
      main: [
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final e in _liste(ctx['etiquettes'])) KojiPill(_s(e['texte']), tone: e['alerte'] == true ? KojiTone.coral : KojiTone.grey),
        ]),
        for (final j in _liste(d['jours'])) ...[
          Center(child: Text(_s(j['titre']), style: TextStyle(fontSize: 11.5, color: p.faint))),
          for (final m in _liste(j['messages']))
            Align(
              alignment: m['entreprise'] == true ? Alignment.centerRight : Alignment.centerLeft,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Column(crossAxisAlignment: m['entreprise'] == true ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(color: m['entreprise'] == true ? p.heading : p.lineSoft, borderRadius: BorderRadius.circular(4)),
                    child: Text(_s(m['texte']), style: TextStyle(fontSize: 14, color: m['entreprise'] == true ? p.surface : p.heading)),
                  ),
                  Text(_s(m['heure']), style: TextStyle(fontSize: 11, color: p.faint)),
                ]),
              ),
            ),
        ],
        if (s != null && s['etat'] == 'propose') ...[
          KojiAlertBox(title: 'Koji', message: _s(s['resume']), tone: KojiTone.amber),
          Row(children: [
            Expanded(child: KojiButton(label: s['action'] == 'livraison' ? 'Mettre à jour' : 'Noter sur la fiche', onPressed: _busy ? null : () => _faire(() => repo.suggestion(widget.cle, 'appliquer'), ok: 'Mis à jour.'))),
            TextButton(onPressed: _busy ? null : () => _faire(() => repo.suggestion(widget.cle, 'ignorer')), child: const Text('Ignorer')),
          ]),
        ],
        if (rapides.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final r in rapides) ActionChip(label: Text(r), onPressed: () => setState(() => _texte.text = r))]),
        KojiField(label: 'Écrire à ${fil['titre']}', controller: _texte, maxLines: 3),
        KojiButton(
          label: 'Envoyer',
          expand: true,
          loading: _busy,
          onPressed: _busy
              ? null
              : () async {
                  final t = _texte.text.trim();
                  if (t.isEmpty) return;
                  _texte.clear();
                  await _faire(() => repo.envoyer(fil, t));
                },
        ),
      ],
    );
  }
}
