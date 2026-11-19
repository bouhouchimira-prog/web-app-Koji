import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/features/intervention_rapide/intervention_rapide.dart'
    show suiviInterventionRoute;
import 'package:koji/features/urgences/urgences_logic.dart';

// Urgences côté artisan (maquette PRO-17, « KOJI Pro téléphone ») : être
// disponible jusqu'à une heure, mes urgences et mes prix, chiffres du jour ;
// une urgence arrive (60 s pour accepter ou refuser librement) ; le client
// confirme, l'artisan part, puis l'intervention rapide (PRO-17.1) prend le
// relais : devis avant travaux, facture. Données : /api/urgences du site.
// L'écran se rafraîchit seul (5 s quand on est disponible, 30 s sinon) :
// le push téléphone n'est pas encore branché.

const urgencesRoute = '/urgences';
const urgencesReglagesRoute = '/urgences/reglages';

final urgencesProRepositoryProvider = Provider<UrgencesProRepository>(
    (ref) => UrgencesProRepository(ref.watch(kojiProApiProvider)));

String _erreur(Object e) =>
    e is KojiWebApiException ? e.message : 'Connexion impossible. Réessayez.';

// ── Écran ──────────────────────────────────────────────────────────────────

class UrgencesProScreen extends ConsumerStatefulWidget {
  const UrgencesProScreen({super.key});
  @override
  ConsumerState<UrgencesProScreen> createState() => _UrgencesProScreenState();
}

class _UrgencesProScreenState extends ConsumerState<UrgencesProScreen> {
  Map<String, dynamic>? _vue;
  String _message = '';
  bool _occupe = false;
  Timer? _minuterie;
  Duration _rythme = Duration.zero;

  UrgencesProRepository get _repo => ref.read(urgencesProRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _charger();
  }

  @override
  void dispose() {
    _minuterie?.cancel();
    super.dispose();
  }

  void _planifier() {
    final v = _vue;
    final actif = mapDe(v?['reglages'])['actif'] == true ||
        listeDe(v?['enCours']).isNotEmpty;
    final rythme = Duration(seconds: actif ? 5 : 30);
    if (rythme == _rythme && _minuterie != null) return;
    _rythme = rythme;
    _minuterie?.cancel();
    _minuterie = Timer.periodic(rythme, (_) async {
      if (_occupe) return;
      try {
        final a = await _repo.alertes();
        if (mounted && !_occupe) setState(() => _vue = {...?_vue, ...a});
      } catch (_) {}
    });
  }

  Future<void> _charger() async {
    try {
      final v = await _repo.vue();
      if (!mounted) return;
      setState(() {
        _vue = v;
        _message = '';
      });
      _planifier();
    } catch (e) {
      if (mounted) setState(() => _message = _erreur(e));
    }
  }

  Future<void> _agir(Map<String, dynamic> corps) async {
    setState(() => _occupe = true);
    try {
      final v = await _repo.agir(corps);
      if (!mounted) return;
      setState(() {
        _vue = v;
        _message = '';
      });
      _planifier();
    } catch (e) {
      if (!mounted) return;
      setState(() => _message = _erreur(e));
      await _charger();
    } finally {
      if (mounted) setState(() => _occupe = false);
    }
  }

  Future<void> _basculer(bool actif) async {
    final r = mapDe(_vue?['reglages']);
    if (!actif) return _agir({'action': 'disponible', 'actif': false});
    final defaut = texteDe(r['heureParDefaut']).split(':');
    final choisie = await showTimePicker(
      context: context,
      helpText: 'Je reçois les urgences jusqu\'à',
      initialTime: TimeOfDay(
          hour: int.tryParse(defaut.first) ?? 20,
          minute: int.tryParse(defaut.length > 1 ? defaut[1] : '0') ?? 0),
    );
    if (choisie == null) return;
    final hh =
        '${choisie.hour.toString().padLeft(2, '0')}:${choisie.minute.toString().padLeft(2, '0')}';
    await _agir({'action': 'disponible', 'actif': true, 'jusqua': hh});
  }

  Future<void> _partir(Map<String, dynamic> e, int minutes) async {
    setState(() => _occupe = true);
    try {
      final r = await _repo.agir(
          {'action': 'partir', 'id': e['id'], 'minutes': minutes});
      if (!mounted) return;
      setState(() => _occupe = false);
      await context.push(suiviInterventionRoute(texteDe(r['interventionId'])));
      if (mounted) await _charger();
    } catch (er) {
      if (mounted) {
        setState(() {
          _occupe = false;
          _message = _erreur(er);
        });
      }
    }
  }

  Future<void> _modifier() async {
    final v = _vue;
    if (v == null) return;
    final corps = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(builder: (_) => UrgencesReglagesView(vue: v)),
    );
    if (corps != null) await _agir(corps);
  }

  @override
  Widget build(BuildContext context) {
    final v = _vue;
    if (v == null) {
      final da = ProDa.of(context);
      return Scaffold(
        backgroundColor: da.page,
        appBar: AppBar(title: const Text('Urgences')),
        body: Center(
          child: _message.isEmpty
              ? const CircularProgressIndicator()
              : Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Text(_message, textAlign: TextAlign.center, style: da.text(14)),
                    const SizedBox(height: 12),
                    OutlinedButton(onPressed: _charger, child: const Text('Réessayer')),
                  ]),
                ),
        ),
      );
    }
    final propositions = listeDe(v['propositions']);
    if (propositions.isNotEmpty) {
      final p = propositions.first;
      return UrgenceAlerteView(
        key: ValueKey(p['id']),
        proposition: p,
        occupe: _occupe,
        onRefuser: () => _agir({'action': 'refuser', 'id': p['id']}),
        onAccepter: (minutes) =>
            _agir({'action': 'accepter', 'id': p['id'], 'minutes': minutes}),
      );
    }
    return UrgencesProView(
      vue: v,
      message: _message,
      occupe: _occupe,
      onActualiser: _charger,
      onBasculer: _basculer,
      onModifier: _modifier,
      onRetirer: (e) => _agir({'action': 'retirer', 'id': e['id']}),
      onPartir: _partir,
      onOuvrir: (id) => context.push(suiviInterventionRoute(id)),
    );
  }
}

// ── Être disponible, mes urgences, aujourd'hui ─────────────────────────────

class UrgencesProView extends StatelessWidget {
  const UrgencesProView({
    super.key,
    required this.vue,
    required this.onBasculer,
    required this.onModifier,
    required this.onRetirer,
    required this.onPartir,
    required this.onOuvrir,
    this.onActualiser,
    this.message = '',
    this.occupe = false,
  });

  final Map<String, dynamic> vue;
  final ValueChanged<bool> onBasculer;
  final VoidCallback onModifier;
  final ValueChanged<Map<String, dynamic>> onRetirer;
  final void Function(Map<String, dynamic> urgence, int minutes) onPartir;
  final ValueChanged<String> onOuvrir;
  final Future<void> Function()? onActualiser;
  final String message;
  final bool occupe;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final r = mapDe(vue['reglages']);
    final acces = mapDe(vue['acces']);
    final zone = mapDe(r['zone']);
    final actif = r['actif'] == true;
    final categories =
        listeDe(r['categories']).where((c) => c['choisie'] == true).toList();
    final regle = zone.isNotEmpty && categories.isNotEmpty && (r['demiHeure'] ?? 0) != 0;
    final chiffres = mapDe(vue['chiffres']);
    final enCours = listeDe(vue['enCours']);
    final prises = listeDe(vue['prises']);
    final peutActiver = acces['ok'] == true && regle;
    final corps = ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        _Dispo(
          actif: actif,
          detail: actif
              ? 'jusqu\'à ${texteDe(r['jusqua'])}${zone.isEmpty ? '' : ' · ${zone['rayonKm']} km autour de ${texteDe(zone['adresse'])}'}'
              : (zone.isEmpty ? 'zone à régler' : '${zone['rayonKm']} km autour de ${texteDe(zone['adresse'])}'),
          onChanged: occupe || (!actif && !peutActiver) ? null : onBasculer,
        ),
        if (acces['ok'] != true) ...[
          const SizedBox(height: 10),
          _Bandeau(texteDe(acces['raison'])),
        ] else if (!regle) ...[
          const SizedBox(height: 10),
          const _Bandeau('Réglez votre zone, vos urgences et vos prix pour pouvoir les recevoir.'),
        ],
        if (message.isNotEmpty) ...[
          const SizedBox(height: 10),
          _Bandeau(message),
        ],
        for (final p in prises) ...[
          const SizedBox(height: 10),
          _Bandeau('${texteDe(p['titre'])} · ${texteDe(p['quartier'])} : prise par un autre artisan.'),
        ],
        for (final e in enCours) ...[
          const SizedBox(height: 10),
          _EnCours(e: e, occupe: occupe, onRetirer: onRetirer, onPartir: onPartir, onOuvrir: onOuvrir),
        ],
        const SizedBox(height: 10),
        ProCard(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text('Mes urgences', style: da.text(15, weight: FontWeight.w700))),
              _Lien('Modifier', onTap: onModifier),
            ]),
            const SizedBox(height: 4),
            if (categories.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text('Aucune urgence choisie pour l\'instant.', style: da.text(13, color: da.grey)),
              ),
            for (final c in categories)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
                child: Row(children: [
                  KojiIcon(texteDe(c['icone']), size: 20, color: da.ink),
                  const SizedBox(width: 10),
                  Expanded(child: Text(texteDe(c['label']), style: da.text(14, weight: FontWeight.w600))),
                  Text(eurosCourt(c['prix'] as num? ?? 0), style: da.text(14, weight: FontWeight.w700)),
                ]),
              ),
            const SizedBox(height: 6),
            Text(
              'déplacement et 1re demi-heure, TTC${(r['demiHeure'] ?? 0) != 0 ? ', puis ${eurosCourt(r['demiHeure'] as num)} la demi-heure' : ''} · pièces sur devis',
              style: da.text(12, color: da.grey),
            ),
          ]),
        ),
        const SizedBox(height: 10),
        ProCard(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Aujourd\'hui', style: da.text(15, weight: FontWeight.w700)),
            const SizedBox(height: 8),
            Row(children: [
              _Chiffre(texteDe(chiffres['urgences'] ?? 0), (chiffres['urgences'] ?? 0) == 1 ? 'urgence' : 'urgences'),
              _Chiffre(texteDe(chiffres['factureTexte'] ?? '0 €'), 'facturés'),
              _Chiffre(texteDe(chiffres['arriveeTexte'] ?? '—'), 'arrivée moyenne'),
            ]),
          ]),
        ),
        const SizedBox(height: 12),
        Text(notePro, style: da.text(12, color: da.grey, height: 1.45)),
      ],
    );
    return Scaffold(
      backgroundColor: da.page,
      appBar: AppBar(
        backgroundColor: da.card,
        surfaceTintColor: da.card,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Urgences', style: da.text(15, weight: FontWeight.w700)),
          if (texteDe(vue['entreprise']).isNotEmpty)
            Text(texteDe(vue['entreprise']), style: da.text(12, color: da.grey)),
        ]),
      ),
      body: onActualiser == null ? corps : RefreshIndicator(onRefresh: onActualiser!, child: corps),
    );
  }
}

class _Dispo extends StatelessWidget {
  const _Dispo({required this.actif, required this.detail, required this.onChanged});
  final bool actif;
  final String detail;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    const da = ProDa.light;
    return Semantics(
      toggled: actif,
      button: true,
      label: 'Recevoir les urgences',
      child: InkWell(
        onTap: onChanged == null ? null : () => onChanged!(!actif),
        child: Container(
          color: const Color(0xFF171B1E),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(actif ? 'Je reçois les urgences' : 'Je ne reçois pas d\'urgences',
                    style: da.text(15, weight: FontWeight.w700, color: Colors.white)),
                Text(detail, style: da.text(12, color: const Color(0xFFC4C7CC))),
              ]),
            ),
            const SizedBox(width: 14),
            Opacity(
              opacity: onChanged == null ? .45 : 1,
              child: Container(
                width: 46,
                height: 26,
                decoration: BoxDecoration(
                    color: actif ? Colors.white : const Color(0xFF5B5F66),
                    borderRadius: BorderRadius.circular(13)),
                alignment: actif ? Alignment.centerRight : Alignment.centerLeft,
                padding: const EdgeInsets.all(3),
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                      color: actif ? const Color(0xFF171B1E) : Colors.white,
                      shape: BoxShape.circle),
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

class _Bandeau extends StatelessWidget {
  const _Bandeau(this.texte);
  final String texte;
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
      decoration: BoxDecoration(color: da.card, border: Border(left: BorderSide(color: da.ink, width: 3))),
      child: Text(texte, style: da.text(13, height: 1.4)),
    );
  }
}

class _Lien extends StatelessWidget {
  const _Lien(this.texte, {required this.onTap});
  final String texte;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(color: da.pill, borderRadius: BorderRadius.circular(4)),
        child: Text(texte, style: da.text(13, weight: FontWeight.w600)),
      ),
    );
  }
}

class _Chiffre extends StatelessWidget {
  const _Chiffre(this.valeur, this.libelle);
  final String valeur;
  final String libelle;
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(valeur, style: da.text(20, weight: FontWeight.w700)),
        Text(libelle, style: da.text(12, color: da.grey)),
      ]),
    );
  }
}

/// Champ « J'arrive dans N min » (− / +).
class _Minutes extends StatelessWidget {
  const _Minutes({required this.minutes, required this.onChanged, this.sombre = false});
  final int minutes;
  final ValueChanged<int> onChanged;
  final bool sombre;
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final encre = sombre ? Colors.white : da.ink;
    final gris = sombre ? const Color(0xFFC4C7CC) : da.grey;
    Widget bouton(String t, int delta, String label) => Semantics(
          button: true,
          label: label,
          excludeSemantics: true,
          child: InkWell(
            onTap: () => onChanged((minutes + delta).clamp(5, 180)),
            child: Container(
              width: 34,
              height: 34,
              alignment: Alignment.center,
              decoration: BoxDecoration(border: Border.all(color: sombre ? const Color(0xFF5B5F66) : da.line)),
              child: Text(t, style: da.text(17, weight: FontWeight.w700, color: encre)),
            ),
          ),
        );
    return Row(children: [
      Text('J\'arrive dans', style: da.text(13, color: gris)),
      const SizedBox(width: 10),
      bouton('−', -5, 'Moins de minutes'),
      SizedBox(width: 52, child: Text('$minutes min', textAlign: TextAlign.center, style: da.text(14, weight: FontWeight.w700, color: encre))),
      bouton('+', 5, 'Plus de minutes'),
    ]);
  }
}

class _EnCours extends StatefulWidget {
  const _EnCours({required this.e, required this.occupe, required this.onRetirer, required this.onPartir, required this.onOuvrir});
  final Map<String, dynamic> e;
  final bool occupe;
  final ValueChanged<Map<String, dynamic>> onRetirer;
  final void Function(Map<String, dynamic> urgence, int minutes) onPartir;
  final ValueChanged<String> onOuvrir;
  @override
  State<_EnCours> createState() => _EnCoursState();
}

class _EnCoursState extends State<_EnCours> {
  late int _minutes = ((widget.e['minutes'] as num?) ?? 15).toInt();

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final e = widget.e;
    final acceptee = e['etat'] == 'acceptee';
    return ProCard(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          Expanded(child: Text(texteDe(e['titre']), style: da.text(15, weight: FontWeight.w700))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(border: Border.all(color: acceptee ? da.grey : da.ink)),
            child: Text(acceptee ? 'Acceptée' : 'Confirmée', style: da.text(11.5, weight: FontWeight.w700)),
          ),
        ]),
        const SizedBox(height: 6),
        Text(
          acceptee
              ? '${texteDe(e['quartier'])} · arrivée annoncée vers ${texteDe(e['arriveeVers'])}. En attente de la confirmation du client : son adresse exacte et son téléphone arrivent à ce moment.'
              : '${texteDe(e['quartier'])} · le client attend votre arrivée vers ${texteDe(e['arriveeVers'])}. Son adresse et son téléphone sont dans l\'intervention.',
          style: da.text(13, height: 1.4),
        ),
        if (e['serrure'] == true && !acceptee) ...[
          const SizedBox(height: 6),
          Text(noteSerrure, style: da.text(12, color: da.grey, height: 1.4)),
        ],
        const SizedBox(height: 10),
        if (acceptee)
          Align(alignment: Alignment.centerLeft, child: _Lien('Je ne peux plus y aller', onTap: () => widget.onRetirer(e)))
        else if (e['parti'] == true)
          _BoutonJaune('Ouvrir l\'intervention', onTap: () => widget.onOuvrir(texteDe(e['interventionId'])))
        else ...[
          _Minutes(minutes: _minutes, onChanged: (m) => setState(() => _minutes = m)),
          const SizedBox(height: 10),
          _BoutonJaune('Je pars', onTap: widget.occupe ? null : () => widget.onPartir(e, _minutes)),
        ],
      ]),
    );
  }
}

class _BoutonJaune extends StatelessWidget {
  const _BoutonJaune(this.label, {required this.onTap});
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Material(
      color: ProDa.prim.withValues(alpha: onTap == null ? .5 : 1),
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        child: SizedBox(
          height: 50,
          child: Center(child: Text(label, style: da.text(16, weight: FontWeight.w700, color: ProDa.onPrim))),
        ),
      ),
    );
  }
}

// ── Une urgence arrive ─────────────────────────────────────────────────────

class UrgenceAlerteView extends StatefulWidget {
  const UrgenceAlerteView({
    super.key,
    required this.proposition,
    required this.onAccepter,
    required this.onRefuser,
    this.occupe = false,
    this.anime = true,
  });

  final Map<String, dynamic> proposition;
  final ValueChanged<int> onAccepter;
  final VoidCallback onRefuser;
  final bool occupe;

  /// Faux dans les tests : l'anneau reste sur les secondes reçues.
  final bool anime;

  @override
  State<UrgenceAlerteView> createState() => _UrgenceAlerteViewState();
}

class _UrgenceAlerteViewState extends State<UrgenceAlerteView> {
  late int _minutes = ((widget.proposition['minutes'] as num?) ?? 15).toInt();
  late int _secondes = widget.anime
      ? secondesRestantes(texteDe(widget.proposition['finLe']), DateTime.now())
      : ((widget.proposition['secondes'] as num?) ?? 60).toInt();
  Timer? _t;

  @override
  void initState() {
    super.initState();
    if (widget.anime) {
      _t = Timer.periodic(const Duration(seconds: 1), (_) {
        setState(() => _secondes = secondesRestantes(texteDe(widget.proposition['finLe']), DateTime.now()));
      });
    }
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const da = ProDa.light;
    final p = widget.proposition;
    final prix = mapDe(p['prix']);
    const gris = Color(0xFFC4C7CC);
    const filet = Color(0xFF3A3F43);
    final photo = texteDe(p['photo']);
    final proposeeA = (p['proposeeA'] as num?)?.toInt() ?? 0;
    return Scaffold(
      backgroundColor: const Color(0xFF171B1E),
      body: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
         Expanded(child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
          children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('NOUVELLE URGENCE', style: da.text(11, weight: FontWeight.w700, color: ProDa.prim, letterSpacing: .9)),
                  const SizedBox(height: 4),
                  Text(texteDe(p['titre']), style: da.text(22, weight: FontWeight.w700, color: Colors.white)),
                  const SizedBox(height: 2),
                  Text('${texteDe(p['quartier'])} · ${texteDe(p['distance'])} · environ ${texteDe(p['minutes'])} min', style: da.text(13, color: gris)),
                ]),
              ),
              const SizedBox(width: 10),
              _Anneau(secondes: _secondes),
            ]),
            if (photo.isNotEmpty) ...[
              const SizedBox(height: 12),
              Stack(children: [
                Image.network(photo, height: 170, width: double.infinity, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink()),
                Positioned(
                  left: 6,
                  top: 6,
                  child: Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    child: Text('PHOTO DU CLIENT', style: da.text(10, weight: FontWeight.w700)),
                  ),
                ),
              ]),
            ],
            const SizedBox(height: 12),
            Container(
              decoration: const BoxDecoration(border: Border(top: BorderSide(color: filet))),
              child: Column(children: [
                for (final d in listeDe(p['details']))
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 7),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: filet))),
                    child: Row(children: [
                      Text(texteDe(d['libelle']), style: da.text(13, color: gris)),
                      const SizedBox(width: 10),
                      Expanded(child: Text(texteDe(d['valeur']), textAlign: TextAlign.right, style: da.text(13, weight: FontWeight.w600, color: Colors.white))),
                    ]),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
            Container(
              color: const Color(0xFF24292C),
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Votre prix', style: da.text(12, color: gris)),
                Text(texteDe(prix['montant']), style: da.text(24, weight: FontWeight.w700, color: Colors.white)),
                Text(texteDe(prix['detail']), style: da.text(12, color: gris)),
              ]),
            ),
            const SizedBox(height: 12),
            _Minutes(minutes: _minutes, sombre: true, onChanged: (m) => setState(() => _minutes = m)),
            if (p['serrure'] == true) ...[
              const SizedBox(height: 10),
              Text(noteSerrure, style: da.text(12, color: gris, height: 1.4)),
            ],
          ],
         )),
         Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                flex: 10,
                child: OutlinedButton(
                  onPressed: widget.occupe ? null : widget.onRefuser,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFF8A8F98)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
                  ),
                  child: Text('Refuser', style: da.text(16, weight: FontWeight.w700, color: Colors.white)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 16,
                child: FilledButton(
                  onPressed: widget.occupe || _secondes <= 0 ? null : () => widget.onAccepter(_minutes),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    backgroundColor: ProDa.prim,
                    foregroundColor: ProDa.onPrim,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
                  ),
                  child: Text('Accepter', style: da.text(16, weight: FontWeight.w700, color: ProDa.onPrim)),
                ),
              ),
            ]),
            const SizedBox(height: 10),
            Text(
              'Proposée aux ${proposeeA > 1 ? '$proposeeA artisans disponibles les plus proches' : 'artisans disponibles les plus proches'} · le premier qui accepte',
              textAlign: TextAlign.center,
              style: da.text(11, color: const Color(0xFF8A8F98)),
            ),
          ]),
         ),
        ]),
      ),
    );
  }
}

class _Anneau extends StatelessWidget {
  const _Anneau({required this.secondes});
  final int secondes;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$secondes secondes pour accepter',
      child: SizedBox(
        width: 64,
        height: 64,
        child: CustomPaint(
          painter: _AnneauPeintre(math.min(60, secondes) / 60),
          child: Center(
            child: Text(compteARebours(secondes), style: ProDa.light.text(17, weight: FontWeight.w700, color: Colors.white)),
          ),
        ),
      ),
    );
  }
}

class _AnneauPeintre extends CustomPainter {
  _AnneauPeintre(this.part);
  final double part;
  @override
  void paint(Canvas canvas, Size size) {
    final centre = size.center(Offset.zero);
    const rayon = 28.0;
    final trait = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5;
    canvas.drawCircle(centre, rayon, trait..color = const Color(0xFF3A3F43));
    canvas.drawArc(Rect.fromCircle(center: centre, radius: rayon), -math.pi / 2, 2 * math.pi * part, false, trait..color = Colors.white);
  }

  @override
  bool shouldRepaint(_AnneauPeintre old) => old.part != part;
}

// ── Modifier : zone, urgences et prix ──────────────────────────────────────

class UrgencesReglagesView extends StatefulWidget {
  const UrgencesReglagesView({super.key, required this.vue});
  final Map<String, dynamic> vue;
  @override
  State<UrgencesReglagesView> createState() => _UrgencesReglagesViewState();
}

class _UrgencesReglagesViewState extends State<UrgencesReglagesView> {
  late final Map<String, dynamic> _r = mapDe(widget.vue['reglages']);
  late final _adresse = TextEditingController(text: texteDe(mapDe(_r['zone'])['adresse']));
  late final _demiHeure = TextEditingController(text: _r['demiHeure'] == null || _r['demiHeure'] == 0 ? '' : texteDe(_r['demiHeure']));
  late int _rayon = ((mapDe(_r['zone'])['rayonKm'] as num?) ?? 8).toInt();
  late final Map<String, TextEditingController> _prix = {
    for (final c in listeDe(_r['categories']))
      texteDe(c['id']): TextEditingController(text: c['prix'] == null ? '' : texteDe(c['prix'])),
  };
  late final Map<String, bool> _choisies = {
    for (final c in listeDe(_r['categories'])) texteDe(c['id']): c['choisie'] == true,
  };

  @override
  void dispose() {
    _adresse.dispose();
    _demiHeure.dispose();
    for (final c in _prix.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final rayons = (widget.vue['rayons'] as List? ?? const [3, 5, 8, 10, 15, 20]).map((x) => (x as num).toInt()).toList();
    InputDecoration deco(String label) => InputDecoration(labelText: label, isDense: true, border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(2))));
    return Scaffold(
      backgroundColor: da.page,
      appBar: AppBar(backgroundColor: da.card, surfaceTintColor: da.card, title: Text('Mes urgences et mes prix', style: da.text(15, weight: FontWeight.w700))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        TextField(controller: _adresse, decoration: deco('Adresse de départ (adresse ou ville)')),
        const SizedBox(height: 12),
        Text('Rayon', style: da.text(12, color: da.grey)),
        const SizedBox(height: 6),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final k in rayons)
            ChoiceChip(label: Text('$k km'), selected: _rayon == k, onSelected: (_) => setState(() => _rayon = k)),
        ]),
        const SizedBox(height: 16),
        Text('URGENCES DE MES MÉTIERS ET MON PRIX', style: da.text(11, weight: FontWeight.w600, color: da.grey, letterSpacing: .9)),
        Text('déplacement et 1re demi-heure, TTC', style: da.text(12, color: da.grey)),
        for (final c in listeDe(_r['categories']))
          Container(
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
            child: Row(children: [
              Checkbox(
                value: c['autorisee'] == true && (_choisies[texteDe(c['id'])] ?? false),
                onChanged: c['autorisee'] == true
                    ? (v) => setState(() {
                          final id = texteDe(c['id']);
                          _choisies[id] = v == true;
                          if (v == true && _prix[id]!.text.isEmpty && c['prixIntervention'] != null) _prix[id]!.text = texteDe(c['prixIntervention']);
                        })
                    : null,
              ),
              KojiIcon(texteDe(c['icone']), size: 18, color: c['autorisee'] == true ? da.ink : da.grey),
              const SizedBox(width: 8),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(texteDe(c['label']), style: da.text(14, weight: FontWeight.w600, color: c['autorisee'] == true ? da.ink : da.grey)),
                  if (c['autorisee'] != true) Text(texteDe(c['raison']), style: da.text(11.5, color: da.grey)),
                ]),
              ),
              if (c['autorisee'] == true)
                SizedBox(
                  width: 90,
                  child: TextField(
                    controller: _prix[texteDe(c['id'])],
                    enabled: _choisies[texteDe(c['id'])] ?? false,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    textAlign: TextAlign.right,
                    decoration: const InputDecoration(isDense: true, suffixText: ' €', border: OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(2)))),
                  ),
                ),
            ]),
          ),
        const SizedBox(height: 14),
        TextField(controller: _demiHeure, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: deco('Demi-heure suivante (€ TTC)')),
        const SizedBox(height: 8),
        Text('Pièces sur devis signé avant travaux. Le client voit votre prix avant de confirmer.', style: da.text(12, color: da.grey)),
        const SizedBox(height: 18),
        _BoutonJaune('Enregistrer', onTap: () {
          Navigator.of(context).pop(<String, dynamic>{
            'action': 'reglages',
            'adresse': _adresse.text.trim(),
            'rayonKm': _rayon,
            'demiHeure': _demiHeure.text.trim(),
            'prix': {
              for (final e in _prix.entries)
                if (_choisies[e.key] == true) e.key: e.value.text.trim(),
            },
          });
        }),
      ]),
    );
  }
}
