import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/factures/factures_widgets.dart' show errorText;

// Koji, assistant IA, dans l'app Koji Pro (maquettes PRO-18 à 18.2,
// téléphone) : plein écran, une question → un constat, les chiffres
// calculés par Koji, les sources, des actions à valider (rien ne part
// sans l'utilisateur) et trois suggestions. Même moteur que le site
// (/api/koji-assistant, mode question).
const _encre = Color(0xFF171B1E);
const _gris = Color(0xFF5B5F66);
const _or = Color(0xFFFFC400);

final kojiRepositoryProvider = Provider<KojiRepository>((ref) => KojiRepository(ref.watch(kojiProApiProvider)));

class KojiRepository {
  KojiRepository(this._api);
  final KojiProApi _api;
  Future<Json> question(String message, {String conversationId = '', String page = ''}) => _api.post('/api/koji-assistant', {
        'message': message,
        'mode': 'question',
        if (conversationId.isNotEmpty) 'conversationId': conversationId,
        if (page.isNotEmpty) 'pageContext': {'label': page},
      });
  Future<Json> messageClient(String quoteId, String texte) => _api.post('/api/quotes/${Uri.encodeComponent(quoteId)}/messages', {'texte': texte});
}

/// Les sources du site pointent vers des pages web ; celles qui existent
/// dans l'app s'ouvrent, les autres restent en texte.
String? routeApp(String href) {
  final u = Uri.tryParse(href);
  if (u == null) return null;
  if (u.path == '/equipe') return '/equipe';
  if (u.path.startsWith('/equipe/')) return '/equipe/fiche/${u.pathSegments.last}';
  if (u.path == '/facturation') return '/facturation';
  if (u.path == '/depenses/chantier' && (u.queryParameters['projet'] ?? '').isNotEmpty) return '/depenses/chantier/${u.queryParameters['projet']}';
  if (u.path == '/calendrier') return '/calendrier';
  if (u.path.startsWith('/interventions/rapide/')) return '/intervention-rapide/suivi/${u.pathSegments.last}';
  return null;
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
String _s(Object? v) => v == null ? '' : '$v';

/// Bouton flottant « Demander à Koji » (téléphone : 12 px du bord droit,
/// 88 px du bas, au-dessus de la barre d'onglets).
/// Nombre d'écrans ouverts qui demandent au bouton Koji de s'effacer.
final boutonKojiMasque = ValueNotifier<int>(0);

/// Pour un écran qui a son propre bouton en bas (valider, enregistrer) : le
/// bouton Koji s'efface tant que l'écran est ouvert (retours du build 64 : il
/// recouvrait « Valider la réception » et d'autres boutons).
mixin SansBoutonKoji<T extends StatefulWidget> on State<T> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => boutonKojiMasque.value++);
  }

  @override
  void dispose() {
    // Hors de la phase de démontage : l'app se redessine juste après.
    Future.microtask(() => boutonKojiMasque.value--);
    super.dispose();
  }
}

class KojiBoutonFlottant extends StatelessWidget {
  const KojiBoutonFlottant({super.key, this.page = ''});
  final String page;
  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: 'Demander à Koji, assistant IA',
        child: Material(
          color: _encre,
          shape: const RoundedRectangleBorder(side: BorderSide(color: Color(0xFFF5F5F1), width: 3)),
          child: InkWell(
            onTap: () => ouvrirKoji(context, page: page),
            child: const SizedBox(width: 52, height: 52, child: Icon(Icons.auto_awesome, color: _or, size: 22)),
          ),
        ),
      );
}

Future<void> ouvrirKoji(BuildContext context, {String question = '', String page = ''}) =>
    Navigator.of(context, rootNavigator: true).push(MaterialPageRoute(fullscreenDialog: true, builder: (_) => KojiAssistantScreen(question: question, page: page)));

class _Tour {
  _Tour(this.question);
  final String question;
  Json? reponse;
  String erreur = '';
}

class KojiAssistantScreen extends ConsumerStatefulWidget {
  const KojiAssistantScreen({super.key, this.question = '', this.page = ''});
  final String question;
  final String page;
  @override
  ConsumerState<KojiAssistantScreen> createState() => _KojiAssistantScreenState();
}

class _KojiAssistantScreenState extends ConsumerState<KojiAssistantScreen> {
  final _saisie = TextEditingController();
  final _defil = ScrollController();
  final _tours = <_Tour>[];
  late String _page = widget.page;
  final String _conversation = 'koji-conv-${DateTime.now().millisecondsSinceEpoch}-${Random().nextInt(99999)}';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    if (widget.question.isNotEmpty) WidgetsBinding.instance.addPostFrameCallback((_) => _demander(widget.question));
  }

  @override
  void dispose() {
    _saisie.dispose();
    _defil.dispose();
    super.dispose();
  }

  Future<void> _demander(String q) async {
    final t = q.trim();
    if (t.isEmpty || _busy) return;
    final tour = _Tour(t);
    setState(() {
      _tours.add(tour);
      _busy = true;
      _saisie.clear();
    });
    try {
      final r = await ref.read(kojiRepositoryProvider).question(t, conversationId: _conversation, page: _page);
      tour.reponse = r['reponse'] is Map ? Map<String, dynamic>.from(r['reponse'] as Map) : {'constat': _s(r['message']).isEmpty ? "Je n'ai pas compris la demande." : _s(r['message'])};
    } catch (e) {
      tour.erreur = errorText(e);
    } finally {
      if (mounted) setState(() => _busy = false);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_defil.hasClients) _defil.animateTo(_defil.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F1),
      appBar: AppBar(
        backgroundColor: _encre,
        foregroundColor: Colors.white,
        leading: IconButton(tooltip: 'Fermer', icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).maybePop()),
        title: const Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.auto_awesome, color: _or, size: 18),
          SizedBox(width: 6),
          Text('Koji', style: TextStyle(fontWeight: FontWeight.w700)),
          SizedBox(width: 6),
          Text('ASSISTANT IA', style: TextStyle(fontSize: 11, color: Color(0xFFC4C7CC), letterSpacing: .6)),
        ]),
      ),
      body: SafeArea(
        child: Column(children: [
          if (_page.isNotEmpty)
            Container(
              color: const Color(0xFFFAFAF7),
              padding: const EdgeInsets.fromLTRB(16, 6, 4, 6),
              child: Row(children: [
                const Text('Sur cette page  ', style: TextStyle(fontSize: 12, color: _gris)),
                Expanded(child: Text(_page, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                IconButton(tooltip: 'Retirer le contexte', icon: const Icon(Icons.close, size: 16), onPressed: () => setState(() => _page = '')),
              ]),
            ),
          Expanded(
            child: ListView(controller: _defil, padding: const EdgeInsets.all(16), children: [
              if (_tours.isEmpty) ...[
                const Text('Bonjour. Posez une question sur vos chantiers, devis, factures ou votre équipe.', style: TextStyle(fontSize: 15, height: 1.45)),
                const SizedBox(height: 12),
                for (final s in const ["Qu'est-ce qui m'attend aujourd'hui ?", "Qui me doit de l'argent ?", "Quels chantiers perdent de l'argent ?"])
                  Padding(padding: const EdgeInsets.only(bottom: 8), child: _Suggestion(s, onTap: () => _demander(s))),
              ],
              for (var k = 0; k < _tours.length; k++) ...[
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(margin: const EdgeInsets.only(bottom: 10, left: 40), padding: const EdgeInsets.all(10), color: _encre, child: Text(_tours[k].question, style: const TextStyle(color: Colors.white))),
                ),
                if (_tours[k].erreur.isNotEmpty) Text(_tours[k].erreur, style: const TextStyle(color: Color(0xFFB3261E))),
                if (_tours[k].reponse != null) KojiReponseVue(r: _tours[k].reponse!, dernier: k == _tours.length - 1, onAsk: _demander),
                if (_tours[k].reponse == null && _tours[k].erreur.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('Koji regarde vos données…', style: TextStyle(color: _gris))),
                const SizedBox(height: 14),
              ],
            ]),
          ),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 4),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _saisie,
                  minLines: 1,
                  maxLines: 4,
                  textInputAction: TextInputAction.send,
                  onSubmitted: _demander,
                  decoration: const InputDecoration(hintText: 'Écrire ou dicter à Koji…', border: InputBorder.none),
                ),
              ),
              IconButton(tooltip: 'Envoyer', icon: const Icon(Icons.send), onPressed: _busy ? null : () => _demander(_saisie.text)),
            ]),
          ),
          Container(
            width: double.infinity,
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: const Text("Koji, assistant IA · peut se tromper : vérifiez avant d'envoyer. Rien ne part sans vous.", style: TextStyle(fontSize: 11, color: _gris)),
          ),
        ]),
      ),
    );
  }
}

class _Suggestion extends StatelessWidget {
  const _Suggestion(this.texte, {required this.onTap});
  final String texte;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _encre)),
          child: Text(texte, style: const TextStyle(fontSize: 13)),
        ),
      );
}

/// Une réponse de Koji : mention IA, constat, chiffres, points, sources,
/// actions à valider, suggestions.
class KojiReponseVue extends StatelessWidget {
  const KojiReponseVue({super.key, required this.r, this.dernier = false, this.onAsk});
  final Json r;
  final bool dernier;
  final ValueChanged<String>? onAsk;

  @override
  Widget build(BuildContext context) {
    final chiffres = _liste(r['chiffres']);
    final points = _liste(r['points']);
    final sources = _liste(r['sources']);
    final actions = _liste(r['actions']);
    final suggestions = (r['suggestions'] as List? ?? const []).map((x) => '$x').toList();
    return Container(
      padding: const EdgeInsets.only(left: 10),
      decoration: const BoxDecoration(border: Border(left: BorderSide(color: _or, width: 3))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(_s(r['mention']).isEmpty ? 'RÉPONSE DE KOJI, ASSISTANT IA · VÉRIFIEZ AVANT DE DÉCIDER' : _s(r['mention']).toUpperCase(), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: _gris, letterSpacing: .4)),
        const SizedBox(height: 4),
        Text(_s(r['constat']), style: const TextStyle(fontSize: 15, height: 1.45)),
        if (chiffres.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final c in chiffres)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFE1E1DB))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(_s(c['label']), style: const TextStyle(fontSize: 11, color: _gris)),
                  Text(_s(c['valeur']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                ]),
              ),
          ]),
        ],
        for (final p in points)
          Container(
            margin: const EdgeInsets.only(top: 6),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _encre)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_s(p['titre']), style: const TextStyle(fontWeight: FontWeight.w700)),
              if (_s(p['detail']).isNotEmpty) Text(_s(p['detail']), style: const TextStyle(fontSize: 12, color: _gris)),
            ]),
          ),
        if (sources.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
            const Text('Sources', style: TextStyle(fontSize: 12, color: _gris)),
            for (final s in sources)
              ActionChip(
                label: Text(_s(s['label']), style: const TextStyle(fontSize: 12)),
                onPressed: routeApp(_s(s['href'])) == null ? null : () => GoRouter.of(context).push(routeApp(_s(s['href']))!),
              ),
          ]),
        ],
        for (final a in actions) Padding(padding: const EdgeInsets.only(top: 8), child: _ActionVue(a: a)),
        if (dernier && suggestions.isNotEmpty) ...[
          const SizedBox(height: 10),
          for (final s in suggestions) Padding(padding: const EdgeInsets.only(bottom: 6), child: _Suggestion(s, onTap: () => onAsk?.call(s))),
        ],
      ]),
    );
  }
}

class _ActionVue extends ConsumerStatefulWidget {
  const _ActionVue({required this.a});
  final Json a;
  @override
  ConsumerState<_ActionVue> createState() => _ActionVueState();
}

class _ActionVueState extends ConsumerState<_ActionVue> {
  late final _texte = TextEditingController(text: _s(widget.a['texte']));
  bool _edition = false;
  String _etat = '';

  @override
  void dispose() {
    _texte.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.a;
    final route = routeApp(_s(a['href']));
    final cadre = BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFCFCFC9)));
    if (a['type'] != 'message_client') {
      return Container(
        padding: const EdgeInsets.all(10),
        decoration: cadre,
        child: Row(children: [
          Expanded(child: Text(_s(a['label']), style: const TextStyle(fontWeight: FontWeight.w700))),
          if (route != null) FilledButton(style: FilledButton.styleFrom(backgroundColor: _encre), onPressed: () => GoRouter.of(context).push(route), child: const Text('Ouvrir')) else const Text('sur le site', style: TextStyle(fontSize: 12, color: _gris)),
        ]),
      );
    }
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: cadre,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(_s(a['label']), style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(_s(a['detail']).isEmpty ? 'par message Koji, à relire' : _s(a['detail']), style: const TextStyle(fontSize: 12, color: _gris)),
        const SizedBox(height: 6),
        if (_edition) TextField(controller: _texte, maxLines: 5, decoration: const InputDecoration(border: OutlineInputBorder())) else Text(_texte.text, style: const TextStyle(fontSize: 13, height: 1.45)),
        const SizedBox(height: 6),
        if (_etat == 'ok')
          const Text('Envoyé.', style: TextStyle(color: Color(0xFF2F6B3A), fontWeight: FontWeight.w600))
        else
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(onPressed: () => setState(() => _edition = !_edition), child: Text(_edition ? 'Terminer' : 'Modifier')),
            const SizedBox(width: 8),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: _encre),
              onPressed: _etat == 'envoi'
                  ? null
                  : () async {
                      setState(() => _etat = 'envoi');
                      try {
                        await ref.read(kojiRepositoryProvider).messageClient(_s(a['quoteId']), _texte.text);
                        if (mounted) setState(() => _etat = 'ok');
                      } catch (e) {
                        if (mounted) setState(() => _etat = errorText(e));
                      }
                    },
              child: const Text('Envoyer'),
            ),
          ]),
        if (_etat.isNotEmpty && _etat != 'ok' && _etat != 'envoi') Text(_etat, style: const TextStyle(color: Color(0xFFB3261E), fontSize: 12)),
      ]),
    );
  }
}

