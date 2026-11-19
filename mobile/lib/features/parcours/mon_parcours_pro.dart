import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_widgets.dart' show errorText;
import 'package:koji/features/parcours/parcours_logic.dart';

// Mon parcours v2 (maquettes PRO-26 et PRO-26.1, téléphone) sur l'API du
// site : GET /api/parcours/grade (lecture seule), POST /api/parcours/grade
// (distinctions) et POST /api/parcours/talents (placer, réorganiser). Le
// « Premier mois » (version 1) reste sur /parcours/premier-mois.
const monParcoursRoute = '/parcours';
const talentsRoute = '/parcours/talents';

final parcoursGradeProvider = FutureProvider.autoDispose<Json>(
    (ref) => ref.watch(kojiProApiProvider).get('/api/parcours/grade'));

/// Envoi d'une action ; remplacé dans les tests.
final parcoursActionProvider =
    Provider<Future<Json> Function(String chemin, Json corps)>((ref) =>
        (chemin, corps) => ref.read(kojiProApiProvider).post(chemin, corps));

List<Json> _liste(Object? v) => (v as List? ?? const [])
    .whereType<Map>()
    .map((x) => Map<String, dynamic>.from(x))
    .toList();
Json _map(Object? v) =>
    v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
int _n(Object? v) => v is num ? v.round() : int.tryParse('$v') ?? 0;

const _graphite = Color(0xFF171B1E);
const _gris = Color(0xFF5B5F66);
const _grisClair = Color(0xFFC4C7CC);
const _trait = Color(0xFF3A3F43);
const _jaune = Color(0xFFFFC400);
const _bord = Color(0xFFE1E1DB);

Widget _carte(
        {required Widget child,
        Color fond = Colors.white,
        Color bord = _bord}) =>
    Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(color: fond, border: Border.all(color: bord)),
      child: child,
    );

Widget _titreCarte(String t) => Padding(
      padding: const EdgeInsets.only(top: 2, bottom: 4),
      child: Text(t.toUpperCase(),
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: .7,
              color: _gris)),
    );

Widget _barre(int pourcent, {Color fond = _trait}) => ClipRect(
      child: SizedBox(
        height: 4,
        child: Stack(children: [
          Container(color: fond),
          FractionallySizedBox(
              widthFactor: (pourcent.clamp(0, 100)) / 100,
              child: Container(color: _jaune)),
        ]),
      ),
    );

Widget _boutonJaune(String label, VoidCallback? onTap) => SizedBox(
      width: double.infinity,
      height: 48,
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
            backgroundColor: _jaune,
            foregroundColor: _graphite,
            disabledBackgroundColor: const Color(0xFFECECE7),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(4))),
        child: Text(label,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      ),
    );

Widget _rond(bool obtenu) => Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: obtenu ? _graphite : null,
          border: Border.all(
              color: obtenu ? _graphite : const Color(0xFFCFCFC9), width: 1.5)),
      child: obtenu ? const Icon(Icons.check, size: 14, color: _jaune) : null,
    );

Widget _ligne(
        {required Widget tete,
        required String titre,
        required String detail,
        required String droite,
        String? note}) =>
    Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Color(0xFFF0F0EB)))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
        tete,
        const SizedBox(width: 10),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(titre,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: _graphite)),
            Text(detail, style: const TextStyle(fontSize: 12, color: _gris)),
            if (note != null && note.isNotEmpty)
              Text(note,
                  style: const TextStyle(
                      fontSize: 11, color: _gris, fontStyle: FontStyle.italic)),
          ]),
        ),
        const SizedBox(width: 8),
        Text(droite, style: const TextStyle(fontSize: 11, color: _gris)),
      ]),
    );

Widget _chargement(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) {
    return KojiPage(title: titre, appBarOnPhone: true, main: [
      KojiEmptyState(
          title: 'Parcours indisponible',
          subtitle: errorText(a.error!),
          icon: KojiIcons.accueil)
    ]);
  }
  return KojiPage(title: titre, appBarOnPhone: true, main: const [
    Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator()))
  ]);
}

// ── Mon parcours : grade et hauts faits ─────────────────────────────────
class MonParcoursScreen extends ConsumerStatefulWidget {
  const MonParcoursScreen({super.key});

  @override
  ConsumerState<MonParcoursScreen> createState() => _MonParcoursScreenState();
}

class _MonParcoursScreenState extends ConsumerState<MonParcoursScreen> {
  Json? _maj;

  Future<void> _choisirDistinctions(Json d) async {
    final publics = _liste(d['hautsFaits'])
        .where((h) => h['public'] == true && h['obtenu'] == true)
        .toList();
    var choix =
        (d['distinctions'] as List? ?? const []).map((e) => '$e').toList();
    String erreur = '';
    final resultat = await showModalBottomSheet<Json>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, maj) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Choisir mes distinctions',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  const Text('Trois au plus, parmi vos hauts faits publics.',
                      style: TextStyle(fontSize: 13, color: _gris)),
                  const SizedBox(height: 8),
                  if (publics.isEmpty)
                    const Padding(
                        padding: EdgeInsets.symmetric(vertical: 12),
                        child: Text(
                            'Aucun haut fait public obtenu pour l\'instant.')),
                  for (final h in publics)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: choix.contains(_s(h['id'])),
                      onChanged: !choix.contains(_s(h['id'])) &&
                              choix.length >= 3
                          ? null
                          : (_) => maj(() =>
                              choix = basculerDistinction(choix, _s(h['id']))),
                      title: Text(_s(h['titre'])),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                  if (erreur.isNotEmpty)
                    Text(erreur,
                        style: const TextStyle(
                            color: Color(0xFFB42318), fontSize: 13)),
                  const SizedBox(height: 10),
                  _boutonJaune('Enregistrer (${choix.length} sur 3)', () async {
                    try {
                      final r = await ref.read(parcoursActionProvider)(
                          '/api/parcours/grade',
                          {'action': 'distinctions', 'ids': choix});
                      if (ctx.mounted) Navigator.of(ctx).pop(r);
                    } catch (e) {
                      maj(() => erreur = errorText(e));
                    }
                  }),
                ]),
          ),
        ),
      ),
    );
    if (resultat != null && mounted) setState(() => _maj = resultat);
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(parcoursGradeProvider);
    if (!a.hasValue && _maj == null) return _chargement('Mon parcours', a);
    final d = _maj ?? a.value!;
    final niveau = _map(d['niveau']);
    final grade = _s(_map(niveau['grade'])['label']);
    final preuves = _map(d['preuves']);
    final talents = _map(d['talents']);
    final libres = _n(talents['libres']);
    final faits = _liste(d['hautsFaits']);
    final visibles = faits
        .where((h) => h['obtenu'] == true || h['atteignable'] == true)
        .toList();
    final nonMesures = faits.where((h) => h['mesurable'] != true).toList();
    final apercu = _map(d['apercu']);
    final requis = _n(niveau['requis']);
    final avis = _n(preuves['avisVerifies']);
    final note = (preuves['noteMoyenne'] as num? ?? 0)
        .toStringAsFixed(1)
        .replaceAll('.', ',');

    Widget fait(String chiffre, String libelle) => Expanded(
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            padding: const EdgeInsets.only(top: 6),
            decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: _trait))),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(chiffre,
                  style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
              Text(libelle,
                  style: const TextStyle(fontSize: 10, color: _grisClair)),
            ]),
          ),
        );

    return KojiPage(
      title: 'Mon parcours',
      subtitle: libres > 0
          ? '$grade · ${pluriel(libres, 'point', 'points')} à placer'
          : grade,
      appBarOnPhone: true,
      onRefresh: () async {
        setState(() => _maj = null);
        ref.invalidate(parcoursGradeProvider);
      },
      main: [
        _carte(
          fond: _graphite,
          bord: _graphite,
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Grade',
                style: TextStyle(fontSize: 12, color: _grisClair)),
            Text(grade,
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                    letterSpacing: -.4)),
            Text(
              requis > 0
                  ? 'niveau ${_n(niveau['niveau'])} · ${nombre(_n(niveau['dansNiveau']))} / ${nombre(requis)}'
                  : 'niveau ${_n(niveau['niveau'])}',
              style: const TextStyle(fontSize: 11, color: _grisClair),
            ),
            const SizedBox(height: 6),
            _barre(_n(niveau['pourcent'])),
            const SizedBox(height: 10),
            Row(children: [
              fait('${_n(preuves['chantiersLivres'])}',
                  '${_n(preuves['chantiersLivres']) > 1 ? 'chantiers livrés' : 'chantier livré'} avec PV'),
              fait(
                  '$avis',
                  avis > 0
                      ? '${avis > 1 ? 'avis vérifiés' : 'avis vérifié'} · $note / 5'
                      : 'avis vérifié'),
              fait(
                  '${_n(preuves['devisSignes'])}',
                  _n(preuves['devisSignes']) > 1
                      ? 'devis signés'
                      : 'devis signé'),
            ]),
          ]),
        ),
        _carte(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            _titreCarte(
                'Hauts faits · ${_n(_map(d['compteurs'])['obtenus'])} obtenus'),
            for (final h in visibles)
              _ligne(
                  tete: _rond(h['obtenu'] == true),
                  titre: _s(h['titre']),
                  detail: _s(h['detail']),
                  droite: droiteHautFait(h),
                  note: h['public'] == true ? null : 'privé'),
            if (nonMesures.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                    'Pas encore mesurable : ${nonMesures.map((h) => _s(h['titre'])).join(', ')}. ${_s(nonMesures.first['raison'])}',
                    style: const TextStyle(fontSize: 11, color: _gris)),
              ),
          ]),
        ),
        _carte(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: _titreCarte('Ce que voit le particulier')),
              TextButton(
                  onPressed: () => _choisirDistinctions(d),
                  child: const Text('Choisir mes distinctions')),
            ]),
            _PlaqueApercu(apercu: apercu, active: d['plaqueActive'] == true),
          ]),
        ),
        const SizedBox(height: 4),
        _boutonJaune(
            libres > 0 ? 'Placer mon point de métier' : 'Voir mes talents',
            () => context.push(talentsRoute)),
      ],
    );
  }
}

class _PlaqueApercu extends StatelessWidget {
  const _PlaqueApercu({required this.apercu, required this.active});
  final Json apercu;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final gradeTitre = _s(apercu['grade']);
    final preuves =
        (apercu['preuves'] as List? ?? const []).map((e) => '$e').toList();
    final distinctions =
        (apercu['distinctions'] as List? ?? const []).map((e) => '$e').toList();
    const marine = Color(0xFF101529);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: const Color(0xFFF8F6F1),
          border: Border.all(color: const Color(0xFFE7D8C5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
              width: 30,
              height: 30,
              color: marine,
              alignment: Alignment.center,
              child: const Icon(Icons.auto_awesome,
                  size: 14, color: Color(0xFFE7D8C5))),
          const SizedBox(width: 10),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(gradeTitre.isEmpty ? 'Vos preuves' : gradeTitre,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: marine)),
              Text(
                  preuves.isEmpty
                      ? "Pas encore de chantier livré avec PV ni d'avis vérifié."
                      : preuves.join(' · '),
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF4A4F5C))),
            ]),
          ),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 6, runSpacing: 6, children: [
          for (final t in distinctions)
            Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                    border: Border.all(color: marine),
                    borderRadius: BorderRadius.circular(2)),
                child: Text(t,
                    style: const TextStyle(fontSize: 12, color: marine))),
        ]),
        const SizedBox(height: 8),
        const Text(
            'Trois distinctions choisies par vous, parmi les publiques. Jamais de niveau, de points ni de talents.',
            style: TextStyle(fontSize: 11, color: Color(0xFF4A4F5C))),
        if (!active)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text(
                'Pas encore affiché sur votre KojiPage : placez un point dans Vitrine (Plaque de chantier).',
                style: TextStyle(fontSize: 12, color: _gris)),
          ),
      ]),
    );
  }
}

// ── Talents ──────────────────────────────────────────────────────────────
class TalentsScreen extends ConsumerStatefulWidget {
  const TalentsScreen({super.key});

  @override
  ConsumerState<TalentsScreen> createState() => _TalentsScreenState();
}

class _TalentsScreenState extends ConsumerState<TalentsScreen> {
  Json? _maj;
  BrouillonTalents? _brouillon;
  bool _occupe = false;
  String _erreur = '';

  Future<void> _envoyer(Json corps) async {
    setState(() {
      _occupe = true;
      _erreur = '';
    });
    try {
      final r = await ref.read(parcoursActionProvider)(
          '/api/parcours/talents', corps);
      if (mounted) {
        setState(() {
          _maj = r;
          _brouillon = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _erreur = errorText(e));
    } finally {
      if (mounted) setState(() => _occupe = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(parcoursGradeProvider);
    if (!a.hasValue && _maj == null) return _chargement('Talents', a);
    final d = _maj ?? a.value!;
    final t = _map(d['talents']);
    final points = _n(t['points']);
    final reorg = _map(t['reorg']);
    final aVenir = t['aVenir'] is Map ? _map(t['aVenir']) : null;
    final b = _brouillon;
    final libres = b != null ? b.libres(points) : _n(t['libres']);

    Widget noeud(Json n, int pointsBranche, String suivant, String branche) {
      final etat = etatNoeud(pointsBranche, _n(n['seuil']), libres);
      final peut = b != null
          ? b.peutPlacer(branche, points)
          : libres > 0 && pointsBranche < pointsMaxBranche;
      final tete = Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: etat == 'got' ? _graphite : null,
          border: Border.all(
              color: etat == 'got'
                  ? _graphite
                  : etat == 'avail'
                      ? _jaune
                      : const Color(0xFFCFCFC9),
              width: 1.5),
        ),
        child: Icon(
            etat == 'got'
                ? Icons.check
                : etat == 'avail'
                    ? Icons.auto_awesome
                    : Icons.lock_outline,
            size: 14,
            color: etat == 'got' || etat == 'avail' ? _jaune : _gris),
      );
      final ligne = _ligne(
        tete: tete,
        titre: _s(n['titre']),
        detail: _s(n['detail']),
        droite: pluriel(_n(n['seuil']), 'point', 'points'),
        note: n['enService'] == true ? null : 'pas encore en service',
      );
      final placer = peut && etat == 'avail' && _s(n['id']) == suivant;
      if (!placer) {
        return Opacity(opacity: etat == 'lock' ? .75 : 1, child: ligne);
      }
      return InkWell(
        onTap: _occupe
            ? null
            : () => b != null
                ? setState(() => _brouillon = b.placer(branche, points))
                : _envoyer({'action': 'placer', 'branche': branche}),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          ligne,
          Padding(
            padding: const EdgeInsets.only(left: 36, bottom: 6),
            child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                color: _jaune,
                child: Text(b != null ? 'Placer' : 'Placer 1 point',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _graphite))),
          ),
        ]),
      );
    }

    return KojiPage(
      title: b != null ? 'Talents · réorganiser' : 'Talents',
      subtitle: '${pluriel(points, 'point', 'points')} · $libres à placer',
      appBarOnPhone: true,
      onRefresh: () async {
        setState(() => _maj = null);
        ref.invalidate(parcoursGradeProvider);
      },
      main: [
        if (b != null)
          _carte(
            fond: _graphite,
            bord: _graphite,
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Réorganisation en cours',
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white)),
              Text(
                  '${pluriel(libres, 'point à replacer', 'points à replacer')} · effet le ${jourCourt(_s(reorg['effetSiValideeLe']))}',
                  style: const TextStyle(fontSize: 12, color: _grisClair)),
              Text(
                  'Prochaine réorganisation possible le ${jourCourt(_s(reorg['suivanteSiValideeLe']))}',
                  style: const TextStyle(fontSize: 12, color: _grisClair)),
            ]),
          )
        else if (aVenir != null)
          _carte(
              child: Text(
                  'Réorganisation validée · effet le ${jourCourt(_s(aVenir['effetLe']))} · Radar ${_n(aVenir['radar'])} · Vitrine ${_n(aVenir['vitrine'])}',
                  style: const TextStyle(fontSize: 13))),
        for (final br in _liste(t['branches']))
          _carte(
            child: Builder(builder: (context) {
              final id = _s(br['id']);
              final pts = b != null ? b.de(id) : _n(br['points']);
              final noeuds = _liste(br['noeuds']);
              final suivant = noeuds.firstWhere(
                  (n) => etatNoeud(pts, _n(n['seuil']), libres) != 'got',
                  orElse: () => <String, dynamic>{});
              return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                          child: _titreCarte(
                              '${_s(br['titre'])} · ${_s(br['sousTitre'])}')),
                      if (b != null && pts > 0)
                        TextButton(
                            onPressed: () =>
                                setState(() => _brouillon = b.retirer(id)),
                            child: const Text('Retirer 1 point')),
                    ]),
                    for (final n in noeuds)
                      noeud(n, pts, _s(suivant['id']), id),
                  ]);
            }),
          ),
        if (_erreur.isNotEmpty)
          Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(_erreur,
                  style:
                      const TextStyle(color: Color(0xFFB42318), fontSize: 13))),
        if (b != null) ...[
          _boutonJaune(
              'Valider',
              _occupe
                  ? null
                  : () => _envoyer(
                      {'action': 'reorganiser', 'repartition': b.versJson()})),
          TextButton(
              onPressed: () => setState(() => _brouillon = null),
              child: const Text('Annuler')),
        ] else ...[
          _boutonJaune(
              'Réorganiser mes talents',
              reorg['possible'] == true && points > 0
                  ? () => setState(() => _brouillon = const BrouillonTalents())
                  : null),
          if (reorg['possible'] != true &&
              aVenir == null &&
              _s(reorg['prochaineLe']).isNotEmpty)
            Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                    'Réorganisation possible une fois par mois · prochaine fois le ${jourCourt(_s(reorg['prochaineLe']))}',
                    style: const TextStyle(fontSize: 12, color: _gris))),
          const SizedBox(height: 8),
          const Text(
              "Seule la Plaque de chantier est en service aujourd'hui ; les autres paliers seront attribués quand leur fonction existera. Les points viennent des niveaux, jamais d'un achat.",
              style: TextStyle(fontSize: 12, color: _gris)),
        ],
      ],
    );
  }
}
