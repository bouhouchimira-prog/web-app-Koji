import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart' show prendrePhotoAppareil;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, euro, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/design/liste_vide.dart';
import 'package:koji/features/factures/impayes_screen.dart' show impayesRoute;

// Contacts de Koji Pro (maquettes PRO-10 à 10.3) sur l'API du site
// (/api/contacts/carnet), le même carnet que /contacts sur le web.
const contactsRoute = '/contacts';
const nouveauContactRoute = '/contacts/nouveau';
String ficheContactRoute(String id) => '/contacts/fiche/$id';

final contactsRepositoryProvider = Provider<ContactsRepository>((ref) => ContactsRepository(ref.watch(kojiProApiProvider)));
final carnetProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(contactsRepositoryProvider).carnet());
final ficheContactProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(contactsRepositoryProvider).fiche(id));

class ContactsRepository {
  ContactsRepository(this._api);
  final KojiProApi _api;

  Future<Json> carnet() => _api.get('/api/contacts/carnet');
  Future<Json> fiche(String id) async => Map<String, dynamic>.from((await _api.get('/api/contacts/carnet', query: {'id': id}))['fiche'] as Map);
  Future<Json> poster(Json corps) => _api.post('/api/contacts/carnet', corps);
  Future<Json> modifier(Json corps) => _api.patch('/api/contacts/carnet', corps);
}

/// Prise de photo remplaçable dans les tests.
typedef PrisePhotoCarte = Future<List<int>?> Function();

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
String _s(Object? v) => v == null ? '' : '$v';
Future<void> _ouvrir(String url) async {
  final uri = Uri.parse(url);
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Widget _avatar(BuildContext context, Json c, {double taille = 38}) {
  final p = context.koji;
  final pro = c['pro'] == true;
  return Container(
    width: taille,
    height: taille,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      color: pro ? p.surface : p.heading,
      border: pro ? Border.all(color: p.heading) : null,
      borderRadius: BorderRadius.circular(c['type'] == 'sous_traitant' || c['type'] == 'fournisseur' ? 4 : taille),
    ),
    child: Text(_s(c['initiales']), style: TextStyle(fontSize: taille * .34, fontWeight: FontWeight.w800, color: pro ? p.heading : p.surface)),
  );
}

// ---------------------------------------------------------------------------
// PRO-10 Contacts (téléphone) : liste, « à faire » d'abord.
// ---------------------------------------------------------------------------
class ContactsScreen extends ConsumerStatefulWidget {
  const ContactsScreen({super.key});

  @override
  ConsumerState<ContactsScreen> createState() => _ContactsScreenState();
}

class _ContactsScreenState extends ConsumerState<ContactsScreen> {
  String _onglet = 'tous';
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(carnetProvider);
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Contacts', appBarOnPhone: true, main: [KojiEmptyState(title: 'Contacts indisponibles', subtitle: errorText(async.error!), icon: KojiIcons.contacts)]);
    if (!async.hasValue) return const KojiPage(title: 'Contacts', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final p = context.koji;
    final d = async.value!;
    final k = Map<String, dynamic>.from(d['compteurs'] as Map? ?? const {});
    final q = _q.trim().toLowerCase();
    // Onglet d'archive « Inactifs » (PRO-19.1), toujours en dernier.
    final liste = _liste(_onglet == 'inactifs' ? d['inactifs'] : d['contacts']).where((c) {
      final ok = _onglet == 'tous' || _onglet == 'inactifs' || (_onglet == 'afaire' && c['aFaire'] == true) || (_onglet == 'clients' && c['pro'] != true) || (_onglet == 'pros' && c['pro'] == true);
      return ok && (q.isEmpty || '${c['nom']} ${c['telephone']} ${c['sousTitre']}'.toLowerCase().contains(q));
    }).toList()
      ..sort((a, b) => (b['aFaire'] == true ? 1 : 0).compareTo(a['aFaire'] == true ? 1 : 0) != 0 ? (b['aFaire'] == true ? 1 : 0).compareTo(a['aFaire'] == true ? 1 : 0) : _s(b['dernier']).compareTo(_s(a['dernier'])));
    return KojiPage(
      title: 'Contacts',
      subtitle: '${num2(k['tous']).round()} contacts · ${num2(k['aFaire']).round()} à faire',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(carnetProvider);
        await ref.read(carnetProvider.future);
      },
      // Carnet vide : un seul bouton, celui de la carte « Aucun contact ».
      actions: [if (_liste(d['contacts']).isNotEmpty) KojiButton(label: 'Ajouter', onPressed: () => context.push(nouveauContactRoute))],
      main: [
        TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'Nom, téléphone, chantier', isDense: true), onChanged: (v) => setState(() => _q = v)),
        KojiFilterChips<String>(
          options: {'tous': 'Tous', 'afaire': 'À faire ${num2(k['aFaire']).round()}', 'clients': 'Clients', 'pros': 'Pros', 'inactifs': 'Inactifs ${num2(k['inactifs']).round()}'},
          value: _onglet,
          onChanged: (v) => setState(() => _onglet = v),
        ),
        if (liste.isEmpty && _liste(d['contacts']).isEmpty)
          ListeVide(titre: 'Aucun contact', texte: "Les clients s'ajoutent seuls avec vos devis et vos chantiers.", action: 'Ajouter un contact', onAction: () => context.push(nouveauContactRoute))
        else if (liste.isEmpty)
          const KojiEmptyState(compact: true, icon: KojiIcons.contacts, title: 'Aucun contact', subtitle: 'Aucun contact ne correspond.'),
        for (final c in liste)
          InkWell(
            onTap: () => context.push(ficheContactRoute(_s(c['id']))),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
              child: Row(children: [
                _avatar(context, c),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(_s(c['nom']), overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading))),
                      Text(jourCourt(c['dernier']), style: TextStyle(fontSize: 12, color: p.faint)),
                    ]),
                    Row(children: [
                      Expanded(child: Text(_s(c['sousTitre']), overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: p.muted))),
                      if (_s(c['flag']).isNotEmpty) KojiPill(_s(c['flag']), tone: c['aFaire'] == true ? KojiTone.coral : KojiTone.grey),
                    ]),
                  ]),
                ),
              ]),
            ),
          ),
        KojiButton(label: 'Scanner une carte de visite', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => context.push(nouveauContactRoute)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Fiche (client, sous-traitant et documents, autres types).
// ---------------------------------------------------------------------------
class FicheContactScreen extends ConsumerStatefulWidget {
  const FicheContactScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<FicheContactScreen> createState() => _FicheContactScreenState();
}

class _FicheContactScreenState extends ConsumerState<FicheContactScreen> {
  final _note = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _faire(Future<Json> Function() appel, String ok) async {
    setState(() => _busy = true);
    try {
      final r = await appel();
      ref.invalidate(ficheContactProvider(widget.id));
      ref.invalidate(carnetProvider);
      if (mounted) showFacturesMessage(context, r['envoye'] == false && r['lien'] != null ? 'Pas d\'e-mail : envoyez ce lien au sous-traitant : ${r['lien']}' : ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(ficheContactProvider(widget.id));
    if (async.hasError && !async.hasValue) return KojiPage(title: 'Contact', appBarOnPhone: true, main: [KojiEmptyState(title: 'Contact indisponible', subtitle: errorText(async.error!), icon: KojiIcons.contacts)]);
    if (!async.hasValue) return const KojiPage(title: 'Contact', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final f = async.value!;
    final p = context.koji;
    final c = Map<String, dynamic>.from(f['contact'] as Map);
    final a = f['action'] as Map?;
    final argent = f['argent'] as Map?;
    final vig = f['vigilance'] as Map?;
    final repo = ref.read(contactsRepositoryProvider);
    final phone = _s(c['phone']).replaceAll(RegExp(r'[^\d+]'), '');
    final type = _s(f['type']);
    return KojiPage(
      title: _s(f['nom']),
      subtitle: [f['typeLabel'], f['genre'], type == 'sous_traitant' ? c['metier'] : null].where((x) => _s(x).isNotEmpty).join(' · '),
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(ficheContactProvider(widget.id));
        await ref.read(ficheContactProvider(widget.id).future);
      },
      main: [
        if (_s(c['contactPerson']).isNotEmpty || phone.isNotEmpty) Text([c['contactPerson'], c['phone'], c['email']].where((x) => _s(x).isNotEmpty).join(' · '), style: TextStyle(fontSize: 13, color: p.muted)),
        Row(children: [
          Expanded(child: KojiButton(label: 'Appeler', variant: KojiButtonVariant.secondary, onPressed: phone.isEmpty ? null : () => _ouvrir('tel:$phone'))),
          const SizedBox(width: 6),
          Expanded(child: KojiButton(label: 'Message', variant: KojiButtonVariant.secondary, onPressed: phone.isEmpty && _s(c['email']).isEmpty ? null : () => _ouvrir(phone.isNotEmpty ? 'sms:$phone' : 'mailto:${c['email']}'))),
          const SizedBox(width: 6),
          Expanded(child: KojiButton(label: 'Itinéraire', variant: KojiButtonVariant.secondary, onPressed: _s(c['address']).isEmpty ? null : () => _ouvrir('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(_s(c['address']))}'))),
        ]),
        if (a != null) ...[
          KojiAlertBox(title: a['cle'] == 'vigilance' && vig?['bloquant'] != null ? '${(vig!['bloquant'] as Map)['nom']} manquante' : _s(a['texte']).isNotEmpty ? _s(a['texte']) : _s(a['label']), message: a['cle'] == 'vigilance' && vig?['bloquant'] != null ? 'Sous-traitant non affectable aux chantiers tant qu\'elle manque.' : _s(c['preferences']), tone: a['urgent'] == true ? KojiTone.coral : KojiTone.amber),
          KojiButton(
            label: _s(a['label']),
            expand: true,
            loading: _busy,
            onPressed: _busy
                ? null
                : a['cle'] == 'relancer'
                    ? () => context.push(impayesRoute)
                    : a['cle'] == 'vigilance'
                        ? () => _faire(() => repo.poster({'action': 'demander', 'id': c['id'], if (a['doc'] != null) 'docs': [a['doc']]}), 'Demande envoyée.')
                        : () => _faire(() => repo.modifier({'action': 'prochaine', 'id': c['id'], 'label': ''}), 'Fait.'),
          ),
        ],
        if (argent != null)
          KojiCard(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(children: [
              FactureKv('Signé HT', euro(num2(argent['signeHt']))),
              FactureKv('Facturé TTC', euro(num2(argent['factureTtc']))),
              FactureKv('Payé', euro(num2(argent['paye']))),
              FactureKv('En retard', euro(num2(argent['retard'])), strong: num2(argent['retard']) > 0),
            ]),
          ),
        if (type == 'client')
          KojiCard(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Accès et préférences', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              FactureKv('Chantier', _s(c['address']).isEmpty ? '—' : _s(c['address'])),
              FactureKv('Accès', [if (_s(c['accessCode']).isNotEmpty) 'code ${c['accessCode']}', c['floor']].where((x) => _s(x).isNotEmpty).join(' · ').ifEmpty('—')),
              if (_s(c['preferences']).isNotEmpty) FactureKv('Préférence', _s(c['preferences'])),
              for (final pe in _liste(c['personnes'])) FactureKv(_s(pe['nom']), _s(pe['role'])),
            ]),
          ),
        if (vig != null)
          KojiCard(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Documents de vigilance', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              for (final doc in _liste(vig['docs']))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_s(doc['nom']), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: p.heading)),
                      Text(_s(doc['texte']), style: TextStyle(fontSize: 12, color: p.muted)),
                    ])),
                    KojiPill(
                      doc['etat'] == 'ok' ? 'OK' : doc['etat'] == 'echeance' ? 'Échéance' : doc['facultatif'] == true ? 'Facultatif' : 'Bloquant',
                      tone: doc['etat'] == 'ok' ? KojiTone.green : doc['etat'] == 'echeance' ? KojiTone.amber : doc['facultatif'] == true ? KojiTone.grey : KojiTone.coral,
                    ),
                  ]),
                ),
              if (a?['cle'] != 'vigilance') TextButton(onPressed: _busy ? null : () => _faire(() => repo.poster({'action': 'demander', 'id': c['id']}), 'Demande envoyée.'), child: const Text('Demander les documents')),
            ]),
          ),
        if (f['pro'] is Map && _liste((f['pro'] as Map)['chantiers']).isNotEmpty)
          KojiCard(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Chantiers', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
              for (final ch in _liste((f['pro'] as Map)['chantiers'])) FactureKv('${ch['title']}${_s(ch['lot']).isNotEmpty ? ' · ${ch['lot']}' : ''}', '${euro(num2(ch['ht']))} HT'),
              FactureKv('Cumul de l\'année', '${euro(num2((f['pro'] as Map)['cumulAnnee']))} HT', strong: true),
            ]),
          ),
        if (f['genre'] == 'syndic' || type == 'fournisseur' || type == 'architecte')
          KojiCard(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (l, v) in _blocsType(f, c)) FactureKv(l, v.isEmpty ? 'à renseigner' : v),
            ]),
          ),
        KojiField(label: 'Noter un appel ou une info', controller: _note, hint: 'au clavier ou au micro du clavier', maxLines: 2),
        Row(children: [
          Expanded(child: KojiButton(label: 'Appel', variant: KojiButtonVariant.secondary, onPressed: _busy ? null : () => _noter(repo, c, 'appel'))),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'Note', variant: KojiButtonVariant.secondary, onPressed: _busy ? null : () => _noter(repo, c, 'note'))),
        ]),
        Text('Historique', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: p.heading)),
        if (_liste(f['historique']).isEmpty) Text('Devis, factures, visites et notes s\'ajoutent seuls.', style: TextStyle(fontSize: 12.5, color: p.muted)),
        for (final h in _liste(f['historique']).take(30)) FactureKv('${jourCourt(h['quand'])} · ${h['titre']}', _s(h['texte'])),
      ],
    );
  }

  Future<void> _noter(ContactsRepository repo, Json c, String kind) async {
    if (_note.text.trim().isEmpty) return;
    final t = _note.text;
    _note.clear();
    await _faire(() => repo.modifier({'action': 'noter', 'id': c['id'], 'texte': t, 'kind': kind}), 'Noté.');
  }

  List<(String, String)> _blocsType(Json f, Json c) {
    if (f['genre'] == 'syndic') {
      final s = Map<String, dynamic>.from(c['syndic'] as Map? ?? const {});
      return [('Gestionnaire', _s(s['gestionnaire'])), ('Conseil syndical', _s(s['conseil'])), ('Vote des travaux', _s(s['vote'])), ('Paiement', _s(s['paiement'])), ('Accès', _s(s['acces'])), ('Documents', _s(s['documents']))];
    }
    if (f['type'] == 'fournisseur') {
      final s = Map<String, dynamic>.from(c['fournisseurInfo'] as Map? ?? const {});
      final fo = f['fournisseur'] as Map?;
      return [('Remise négociée', _s(s['remises'])), ('Paiement', _s(s['paiement'])), ('Franco de port', _s(s['franco'])), ('Commercial', _s(s['commercial'])), if (fo != null) ('Commandes de l\'année', '${num2(fo['commandes']).round()} · ${euro(num2(fo['commandesHt']))} HT')];
    }
    final s = Map<String, dynamic>.from(c['prescripteurInfo'] as Map? ?? const {});
    final ap = _liste(f['apportes']);
    return [('Chantiers apportés', ap.map((x) => x['title']).join(', ')), ('Montant signé', '${euro(ap.fold<double>(0, (t, x) => t + num2(x['signeHt'])))} HT'), ('Remerciement', _s(s['remerciement'])), ('Préférence', _s(s['preference']))];
  }
}

extension on String {
  String ifEmpty(String autre) => isEmpty ? autre : this;
}

// ---------------------------------------------------------------------------
// PRO-10.2 Ajouter un contact (téléphone) : photo de la carte lue par Koji.
// ---------------------------------------------------------------------------
class AjouterContactScreen extends ConsumerStatefulWidget {
  const AjouterContactScreen({super.key, this.prisePhoto});
  final PrisePhotoCarte? prisePhoto;

  @override
  ConsumerState<AjouterContactScreen> createState() => _AjouterContactScreenState();
}

class _AjouterContactScreenState extends ConsumerState<AjouterContactScreen> {
  final _entreprise = TextEditingController();
  final _contact = TextEditingController();
  final _tel = TextEditingController();
  final _email = TextEditingController();
  final _siret = TextEditingController();
  // « Client » par défaut : c'est le contact le plus souvent ajouté à la main.
  String _role = 'client';
  Json? _doublon;
  bool _lu = false;
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_entreprise, _contact, _tel, _email, _siret]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _photo() async {
    final octets = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (octets == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await ref.read(contactsRepositoryProvider).poster({'action': 'carte', 'data': 'data:image/jpeg;base64,${base64Encode(octets)}'});
      final pr = Map<String, dynamic>.from(r['proposition'] as Map);
      setState(() {
        _entreprise.text = _s(pr['companyName']).isNotEmpty ? _s(pr['companyName']) : '${pr['firstName'] ?? ''} ${pr['lastName'] ?? ''}'.trim();
        _contact.text = _s(pr['contactPerson']);
        _tel.text = _s(pr['phone']);
        _email.text = _s(pr['email']);
        _siret.text = _s(pr['siret']);
        _role = _s((pr['roles'] as List?)?.first).ifEmpty('client');
        _doublon = r['doublon'] is Map ? Map<String, dynamic>.from(r['doublon'] as Map) : null;
        _lu = true;
      });
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enregistrer() async {
    if (_entreprise.text.trim().isEmpty) {
      showFacturesMessage(context, 'Indiquez le nom ou l\'entreprise.');
      return;
    }
    setState(() => _busy = true);
    try {
      final societe = _siret.text.trim().isNotEmpty || _contact.text.trim().isNotEmpty;
      final r = await ref.read(contactsRepositoryProvider).poster({
        'type': societe ? 'societe' : 'particulier',
        if (societe) 'companyName': _entreprise.text.trim() else 'lastName': _entreprise.text.trim(),
        'contactPerson': _contact.text.trim(),
        'phone': _tel.text.trim(),
        'email': _email.text.trim(),
        'siret': _siret.text.trim(),
        'roles': [_role],
        'source': _lu ? 'carte' : 'saisie',
        if (_doublon != null) 'completer': _doublon!['id'],
      });
      ref.invalidate(carnetProvider);
      if (mounted) {
        showFacturesMessage(context, _doublon != null ? 'Fiche existante complétée.' : 'Contact ajouté.');
        context.pushReplacement(ficheContactRoute(_s(r['id'])));
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
    return KojiPage(
      title: 'Nouveau contact',
      subtitle: _lu ? 'Lu par Koji depuis la carte de visite' : null,
      appBarOnPhone: true,
      main: [
        KojiButton(label: _busy && !_lu ? 'Koji lit la carte…' : 'Photo de la carte ou du devis reçu', variant: KojiButtonVariant.secondary, expand: true, loading: _busy && !_lu, onPressed: _busy ? null : _photo),
        DropdownButtonFormField<String>(
          initialValue: _role,
          decoration: const InputDecoration(labelText: 'Type', isDense: true),
          items: const [
            DropdownMenuItem(value: 'client', child: Text('Client')),
            DropdownMenuItem(value: 'sous_traitant', child: Text('Sous-traitant')),
            DropdownMenuItem(value: 'fournisseur', child: Text('Fournisseur')),
            DropdownMenuItem(value: 'architecte', child: Text('Prescripteur')),
            DropdownMenuItem(value: 'prospect', child: Text('Prospect')),
          ],
          onChanged: (v) => setState(() => _role = v ?? 'client'),
        ),
        KojiField(label: 'Entreprise ou nom', controller: _entreprise),
        KojiField(label: 'Contact', controller: _contact, hint: 'Prénom N. · fonction'),
        KojiField(label: 'Téléphone', controller: _tel, keyboardType: TextInputType.phone),
        KojiField(label: 'E-mail', controller: _email, keyboardType: TextInputType.emailAddress),
        KojiField(label: 'SIRET', controller: _siret, keyboardType: TextInputType.number),
        if (_doublon != null) KojiAlertBox(title: 'Ce contact existe déjà : ${_doublon!['nom']}', message: '${_doublon!['par']} · la fiche existante sera complétée.', tone: KojiTone.amber),
        if (_role == 'sous_traitant') Text('Sous-traitant : Koji demandera ensuite l\'URSSAF, le Kbis, la décennale et la RC pro.', style: TextStyle(fontSize: 12.5, color: p.muted)),
        KojiButton(label: _doublon != null ? 'Compléter la fiche' : 'Enregistrer', expand: true, loading: _busy && _lu, onPressed: _busy ? null : _enregistrer),
      ],
    );
  }
}
