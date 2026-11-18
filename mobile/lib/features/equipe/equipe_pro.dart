import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show errorText, showFacturesMessage;

// Équipe dans Koji Pro (maquettes PRO-16 à 16.3, téléphone) sur l'API du
// site (/api/equipe) : qui est où aujourd'hui, heures de la semaine à
// valider, fiche compagnon, ajouter un compagnon avec un lien d'invitation
// envoyé par SMS (pas de mot de passe). Les sous-traitants n'y sont jamais.
const equipeRoute = '/equipe';
const heuresEquipeRoute = '/equipe/heures';
const ajouterCompagnonRoute = '/equipe/nouveau';
String ficheCompagnonRoute(String id) => '/equipe/fiche/$id';

final equipeRepositoryProvider = Provider<EquipeRepository>((ref) => EquipeRepository(ref.watch(kojiProApiProvider)));
final equipeProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(equipeRepositoryProvider).equipe());
final semaineEquipeProvider = FutureProvider.autoDispose.family<Json, String>((ref, lundi) => ref.watch(equipeRepositoryProvider).semaine(lundi));
final ficheCompagnonProvider = FutureProvider.autoDispose.family<Json, String>((ref, id) => ref.watch(equipeRepositoryProvider).fiche(id));

class EquipeRepository {
  EquipeRepository(this._api);
  final KojiProApi _api;

  Future<Json> equipe() => _api.get('/api/equipe');
  Future<Json> semaine(String lundi) => _api.get('/api/equipe', query: {'semaine': lundi});
  Future<Json> fiche(String id) => _api.get('/api/equipe', query: {'id': id});
  Future<Json> agir(Json corps) => _api.post('/api/equipe', corps);
}

/// Langues proposées aux compagnons (mêmes codes que le site, PRO-15.1).
const languesCompagnon = {
  'fr': 'français', 'pt': 'portugais', 'ar': 'arabe', 'tr': 'turc', 'ro': 'roumain', 'pl': 'polonais',
  'ta': 'tamoul', 'zh': 'chinois', 'en': 'anglais', 'es': 'espagnol', 'it': 'italien', 'de': 'allemand',
};

/// « 8 h », « 38,5 h » (feuille d'heures).
String heuresDecimales(Object? minutes) {
  final h = (num2(minutes) / 6).round() / 10;
  final t = h == h.roundToDouble() ? h.toInt().toString() : h.toString().replaceAll('.', ',');
  return '$t h';
}

/// « 6 h 12 » (durée en cours, vue compagnon).
String heuresMinutes(Object? minutes) {
  final m = num2(minutes).round().clamp(0, 100000);
  return '${m ~/ 60} h ${(m % 60).toString().padLeft(2, '0')}';
}

String initiales(String nom) {
  final mots = nom.split(RegExp(r'\s+')).where((m) => m.isNotEmpty).take(2);
  final t = mots.map((m) => m[0]).join().toUpperCase();
  return t.isEmpty ? '?' : t;
}

/// Lien « sms: » avec le message prêt (Android et iOS).
Uri smsUri(String telephone, String message) =>
    Uri.parse('sms:${telephone.replaceAll(RegExp(r'[^\d+]'), '')}?&body=${Uri.encodeComponent(message)}');

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
const _mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const _moisLongs = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
String _dateCourte(String j) => j.length < 10 ? '' : '${int.parse(j.substring(8, 10))} ${_mois[int.parse(j.substring(5, 7)) - 1]}';
String _moisAnnee(String j) => j.length < 7 ? '' : '${_moisLongs[int.parse(j.substring(5, 7)) - 1]} ${j.substring(0, 4)}';

Widget _attente(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) return KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(a.error!), icon: KojiIcons.contacts)]);
  return KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
}

class _Avatar extends StatelessWidget {
  const _Avatar(this.nom);
  final String nom;
  @override
  Widget build(BuildContext context) => CircleAvatar(
        radius: 16,
        backgroundColor: const Color(0xFF171B1E),
        child: Text(initiales(nom), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
      );
}

/// PRO-16 : l'équipe aujourd'hui (qui est où), ce que Koji a appris.
class EquipeScreen extends ConsumerWidget {
  const EquipeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(equipeProvider);
    if (!a.hasValue) return _attente('Équipe', a);
    final d = a.value!;
    final equipe = _liste(d['equipe']);
    final k = _map(d['kpis']);
    final docs = _liste(d['documents']);
    final appris = _liste(d['appris']);
    final p = context.koji;
    final enRetard = equipe.where((w) => w['statut'] == 'pas_arrive').toList();
    return KojiPage(
      title: 'Équipe',
      subtitle: _s(d['aujourdhui']).isEmpty ? '' : jourCourt(_s(d['aujourdhui'])),
      appBarOnPhone: true,
      actions: [KojiButton(label: 'Ajouter', leadingIcon: KojiIcons.plus, variant: KojiButtonVariant.secondary, onPressed: () => context.push(ajouterCompagnonRoute))],
      onRefresh: () async {
        ref.invalidate(equipeProvider);
        await ref.read(equipeProvider.future);
      },
      main: [
        if (equipe.isEmpty)
          KojiEmptyState(
            title: 'Votre équipe',
            subtitle: 'Ajoutez vos compagnons : ils reçoivent un lien par SMS, voient leur journée et pointent leurs heures en deux boutons. Aucun prix ne leur est montré.',
            icon: KojiIcons.contacts,
            action: KojiButton(label: 'Ajouter un compagnon', onPressed: () => context.push(ajouterCompagnonRoute)),
          )
        else ...[
          KojiKpiRow(children: [
            KojiKpi(label: 'Sur chantier', value: '${k['surChantier'] ?? 0} sur ${k['total'] ?? 0}', icon: KojiIcons.hardHat),
            KojiKpi(label: 'Heures cette semaine', value: heuresDecimales(k['heuresSemaine']), sub: k['aValider'] == true ? 'à valider' : 'validées', icon: KojiIcons.clock, onTap: () => context.push(heuresEquipeRoute)),
          ]),
          if (docs.isNotEmpty)
            KojiAlertBox(
              title: '${docs.length} document${docs.length > 1 ? 's' : ''} à renouveler',
              message: '${_s(docs.first['document'])} de ${_s(docs.first['nom'])}, ${_dateCourte(_s(docs.first['jusqua']))}',
              onTap: () => context.push(ficheCompagnonRoute(_s(docs.first['workerId']))),
            ),
          KojiSectionTitle("Qui est où, aujourd'hui", action: 'Heures', onAction: () => context.push(heuresEquipeRoute)),
          KojiCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            child: Column(children: [
              for (final w in equipe)
                InkWell(
                  onTap: () => context.push(ficheCompagnonRoute(_s(w['id']))),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    child: Row(children: [
                      _Avatar(_s(w['nom'])),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(_s(w['nom']), style: TextStyle(fontWeight: FontWeight.w700, color: w['statut'] == 'conge' ? p.muted : p.heading)),
                          Text(_s(w['chantier']).isEmpty ? _s(w['metier']) : _s(w['chantier']), style: TextStyle(fontSize: 12, color: p.muted)),
                        ]),
                      ),
                      if (w['statut'] == 'arrive')
                        Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.check, size: 14), const SizedBox(width: 4), Text(_s(w['texte']), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600))])
                      else if (w['statut'] == 'pas_arrive')
                        KojiPill(_s(w['texte']), tone: KojiTone.amber)
                      else
                        Text(_s(w['texte']), style: TextStyle(fontSize: 12.5, color: p.muted)),
                    ]),
                  ),
                ),
            ]),
          ),
          if (enRetard.isNotEmpty && _s(enRetard.first['telephone']).isNotEmpty)
            KojiAlertBox(
              title: "${_s(enRetard.first['nom']).split(' ').first} n'est pas encore arrivé",
              message: [_s(enRetard.first['chantier']), 'Toucher pour appeler'].where((x) => x.isNotEmpty).join(' · '),
              icon: KojiIcons.clock,
              onTap: () => launchUrl(Uri.parse('tel:${_s(enRetard.first['telephone']).replaceAll(RegExp(r'[^\d+]'), '')}')),
            ),
          if (appris.isNotEmpty) ...[
            const KojiSectionTitle('Ce que Koji a appris'),
            for (final x in appris) _Appris(x),
          ],
        ],
        const SizedBox(height: 8),
        TextButton(onPressed: () => context.push('/synchronization'), child: Text("Ancien outil Équipe de l'app", style: TextStyle(fontSize: 12, color: p.faint))),
      ],
    );
  }
}

class _Appris extends ConsumerWidget {
  const _Appris(this.x);
  final Json x;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    return KojiCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_s(x['titre']), style: TextStyle(fontSize: 12, color: p.muted)),
        Text(_s(x['resume']), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: p.heading)),
        const SizedBox(height: 6),
        Text(_s(x['texte']), style: TextStyle(fontSize: 14, height: 1.45, color: p.ink)),
        const SizedBox(height: 10),
        Row(children: [
          TextButton(
            onPressed: () async {
              await ref.read(equipeRepositoryProvider).agir({'action': 'masquer-appris', 'cle': x['cle']});
              ref.invalidate(equipeProvider);
            },
            child: const Text('Plus tard'),
          ),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'Mettre à jour mes prix', expand: true, variant: KojiButtonVariant.gold, onPressed: () => context.push('/bibliotheque'))),
        ]),
      ]),
    );
  }
}

/// Lundi de la semaine d'une date (AAAA-MM-JJ).
String lundiDe(String jour) {
  final d = DateTime.utc(int.parse(jour.substring(0, 4)), int.parse(jour.substring(5, 7)), int.parse(jour.substring(8, 10)));
  return d.subtract(Duration(days: d.weekday - 1)).toIso8601String().substring(0, 10);
}

String _ajouter(String jour, int n) =>
    DateTime.utc(int.parse(jour.substring(0, 4)), int.parse(jour.substring(5, 7)), int.parse(jour.substring(8, 10))).add(Duration(days: n)).toIso8601String().substring(0, 10);

/// PRO-16.2 : heures de la semaine, une ligne par compagnon, valider.
class HeuresEquipeScreen extends ConsumerStatefulWidget {
  const HeuresEquipeScreen({super.key});
  @override
  ConsumerState<HeuresEquipeScreen> createState() => _HeuresEquipeScreenState();
}

class _HeuresEquipeScreenState extends ConsumerState<HeuresEquipeScreen> {
  String _lundi = lundiDe(DateTime.now().toIso8601String().substring(0, 10));
  bool _busy = false;

  Future<void> _agir(Json corps, {String? ok}) async {
    setState(() => _busy = true);
    try {
      await ref.read(equipeRepositoryProvider).agir(corps);
      ref.invalidate(semaineEquipeProvider(_lundi));
      ref.invalidate(equipeProvider);
      if (ok != null && mounted) showFacturesMessage(context, ok);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _corriger(Json ligne, Json c) async {
    final ctrl = TextEditingController(text: (num2(c['minutes']) / 60).toStringAsFixed(1).replaceAll('.', ',').replaceAll(',0', ''));
    final r = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${_s(ligne['nom'])} · ${jourCourt(_s(c['date']))}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          KojiField(label: 'Heures', controller: ctrl, keyboardType: const TextInputType.numberWithOptions(decimal: true)),
          const SizedBox(height: 12),
          KojiButton(label: 'Enregistrer', expand: true, onPressed: () => Navigator.pop(ctx, 'ok')),
          TextButton(onPressed: () => Navigator.pop(ctx, 'conge'), child: const Text('Congé ce jour-là')),
        ]),
      ),
    );
    if (r == null) return;
    final h = double.tryParse(ctrl.text.replaceAll(',', '.')) ?? 0;
    await _agir({'action': 'corriger', 'workerId': ligne['workerId'], 'date': c['date'], 'minutes': h * 60, 'conge': r == 'conge'}, ok: 'Heures corrigées.');
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(semaineEquipeProvider(_lundi));
    if (!a.hasValue) return _attente('Heures de la semaine', a);
    final d = a.value!;
    final g = _map(d['grille']);
    final lignes = _liste(g['lignes']);
    final remarques = _liste(d['remarques']);
    final parWorker = _map(d['parWorker']);
    final validation = d['validation'] is Map ? _map(d['validation']) : null;
    final p = context.koji;
    final semaineCourante = _lundi == lundiDe(DateTime.now().toIso8601String().substring(0, 10));
    return KojiPage(
      title: 'Heures de la semaine',
      subtitle: 'du ${_dateCourte(_lundi)} au ${_dateCourte(_ajouter(_lundi, 4))}${validation == null ? ' · à valider' : ' · validée'}',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(semaineEquipeProvider(_lundi)),
      main: [
        Row(children: [
          TextButton(onPressed: () => setState(() => _lundi = _ajouter(_lundi, -7)), child: const Text('‹ Précédente')),
          const Spacer(),
          if (!semaineCourante) TextButton(onPressed: () => setState(() => _lundi = _ajouter(_lundi, 7)), child: const Text('Suivante ›')),
        ]),
        for (final r in remarques)
          KojiAlertBox(
            title: _s(r['texte']),
            message: _s(r['detail']),
            icon: r['type'] == 'depart' ? KojiIcons.sparkle : KojiIcons.alert,
            onTap: r['type'] == 'manquant' ? () => _agir({'action': 'rappel', 'date': r['date'], 'workerIds': r['workerIds']}, ok: 'Rappel envoyé dans Koji.') : null,
          ),
        KojiCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(children: [
            for (final l in lignes)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text(_s(l['nom']), style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
                subtitle: Text(_liste(parWorker[l['workerId']]).map((x) => '${_s(x['chantier'])} · ${x['jours']} jour${num2(x['jours']) > 1 ? 's' : ''}').join(', '), style: TextStyle(fontSize: 12, color: p.muted)),
                trailing: Text(heuresDecimales(l['total']), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                children: [
                  for (final c in _liste(l['cases']))
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(jourCourt(_s(c['date']))),
                      trailing: Text(
                        switch (_s(c['statut'])) { 'conge' => 'congé', 'manquant' => '—', 'a_venir' => '', 'douteux' => '${heuresDecimales(c['minutes'])} ?', _ => heuresDecimales(c['minutes']) },
                        style: TextStyle(fontWeight: FontWeight.w600, color: c['statut'] == 'douteux' ? KojiColors.goldText : null),
                      ),
                      onTap: c['statut'] == 'a_venir' ? null : () => _corriger(l, c),
                    ),
                ],
              ),
            for (final st in _liste(d['sousTraitants']))
              ListTile(contentPadding: EdgeInsets.zero, title: Text(_s(st['nom']), style: TextStyle(color: p.muted)), subtitle: const Text('sous-traitant · non compté'), trailing: const Text('—')),
          ]),
        ),
        Text('Touchez un jour pour corriger ; chaque correction est gardée. Les heures validées comptent dans la marge de chaque chantier.', style: TextStyle(fontSize: 12, color: p.muted)),
        const SizedBox(height: 10),
        KojiButton(
          label: validation == null ? 'Valider la semaine' : 'Valider à nouveau',
          expand: true,
          loading: _busy,
          onPressed: lignes.isEmpty ? null : () => _agir({'action': 'valider', 'lundi': _lundi}, ok: 'Semaine validée.'),
        ),
      ],
    );
  }
}

/// PRO-16.1 : fiche compagnon.
class FicheCompagnonScreen extends ConsumerWidget {
  const FicheCompagnonScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(ficheCompagnonProvider(id));
    if (!a.hasValue) return _attente('Fiche compagnon', a);
    final f = _map(a.value!['fiche']);
    final roles = _map(a.value!['roles']);
    final role = _map(roles[f['role']]);
    final heures = _liste(f['heures']);
    final docs = _liste(f['documents']);
    final inv = f['invitation'] is Map ? _map(f['invitation']) : null;
    final tel = _s(f['telephone']);
    final p = context.koji;
    final auj = DateTime.now().toIso8601String().substring(0, 10);
    final dans30 = _ajouter(auj, 30);
    final chantiersSemaine = (_map(f['semaine'])['chantiers'] as List? ?? const []).map((x) => '$x').join(', ');
    Future<void> agir(Json corps, String ok) async {
      try {
        await ref.read(equipeRepositoryProvider).agir({'id': id, ...corps});
        ref.invalidate(ficheCompagnonProvider(id));
        ref.invalidate(equipeProvider);
        if (context.mounted) showFacturesMessage(context, ok);
      } catch (e) {
        if (context.mounted) showFacturesMessage(context, errorText(e));
      }
    }

    return KojiPage(
      title: _s(f['nom']),
      subtitle: '${_s(f['metier'])} · ${_s(role['label'])}',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(ficheCompagnonProvider(id)),
      main: [
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _Kv('Cette semaine', chantiersSemaine.isEmpty ? '—' : chantiersSemaine),
            _Kv('Heures semaine', heuresDecimales(_map(f['semaine'])['minutes'])),
            _Kv('Rôle', '${_s(role['label'])} · ${_s(role['detail'])}'),
            _Kv('Langue', languesCompagnon[_s(f['langue'])] ?? 'français'),
            _Kv('Téléphone', tel.isEmpty ? '—' : tel),
            _Kv('Coût horaire, pour vos marges', num2(f['coutHoraire']) > 0 ? '${num2(f['coutHoraire']).toStringAsFixed(2).replaceAll('.', ',')} € · vous seul le voyez' : '—'),
            if (_s(f['depuis']).isNotEmpty) _Kv("Dans l'équipe depuis", _moisAnnee(_s(f['depuis']))),
          ]),
        ),
        if (tel.isNotEmpty)
          KojiButton(label: 'Appeler ${_s(f['nom']).split(' ').first}', expand: true, variant: KojiButtonVariant.secondary, onPressed: () => launchUrl(Uri.parse('tel:${tel.replaceAll(RegExp(r'[^\d+]'), '')}'))),
        const KojiSectionTitle('Heures, 4 semaines'),
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(children: [
            for (final h in heures)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  SizedBox(width: 36, child: Text(_s(h['semaine']), style: TextStyle(fontSize: 12, color: p.muted))),
                  Expanded(child: KojiProgressBar(value: (num2(h['minutes']) / (45 * 60)).clamp(0, 1).toDouble(), color: const Color(0xFF171B1E), height: 12)),
                  SizedBox(width: 56, child: Text(heuresDecimales(h['minutes']), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700))),
                ]),
              ),
          ]),
        ),
        const KojiSectionTitle('Documents'),
        KojiCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final x in docs)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_s(x['nom']), style: const TextStyle(fontWeight: FontWeight.w600)),
                subtitle: Text(
                  _s(x['jusqua']).compareTo(auj) < 0 ? 'expiré le ${_dateCourte(_s(x['jusqua']))}' : _s(x['jusqua']).compareTo(dans30) <= 0 ? 'expire le ${_dateCourte(_s(x['jusqua']))}' : "valable jusqu'en ${_moisAnnee(_s(x['jusqua']))}",
                  style: TextStyle(fontWeight: _s(x['jusqua']).compareTo(dans30) <= 0 ? FontWeight.w700 : FontWeight.w400),
                ),
                trailing: IconButton(tooltip: 'Retirer', icon: const Icon(Icons.close, size: 18), onPressed: () => agir({'action': 'retirer-document', 'documentId': x['id']}, 'Document retiré.')),
              ),
            TextButton.icon(
              onPressed: () async {
                final r = await _demanderDocument(context);
                if (r != null) await agir({'action': 'document', ...r}, 'Document ajouté.');
              },
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Ajouter un document'),
            ),
            Text('Koji vous prévient un mois avant chaque date.', style: TextStyle(fontSize: 12, color: p.muted)),
            const SizedBox(height: 6),
          ]),
        ),
        const KojiSectionTitle('Accès à Koji'),
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (inv != null) ...[
              Text("Lien valable 7 jours · code pour l'app : ${_s(inv['code'])}", style: TextStyle(fontSize: 13, color: p.muted)),
              const SizedBox(height: 8),
              Text(_s(inv['message']), style: const TextStyle(fontSize: 13, height: 1.45)),
              const SizedBox(height: 10),
              if (tel.isNotEmpty) KojiButton(label: 'Envoyer par SMS', expand: true, variant: KojiButtonVariant.gold, onPressed: () => launchUrl(smsUri(tel, _s(inv['message'])))),
              TextButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _s(inv['message'])));
                  showFacturesMessage(context, 'Message copié.');
                },
                child: const Text('Copier le message'),
              ),
            ] else
              Text(f['dejaConnecte'] == true ? '${_s(f['nom']).split(' ').first} est connecté à Koji.' : 'Aucune invitation en cours.', style: TextStyle(fontSize: 13, color: p.muted)),
            KojiButton(label: inv == null ? "Renvoyer l'invitation" : 'Nouveau lien', variant: KojiButtonVariant.secondary, onPressed: () => agir({'action': 'inviter'}, 'Invitation prête.')),
            TextButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: Text("Retirer ${_s(f['nom'])} de l'équipe ?"),
                    content: const Text("Il n'aura plus accès à Koji ; ses heures restent dans l'historique."),
                    actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Annuler')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Retirer'))],
                  ),
                );
                if (ok == true) {
                  await agir({'action': 'retirer'}, "Retiré de l'équipe.");
                  if (context.mounted) context.pop();
                }
              },
              child: const Text("Retirer de l'équipe"),
            ),
          ]),
        ),
      ],
    );
  }
}

Future<Json?> _demanderDocument(BuildContext context) async {
  final nom = TextEditingController();
  DateTime? date;
  return showModalBottomSheet<Json>(
    context: context,
    isScrollControlled: true,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setState) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Ajouter un document', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          KojiField(label: 'Document', controller: nom, hint: 'Carte BTP, formation amiante…'),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () async {
              final d = await showDatePicker(context: ctx, firstDate: DateTime(2020), lastDate: DateTime(2040), initialDate: DateTime.now().add(const Duration(days: 365)));
              if (d != null) setState(() => date = d);
            },
            child: Text(date == null ? "Valable jusqu'au…" : "Valable jusqu'au ${_dateCourte(date!.toIso8601String().substring(0, 10))} ${date!.year}"),
          ),
          const SizedBox(height: 12),
          KojiButton(
            label: 'Ajouter',
            expand: true,
            onPressed: () {
              if (nom.text.trim().isEmpty || date == null) return;
              Navigator.pop(ctx, {'nom': nom.text.trim(), 'jusqua': date!.toIso8601String().substring(0, 10)});
            },
          ),
        ]),
      ),
    ),
  );
}

class _Kv extends StatelessWidget {
  const _Kv(this.k, this.v);
  final String k;
  final String v;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(k, style: TextStyle(fontSize: 12, color: context.koji.muted)),
          Text(v, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
        ]),
      );
}

/// PRO-16.3 : ajouter un compagnon (invitation par message, pas de mot de passe).
class AjouterCompagnonScreen extends ConsumerStatefulWidget {
  const AjouterCompagnonScreen({super.key});
  @override
  ConsumerState<AjouterCompagnonScreen> createState() => _AjouterCompagnonScreenState();
}

class _AjouterCompagnonScreenState extends ConsumerState<AjouterCompagnonScreen> {
  final _nom = TextEditingController();
  final _tel = TextEditingController();
  final _metier = TextEditingController();
  String _langue = 'fr';
  String _role = 'compagnon';
  bool _busy = false;
  Json? _fait;

  static const _roles = {
    'compagnon': ['Compagnon', 'sa journée, ses tâches, pointer, envoyer des photos · aucun prix'],
    'chef': ['Chef de chantier', "en plus : le planning et les chantiers qu'il suit"],
    'dirigeant': ['Dirigeant', 'tout, y compris prix, factures et comptabilité'],
  };

  @override
  void dispose() {
    _nom.dispose();
    _tel.dispose();
    _metier.dispose();
    super.dispose();
  }

  Future<void> _envoyer() async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(equipeRepositoryProvider).agir({'action': 'ajouter', 'nom': _nom.text.trim(), 'telephone': _tel.text.trim(), 'metier': _metier.text.trim(), 'langue': _langue, 'role': _role});
      ref.invalidate(equipeProvider);
      final inv = _map(r['invitation']);
      if (_tel.text.trim().isNotEmpty) await launchUrl(smsUri(_tel.text.trim(), _s(inv['message'])));
      setState(() => _fait = r);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    if (_fait != null) {
      final inv = _map(_fait!['invitation']);
      return KojiPage(
        title: 'Invitation prête',
        appBarOnPhone: true,
        main: [
          Text("${_nom.text.trim()} est dans l'équipe. Il ouvre Koji avec ce lien, sans mot de passe, ou entre le code ${_s(inv['code'])} dans l'app.", style: const TextStyle(fontSize: 14, height: 1.45)),
          KojiCard(padding: const EdgeInsets.all(14), child: Text(_s(inv['message']), style: const TextStyle(fontSize: 13, height: 1.45))),
          if (_tel.text.trim().isNotEmpty) KojiButton(label: 'Envoyer par SMS', expand: true, variant: KojiButtonVariant.gold, onPressed: () => launchUrl(smsUri(_tel.text.trim(), _s(inv['message'])))),
          KojiButton(
            label: 'Copier le message',
            expand: true,
            variant: KojiButtonVariant.secondary,
            onPressed: () {
              Clipboard.setData(ClipboardData(text: _s(inv['message'])));
              showFacturesMessage(context, 'Message copié.');
            },
          ),
          TextButton(onPressed: () => context.pushReplacement(ficheCompagnonRoute(_s(_fait!['id']))), child: const Text('Ouvrir sa fiche')),
        ],
      );
    }
    return KojiPage(
      title: 'Ajouter un compagnon',
      subtitle: 'Invitation par message',
      appBarOnPhone: true,
      main: [
        KojiField(label: 'Prénom et nom', controller: _nom, onChanged: (_) => setState(() {})),
        KojiField(label: 'Téléphone', controller: _tel, keyboardType: TextInputType.phone),
        KojiField(label: 'Métier', controller: _metier, hint: 'Plaquiste, carreleur…'),
        DropdownButtonFormField<String>(
          initialValue: _langue,
          decoration: const InputDecoration(labelText: 'Langue des messages'),
          items: [for (final e in languesCompagnon.entries) DropdownMenuItem(value: e.key, child: Text(e.value[0].toUpperCase() + e.value.substring(1)))],
          onChanged: (v) => setState(() => _langue = v ?? 'fr'),
        ),
        const KojiSectionTitle("Ce qu'il peut faire"),
        for (final e in _roles.entries)
          KojiCard(
            padding: const EdgeInsets.all(12),
            borderColor: _role == e.key ? p.ink : null,
            onTap: () => setState(() => _role = e.key),
            child: Row(children: [
              Icon(_role == e.key ? Icons.radio_button_checked : Icons.radio_button_unchecked, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(e.value[0], style: const TextStyle(fontWeight: FontWeight.w700)),
                Text(e.value[1], style: TextStyle(fontSize: 12, color: p.muted)),
              ])),
            ]),
          ),
        Text("Il reçoit un lien par SMS ; pas de mot de passe à créer.", style: TextStyle(fontSize: 12, color: p.muted)),
        KojiButton(label: "Envoyer l'invitation", expand: true, loading: _busy, onPressed: _nom.text.trim().isEmpty ? null : _envoyer),
      ],
    );
  }
}
