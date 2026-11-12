import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

/// Koji Pro, Lancer le chantier (maquette PRO-02.1, téléphone « 1 · Lancer
/// le chantier ») : Koji propose le planning par lot depuis le devis signé,
/// l'artisan ajuste le démarrage, la durée et l'équipe de chaque lot, puis
/// « Créer le chantier » planifie chaque ligne du devis (mêmes routes que le
/// site) et met le client en suivi dans Koji Client. Pas encore construits :
/// invitation des sous-traitants, rappels URSSAF, partage du planning.
class ProLancerChantierScreen extends ConsumerStatefulWidget {
  const ProLancerChantierScreen(
      {super.key, required this.projectId, this.aujourdhui});

  final String projectId;

  /// Pour les tests ; par défaut, la date du jour.
  final DateTime? aujourdhui;

  @override
  ConsumerState<ProLancerChantierScreen> createState() =>
      _ProLancerChantierScreenState();
}

class _ProLancerChantierScreenState
    extends ConsumerState<ProLancerChantierScreen> {
  Map<String, dynamic>? _projet;
  Map<String, dynamic>? _devis;
  List<Map<String, dynamic>> _taches = const [];
  List<Map<String, dynamic>> _equipe = const [];
  Map<String, dynamic>? _acces;
  double _heuresParJour = 7;
  String? _erreurChargement;

  late String _debut;
  final Map<String, int> _durees = {};
  final Map<String, String> _equipes = {}; // lot → id d'ouvrier
  bool _suiviClient = false;
  int? _fait;
  String _erreur = '';

  ProKojiWebClient get _api => ref.read(proKojiWebProvider);

  @override
  void initState() {
    super.initState();
    _debut = demarragePropose(isoJour(widget.aujourdhui ?? DateTime.now()));
    _charger();
  }

  String _s(dynamic v) => v == null ? '' : '$v';

  Future<void> _charger() async {
    try {
      Future<List<Map<String, dynamic>>> lire(String path, String key) =>
          _api.liste(path, key).catchError((_) => <Map<String, dynamic>>[]);
      final r = await Future.wait([
        _api.liste('/api/projects', 'projects'),
        lire('/api/quotes', 'quotes'),
        lire('/api/tasks', 'tasks'),
        lire('/api/workers', 'workers'),
      ]);
      final profil = await _api.profil().catchError((_) => <String, dynamic>{});
      final acces =
          await _api.accesClient(widget.projectId).catchError((_) => null);
      if (!mounted) return;
      final projet = r[0].where((p) => _s(p['id']) == widget.projectId);
      final devis = r[1].where((q) => _s(q['projectId']) == widget.projectId);
      setState(() {
        _projet = projet.isEmpty ? null : projet.first;
        _devis = devis.isEmpty ? null : devis.first;
        _taches =
            r[2].where((t) => _s(t['projectId']) == widget.projectId).toList();
        _equipe = r[3];
        _acces = acces;
        final hpj =
            ((profil['business'] as Map?)?['hoursPerDay'] as num?)?.toDouble();
        _heuresParJour = hpj != null && hpj > 0 ? hpj : 7;
        _suiviClient = _acces == null && _contactClient.isNotEmpty;
        _erreurChargement = _projet == null || _devis == null
            ? 'Chantier ou devis introuvable.'
            : null;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _erreurChargement = e is ProKojiWebException
            ? e.message
            : 'Connexion impossible pour le moment.');
      }
    }
  }

  String get _contactClient => [
        _s(_devis?['clientEmail']),
        _s(_devis?['clientPhone'])
      ].firstWhere((c) => c.trim().isNotEmpty, orElse: () => '');

  PlanningPropose get _planning => proposerPlanning(_devis,
      debut: _debut, heuresParJour: _heuresParJour, durees: _durees);

  String _jour(String iso, [String motif = 'd MMM']) =>
      DateFormat(motif, 'fr_FR').format(DateTime.parse(iso));

  String _jourLong(String iso) {
    final t = _jour(iso, 'EEEE d MMM');
    return t.isEmpty ? t : '${t[0].toUpperCase()}${t.substring(1)}';
  }

  String _euros(num n) => NumberFormat.currency(locale: 'fr_FR', symbol: '€')
      .format(n)
      .replaceAll(' ', ' ')
      .replaceAll(' ', ' ');

  Map<String, dynamic>? _ouvrier(String? id) {
    for (final w in _equipe) {
      if (_s(w['id']) == id) return w;
    }
    return null;
  }

  String _equipeDe(String lot) {
    final w = _ouvrier(_equipes[lot]);
    if (w == null) return 'Équipe';
    return '${w['name']}${w['type'] == 'Sous-traitant' ? ' · sous-traitant' : ''}';
  }

  Future<void> _choisirDebut() async {
    final initial = DateTime.parse(_debut);
    final choisi = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (choisi != null) setState(() => _debut = premierOuvre(isoJour(choisi)));
  }

  Future<void> _modifierLot(LotPlanifie lot) async {
    final da = ProDa.of(context);
    var jours = lot.jours;
    var equipe = _equipes[lot.nom] ?? '';
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: da.page,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Lot ${lot.numero} · ${lot.nom}',
                    style: da.text(17, weight: FontWeight.w700)),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                        child:
                            Text('Durée', style: da.text(14, color: da.grey))),
                    IconButton(
                      tooltip: 'Un jour de moins',
                      onPressed:
                          jours > 1 ? () => setSheet(() => jours--) : null,
                      icon: const Icon(Icons.remove),
                    ),
                    Text('$jours j',
                        style: da.text(16, weight: FontWeight.w700)),
                    IconButton(
                      tooltip: 'Un jour de plus',
                      onPressed: () => setSheet(() => jours++),
                      icon: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text('Équipe', style: da.text(14, color: da.grey)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final (id, label) in [
                      ('', 'Équipe'),
                      for (final w in _equipe)
                        (
                          _s(w['id']),
                          '${w['name']}${w['type'] == 'Sous-traitant' ? ' · sous-traitant' : ''}'
                        ),
                    ])
                      ChoiceChip(
                        label: Text(label),
                        selected: equipe == id,
                        onSelected: (_) => setSheet(() => equipe = id),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                ProPrimaryButton(
                  label: 'Valider',
                  expand: true,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    setState(() {
      _durees[lot.nom] = jours;
      if (equipe.isEmpty) {
        _equipes.remove(lot.nom);
      } else {
        _equipes[lot.nom] = equipe;
      }
    });
  }

  Future<void> _creer() async {
    final planning = _planning;
    final lignes = [
      for (final lot in planning.lots)
        for (final l in lot.lignes) (lot, l),
    ];
    setState(() {
      _fait = 0;
      _erreur = '';
    });
    try {
      for (final (lot, l) in lignes) {
        final workerId = _equipes[lot.nom];
        final w = _ouvrier(workerId);
        Map<String, dynamic>? existante;
        for (final t in _taches) {
          if (t['quoteItemId'] == l.cle ||
              (t['label'] == l.ligne['label'] &&
                  _s(t['room']) == _s(l.ligne['room']))) {
            existante = t;
            break;
          }
        }
        await _api.enregistrerTache({
          'label': existante?['label'] ?? l.ligne['label'] ?? 'Ouvrage',
          'project': _projet!['title'],
          'projectId': widget.projectId,
          'quoteId': _devis!['id'],
          'quoteItemId': l.cle,
          'code': l.ligne['code'] ?? '',
          'room': _s(l.ligne['room']).isEmpty ? 'Chantier' : l.ligne['room'],
          'unit': l.ligne['unit'] ?? '',
          'quantity': (l.ligne['quantity'] as num?) ?? 0,
          'startDate': lot.debut,
          'endDate': lot.fin,
          'dueDate': lot.fin,
          'durationHours': l.heures > 0 ? l.heures : 1,
          'workerIds': [if (workerId != null) workerId],
          'assignedTo': w?['name'] ?? 'Equipe',
          'participantType':
              w?['type'] == 'Sous-traitant' ? 'Sous-traitants' : 'Ouvriers',
          'status': 'Planifiee',
        }, id: existante == null ? null : _s(existante['id']));
        if (mounted) setState(() => _fait = (_fait ?? 0) + 1);
      }
      if (_suiviClient && _acces == null) {
        await _api
            .activerSuiviClient(widget.projectId, _s(_devis?['clientEmail']),
                _s(_devis?['clientPhone']))
            .catchError((_) {});
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Chantier lancé : ${planning.lots.length} lot'
              '${planning.lots.length > 1 ? 's' : ''} du ${_jour(planning.debut, 'd MMMM')} '
              'au ${_jour(planning.fin, 'd MMMM')}.')));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _fait = null;
        _erreur = e is ProKojiWebException
            ? e.message
            : "La création n'a pas abouti. Les lots déjà planifiés sont gardés.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _barre(da),
          Expanded(
            child: _devis == null || _projet == null
                ? Center(
                    child: _erreurChargement == null
                        ? const CircularProgressIndicator(strokeWidth: 2)
                        : Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(_erreurChargement!, style: da.text(15)),
                          ))
                : SafeArea(top: false, child: _corps(da)),
          ),
        ],
      ),
    );
  }

  Widget _barre(ProDa da) => Container(
        color: const Color(0xFF171B1E),
        padding: EdgeInsets.fromLTRB(
            6, MediaQuery.paddingOf(context).top + 6, 16, 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Retour',
              onPressed:
                  _fait != null ? null : () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.chevron_left, color: Colors.white),
            ),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Lancer le chantier',
                      style: da.text(15,
                          weight: FontWeight.w700,
                          color: const Color(0xFFF5F5F2))),
                  Text(
                    [
                      if (_s(_devis?['quoteNumber']).isNotEmpty)
                        'Devis ${_devis!['quoteNumber']}',
                      _s(_devis?['client']),
                    ].where((s) => s.isNotEmpty).join(' · '),
                    style: da.text(12, color: const Color(0xFFA7ABB2)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _kv(ProDa da, String label, String valeur, {VoidCallback? onTap}) =>
      InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: da.card,
            border: Border.all(color: da.frame),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            children: [
              Expanded(child: Text(label, style: da.text(13, color: da.grey))),
              Text(valeur, style: da.text(14, weight: FontWeight.w600)),
              if (onTap != null) ...[
                const SizedBox(width: 6),
                Icon(Icons.edit_calendar_outlined, size: 16, color: da.grey),
              ],
            ],
          ),
        ),
      );

  Widget _corps(ProDa da) {
    final p = _planning;
    final envoi = _fait != null;
    final total = p.lots.fold<int>(0, (n, l) => n + l.lignes.length);
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
      children: [
        _kv(da, 'Démarrage', _jourLong(p.debut),
            onTap: envoi ? null : _choisirDebut),
        const SizedBox(height: 8),
        _kv(da, 'Fin prévue',
            '${_jour(p.fin)} · ${p.joursOuvres} j ouvré${p.joursOuvres > 1 ? 's' : ''}'),
        const SizedBox(height: 16),
        Text('LOTS ET PLANNING PROPOSÉS PAR KOJI',
            style: da.text(11, weight: FontWeight.w600, color: da.grey)),
        const SizedBox(height: 6),
        ProCard(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Column(
            children: [
              for (final (i, lot) in p.lots.indexed)
                InkWell(
                  onTap: envoi ? null : () => _modifierLot(lot),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: i == 0
                        ? null
                        : BoxDecoration(
                            border: Border(top: BorderSide(color: da.line))),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Lot ${lot.numero} · ${lot.nom}',
                                  style: da.text(14, weight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(
                                  '${_jour(lot.debut)} → ${_jour(lot.fin)} · ${_equipeDe(lot.nom)}',
                                  style: da.text(12, color: da.grey)),
                            ],
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(_euros(lot.montantHt),
                            style: da.text(13, weight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text('Touchez un lot pour changer sa durée ou son équipe.',
            style: da.text(12, color: da.grey)),
        const SizedBox(height: 16),
        Text('AU LANCEMENT',
            style: da.text(11, weight: FontWeight.w600, color: da.grey)),
        const SizedBox(height: 6),
        _acces != null
            ? _case(da, true, 'Client déjà en suivi dans Koji Client', null)
            : _case(
                da,
                _suiviClient,
                _contactClient.isEmpty
                    ? 'Client en suivi : ajoutez d\'abord son e-mail au devis'
                    : 'Client en suivi dans Koji Client',
                _contactClient.isEmpty || envoi
                    ? null
                    : () => setState(() => _suiviClient = !_suiviClient),
              ),
        if (_erreur.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_erreur, style: da.text(13, weight: FontWeight.w600)),
        ],
        const SizedBox(height: 20),
        ProPrimaryButton(
          label: envoi ? 'Planification… $_fait / $total' : 'Créer le chantier',
          icon: envoi ? null : Icons.check,
          expand: true,
          onPressed: envoi || p.lots.isEmpty ? null : _creer,
        ),
        const SizedBox(height: 6),
        TextButton(
          onPressed: envoi ? null : () => Navigator.of(context).maybePop(),
          child: Text('Plus tard',
              style: da.text(14, weight: FontWeight.w600, color: da.grey)),
        ),
      ],
    );
  }

  Widget _case(ProDa da, bool on, String texte, VoidCallback? onTap) => InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
          decoration: BoxDecoration(
            color: da.card,
            border: Border.all(color: on ? da.ink : da.line),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Row(
            children: [
              Icon(on ? Icons.check_box : Icons.check_box_outline_blank,
                  size: 18, color: on ? da.ink : da.grey),
              const SizedBox(width: 10),
              Expanded(
                child: Text(texte,
                    style: da.text(14,
                        weight: on ? FontWeight.w600 : FontWeight.w400,
                        color: on ? null : da.grey)),
              ),
            ],
          ),
        ),
      );
}
