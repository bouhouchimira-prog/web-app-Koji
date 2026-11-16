import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, euro0, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/core/route_args.dart' show QuoteDetailArgs;
import 'package:koji/features/quote/providers/quote_creation_provider.dart';

// KojiPage dans Koji Pro (maquettes PRO-13 à 13.4, téléphone) sur l'API du
// site (/api/kojipage) : résumé, demandes reçues et base de devis préparée
// par Koji, nouvelle réalisation depuis un chantier terminé, réglages,
// carte de visite (partage, QR code plein écran, fiche contact).
const kojipageRoute = '/kojipage';
const demandesKojiPageRoute = '/kojipage/demandes';
String demandeKojiPageRoute(String id) => '/kojipage/demandes/$id';
const nouvelleRealisationRoute = '/kojipage/realisation';
const reglagesKojiPageRoute = '/kojipage/reglages';
const carteKojiPageRoute = '/kojipage/carte';

final kojiPageRepositoryProvider = Provider<KojiPageRepository>((ref) => KojiPageRepository(ref.watch(kojiProApiProvider)));
final kojiPageProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(kojiPageRepositoryProvider).page());
final demandesKojiPageProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(kojiPageRepositoryProvider).demandes());
final demandeKojiPageProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(kojiPageRepositoryProvider).demande(id));

class KojiPageRepository {
  KojiPageRepository(this._api);
  final KojiProApi _api;

  Future<Json> page() => _api.get('/api/kojipage');
  Future<Json> modifier(Json champs) => _api.patch('/api/kojipage', champs);
  Future<Json> action(Json corps) => _api.post('/api/kojipage', corps);
  Future<Json> demandes() => _api.get('/api/kojipage/demandes');
  Future<Json> demande(String id) => _api.get('/api/kojipage/demandes', query: {'id': id});
  Future<Json> agir(String id, Json corps) => _api.post('/api/kojipage/demandes', {'id': id, ...corps});
}

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _note(Object? n) => num2(n).toStringAsFixed(1).replaceAll('.', ',');
String delaiTexte(Object? h) {
  if (h == null) return '—';
  final v = num2(h);
  if (v < 1) return '< 1 h';
  if (v < 48) return '${v.round()} h';
  return '${(v / 24).round()} j';
}

String depuis(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  final h = DateTime.now().difference(d).inMinutes / 60;
  if (h < 1) return "il y a moins d'une heure";
  if (h < 24) return 'il y a ${h.round()} h';
  if (h < 48) return 'hier';
  return jourCourt(iso);
}

Future<void> _ouvrir(String url) => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);

Widget _chargement(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) return KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(a.error!), icon: KojiIcons.kojipage)]);
  return KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
}

/// Résumé (maquette PRO-13, téléphone « KojiPage · résumé »).
class KojiPageScreen extends ConsumerStatefulWidget {
  const KojiPageScreen({super.key});

  @override
  ConsumerState<KojiPageScreen> createState() => _KojiPageScreenState();
}

class _KojiPageScreenState extends ConsumerState<KojiPageScreen> {
  bool _busy = false;

  Future<void> _publier() async {
    setState(() => _busy = true);
    try {
      await ref.read(kojiPageRepositoryProvider).action({'action': 'publier'});
      ref.invalidate(kojiPageProvider);
      if (mounted) showFacturesMessage(context, 'Modifications publiées.');
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(kojiPageProvider);
    if (!a.hasValue) return _chargement('KojiPage', a);
    final p = context.koji;
    final d = a.value!;
    final dem = ref.watch(demandesKojiPageProvider).valueOrNull;
    final nouvelles = _liste(dem?['demandes']).where((x) => x['etat'] == 'a_repondre').toList();
    final c = _map(d['completude']);
    final k = _map(d['demandes']);
    final av = _map(d['avisStats']);
    final url = _s(d['url']);
    final nonPubliees = num2(d['nonPubliees']).round();
    final offre = _map(d['offre']);
    return KojiPage(
      title: 'KojiPage',
      subtitle: url.replaceFirst(RegExp(r'^https?://'), ''),
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(kojiPageProvider);
        ref.invalidate(demandesKojiPageProvider);
        await ref.read(kojiPageProvider.future);
      },
      main: [
        if (offre['niveau'] == 'essentielle') const KojiAlertBox(title: 'Offre Start', message: 'KojiPage essentielle : 5 photos, sans avis ni demandes directes. Passez à Pro sur le site pour tout débloquer.', tone: KojiTone.info),
        KojiKpiRow(children: [
          KojiKpi(label: 'Visites 30 j', value: '${num2(_map(d['visites'])['total']).round()}'),
          KojiKpi(label: 'Demandes', value: '${num2(k['mois']).round()}', onTap: () => context.push(demandesKojiPageRoute)),
          KojiKpi(label: 'Réponse', value: delaiTexte(d['delai'])),
          KojiKpi(label: 'Avis', value: num2(av['nombre']) > 0 ? _note(av['moyenne']) : '—'),
        ]),
        if (nouvelles.isNotEmpty) ...[
          KojiSectionTitle('${nouvelles.length} nouvelle${nouvelles.length > 1 ? 's' : ''} demande${nouvelles.length > 1 ? 's' : ''}', action: 'Toutes', onAction: () => context.push(demandesKojiPageRoute)),
          for (final x in nouvelles.take(2))
            KojiCard(
              onTap: () => context.push(demandeKojiPageRoute(_s(x['id']))),
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(x['titre']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                  Text([x['client'], x['ville'], depuis(_s(x['createdAt']))].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
                ])),
                KojiButton(label: 'Répondre', variant: KojiButtonVariant.secondary, height: 36, onPressed: () => context.push(demandeKojiPageRoute(_s(x['id'])))),
              ]),
            ),
        ],
        KojiCard(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Page complète à ${num2(c['pct']).round()} %', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
            const SizedBox(height: 8),
            KojiProgressBar(value: num2(c['pct']) / 100),
            if (_s(c['prochaine']).isNotEmpty) ...[const SizedBox(height: 8), Text('Prochaine étape : ${c['prochaine']}.', style: TextStyle(fontSize: 13, color: p.muted))],
          ]),
        ),
        KojiButton(label: 'Ajouter une réalisation', expand: true, leadingIcon: KojiIcons.plus, onPressed: () => context.push(nouvelleRealisationRoute)),
        Row(children: [
          Expanded(child: KojiButton(label: 'Voir ma page', variant: KojiButtonVariant.secondary, onPressed: () => _ouvrir(url))),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'Partager le lien', variant: KojiButtonVariant.secondary, onPressed: () => Share.share(url))),
        ]),
        Row(children: [
          Expanded(child: KojiButton(label: 'Carte de visite', variant: KojiButtonVariant.secondary, onPressed: () => context.push(carteKojiPageRoute))),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'Réglages', variant: KojiButtonVariant.secondary, onPressed: () => context.push(reglagesKojiPageRoute))),
        ]),
        if (nonPubliees > 0 || d['enLigne'] != true)
          KojiButton(label: d['enLigne'] == true ? 'Publier les modifications ($nonPubliees)' : 'Mettre en ligne', expand: true, variant: KojiButtonVariant.gold, loading: _busy, onPressed: _busy ? null : _publier),
        Text('Profil, prestations et avis se modifient aussi sur le site, onglets de la KojiPage.', style: TextStyle(fontSize: 12, color: p.faint)),
      ],
    );
  }
}

/// Demandes reçues (maquette PRO-13.1, téléphone).
class DemandesKojiPageScreen extends ConsumerWidget {
  const DemandesKojiPageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(demandesKojiPageProvider);
    if (!a.hasValue) return _chargement('Demandes KojiPage', a);
    final p = context.koji;
    final liste = _liste(a.value!['demandes']);
    final nouvelles = liste.where((x) => x['etat'] == 'a_repondre').length;
    return KojiPage(
      title: 'Demandes',
      subtitle: nouvelles > 0 ? '$nouvelles nouvelle${nouvelles > 1 ? 's' : ''} · réservées à votre entreprise' : 'réservées à votre entreprise',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(demandesKojiPageProvider);
        await ref.read(demandesKojiPageProvider.future);
      },
      main: [
        if (liste.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.kojipage, title: 'Pas encore de demande', subtitle: 'Partagez votre page et votre carte de visite : les demandes arrivent ici, sans jeton.'),
        for (final x in liste)
          KojiCard(
            onTap: () => context.push(demandeKojiPageRoute(_s(x['id']))),
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(_s(x['titre']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading))),
                KojiPill(_s(x['etatTexte']), tone: x['etat'] == 'a_repondre' ? KojiTone.navy : KojiTone.grey),
              ]),
              const SizedBox(height: 4),
              Text([x['client'], x['ville'], depuis(_s(x['createdAt']))].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
              Text(x['etat'] == 'declinee' ? 'déclinée · ${x['declinMotif']}' : [x['sourceTexte'], x['budget']].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
            ]),
          ),
      ],
    );
  }
}

class DemandeKojiPageScreen extends ConsumerStatefulWidget {
  const DemandeKojiPageScreen({super.key, required this.id});
  final String id;

  @override
  ConsumerState<DemandeKojiPageScreen> createState() => _DemandeKojiPageScreenState();
}

class _DemandeKojiPageScreenState extends ConsumerState<DemandeKojiPageScreen> {
  String _busy = '';

  Future<void> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = '${corps['action']}');
    try {
      await ref.read(kojiPageRepositoryProvider).agir(widget.id, corps);
      ref.invalidate(demandeKojiPageProvider(widget.id));
      ref.invalidate(demandesKojiPageProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = '');
    }
  }

  Future<void> _texte(String titre, String action, {String hint = ''}) async {
    final ctrl = TextEditingController();
    final t = await showModalBottomSheet<String>(
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
    if (t != null && t.isNotEmpty) await _agir({'action': action, 'texte': t}, ok: 'Réponse envoyée par e-mail.');
  }

  Future<void> _decliner() async {
    const motifs = {'hors_metier': 'Hors de mes métiers', 'hors_zone': 'Hors de ma zone', 'indisponible': 'Pas disponible'};
    final m = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        const ListTile(title: Text('Décliner avec un motif', style: TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('Le client est prévenu et peut décrire son projet sur Koji.')),
        for (final e in motifs.entries) ListTile(title: Text(e.value), onTap: () => Navigator.pop(ctx, e.key)),
      ])),
    );
    if (m != null) await _agir({'action': 'decliner', 'motif': m}, ok: 'Demande déclinée, client prévenu.');
  }

  Future<void> _visite() async {
    final now = DateTime.now();
    final jour = await showDatePicker(context: context, firstDate: now, lastDate: now.add(const Duration(days: 120)), initialDate: now.add(const Duration(days: 1)), locale: const Locale('fr'));
    if (jour == null || !mounted) return;
    final heure = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 9, minute: 0));
    if (heure == null) return;
    final quand = DateTime(jour.year, jour.month, jour.day, heure.hour, heure.minute);
    await _agir({'action': 'visite', 'date': quand.toUtc().toIso8601String()}, ok: 'Visite proposée et ajoutée au calendrier.');
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(demandeKojiPageProvider(widget.id));
    if (!a.hasValue) return _chargement('Demande', a);
    final p = context.koji;
    final d = _map(a.value!['demande']);
    final client = _map(d['client']);
    final projet = _map(d['projet']);
    final base = d['base'] is Map ? _map(d['base']) : null;
    final budget = d['budgetDetail'] is Map ? _map(d['budgetDetail']) : null;
    final declinee = d['etat'] == 'declinee';
    return KojiPage(
      title: _s(d['titre']),
      subtitle: [d['sourceTexte'], depuis(_s(d['createdAt']))].where((v) => _s(v).isNotEmpty).join(' · '),
      appBarOnPhone: true,
      main: [
        Row(children: [Expanded(child: Text([client['nom'], d['ville']].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(color: p.heading, fontWeight: FontWeight.w600))), KojiPill(_s(d['etatTexte']), tone: KojiTone.navy)]),
        Text(client['masque'] == true ? 'Coordonnées complètes après votre réponse.' : [client['telephone'], client['email']].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(fontSize: 13, color: p.muted)),
        if (_s(d['message']).isNotEmpty) KojiCard(padding: const EdgeInsets.all(14), child: Text('« ${d['message']} »', style: TextStyle(color: p.heading))),
        if (projet.isNotEmpty) ...[
          const KojiSectionTitle('Projet décrit avec Koji'),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final t in [projet['piece'], ..._listeTexte(projet['travaux'])].where((v) => _s(v).isNotEmpty)) KojiPill(_s(t), tone: KojiTone.grey)]),
          if (num2(projet['surface']) > 0) FactureKv('Surface', '${num2(projet['surface']).round()} m²'),
          if (_s(projet['acces']).isNotEmpty) FactureKv('Accès', _s(projet['acces'])),
          if (_s(projet['quand']).isNotEmpty) FactureKv('Quand', _s(projet['quand'])),
          if (budget != null) FactureKv('Budget', budget['compatible'] == true ? 'compatible' : '${euro0(num2(budget['budget']))} · ${euro0(num2(budget['ecart']))} sous votre prix'),
        ],
        if (_listeTexte(d['photos']).isNotEmpty)
          SizedBox(height: 88, child: ListView(scrollDirection: Axis.horizontal, children: [for (final u in _listeTexte(d['photos'])) Padding(padding: const EdgeInsets.only(right: 6), child: ClipRRect(borderRadius: BorderRadius.circular(4), child: Image.network(u, width: 88, height: 88, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(width: 88))))])),
        if (base != null)
          KojiAlertBox(
            title: 'Koji a préparé',
            tone: KojiTone.amber,
            icon: KojiIcons.sparkle,
            message: [
              'Base de devis · ${num2(base['lignes']).round()} lignes${num2(base['ttc']) > 0 ? ', ${euro0(num2(base['ttc']))} TTC à vos prix' : ''}.',
              if (_listeTexte(base['hypotheses']).isNotEmpty) 'Hypothèses : ${_listeTexte(base['hypotheses']).join(' ; ')}.',
              if (_listeTexte(base['nonCompris']).isNotEmpty) 'Non compris : ${_listeTexte(base['nonCompris']).join(' ; ')}.',
            ].join('\n'),
          )
        else if (!declinee)
          KojiButton(label: 'Koji prépare une base de devis', variant: KojiButtonVariant.secondary, expand: true, leadingIcon: KojiIcons.sparkle, loading: _busy == 'preparer', onPressed: _busy.isNotEmpty ? null : () => _agir({'action': 'preparer'})),
        if (!declinee) ...[
          Row(children: [
            Expanded(child: KojiButton(label: 'Proposer une visite', variant: KojiButtonVariant.secondary, onPressed: _busy.isNotEmpty ? null : _visite)),
            const SizedBox(width: 8),
            Expanded(child: KojiButton(label: 'Répondre', variant: KojiButtonVariant.secondary, onPressed: _busy.isNotEmpty ? null : () => _texte('Répondre au client', 'repondre', hint: 'Bonjour, merci pour votre demande…'))),
          ]),
          KojiButton(
            label: _s(d['quoteId']).isNotEmpty ? 'Devis ${_s(d['quoteNumber']).isNotEmpty ? d['quoteNumber'] : 'commencé'}' : 'Démarrer un devis guidé',
            expand: true,
            onPressed: _s(d['quoteId']).isNotEmpty
                ? null
                : () {
                    ref.read(quoteCreationProvider.notifier).reset();
                    context.push('/quote/detail', extra: QuoteDetailArgs(data: <String, dynamic>{
                      'tasks': <String, dynamic>{},
                      'client': {'name': _s(client['nom']), 'email': _s(client['email']), 'phone': _s(client['telephone'])},
                      'demandeKojiPage': {'id': widget.id, 'texte': _s(d['messageDevis'])},
                    }));
                  },
          ),
          TextButton(onPressed: _busy.isNotEmpty ? null : _decliner, child: const Text('Décliner avec un motif')),
        ],
        Text('Aucun jeton débité. La demande vous reste réservée.', style: TextStyle(fontSize: 12, color: p.faint)),
      ],
    );
  }
}

List<String> _listeTexte(Object? v) => (v as List? ?? const []).map((x) => '$x').where((x) => x.isNotEmpty).toList();

/// Nouvelle réalisation depuis un chantier terminé (maquette PRO-13, téléphone).
class NouvelleRealisationScreen extends ConsumerStatefulWidget {
  const NouvelleRealisationScreen({super.key});

  @override
  ConsumerState<NouvelleRealisationScreen> createState() => _NouvelleRealisationScreenState();
}

class _NouvelleRealisationScreenState extends ConsumerState<NouvelleRealisationScreen> {
  Json? _r;
  final _titre = TextEditingController();
  final _lieu = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _titre.dispose();
    _lieu.dispose();
    super.dispose();
  }

  Future<void> _preparer(String projectId) async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(kojiPageRepositoryProvider).action({'action': 'realisation-chantier', 'projectId': projectId});
      final real = _map(r['realisation']);
      _titre.text = _s(real['name']);
      _lieu.text = _s(real['lieu']);
      setState(() => _r = real);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enregistrer({required bool publier}) async {
    final r = _r;
    if (r == null) return;
    setState(() => _busy = true);
    final repo = ref.read(kojiPageRepositoryProvider);
    try {
      final page = await repo.page();
      final reals = _liste(_map(page['site'])['realisations']).map((x) => x['id'] == r['id'] ? {...x, 'name': _titre.text.trim(), 'lieu': _lieu.text.trim()} : x).toList();
      await repo.modifier({'realisations': reals});
      if (publier) {
        final x = await repo.action({'action': 'publier-realisation', 'id': r['id']});
        if (mounted) showFacturesMessage(context, _map(x['realisation'])['statut'] == 'accord_demande' ? "Accord demandé au client dans Koji Client : publication dès son accord." : 'Réalisation prête : publiez les modifications.');
      } else if (mounted) {
        showFacturesMessage(context, 'Brouillon enregistré.');
      }
      ref.invalidate(kojiPageProvider);
      if (mounted) context.pop();
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(kojiPageProvider);
    if (!a.hasValue) return _chargement('Nouvelle réalisation', a);
    final p = context.koji;
    final chantiers = _liste(a.value!['chantiers']);
    final r = _r;
    return KojiPage(
      title: 'Nouvelle réalisation',
      subtitle: 'depuis un chantier terminé',
      appBarOnPhone: true,
      main: [
        if (r == null) ...[
          if (chantiers.isEmpty) const KojiEmptyState(compact: true, icon: KojiIcons.chantiers, title: 'Pas encore de chantier terminé', subtitle: 'Une réalisation se prépare à partir des photos avant et après d\'un chantier réceptionné.'),
          for (final c in chantiers)
            KojiCard(
              onTap: _busy ? null : () => _preparer(_s(c['projectId'])),
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(c['titre']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                  Text([c['lieu'], if (_s(c['termineLe']).isNotEmpty) 'terminé le ${jourCourt(c['termineLe'])}'].where((v) => _s(v).isNotEmpty).join(' · '), style: TextStyle(fontSize: 12.5, color: p.muted)),
                  Text('Photos avant · ${num2(c['avant']).round()} · après · ${num2(c['apres']).round()}', style: TextStyle(fontSize: 12.5, color: p.muted)),
                ])),
                const Icon(Icons.chevron_right),
              ]),
            ),
        ] else ...[
          FactureKv('Photos avant', '${_listeTexte(r['avant']).length} dans le chantier'),
          FactureKv('Photos après', '${_listeTexte(r['apres']).length} dans le chantier'),
          KojiField(label: 'Titre', controller: _titre),
          KojiField(label: 'Lieu', controller: _lieu, helper: "Lieu arrondi à la ville ou à l'arrondissement, jamais l'adresse."),
          const KojiAlertBox(title: 'Accord du client', message: 'Demande envoyée au client dans Koji Client. Publication dès son accord.', tone: KojiTone.info),
          Row(children: [
            Expanded(child: KojiButton(label: 'Brouillon', variant: KojiButtonVariant.secondary, onPressed: _busy ? null : () => _enregistrer(publier: false))),
            const SizedBox(width: 8),
            Expanded(child: KojiButton(label: 'Publier', loading: _busy, onPressed: _busy ? null : () => _enregistrer(publier: true))),
          ]),
        ],
      ],
    );
  }
}

/// Réglages (maquette PRO-13.3, téléphone).
class ReglagesKojiPageScreen extends ConsumerStatefulWidget {
  const ReglagesKojiPageScreen({super.key});

  @override
  ConsumerState<ReglagesKojiPageScreen> createState() => _ReglagesKojiPageScreenState();
}

class _ReglagesKojiPageScreenState extends ConsumerState<ReglagesKojiPageScreen> {
  bool _busy = false;

  Future<void> _faire(Future<Json> Function() appel, {String? ok}) async {
    setState(() => _busy = true);
    try {
      await appel();
      ref.invalidate(kojiPageProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(kojiPageProvider);
    if (!a.hasValue) return _chargement('Réglages', a);
    final d = a.value!;
    final site = _map(d['site']);
    final sections = {'realisations': true, 'prestations': true, 'avis': true, 'formulaire': true, 'horaires': true, ..._map(site['sections'])};
    final reals = _map(d['realisations']);
    final repo = ref.read(kojiPageRepositoryProvider);
    final nonPubliees = num2(d['nonPubliees']).round();
    Widget bascule(String label, String sous, bool valeur, ValueChanged<bool> onChanged) => SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(label), subtitle: Text(sous), value: valeur, onChanged: _busy ? null : onChanged);
    return KojiPage(
      title: 'Réglages',
      subtitle: nonPubliees > 0 ? '$nonPubliees modification${nonPubliees > 1 ? 's' : ''} non publiée${nonPubliees > 1 ? 's' : ''}' : 'KojiPage',
      appBarOnPhone: true,
      main: [
        KojiKpiRow(children: [
          KojiKpi(label: 'Visites 30 j', value: '${num2(_map(d['visites'])['total']).round()}'),
          KojiKpi(label: 'Demandes', value: '${num2(_map(d['demandes'])['mois']).round()}'),
          KojiKpi(label: 'Avis', value: num2(_map(d['avisStats'])['nombre']) > 0 ? _note(_map(d['avisStats'])['moyenne']) : '—'),
        ]),
        const KojiSectionTitle('Ma page'),
        FactureKv('Adresse', _s(d['url']).replaceFirst(RegExp(r'^https?://'), '')),
        FactureKv('Zone', _s(site['zoneIntervention']).isEmpty ? 'à renseigner' : _s(site['zoneIntervention'])),
        FactureKv('Prestations', '${_liste(site['prestations']).length}'),
        FactureKv('Réalisations', '${num2(reals['publiee']).round()} publiées · ${num2(reals['brouillon']).round()} brouillons'),
        const KojiSectionTitle('Visibilité'),
        bascule('Page en ligne', site['indexable'] == false ? 'non indexée par les moteurs de recherche' : 'visible sur Google', site['indexable'] != false, (v) => _faire(() => repo.modifier({'indexable': v}))),
        bascule('Bouton « Demander un devis »', 'formulaire guidé par Koji', sections['formulaire'] != false, (v) => _faire(() => repo.modifier({'sections': {...sections, 'formulaire': v}}))),
        bascule('Afficher les avis', '${num2(_map(d['avisStats'])['nombre']).round()} avis vérifiés', sections['avis'] != false, (v) => _faire(() => repo.modifier({'sections': {...sections, 'avis': v}}))),
        KojiButton(label: d['enLigne'] == true ? 'Publier les modifications' : 'Mettre en ligne', expand: true, variant: KojiButtonVariant.gold, loading: _busy, onPressed: _busy || (d['enLigne'] == true && nonPubliees == 0) ? null : () => _faire(() => repo.action({'action': 'publier'}), ok: 'Modifications publiées.')),
        Text("Adresse, couleur du bandeau et sections se règlent aussi sur le site.", style: TextStyle(fontSize: 12, color: context.koji.faint)),
      ],
    );
  }
}

/// Carte de visite (maquette PRO-13.4, téléphone) : partage et QR code.
class CarteKojiPageScreen extends ConsumerWidget {
  const CarteKojiPageScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(kojiPageProvider);
    if (!a.hasValue) return _chargement('Carte de visite', a);
    final p = context.koji;
    final d = a.value!;
    final site = _map(d['site']);
    final k = {'nom': site['title'], 'personne': site['contactName'], 'fonction': 'Dirigeant', 'telephone': site['contactPhone'], 'email': site['contactEmail'], 'metiers': _listeTexte(site['specialties']).take(4).toList(), ..._map(site['carte'])};
    final lien = '${d['url']}/carte';
    final texte = '${_s(k['personne']).isNotEmpty ? '${k['personne']}, ' : ''}${k['nom']} : nos réalisations, nos avis et votre demande de devis sur $lien';
    final qr = _s(d['qr']);
    final couleurs = _liste(d['couleurs']);
    final hex = _s((couleurs.firstWhere((c) => c['id'] == (_map(d['offre'])['couleur'] == true ? site['couleur'] : 'marine'), orElse: () => couleurs.isEmpty ? {'hex': '#0B1530'} : couleurs.first))['hex']);
    final bandeau = Color(int.parse('FF${hex.replaceFirst('#', '')}', radix: 16));
    if (_map(d['offre'])['carte'] != true) {
      return const KojiPage(title: 'Carte de visite', appBarOnPhone: true, main: [KojiEmptyState(title: 'Offres Pro et Business', subtitle: 'La carte de visite est incluse dans les offres Pro et Business.', icon: KojiIcons.kojipage)]);
    }
    return KojiPage(
      title: 'Carte de visite',
      subtitle: _s(k['nom']),
      appBarOnPhone: true,
      main: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: bandeau, width: 6)), boxShadow: const [BoxShadow(color: Color(0x22000000), blurRadius: 8)]),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (_s(site['tagline']).isNotEmpty) Text(_s(site['tagline']), style: const TextStyle(fontSize: 12, color: Color(0xFF5B5F66))),
            const SizedBox(height: 6),
            Text(_s(k['nom']), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF0B1530))),
            if (_s(k['personne']).isNotEmpty) Text('${k['personne']} · ${k['fonction']}', style: const TextStyle(color: Color(0xFF0B1530))),
            if ((k['metiers'] as List).isNotEmpty) Text((k['metiers'] as List).join(' · '), style: const TextStyle(fontSize: 12, color: Color(0xFF5B5F66))),
            const SizedBox(height: 8),
            if (_s(k['telephone']).isNotEmpty) Text('Tél. ${k['telephone']}', style: const TextStyle(color: Color(0xFF0B1530))),
            if (_s(k['email']).isNotEmpty) Text('E-mail ${k['email']}', style: const TextStyle(color: Color(0xFF0B1530))),
          ]),
        ),
        const KojiSectionTitle('Partager'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          KojiButton(label: 'SMS', variant: KojiButtonVariant.secondary, height: 40, onPressed: () => _ouvrir('sms:?&body=${Uri.encodeComponent(texte)}')),
          KojiButton(label: 'WhatsApp', variant: KojiButtonVariant.secondary, height: 40, onPressed: () => _ouvrir('https://wa.me/?text=${Uri.encodeComponent(texte)}')),
          KojiButton(label: 'E-mail', variant: KojiButtonVariant.secondary, height: 40, onPressed: () => _ouvrir('mailto:?subject=${Uri.encodeComponent('Carte de visite ${k['nom']}')}&body=${Uri.encodeComponent(texte)}')),
          KojiButton(label: 'Lien', variant: KojiButtonVariant.secondary, height: 40, onPressed: () => Share.share(texte)),
        ]),
        KojiButton(label: 'QR code plein écran', expand: true, onPressed: qr.isEmpty ? null : () => Navigator.of(context).push(MaterialPageRoute<void>(fullscreenDialog: true, builder: (_) => QrPleinEcran(dataUrl: qr, nom: _s(k['nom']), url: _s(d['url']))))),
        Row(children: [
          Expanded(child: KojiButton(label: 'Fiche contact', variant: KojiButtonVariant.secondary, onPressed: () => _ouvrir('${_s(d['url']).replaceFirst('/site/', '/api/site/')}/vcf'))),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'Imprimer', variant: KojiButtonVariant.secondary, onPressed: () => _ouvrir('${Uri.parse(_s(d['url'])).origin}/kojipage/carte'))),
        ]),
        Row(children: [
          Expanded(child: FactureKv('Ouvertures 30 j', '${num2(_map(d['carte'])['ouvertures']).round()}')),
          Expanded(child: FactureKv('Contacts', '${num2(_map(d['carte'])['contacts']).round()}')),
        ]),
        Text('Sur le chantier : montrez le QR code, le client enregistre votre contact et voit vos réalisations.', style: TextStyle(fontSize: 12.5, color: p.muted)),
      ],
    );
  }
}

class QrPleinEcran extends StatelessWidget {
  const QrPleinEcran({super.key, required this.dataUrl, required this.nom, required this.url});
  final String dataUrl;
  final String nom;
  final String url;

  @override
  Widget build(BuildContext context) {
    final octets = base64Decode(dataUrl.substring(dataUrl.indexOf(',') + 1));
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(backgroundColor: Colors.white, foregroundColor: Colors.black, elevation: 0, title: const Text('QR code à montrer au client')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Image.memory(octets, width: 300, height: 300, filterQuality: FilterQuality.none),
            const SizedBox(height: 16),
            Text(nom, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF0B1530))),
            Text(url.replaceFirst(RegExp(r'^https?://'), ''), style: const TextStyle(color: Color(0xFF5B5F66))),
          ]),
        ),
      ),
    );
  }
}
