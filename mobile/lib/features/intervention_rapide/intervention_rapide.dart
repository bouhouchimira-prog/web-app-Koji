import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart' show MediaType;
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/entreprise/chantiers/pro_cloture_screen.dart' show SignatureController, SignatureZone, signaturePng;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, num2;
import 'package:koji/features/factures/factures_widgets.dart' show errorText, showFacturesMessage;

// Intervention rapide (maquette PRO-17.1) sur l'API du site
// (/api/interventions/rapide) : un client appelle, l'artisan crée
// l'intervention en un geste depuis l'accueil, envoie ses prix par écrit,
// part, fait signer le devis avant travaux, termine et facture.
const interventionsRapidesRoute = '/intervention-rapide';
const nouvelleInterventionRoute = '/intervention-rapide/nouvelle';
String suiviInterventionRoute(String id) => '/intervention-rapide/suivi/$id';

final interventionRapideRepositoryProvider = Provider<InterventionRapideRepository>((ref) => InterventionRapideRepository(ref.watch(kojiProApiProvider)));
final interventionsRapidesProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(interventionRapideRepositoryProvider).liste());
final interventionRapideProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(interventionRapideRepositoryProvider).une(id));

class InterventionRapideRepository {
  InterventionRapideRepository(this._api, {AccessTokenProvider? token, http.Client? client})
      : _token = token ?? supabaseAccessToken,
        _http = client ?? http.Client();
  final KojiProApi _api;
  final AccessTokenProvider _token;
  final http.Client _http;

  Future<Json> liste() => _api.get('/api/interventions/rapide');
  Future<Json> une(String id) => _api.get('/api/interventions/rapide', query: {'id': id});
  Future<Json> agir(Json corps) => _api.post('/api/interventions/rapide', corps);

  Future<Json> photo(String id, String phase, List<int> octets) async {
    final jeton = await _token();
    final req = http.MultipartRequest('POST', Uri.parse('${KojiWebApiConfig.baseUrl}/api/interventions/rapide'))
      ..headers['Authorization'] = 'Bearer $jeton'
      ..fields['id'] = id
      ..fields['phase'] = phase
      ..files.add(http.MultipartFile.fromBytes('file', octets, filename: 'photo.jpg', contentType: MediaType.parse('image/jpeg')));
    final r = await http.Response.fromStream(await _http.send(req));
    final data = r.body.isEmpty ? null : jsonDecode(r.body);
    if (r.statusCode >= 400) throw KojiWebApiException(r.statusCode, (data is Map ? data['error']?.toString() : null) ?? 'Erreur ${r.statusCode}');
    return Map<String, dynamic>.from(data as Map);
  }
}

/// Même texte que lib/intervention-rapide.js (information écrite préalable).
String messagePrix(String entreprise, Json prix) {
  final d = num2(prix['deplacement']);
  final h = num2(prix['demiHeure']);
  if (d <= 0 || h <= 0) return '';
  return '${entreprise.isEmpty ? '' : '$entreprise : '}déplacement et 1re demi-heure ${eurosCourt(d)} TTC, puis ${eurosCourt(h)} la demi-heure. Devis gratuit, signé avant tout travail.';
}

String eurosCourt(num n) {
  final r = (n * 100).round() / 100;
  return r == r.roundToDouble() ? '${r.toInt()} €' : '${r.toStringAsFixed(2).replaceAll('.', ',')} €';
}

String euros2(num n) {
  final p = n.toStringAsFixed(2).split('.');
  final ent = p[0].replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
  return '$ent,${p[1]} €';
}

double totalLignes(List<Json> lignes) => lignes.fold<double>(0, (s, l) => s + num2(l['ttc']));

Uri _sms(String tel, [String texte = '']) => Uri.parse('sms:${tel.replaceAll(RegExp(r'[^\d+]'), '')}${texte.isEmpty ? '' : '?&body=${Uri.encodeComponent(texte)}'}');
Uri _tel(String tel) => Uri.parse('tel:${tel.replaceAll(RegExp(r'[^\d+]'), '')}');
List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _hh(String iso) {
  if (iso.isEmpty) return '';
  final d = DateTime.parse(iso).toLocal();
  return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}

const _etapes = {'creee': 'créée', 'acceptee': 'prix acceptés', 'en_route': 'en route', 'sur_place': 'sur place', 'devis_signe': 'devis signé', 'terminee': 'terminée', 'annulee': 'annulée'};

Widget _attente(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) return KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(a.error!), icon: KojiIcons.hardHat)]);
  return KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
}

/// Liste et prix d'intervention.
class InterventionsRapidesScreen extends ConsumerWidget {
  const InterventionsRapidesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(interventionsRapidesProvider);
    if (!a.hasValue) return _attente('Interventions rapides', a);
    final d = a.value!;
    final p = context.koji;
    return KojiPage(
      title: 'Interventions rapides',
      subtitle: 'un client vous appelle directement',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(interventionsRapidesProvider),
      main: [
        KojiButton(label: 'Nouvelle intervention', leadingIcon: KojiIcons.plus, expand: true, onPressed: () => context.push(nouvelleInterventionRoute)),
        for (final i in _liste(d['interventions']))
          KojiCard(
            padding: const EdgeInsets.all(14),
            onTap: () => context.push(suiviInterventionRoute(_s(i['id']))),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${_s(i['client'])}${_s(i['probleme']).isEmpty ? '' : ' · ${_s(i['probleme'])}'}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                Text(_s(i['site']), style: TextStyle(fontSize: 12, color: p.muted)),
              ])),
              Text(_etapes[_s(i['etape'])] ?? '', style: TextStyle(fontSize: 12, color: p.muted)),
            ]),
          ),
        _MesPrix(prix: _map(d['prix']), entreprise: _s(d['entreprise'])),
      ],
    );
  }
}

class _MesPrix extends ConsumerStatefulWidget {
  const _MesPrix({required this.prix, required this.entreprise});
  final Json prix;
  final String entreprise;
  @override
  ConsumerState<_MesPrix> createState() => _MesPrixState();
}

class _MesPrixState extends ConsumerState<_MesPrix> {
  late final _dep = TextEditingController(text: num2(widget.prix['deplacement']) > 0 ? _s(widget.prix['deplacement']) : '');
  late final _dh = TextEditingController(text: num2(widget.prix['demiHeure']) > 0 ? _s(widget.prix['demiHeure']) : '');

  @override
  void dispose() {
    _dep.dispose();
    _dh.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final apercu = messagePrix(widget.entreprise, {'deplacement': double.tryParse(_dep.text.replaceAll(',', '.')), 'demiHeure': double.tryParse(_dh.text.replaceAll(',', '.'))});
    return KojiCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text("Mes prix d'intervention", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        KojiField(label: 'Déplacement et 1re demi-heure (€ TTC)', controller: _dep, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
        const SizedBox(height: 8),
        KojiField(label: 'Demi-heure suivante (€ TTC)', controller: _dh, keyboardType: const TextInputType.numberWithOptions(decimal: true), onChanged: (_) => setState(() {})),
        if (apercu.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('« $apercu »', style: TextStyle(fontSize: 13, color: context.koji.muted))),
        const SizedBox(height: 8),
        KojiButton(
          label: 'Enregistrer mes prix',
          variant: KojiButtonVariant.secondary,
          onPressed: () async {
            try {
              await ref.read(interventionRapideRepositoryProvider).agir({'action': 'prix', 'deplacement': _dep.text, 'demiHeure': _dh.text});
              ref.invalidate(interventionsRapidesProvider);
              if (context.mounted) showFacturesMessage(context, 'Prix enregistrés.');
            } catch (e) {
              if (context.mounted) showFacturesMessage(context, errorText(e));
            }
          },
        ),
      ]),
    );
  }
}

/// PRO-17.1 : nouvelle intervention, une cliente vous appelle.
class NouvelleInterventionScreen extends ConsumerStatefulWidget {
  const NouvelleInterventionScreen({super.key});
  @override
  ConsumerState<NouvelleInterventionScreen> createState() => _NouvelleInterventionScreenState();
}

class _NouvelleInterventionScreenState extends ConsumerState<NouvelleInterventionScreen> {
  final _client = TextEditingController();
  final _tel = TextEditingController();
  final _adresse = TextEditingController();
  final _acces = TextEditingController();
  final _probleme = TextEditingController();
  String _urgence = 'maintenant';
  bool _envoyerPrix = true;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_client, _tel, _adresse, _acces, _probleme]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _creer() async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(interventionRapideRepositoryProvider).agir({
        'action': 'creer', 'client': _client.text.trim(), 'telephone': _tel.text.trim(), 'adresse': _adresse.text.trim(),
        'acces': _acces.text.trim(), 'probleme': _probleme.text.trim(), 'urgence': _urgence, 'envoyerPrix': _envoyerPrix,
      });
      ref.invalidate(interventionsRapidesProvider);
      final message = _s(r['message']);
      if (message.isNotEmpty && _tel.text.trim().isNotEmpty) await launchUrl(_sms(_tel.text.trim(), message));
      if (mounted) context.pushReplacement(suiviInterventionRoute(_s(_map(r['intervention'])['id'])));
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(interventionsRapidesProvider);
    final d = a.value ?? const <String, dynamic>{};
    final apercu = messagePrix(_s(d['entreprise']), _map(d['prix']));
    final p = context.koji;
    return KojiPage(
      title: 'Nouvelle intervention',
      subtitle: 'un client vous appelle',
      appBarOnPhone: true,
      main: [
        KojiField(label: 'Client', controller: _client, hint: 'Mme Lefèvre', onChanged: (_) => setState(() {})),
        KojiField(label: 'Téléphone', controller: _tel, keyboardType: TextInputType.phone),
        KojiField(label: 'Adresse', controller: _adresse),
        KojiField(label: 'Accès (étage, code)', controller: _acces, hint: '3e gauche · code 4521B'),
        KojiField(label: 'Le problème', controller: _probleme, hint: "Fuite sous l'évier, elle a coupé l'eau"),
        const KojiSectionTitle('Urgence'),
        KojiSegmented<String>(options: const {'maintenant': 'Oui, ce matin', 'planifier': 'Non, à planifier'}, value: _urgence, onChanged: (v) => setState(() => _urgence = v)),
        if (_urgence == 'planifier') Text('Devis signé au domicile : 14 jours de rétractation, aucun acompte avant 7 jours.', style: TextStyle(fontSize: 12, color: p.muted)),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Envoyer mes prix au client'), value: _envoyerPrix, onChanged: (v) => setState(() => _envoyerPrix = v)),
        if (_envoyerPrix)
          apercu.isEmpty
              ? KojiAlertBox(title: "Vos prix d'intervention manquent", message: 'Indiquez-les une fois, Koji les enverra à chaque client.', onTap: () => context.push(interventionsRapidesRoute))
              : KojiCard(padding: const EdgeInsets.all(12), child: Text('« $apercu »', style: const TextStyle(fontSize: 13, height: 1.45))),
        KojiButton(label: 'Créer et partir', expand: true, loading: _busy, height: 52, onPressed: _client.text.trim().isEmpty || (_envoyerPrix && apercu.isEmpty) ? null : _creer),
      ],
    );
  }
}

/// PRO-17.1 : suivi, en route, devis avant travaux, terminer.
class SuiviInterventionScreen extends ConsumerStatefulWidget {
  const SuiviInterventionScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<SuiviInterventionScreen> createState() => _SuiviInterventionScreenState();
}

class _SuiviInterventionScreenState extends ConsumerState<SuiviInterventionScreen> {
  final _signature = SignatureController();
  List<Json>? _lignes;
  List<Json> _enPlus = [];
  String _pieces = '';
  String _moyen = 'terminal';
  int _minutes = 20;
  bool _busy = false;

  @override
  void dispose() {
    _signature.dispose();
    super.dispose();
  }

  Future<void> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = true);
    try {
      await ref.read(interventionRapideRepositoryProvider).agir({'id': widget.id, ...corps});
      ref.invalidate(interventionRapideProvider(widget.id));
      ref.invalidate(interventionsRapidesProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _photo(String phase) async {
    final image = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 2000, imageQuality: 80);
    if (image == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(interventionRapideRepositoryProvider).photo(widget.id, phase, await image.readAsBytes());
      ref.invalidate(interventionRapideProvider(widget.id));
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _signer(Json i) async {
    final png = await signaturePng(_signature.traits, _signature.taille);
    await _agir({
      'action': 'signer',
      'lignes': _lignes,
      'enPlus': _enPlus,
      'pieces': _pieces,
      'signataire': i['client'],
      'signature': 'data:image/png;base64,${base64Encode(png)}',
    }, ok: 'Devis signé.');
  }

  Widget _editeur(String titre, List<Json> lignes, ValueChanged<List<Json>> maj) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(titre, style: const TextStyle(fontWeight: FontWeight.w700)),
      for (var k = 0; k < lignes.length; k++)
        Padding(
          key: ObjectKey(lignes[k]),
          padding: const EdgeInsets.only(top: 6),
          child: Row(children: [
            Expanded(child: TextFormField(initialValue: _s(lignes[k]['label']), decoration: const InputDecoration(isDense: true, hintText: 'Ligne'), onChanged: (v) => lignes[k]['label'] = v)),
            const SizedBox(width: 8),
            SizedBox(
              width: 90,
              child: TextFormField(
                initialValue: num2(lignes[k]['ttc']) > 0 ? _s(lignes[k]['ttc']) : '',
                textAlign: TextAlign.right,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(isDense: true, hintText: '€ TTC'),
                onChanged: (v) => setState(() => lignes[k]['ttc'] = double.tryParse(v.replaceAll(',', '.')) ?? 0),
              ),
            ),
            IconButton(tooltip: 'Retirer', icon: const Icon(Icons.close, size: 18), onPressed: () => maj([...lignes]..removeAt(k))),
          ]),
        ),
      Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => maj([...lignes, {'label': '', 'ttc': 0}]), icon: const Icon(Icons.add, size: 18), label: const Text('Ajouter une ligne'))),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(interventionRapideProvider(widget.id));
    if (!a.hasValue) return _attente('Intervention', a);
    final d = a.value!;
    final i = _map(d['intervention']);
    final devis = _map(i['devis']);
    final etape = _s(i['etape']);
    final tel = _s(i['telephone']);
    final facture = i['facture'] is Map ? _map(i['facture']) : null;
    final moyens = _map(d['moyens']);
    final pieces = _map(d['pieces']);
    final p = context.koji;
    _lignes ??= _liste(devis['lignes']).isNotEmpty
        ? _liste(devis['lignes'])
        : [if (i['prix'] is Map) {'label': 'Déplacement et 1re demi-heure', 'ttc': _map(i['prix'])['deplacement']}];
    if (_enPlus.isEmpty && _liste(devis['enPlus']).isNotEmpty) _enPlus = _liste(devis['enPlus']);
    const ordre = ['creee', 'acceptee', 'en_route', 'sur_place', 'devis_signe', 'terminee'];
    final rang = ordre.indexOf(etape);
    final etapes = [
      ['acceptee', 'Confirmée par le client', _s(i['accepteLe']).isNotEmpty ? '${_hh(_s(i['accepteLe']))} · prix accepté par écrit' : (_s(i['prixEnvoyeLe']).isNotEmpty ? 'prix envoyés, en attente' : '')],
      ['en_route', 'En route', _s(i['enRouteLe']).isNotEmpty ? 'arrivée vers ${_s(i['arriveeVers'])}' : ''],
      ['sur_place', 'Sur place', _hh(_s(i['arriveLe']))],
      ['devis_signe', 'Devis signé', devis['signeLe'] != null && _s(devis['signeLe']).isNotEmpty ? euros2(num2(i['total'])) : ''],
      ['terminee', 'Terminée et facturée', facture == null ? '' : '${_s(facture['numero'])} · ${facture['statut'] == 'Payee' ? 'payée' : 'à encaisser'}'],
    ];
    return KojiPage(
      title: _s(i['client']),
      subtitle: '${_s(i['reference'])} · ${_s(i['probleme'])}',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(interventionRapideProvider(widget.id)),
      main: [
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_s(i['site']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
            if (_s(i['acces']).isNotEmpty) Text(_s(i['acces']), style: TextStyle(fontSize: 12, color: p.muted)),
            const SizedBox(height: 10),
            Row(children: [
              if (tel.isNotEmpty) Expanded(child: OutlinedButton(onPressed: () => launchUrl(_tel(tel)), child: const Text('Appeler'))),
              if (tel.isNotEmpty) const SizedBox(width: 8),
              if (tel.isNotEmpty) Expanded(child: OutlinedButton(onPressed: () => launchUrl(_sms(tel)), child: const Text('Message'))),
              if (tel.isNotEmpty) const SizedBox(width: 8),
              Expanded(child: OutlinedButton(onPressed: () => launchUrl(Uri.parse(_s(i['itineraire'])), mode: LaunchMode.externalApplication), child: const Text('Itinéraire'))),
            ]),
          ]),
        ),
        KojiCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(children: [
            for (var k = 0; k < etapes.length; k++)
              ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  radius: 12,
                  backgroundColor: ordre.indexOf(etapes[k][0]) <= rang ? const Color(0xFF171B1E) : Colors.transparent,
                  child: ordre.indexOf(etapes[k][0]) <= rang ? const Icon(Icons.check, size: 14, color: Colors.white) : Text('${k + 1}', style: TextStyle(fontSize: 11, color: p.ink)),
                ),
                title: Text(etapes[k][1], style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: etapes[k][2].isEmpty ? null : Text(etapes[k][2]),
              ),
          ]),
        ),
        if (etape == 'annulee') const KojiAlertBox(title: 'Intervention annulée', message: ''),
        if (etape == 'creee' && _s(i['prixEnvoyeLe']).isNotEmpty && tel.isNotEmpty)
          KojiButton(label: 'Renvoyer les prix par SMS', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => launchUrl(_sms(tel, '${messagePrix(_s(d['entreprise']), _map(i['prix']))} Confirmez ces prix ici : ${_s(i['lienClient'])}'))),
        if (etape == 'creee' || etape == 'acceptee') ...[
          KojiSegmented<int>(options: const {10: '10 min', 20: '20 min', 30: '30 min', 45: '45 min'}, value: _minutes, onChanged: (v) => setState(() => _minutes = v)),
          KojiButton(label: 'Je pars', expand: true, height: 52, loading: _busy, onPressed: () => _agir({'action': 'en-route', 'minutes': _minutes})),
        ],
        if (etape == 'en_route') KojiButton(label: 'Je suis arrivé', expand: true, height: 52, loading: _busy, onPressed: () => _agir({'action': 'arrive'})),
        if (etape == 'sur_place') ...[
          const KojiSectionTitle('Devis avant travaux'),
          KojiCard(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _editeur(i['urgence'] == 'maintenant' ? 'Urgence · le strict nécessaire' : 'Travaux', _lignes!, (v) => setState(() => _lignes = v)),
              Row(children: [const Expanded(child: Text('Total TTC', style: TextStyle(fontWeight: FontWeight.w700))), Text(euros2(totalLignes(_lignes!)), style: const TextStyle(fontWeight: FontWeight.w700))]),
              const SizedBox(height: 6),
              Text(_s(i['mention']), style: TextStyle(fontSize: 12, color: p.muted)),
              const Divider(height: 24),
              _editeur('Proposé en plus · devis séparé', _enPlus, (v) => setState(() => _enPlus = v)),
              if (_enPlus.isNotEmpty) Text(_s(i['mentionEnPlus']), style: TextStyle(fontSize: 12, color: p.muted)),
              const SizedBox(height: 10),
              const Text('Pièces remplacées', style: TextStyle(fontWeight: FontWeight.w700)),
              for (final e in pieces.entries)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(_pieces == e.key ? Icons.radio_button_checked : Icons.radio_button_unchecked),
                  title: Text(_s(e.value)),
                  onTap: () => setState(() => _pieces = e.key),
                ),
              const SizedBox(height: 8),
              SignatureZone(label: 'Signature de ${_s(i['client'])}', controller: _signature),
              const SizedBox(height: 12),
              ListenableBuilder(
                listenable: _signature,
                builder: (context, _) => KojiButton(label: 'Faire signer le client', expand: true, height: 52, loading: _busy, onPressed: _signature.vide ? null : () => _signer(i)),
              ),
            ]),
          ),
        ],
        if (etape == 'devis_signe' || etape == 'terminee') ...[
          const KojiSectionTitle('Terminer'),
          KojiCard(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final ph in _liste(i['photos']))
                  Stack(children: [
                    Image.network(_s(ph['url']), width: 100, height: 90, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(width: 100, height: 90, color: const Color(0xFFD9D9D4))),
                    Positioned(left: 4, bottom: 4, child: Container(color: const Color(0xFF171B1E), padding: const EdgeInsets.symmetric(horizontal: 4), child: Text('${_hh(_s(ph['takenAt']))} · ${ph['phase'] == 'avant' ? 'Avant' : 'Après'}', style: const TextStyle(color: Colors.white, fontSize: 10)))),
                  ]),
              ]),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _photo('avant'), icon: const Icon(Icons.photo_camera_outlined, size: 18), label: const Text('Photo avant'))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _photo('apres'), icon: const Icon(Icons.photo_camera_outlined, size: 18), label: const Text('Photo après'))),
              ]),
              const SizedBox(height: 12),
              if (facture != null) ...[
                Text('Facture ${_s(facture['numero'])} · ${euros2(num2(facture['montant']))} · ${facture['statut'] == 'Payee' ? 'payée' : 'à encaisser'}', style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                KojiButton(
                  label: _s(facture['envoyeeLe']).isEmpty ? 'Envoyer la facture' : 'Renvoyer la facture',
                  expand: true,
                  loading: _busy,
                  onPressed: () async {
                    final ctrl = TextEditingController(text: _s(i['email']));
                    final to = await showDialog<String>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('E-mail du client'),
                        content: TextField(controller: ctrl, keyboardType: TextInputType.emailAddress),
                        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')), TextButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Envoyer'))],
                      ),
                    );
                    if (to != null && to.isNotEmpty) await _agir({'action': 'envoyer-facture', 'to': to}, ok: 'Facture envoyée.');
                  },
                ),
              ] else ...[
                const Text('Payé par', style: TextStyle(fontWeight: FontWeight.w700)),
                Wrap(spacing: 8, children: [
                  for (final e in [...moyens.entries, const MapEntry('', 'Pas encore')])
                    ChoiceChip(label: Text(_s(e.value)), selected: _moyen == e.key, onSelected: (_) => setState(() => _moyen = e.key)),
                ]),
                Text('Paiement dans Koji : prévu dans une version suivante.', style: TextStyle(fontSize: 12, color: p.muted)),
                const SizedBox(height: 8),
                KojiButton(label: _moyen.isEmpty ? 'Créer la facture' : 'Encaissé, créer la facture', expand: true, height: 52, loading: _busy, onPressed: () => _agir({'action': 'terminer', 'moyen': _moyen}, ok: 'Facture créée.')),
              ],
              if (num2(i['totalEnPlus']) > 0) ...[
                const SizedBox(height: 10),
                Text('Proposé en plus : ${_liste(devis['enPlus']).map((l) => _s(l['label'])).join(', ')} · ${euros2(num2(i['totalEnPlus']))}. Préparez le devis séparé depuis le site (Devis).', style: TextStyle(fontSize: 12, color: p.muted)),
              ],
            ]),
          ),
        ],
        if (_s(i['invoiceId']).isEmpty && etape != 'annulee')
          TextButton(
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Annuler cette intervention ?'),
                  actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Non')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Annuler'))],
                ),
              );
              if (ok == true) await _agir({'action': 'annuler'});
            },
            child: const Text("Annuler l'intervention"),
          ),
        Builder(builder: (context) {
          final lien = _s(i['lienClient']);
          if (lien.isEmpty || etape == 'annulee') return const SizedBox.shrink();
          return TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: lien));
              showFacturesMessage(context, 'Lien de suivi copié.');
            },
            child: const Text('Copier le lien de suivi du client'),
          );
        }),
      ],
    );
  }
}
