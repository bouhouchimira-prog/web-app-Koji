import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:image_picker/image_picker.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, jourCourt, num2;
import 'package:koji/features/equipe/equipe_pro.dart' show heuresMinutes, languesCompagnon;
import 'package:koji/features/factures/factures_widgets.dart' show errorText;

// Vue compagnon dans l'app (maquettes PRO-16 « matin / sur place » et
// PRO-16.4) : la journée est l'accueil ; « Je suis arrivé » / « Je pars »,
// tâches cochables, photo de fin, un problème ; ma semaine et mes heures
// s'ouvrent depuis elle. Connexion par le code de l'invitation (pas de mot
// de passe), jeton gardé dans le coffre du téléphone. Même source que le
// site (/api/compagnon) : jamais un prix ni un nom de client.
const _cleJeton = 'koji_compagnon_token';
const _encre = Color(0xFF171B1E);
const _gris = Color(0xFF5B5F66);
const _fond = Color(0xFFF5F5F1);
const _ligne = Color(0xFFCFCFC9);

/// Invitation de la forme « K7P2QMXA » (8 caractères, sans OUV-).
bool estCodeInvitation(String code) => RegExp(r'^[A-HJ-NP-Z2-9]{8}$').hasMatch(code.trim().toUpperCase());

class CompagnonApi {
  CompagnonApi({FlutterSecureStorage? storage, http.Client? client, KojiProApi? api})
      : _storage = storage ?? const FlutterSecureStorage(),
        _http = client ?? http.Client() {
    _api = api ?? KojiProApi(tokenProvider: () => _storage.read(key: _cleJeton), httpClient: _http);
  }
  final FlutterSecureStorage _storage;
  final http.Client _http;
  late final KojiProApi _api;

  Future<bool> connecte() async => (await _storage.read(key: _cleJeton))?.isNotEmpty == true;

  /// Échange le code de l'invitation contre un jeton de session.
  Future<Json> connexion(String code) async {
    final r = await _http.post(Uri.parse('${KojiWebApiConfig.baseUrl}/api/compagnon/connexion'), headers: {'Content-Type': 'application/json'}, body: jsonEncode({'code': code.trim().toUpperCase()}));
    final data = jsonDecode(r.body.isEmpty ? '{}' : r.body);
    if (r.statusCode >= 400 || data is! Map) throw KojiWebApiException(r.statusCode, (data is Map ? data['error'] : null)?.toString() ?? 'Connexion impossible.');
    await _storage.write(key: _cleJeton, value: '${data['workerToken']}');
    return Map<String, dynamic>.from(data);
  }

  Future<void> deconnexion() => _storage.delete(key: _cleJeton);
  Future<Json> vue() => _api.get('/api/compagnon');
  Future<Json> agir(Json corps) => _api.post('/api/compagnon', corps);

  Future<void> photo({required List<int> octets, required String mode, String taskId = '', String projectId = '', String message = ''}) async {
    final jeton = await _storage.read(key: _cleJeton);
    final req = http.MultipartRequest('POST', Uri.parse('${KojiWebApiConfig.baseUrl}/api/compagnon'))
      ..headers['Authorization'] = 'Bearer $jeton'
      ..fields['mode'] = mode
      ..fields['taskId'] = taskId
      ..fields['projectId'] = projectId
      ..fields['message'] = message
      ..files.add(http.MultipartFile.fromBytes('file', octets, filename: 'photo.jpg', contentType: MediaType.parse('image/jpeg')));
    final r = await http.Response.fromStream(await _http.send(req));
    if (r.statusCode >= 400) {
      dynamic data;
      try {
        data = jsonDecode(r.body);
      } on FormatException {
        data = null;
      }
      throw KojiWebApiException(r.statusCode, (data is Map ? data['error']?.toString() : null) ?? 'Erreur ${r.statusCode}');
    }
  }
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _heure(String hhmm) => hhmm.replaceFirst(RegExp(r'^0(?=\d)'), '').replaceFirst(':', ' h ');
String _hm(Object? m) => num2(m) > 0 ? heuresMinutes(m) : '—';
const _jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const _mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
String dateLongue(String j) {
  if (j.length < 10) return '';
  final d = DateTime.utc(int.parse(j.substring(0, 4)), int.parse(j.substring(5, 7)), int.parse(j.substring(8, 10)));
  return '${_jours[d.weekday - 1]} ${d.day} ${_mois[d.month - 1]}';
}

Widget _carte({required Widget child, EdgeInsets padding = const EdgeInsets.all(14)}) => Material(
      color: Colors.white,
      shape: const Border(top: BorderSide(color: _encre, width: 2), left: BorderSide(color: _ligne), right: BorderSide(color: _ligne), bottom: BorderSide(color: _ligne)),
      child: Padding(padding: padding, child: SizedBox(width: double.infinity, child: child)),
    );
Text _lab(String t) => Text(t.toUpperCase(), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .6, color: _gris));

Widget _gros(String label, VoidCallback? onTap, {IconData icone = Icons.schedule, bool busy = false}) => SizedBox(
      width: double.infinity,
      height: 56,
      child: FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: _encre, foregroundColor: Colors.white, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2))), textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        onPressed: busy ? null : onTap,
        icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Icon(icone),
        label: Text(label),
      ),
    );

/// Entrée de la vue compagnon : reprend la session gardée ou demande le code.
class CompagnonApp extends StatefulWidget {
  const CompagnonApp({super.key, this.api, this.code});
  final CompagnonApi? api;
  final String? code;
  @override
  State<CompagnonApp> createState() => _CompagnonAppState();
}

class _CompagnonAppState extends State<CompagnonApp> {
  late final CompagnonApi _api = widget.api ?? CompagnonApi();
  Json? _d;
  String _erreur = '';
  bool _busy = false;
  bool _sansSession = false;

  @override
  void initState() {
    super.initState();
    _demarrer();
  }

  Future<void> _demarrer() async {
    try {
      if (widget.code != null && widget.code!.isNotEmpty) await _api.connexion(widget.code!);
      if (!await _api.connecte()) {
        setState(() => _sansSession = true);
        return;
      }
      await _charger();
    } catch (e) {
      setState(() {
        _erreur = errorText(e);
        _sansSession = true;
      });
    }
  }

  Future<void> _charger() async {
    try {
      final d = await _api.vue();
      if (mounted) setState(() => _d = d);
    } on KojiWebApiException catch (e) {
      if (e.statusCode == 401 || e.statusCode == 403) {
        await _api.deconnexion();
        if (mounted) setState(() { _sansSession = true; _erreur = e.message; });
      } else if (mounted) {
        setState(() => _erreur = e.message);
      }
    }
  }

  Future<void> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = true);
    try {
      final r = await _api.agir(corps);
      if (r['journee'] is Map) {
        setState(() => _d = r);
      } else {
        await _charger();
      }
      if (ok != null && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _photo(String mode, {Json? tache, String message = ''}) async {
    final image = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, imageQuality: 80);
    if (image == null) return;
    setState(() => _busy = true);
    try {
      await _api.photo(octets: await image.readAsBytes(), mode: mode, taskId: _s(tache?['id']), projectId: _s(_map(_d?['journee'])['projectId']), message: message);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(mode == 'probleme' ? 'Problème envoyé avec la photo.' : 'Photo de fin envoyée.')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(e))));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _probleme() async {
    final ctrl = TextEditingController();
    final r = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Un problème ?', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Photo ou message : votre chef le reçoit.', style: TextStyle(color: _gris)),
          const SizedBox(height: 12),
          TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(hintText: 'En quelques mots', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          _gros('Prendre une photo', () => Navigator.pop(ctx, 'photo'), icone: Icons.photo_camera_outlined),
          TextButton(onPressed: () => Navigator.pop(ctx, 'message'), child: const Text('Envoyer seulement le message')),
        ]),
      ),
    );
    if (r == 'photo') await _photo('probleme', message: ctrl.text.trim());
    if (r == 'message' && ctrl.text.trim().isNotEmpty) await _agir({'action': 'probleme', 'message': ctrl.text.trim()}, ok: 'Message envoyé.');
  }

  Future<void> _langue() async {
    final actuelle = _s(_map(_d?['compagnon'])['langue']);
    final l = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => ListView(shrinkWrap: true, children: [
        for (final e in languesCompagnon.entries)
          ListTile(title: Text(e.value[0].toUpperCase() + e.value.substring(1)), trailing: e.key == actuelle ? const Icon(Icons.check) : null, onTap: () => Navigator.pop(ctx, e.key)),
      ]),
    );
    if (l != null) await _agir({'action': 'langue', 'langue': l});
  }

  @override
  Widget build(BuildContext context) {
    if (_sansSession) {
      return CodeCompagnonScreen(
        erreur: _erreur,
        onCode: (code) async {
          await _api.connexion(code);
          setState(() { _sansSession = false; _erreur = ''; });
          await _charger();
        },
      );
    }
    final d = _d;
    if (d == null) {
      return Scaffold(backgroundColor: _fond, body: Center(child: _erreur.isEmpty ? const CircularProgressIndicator() : Padding(padding: const EdgeInsets.all(24), child: Text(_erreur, textAlign: TextAlign.center))));
    }
    final j = _map(d['journee']);
    final p = _map(j['pointage']);
    final c = _map(d['compagnon']);
    final ouvert = p['ouvert'] == true;
    final taches = _liste(j['taches']);
    final avec = (j['avec'] as List? ?? const []).map((x) => '$x').toList();
    final infos = [_s(j['adresse']), [_s(j['horaire']).split(' – ').first, if (avec.isNotEmpty) 'avec ${avec.join(', ')}'].where((x) => x.isNotEmpty).join(' · ')];
    return Scaffold(
      backgroundColor: _fond,
      appBar: AppBar(
        backgroundColor: _encre,
        foregroundColor: Colors.white,
        automaticallyImplyLeading: false,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(ouvert ? _s(j['chantier']) : 'Bonjour ${_s(c['prenom'])}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          Text(ouvert ? 'arrivé à ${_heure(_s(p['arriveA']))}' : dateLongue(_s(j['jour'])), style: const TextStyle(fontSize: 12, color: Color(0xFFC4C7CC))),
        ]),
        actions: [
          TextButton(onPressed: _langue, child: Text('FR · ${_s(c['langue']).toUpperCase()}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
          PopupMenuButton<String>(
            onSelected: (v) async {
              if (v == 'sortir') {
                await _api.deconnexion();
                if (context.mounted) Navigator.of(context).maybePop();
              }
            },
            itemBuilder: (_) => const [PopupMenuItem(value: 'sortir', child: Text('Se déconnecter'))],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _charger,
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 24), children: [
          for (final m in _liste(d['messages'])) Padding(padding: const EdgeInsets.only(bottom: 10), child: _carte(child: Text('${_s(m['titre'])} · ${_s(m['message'])}'))),
          if (ouvert)
            _carte(child: Column(children: [
              _lab("Aujourd'hui"),
              Text(heuresMinutes(p['minutes']), style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w600)),
            ]))
          else
            _carte(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _lab("Aujourd'hui"),
              const SizedBox(height: 2),
              Text(j['conge'] == true ? 'Congé' : _s(j['chantier']).isEmpty ? 'Pas de chantier prévu' : _s(j['chantier']), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              for (final x in infos.where((x) => x.isNotEmpty)) Text(x, style: const TextStyle(fontSize: 13, color: Color(0xFF3A3E44))),
            ])),
          const SizedBox(height: 12),
          if (taches.isNotEmpty)
            _carte(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (!ouvert) _lab('À faire'),
              for (final t in taches)
                InkWell(
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => TacheCompagnonScreen(tache: t, onPhoto: () => _photo('fin', tache: t)))),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(children: [
                      Checkbox(value: t['fait'] == true, activeColor: _encre, onChanged: _busy ? null : (v) => _agir({'action': 'tache', 'taskId': t['id'], 'fait': v == true})),
                      Expanded(child: Text(_s(t['label']), style: TextStyle(fontSize: 15, decoration: t['fait'] == true ? TextDecoration.lineThrough : null, color: t['fait'] == true ? _gris : _encre))),
                      const Icon(Icons.chevron_right, color: _gris),
                    ]),
                  ),
                ),
              InkWell(
                onTap: _busy ? null : () => _photo('fin', tache: taches.first),
                child: const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Row(children: [SizedBox(width: 12), Icon(Icons.photo_camera_outlined, size: 20), SizedBox(width: 14), Text('Photo de fin', style: TextStyle(fontSize: 15))])),
              ),
            ])),
          for (final x in (j['consignes'] as List? ?? const []))
            Container(
              margin: const EdgeInsets.only(top: 12),
              color: _encre,
              padding: const EdgeInsets.all(12),
              child: Row(children: [const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 18), const SizedBox(width: 8), Expanded(child: Text('$x', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)))]),
            ),
          if (ouvert) ...[
            const SizedBox(height: 12),
            InkWell(
              onTap: _probleme,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: Colors.white, border: Border.all(color: _encre)),
                child: const Row(children: [Icon(Icons.photo_camera_outlined), SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Un problème ?', style: TextStyle(fontWeight: FontWeight.w700)), Text('photo ou message, votre chef le reçoit', style: TextStyle(fontSize: 12, color: _gris))]))]),
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (j['conge'] != true) _gros(ouvert ? 'Je pars' : 'Je suis arrivé', () => _agir({'action': ouvert ? 'pars' : 'arrive', 'depuis': 'telephone'}), busy: _busy),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => SemaineCompagnonScreen(d: d))), child: const Text('Ma semaine'))),
            const SizedBox(width: 10),
            Expanded(child: OutlinedButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => HeuresCompagnonScreen(d: d))), child: const Text('Mes heures'))),
          ]),
        ]),
      ),
    );
  }
}

/// Saisie du code reçu par SMS.
class CodeCompagnonScreen extends StatefulWidget {
  const CodeCompagnonScreen({super.key, required this.onCode, this.erreur = ''});
  final Future<void> Function(String code) onCode;
  final String erreur;
  @override
  State<CodeCompagnonScreen> createState() => _CodeCompagnonScreenState();
}

class _CodeCompagnonScreenState extends State<CodeCompagnonScreen> {
  final _code = TextEditingController();
  bool _busy = false;
  late String _erreur = widget.erreur;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _fond,
        appBar: AppBar(backgroundColor: _encre, foregroundColor: Colors.white, title: const Text('Koji · compagnon')),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          const Text('Entrez le code de 8 caractères reçu par SMS. Pas de mot de passe.', style: TextStyle(fontSize: 15, height: 1.45)),
          const SizedBox(height: 16),
          TextField(
            controller: _code,
            textCapitalization: TextCapitalization.characters,
            maxLength: 8,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 22, letterSpacing: 4, fontWeight: FontWeight.w700),
            decoration: const InputDecoration(border: OutlineInputBorder(), counterText: ''),
            onChanged: (_) => setState(() {}),
          ),
          if (_erreur.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_erreur, style: const TextStyle(color: Color(0xFFB3261E)))),
          const SizedBox(height: 16),
          _gros('Ouvrir ma journée', estCodeInvitation(_code.text)
              ? () async {
                  setState(() => _busy = true);
                  try {
                    await widget.onCode(_code.text);
                  } catch (e) {
                    setState(() => _erreur = errorText(e));
                  } finally {
                    if (mounted) setState(() => _busy = false);
                  }
                }
              : null, icone: Icons.login, busy: _busy),
        ]),
      );
}

/// PRO-16.4 : ma semaine.
class SemaineCompagnonScreen extends StatelessWidget {
  const SemaineCompagnonScreen({super.key, required this.d});
  final Json d;
  @override
  Widget build(BuildContext context) {
    final s = _map(d['semaine']);
    final jours = _liste(s['jours']);
    final docs = _liste(d['documents']);
    return Scaffold(
      backgroundColor: _fond,
      appBar: AppBar(backgroundColor: _encre, foregroundColor: Colors.white, title: Text('Ma semaine du ${jourCourt(_s(s['lundi']))}')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _carte(
          padding: EdgeInsets.zero,
          child: Column(children: [
            for (final x in jours)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                decoration: BoxDecoration(color: x['aujourdhui'] == true ? const Color(0xFFF1F1EC) : null, border: const Border(top: BorderSide(color: Color(0xFFF0F0EB)))),
                child: Row(children: [
                  SizedBox(width: 58, child: Text(jourCourt(_s(x['jour'])), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _gris))),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${_s(x['chantier'])}${(x['avec'] as List? ?? const []).isNotEmpty ? ' · avec ${(x['avec'] as List).join(', ')}' : ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (_s(x['horaire']).isNotEmpty) Text(_s(x['horaire']), style: const TextStyle(fontSize: 12, color: _gris)),
                  ])),
                  Text(num2(x['minutes']) > 0 ? heuresMinutes(x['minutes']) : '', style: const TextStyle(fontWeight: FontWeight.w700)),
                ]),
              ),
          ]),
        ),
        Container(
          margin: const EdgeInsets.symmetric(vertical: 12),
          padding: const EdgeInsets.all(14),
          color: _encre,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Cette semaine', style: TextStyle(fontSize: 12, color: Color(0xFFC4C7CC))),
            Text('${_hm(s['minutes'])} pointé', style: const TextStyle(fontSize: 24, color: Colors.white, fontWeight: FontWeight.w700)),
            Text(s['validation'] is Map ? 'validé par votre entreprise' : 'validation par votre entreprise en fin de semaine', style: const TextStyle(fontSize: 12, color: Color(0xFFC4C7CC))),
          ]),
        ),
        _carte(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _lab('Mes documents'),
          for (final x in docs) Padding(padding: const EdgeInsets.only(top: 8), child: Text("${_s(x['nom'])} · valable jusqu'au ${jourCourt(_s(x['jusqua']))}")),
          Padding(padding: const EdgeInsets.only(top: 8), child: Text('Contrat, attestation, fiche de paie : demandez-les à ${_s(d['entreprise']).isEmpty ? 'votre entreprise' : _s(d['entreprise'])}.', style: const TextStyle(fontSize: 12, color: _gris))),
        ])),
      ]),
    );
  }
}

/// PRO-16.4 : mes heures.
class HeuresCompagnonScreen extends StatelessWidget {
  const HeuresCompagnonScreen({super.key, required this.d});
  final Json d;
  @override
  Widget build(BuildContext context) {
    final s = _map(d['semaine']);
    final prec = _map(d['semainePrecedente']);
    final auj = _s(_map(d['journee'])['jour']);
    final contrat = num2(prec['contrat']) * 60;
    return Scaffold(
      backgroundColor: _fond,
      appBar: AppBar(backgroundColor: _encre, foregroundColor: Colors.white, title: Text('Mes heures · ${_hm(s['minutes'])}')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        _carte(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(children: [
            for (final x in _liste(s['jours']).where((x) => _s(x['jour']).compareTo(auj) <= 0))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: SizedBox(width: 58, child: Text(jourCourt(_s(x['jour'])), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: _gris))),
                title: Text(_hm(x['minutes']), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(_s(x['chantier'])),
                trailing: num2(x['minutes']) > 0 ? Text(x['valide'] == true ? 'VALIDÉ' : 'À VALIDER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: x['valide'] == true ? const Color(0xFF2F6B3A) : const Color(0xFFB86E00))) : null,
              ),
          ]),
        ),
        Container(
          margin: const EdgeInsets.symmetric(vertical: 12),
          padding: const EdgeInsets.all(14),
          color: _encre,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Semaine précédente', style: TextStyle(fontSize: 12, color: Color(0xFFC4C7CC))),
            Text(_hm(prec['minutes']), style: const TextStyle(fontSize: 24, color: Colors.white, fontWeight: FontWeight.w700)),
            Text(
              '${prec['validation'] is Map ? 'validée' : 'pas encore validée'}${num2(prec['minutes']) > contrat && contrat > 0 ? ' · ${heuresMinutes(num2(prec['minutes']) - contrat)} en plus de ${num2(prec['contrat']).round()} h' : ''}',
              style: const TextStyle(fontSize: 12, color: Color(0xFFC4C7CC)),
            ),
          ]),
        ),
        const Text("Les heures servent au planning et au coût des chantiers. La paie est faite ailleurs, par l'entreprise. Une erreur ? Dites-le à votre chef : il la corrige, la correction est gardée.", style: TextStyle(fontSize: 12, color: _gris, height: 1.45)),
      ]),
    );
  }
}

/// PRO-16.4 : détail d'une tâche (sans prix), à prendre au dépôt, photo de fin.
class TacheCompagnonScreen extends StatefulWidget {
  const TacheCompagnonScreen({super.key, required this.tache, required this.onPhoto});
  final Json tache;
  final Future<void> Function() onPhoto;
  @override
  State<TacheCompagnonScreen> createState() => _TacheCompagnonScreenState();
}

class _TacheCompagnonScreenState extends State<TacheCompagnonScreen> {
  final _coches = <int>{};
  @override
  Widget build(BuildContext context) {
    final t = widget.tache;
    final aPrendre = _liste(t['aPrendre']);
    return Scaffold(
      backgroundColor: _fond,
      appBar: AppBar(backgroundColor: _encre, foregroundColor: Colors.white, title: Text(_s(t['label']))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text('${_s(t['chantier'])}${_s(t['lot']).isNotEmpty ? ' · ${_s(t['lot'])}' : ''}', style: const TextStyle(color: _gris)),
        const SizedBox(height: 10),
        _carte(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _lab("Ce qu'il faut faire"),
          const SizedBox(height: 4),
          Text('${_s(t['consigne']).isEmpty ? _s(t['label']) : _s(t['consigne'])}${num2(t['quantite']) > 0 ? ' · ${num2(t['quantite']).toString().replaceAll('.0', '').replaceAll('.', ',')} ${_s(t['unite'])}' : ''}', style: const TextStyle(fontSize: 15, height: 1.5)),
        ])),
        if (aPrendre.isNotEmpty) ...[
          const SizedBox(height: 12),
          _carte(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _lab('À prendre au dépôt'),
            for (var i = 0; i < aPrendre.length; i++)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: _encre,
                value: _coches.contains(i),
                onChanged: (v) => setState(() => v == true ? _coches.add(i) : _coches.remove(i)),
                title: Text('${_s(aPrendre[i]['label'])}${num2(aPrendre[i]['quantite']) > 0 ? ' · ${num2(aPrendre[i]['quantite']).toString().replaceAll('.0', '')} ${_s(aPrendre[i]['unite'])}' : ''}'),
              ),
          ])),
        ],
        const SizedBox(height: 16),
        _gros('Photo de fin', widget.onPhoto, icone: Icons.photo_camera_outlined),
        const SizedBox(height: 8),
        const Text("Envoyée à votre chef et au chantier ; jamais au client sans son accord. La date et l'heure sont ajoutées.", style: TextStyle(fontSize: 12, color: _gris)),
      ]),
    );
  }
}
