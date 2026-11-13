import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/taches_chantier.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

String _s(dynamic v) => v == null ? '' : '$v';

typedef DonneesTaches = ({
  List<Map<String, dynamic>> taches,
  Map<String, dynamic>? devis,
  List<Map<String, dynamic>> equipe,
});

final proTachesProvider = FutureProvider.autoDispose
    .family<DonneesTaches, String>((ref, projectId) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(String path, String key) =>
      api.liste(path, key).catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    lire('/api/tasks', 'tasks'),
    lire('/api/quotes', 'quotes'),
    lire('/api/workers', 'workers'),
  ]);
  final devis = r[1].where((q) => _s(q['projectId']) == projectId).toList();
  return (
    taches: r[0].where((t) => _s(t['projectId']) == projectId).toList(),
    devis: devis.isEmpty ? null : devis.first,
    equipe: r[2],
  );
});

String _aujourdhui(DateTime Function() maintenant) =>
    DateFormat('yyyy-MM-dd').format(maintenant());

/// Koji Pro, tâches du chantier (maquette PRO-02.7, téléphone) : filtres
/// Toutes / Aujourd'hui / Bloquées, liste par lot, « Fait » et « Bloquant »,
/// ajout en dictant.
class ProTachesScreen extends ConsumerStatefulWidget {
  const ProTachesScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    this.maintenant = DateTime.now,
  });

  final String projectId;
  final String titreChantier;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProTachesScreen> createState() => _ProTachesScreenState();
}

class _ProTachesScreenState extends ConsumerState<ProTachesScreen> {
  String _filtre = 'toutes';
  final Set<String> _envoi = {};

  void _recharger() => ref.invalidate(proTachesProvider(widget.projectId));

  void _dire(String t) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t)));

  Future<void> _faire(String id, Future<void> Function() action) async {
    setState(() => _envoi.add(id));
    try {
      await action();
      _recharger();
    } catch (e) {
      if (mounted) {
        _dire(e is ProKojiWebException ? e.message : "La tâche n'a pas pu être mise à jour.");
      }
    } finally {
      if (mounted) setState(() => _envoi.remove(id));
    }
  }

  Future<void> _bloquer(Map<String, dynamic> t) async {
    final id = _s(t['id']);
    if (estBloquee(t)) {
      await _faire(id, () => ref.read(proKojiWebProvider).enregistrerTache({'action': 'debloquer'}, id: id));
      return;
    }
    final raison = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Qu\'est-ce qui bloque ?'),
        content: TextField(
            controller: raison,
            autofocus: true,
            decoration: const InputDecoration(hintText: 'receveur livré vendredi')),
        actions: [
          TextButton(onPressed: () => Navigator.of(c).pop(false), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.of(c).pop(true), child: const Text('Bloquer')),
        ],
      ),
    );
    if (ok != true || raison.text.trim().isEmpty) return;
    await _faire(id, () => ref.read(proKojiWebProvider).enregistrerTache({'action': 'bloquer', 'raison': raison.text.trim()}, id: id));
    if (mounted) _dire("Tâche bloquée : elle remonte sur l'accueil.");
  }

  Future<void> _ajouter(DonneesTaches d) async {
    final ajoutee = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => ProNouvelleTacheScreen(
              projectId: widget.projectId,
              titreChantier: widget.titreChantier,
              lots: _lotsDuDevis(d.devis),
              equipe: d.equipe,
              quoteId: _s(d.devis?['id']),
              maintenant: widget.maintenant,
            )));
    if (ajoutee == true) _recharger();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncD = ref.watch(proTachesProvider(widget.projectId));
    final d = asyncD.valueOrNull;
    final auj = _aujourdhui(widget.maintenant);
    final toutes = d?.taches ?? const <Map<String, dynamic>>[];
    final c = compterTaches(toutes, auj);
    final lots = tachesParLot(filtrerTaches(toutes, _filtre, auj), d?.devis);
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFF171B1E),
            padding: EdgeInsets.fromLTRB(6, MediaQuery.paddingOf(context).top + 6, 16, 8),
            child: Row(children: [
              IconButton(
                tooltip: 'Retour',
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.chevron_left, color: Colors.white),
              ),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(widget.titreChantier.isEmpty ? 'Tâches du chantier' : widget.titreChantier,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: da.text(15, weight: FontWeight.w700, color: const Color(0xFFF5F5F2))),
                  Text('Tâches · ${c['toutes']} · ${c['faites']} faite${c['faites']! > 1 ? 's' : ''}',
                      style: da.text(12, color: const Color(0xFFA7ABB2))),
                ]),
              ),
            ]),
          ),
          Expanded(
            child: d == null
                ? Center(
                    child: asyncD.hasError
                        ? Text('Tâches indisponibles pour le moment.', style: da.text(14))
                        : const CircularProgressIndicator(strokeWidth: 2))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    children: [
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ProSegmented<String>(
                          options: [
                            for (final (id, label) in filtresTaches)
                              (id, label, id == 'toutes' ? -1 : c[id] ?? 0),
                          ],
                          value: _filtre,
                          onChanged: (v) => setState(() => _filtre = v),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (lots.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Text(
                              toutes.isEmpty
                                  ? 'Aucune tâche : lancez le chantier ou ajoutez-en une.'
                                  : 'Aucune tâche dans ce filtre.',
                              style: da.text(13, color: da.grey)),
                        ),
                      for (final lot in lots) ...[
                        Container(
                          padding: const EdgeInsets.only(top: 10, bottom: 4),
                          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.ink, width: 2))),
                          child: Text(lot.titre, style: da.text(14, weight: FontWeight.w700)),
                        ),
                        for (final t in lot.taches) _ligne(da, t, auj),
                        const SizedBox(height: 8),
                      ],
                    ],
                  ),
          ),
          if (d != null)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: ProPrimaryButton(label: 'Ajouter une tâche', icon: Icons.add, expand: true, onPressed: () => _ajouter(d)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _ligne(ProDa da, Map<String, dynamic> t, String auj) {
    final id = _s(t['id']);
    final fait = t['done'] == true;
    final etat = etatTache(t, auj);
    return InkWell(
      onLongPress: fait ? null : () => _bloquer(t),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
        child: Row(children: [
          InkWell(
            onTap: _envoi.contains(id)
                ? null
                : () => _faire(id, () => ref.read(proKojiWebProvider).basculerTache(id)),
            child: Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: fait ? da.ink : Colors.white,
                border: Border.all(color: fait ? da.ink : da.grey),
                borderRadius: BorderRadius.circular(4),
              ),
              child: fait ? const Icon(Icons.check, size: 15, color: Colors.white) : null,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_s(t['label']),
                  style: da.text(14, weight: fait ? FontWeight.w500 : FontWeight.w600, color: fait ? da.grey : null)
                      .copyWith(decoration: fait ? TextDecoration.lineThrough : null)),
              const SizedBox(height: 2),
              Text(ligneTache(t, auj), style: da.text(12, color: da.grey)),
            ]),
          ),
          if (etat.isNotEmpty) ...[
            const SizedBox(width: 8),
            GestureDetector(
              onTap: etat == 'Bloquant' ? () => _bloquer(t) : null,
              child: ProTag(etat, tone: etat == 'Bloquant' ? ProTagTone.solid : etat == 'Fait' ? ProTagTone.grey : ProTagTone.ink),
            ),
          ],
        ]),
      ),
    );
  }
}

List<String> _lotsDuDevis(Map<String, dynamic>? devis) {
  final lots = <String>[];
  for (final l in (devis?['items'] as List?) ?? const []) {
    final nom = _s((l as Map)['room']).trim();
    if (nom.isNotEmpty && !lots.contains(nom)) lots.add(nom);
  }
  return lots;
}

/// Nouvelle tâche, dictée ou saisie (maquette PRO-02.7, « Ajouter une
/// tâche, en dictant ») : le micro du clavier dicte la phrase, Koji remplit
/// la tâche, le lot, le compagnon et le jour ; tout reste modifiable.
class ProNouvelleTacheScreen extends ConsumerStatefulWidget {
  const ProNouvelleTacheScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    required this.lots,
    required this.equipe,
    this.quoteId = '',
    this.maintenant = DateTime.now,
  });

  final String projectId;
  final String titreChantier;
  final List<String> lots;
  final List<Map<String, dynamic>> equipe;
  final String quoteId;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProNouvelleTacheScreen> createState() => _ProNouvelleTacheScreenState();
}

class _ProNouvelleTacheScreenState extends ConsumerState<ProNouvelleTacheScreen> {
  final _phrase = TextEditingController();
  final _tache = TextEditingController();
  String _lot = '';
  String _qui = '';
  String _jour = '';
  bool _compris = false;
  bool _envoi = false;

  @override
  void dispose() {
    _phrase.dispose();
    _tache.dispose();
    super.dispose();
  }

  void _comprendre(String texte) {
    final c = comprendreDictee(texte,
        lots: widget.lots, compagnons: widget.equipe, aujourdhui: _aujourdhui(widget.maintenant));
    setState(() {
      _compris = texte.trim().isNotEmpty;
      _tache.text = c.label;
      if (c.lot.isNotEmpty) _lot = c.lot;
      if (c.compagnonId.isNotEmpty) _qui = c.compagnonId;
      if (c.jour.isNotEmpty) _jour = c.jour;
    });
  }

  Future<void> _choisirJour() async {
    final base = _jour.isEmpty ? widget.maintenant() : DateTime.parse(_jour);
    final d = await showDatePicker(
        context: context,
        initialDate: base,
        firstDate: DateTime(base.year - 1),
        lastDate: DateTime(base.year + 2),
        locale: const Locale('fr', 'FR'));
    if (d != null) setState(() => _jour = DateFormat('yyyy-MM-dd').format(d));
  }

  Future<void> _ajouter() async {
    setState(() => _envoi = true);
    Map<String, dynamic>? w;
    for (final x in widget.equipe) {
      if (_s(x['id']) == _qui) w = x;
    }
    try {
      await ref.read(proKojiWebProvider).enregistrerTache({
        'projectId': widget.projectId,
        'project': widget.titreChantier,
        'quoteId': widget.quoteId,
        'label': _tache.text.trim(),
        'room': _lot.isEmpty ? 'Autres tâches' : _lot,
        if (_jour.isNotEmpty) ...{'startDate': _jour, 'endDate': _jour, 'dueDate': _jour},
        'workerIds': w == null ? <String>[] : [_s(w['id'])],
        'assignedTo': w == null ? 'À affecter' : _s(w['name']),
      });
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is ProKojiWebException ? e.message : "La tâche n'a pas pu être ajoutée.")));
        setState(() => _envoi = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    String? nomQui;
    for (final x in widget.equipe) {
      if (_s(x['id']) == _qui) nomQui = _s(x['name']).split(' ').first;
    }
    final jourTexte = _jour.isEmpty ? 'choisir' : DateFormat('E d MMM', 'fr_FR').format(DateTime.parse(_jour));
    InputDecoration champ([String? aide]) => InputDecoration(
          hintText: aide,
          isDense: true,
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFFD9D9D4))),
        );
    Widget libelle(String t) => Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 4),
          child: Text(t, style: da.text(12, color: da.grey)),
        );
    return Scaffold(
      backgroundColor: da.page,
      body: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          color: const Color(0xFF171B1E),
          padding: EdgeInsets.fromLTRB(6, MediaQuery.paddingOf(context).top + 6, 16, 8),
          child: Row(children: [
            IconButton(
              tooltip: 'Retour',
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.chevron_left, color: Colors.white),
            ),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Nouvelle tâche', style: da.text(15, weight: FontWeight.w700, color: const Color(0xFFF5F5F2))),
                Text('${widget.titreChantier} · dictée ou saisie', style: da.text(12, color: const Color(0xFFA7ABB2))),
              ]),
            ),
          ]),
        ),
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), children: [
            TextField(
              controller: _phrase,
              minLines: 2,
              maxLines: 4,
              style: da.text(16),
              onChanged: _comprendre,
              decoration: champ('« Poser les plinthes carrelées vendredi avec Rui »'),
            ),
            const SizedBox(height: 4),
            Text('Touchez le micro du clavier pour dicter.', style: da.text(12, color: da.grey)),
            if (_compris) ...[
              const SizedBox(height: 14),
              Text('KOJI A COMPRIS', style: da.text(11, weight: FontWeight.w700, color: da.grey)),
            ],
            libelle('Tâche'),
            TextField(controller: _tache, style: da.text(15), decoration: champ(), onChanged: (_) => setState(() {})),
            libelle('Lot'),
            DropdownButtonFormField<String>(
              key: ValueKey('lot-$_lot'),
              initialValue: _lot,
              isExpanded: true,
              decoration: champ(),
              items: [
                DropdownMenuItem(value: '', child: Text('Autres tâches', style: da.text(15))),
                for (final (i, l) in widget.lots.indexed)
                  DropdownMenuItem(value: l, child: Text('${(i + 1).toString().padLeft(2, '0')} · $l', style: da.text(15))),
              ],
              onChanged: (v) => setState(() => _lot = v ?? ''),
            ),
            libelle('Compagnon'),
            DropdownButtonFormField<String>(
              key: ValueKey('qui-$_qui'),
              initialValue: _qui,
              isExpanded: true,
              decoration: champ(),
              items: [
                DropdownMenuItem(value: '', child: Text('À affecter', style: da.text(15))),
                for (final w in widget.equipe)
                  DropdownMenuItem(value: _s(w['id']), child: Text(_s(w['name']), style: da.text(15))),
              ],
              onChanged: (v) => setState(() => _qui = v ?? ''),
            ),
            libelle('Jour'),
            OutlinedButton(
              onPressed: _choisirJour,
              style: OutlinedButton.styleFrom(
                  alignment: Alignment.centerLeft,
                  backgroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(46),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  side: const BorderSide(color: Color(0xFFD9D9D4))),
              child: Text(jourTexte, style: da.text(15)),
            ),
            const SizedBox(height: 12),
            Text(
                nomQui == null
                    ? 'La tâche apparaît dans le planning du chantier et sur la feuille à imprimer.'
                    : '$nomQui la verra dans le planning du chantier et sur la feuille à imprimer.',
                style: da.text(12, color: da.grey)),
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: ProPrimaryButton(label: 'Ajouter', expand: true, onPressed: _envoi || _tache.text.trim().isEmpty ? null : _ajouter),
          ),
        ),
      ]),
    );
  }
}
