import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/apps/entreprise/chantiers/fiche_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/pro_cloture_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_taches_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_lancer_chantier_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

/// Données de la fiche, lues sur le site (mêmes routes que la fiche web).
class DonneesFiche {
  const DonneesFiche({
    required this.projet,
    this.devis,
    this.taches = const [],
    this.factures = const [],
    this.rdv = const [],
    this.alertes = const [],
    this.documents = const [],
    this.photos = const [],
    this.reserves = const [],
    this.acces,
  });

  final Map<String, dynamic> projet;
  final Map<String, dynamic>? devis;
  final List<Map<String, dynamic>> taches;
  final List<Map<String, dynamic>> factures;
  final List<Map<String, dynamic>> rdv;
  final List<Map<String, dynamic>> alertes;
  final List<Map<String, dynamic>> documents;

  /// Photos avant / après / pendant (PRO-02.2).
  final List<PhotoChantier> photos;

  /// Réserves (PRO-02.3).
  final List<Reserve> reserves;
  final Map<String, dynamic>? acces;
}

final proFicheChantierProvider = FutureProvider.autoDispose
    .family<DonneesFiche?, String>((ref, projectId) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(String path, String key) =>
      api.liste(path, key).catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    api.liste('/api/projects', 'projects'),
    lire('/api/quotes', 'quotes'),
    lire('/api/tasks', 'tasks'),
    lire('/api/invoices', 'invoices'),
    lire('/api/calendar-events', 'calendarEvents'),
    lire('/api/urgent-alerts', 'alerts'),
    lire('/api/project-documents', 'projectDocuments'),
  ]);
  bool duChantier(Map<String, dynamic> m) => '${m['projectId']}' == projectId;
  final projets = r[0].where((p) => '${p['id']}' == projectId);
  if (projets.isEmpty) return null;
  final devis = r[1].where(duChantier);
  final acces = await api.accesClient(projectId).catchError((_) => null);
  final photos = await api
      .photosChantier(projectId)
      .catchError((_) => <Map<String, dynamic>>[]);
  final reserves =
      await api.reserves(projectId).catchError((_) => <Map<String, dynamic>>[]);
  return DonneesFiche(
    projet: projets.first,
    devis: devis.isEmpty ? null : devis.first,
    taches: r[2].where(duChantier).toList(),
    factures: r[3].where(duChantier).toList(),
    rdv: r[4].where(duChantier).toList(),
    alertes: r[5].where(duChantier).toList(),
    documents: r[6].where(duChantier).toList(),
    photos: photos.map(PhotoChantier.fromJson).toList(),
    reserves: reserves.map(Reserve.new).toList(),
    acces: acces,
  );
});

/// Koji Pro, fiche chantier (maquette PRO-02.1, téléphone « 2 · Fiche
/// chantier ») : avancement, facturé, fin ; « Situation de travaux » ;
/// onglets Lots, Planning, À traiter, Docs ; un lot touché montre ses
/// ouvrages (« Marquer fait »). Budget, dépenses et suivi des ouvriers
/// restent dans les outils du chantier (lien en bas).
class ProFicheChantierScreen extends ConsumerStatefulWidget {
  const ProFicheChantierScreen({super.key, required this.projectId});

  final String projectId;

  @override
  ConsumerState<ProFicheChantierScreen> createState() =>
      _ProFicheChantierScreenState();
}

class _ProFicheChantierScreenState
    extends ConsumerState<ProFicheChantierScreen> {
  String _onglet = 'lots';
  String? _lotOuvert;
  final Set<String> _envoi = {};

  /// Lot dont une photo part (« lot|phase »).
  String? _photoEnCours;

  /// Photo prise à l'appareil photo (jamais depuis la galerie) ; le serveur
  /// pose la date, l'heure et l'auteur.
  Future<void> _prendrePhoto(String lot, String phase) async {
    final image = await ImagePicker().pickImage(
        source: ImageSource.camera, maxWidth: 1600, imageQuality: 80);
    if (image == null || !mounted) return;
    setState(() => _photoEnCours = '$lot|$phase');
    try {
      await ref.read(proKojiWebProvider).envoyerPhoto(
            projectId: widget.projectId,
            lot: lot,
            phase: phase,
            octets: await image.readAsBytes(),
          );
      _recharger();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is ProKojiWebException
                ? e.message
                : "La photo n'a pas pu être envoyée.")));
      }
    } finally {
      if (mounted) setState(() => _photoEnCours = null);
    }
  }

  String _s(dynamic v) => v == null ? '' : '$v';

  void _recharger() =>
      ref.invalidate(proFicheChantierProvider(widget.projectId));

  Future<void> _basculer(Map<String, dynamic> tache) async {
    final id = _s(tache['id']);
    setState(() => _envoi.add(id));
    try {
      await ref.read(proKojiWebProvider).basculerTache(id);
      _recharger();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is ProKojiWebException
                ? e.message
                : "L'ouvrage n'a pas pu être mis à jour.")));
      }
    } finally {
      if (mounted) setState(() => _envoi.remove(id));
    }
  }

  Future<void> _lancer() async {
    final lance = await Navigator.of(context).push<bool>(MaterialPageRoute(
        builder: (_) => ProLancerChantierScreen(projectId: widget.projectId)));
    if (lance == true) _recharger();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncFiche = ref.watch(proFicheChantierProvider(widget.projectId));
    final d = asyncFiche.valueOrNull;
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _barre(da, d),
          Expanded(
            child: d == null
                ? Center(
                    child: asyncFiche.isLoading
                        ? const CircularProgressIndicator(strokeWidth: 2)
                        : Padding(
                            padding: const EdgeInsets.all(20),
                            child: Text(
                                asyncFiche.hasError
                                    ? 'Fiche indisponible pour le moment.'
                                    : 'Chantier introuvable.',
                                style: da.text(15)),
                          ))
                : RefreshIndicator(
                    color: da.ink,
                    onRefresh: () async => _recharger(),
                    child: _corps(da, d),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _barre(ProDa da, DonneesFiche? d) {
    final devis = d?.devis;
    return Container(
      color: const Color(0xFF171B1E),
      padding:
          EdgeInsets.fromLTRB(6, MediaQuery.paddingOf(context).top + 6, 16, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Retour',
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.chevron_left, color: Colors.white),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                    _s(d?.projet['title']).isEmpty
                        ? 'Chantier'
                        : _s(d!.projet['title']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: da.text(15,
                        weight: FontWeight.w700,
                        color: const Color(0xFFF5F5F2))),
                Text(
                  [
                    _s(devis?['client']).isNotEmpty
                        ? _s(devis?['client'])
                        : _s(d?.projet['client']),
                    if (_s(devis?['quoteNumber']).isNotEmpty)
                      'devis ${devis!['quoteNumber']}',
                  ].where((s) => s.isNotEmpty).join(' · '),
                  style: da.text(12, color: const Color(0xFFA7ABB2)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _corps(ProDa da, DonneesFiche d) {
    final lots = lotsFiche(d.devis, d.taches);
    final resume = resumeFiche(
        devis: d.devis, lots: lots, taches: d.taches, factures: d.factures);
    final aujourdhui = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final aTraiter = aTraiterFiche(
        alertes: d.alertes,
        factures: d.factures,
        taches: d.taches,
        aujourdhui: aujourdhui);
    final signe = d.devis != null &&
        (d.devis!['status'] == 'Signe' ||
            d.devis!['signatureStatus'] == 'Signe');
    final rienPlanifie = d.taches.every((t) =>
        _s(t['startDate']).isEmpty &&
        _s(t['endDate']).isEmpty &&
        _s(t['dueDate']).isEmpty);
    final onglets = [
      ('lots', 'Lots', lots.length),
      ('planning', 'Planning', -1),
      ('traiter', 'À traiter', aTraiter.length),
      ('docs', 'Docs', -1),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
      children: [
        _kpis(da, resume),
        const SizedBox(height: 12),
        if (signe && lots.isNotEmpty && rienPlanifie) ...[
          ProCard(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Lancer le chantier',
                    style: da.text(15, weight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                    'Koji propose un planning à partir des ${lots.length} lots du devis.',
                    style: da.text(13, color: da.grey)),
                const SizedBox(height: 10),
                ProPrimaryButton(
                    label: 'Lancer le chantier',
                    expand: true,
                    onPressed: _lancer),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ] else if (signe) ...[
          ProPrimaryButton(
            label: 'Situation de travaux',
            icon: Icons.add,
            expand: true,
            onPressed: () =>
                context.push('/chantier/facturation/create', extra: {
              'quoteId': _s(d.devis!['id']),
              'type': 'Facture intermédiaire',
              'amountMode': 'percent',
            }),
          ),
          const SizedBox(height: 12),
        ],
        _ligneTaches(da, d),
        const SizedBox(height: 8),
        _ligneReserves(da, d),
        const SizedBox(height: 8),
        _ligneCloture(da, d),
        const SizedBox(height: 12),
        _onglets(da, onglets),
        const SizedBox(height: 10),
        ...switch (_onglet) {
          'planning' => _planning(da, d, aujourdhui),
          'traiter' => _traiter(da, aTraiter),
          'docs' => _docs(da, d),
          _ => _lots(da, lots, d.photos),
        },
        const SizedBox(height: 18),
        Center(
          child: TextButton(
            onPressed: () => context
                .push('/chantier/outils', extra: {'id': widget.projectId}),
            child: Text('Budget, dépenses et suivi des ouvriers',
                style: da
                    .text(13, weight: FontWeight.w600, color: da.grey)
                    .copyWith(decoration: TextDecoration.underline)),
          ),
        ),
      ],
    );
  }

  /// Réserves (PRO-02.3) : nombre à traiter, ouvre l'écran des réserves.
  Widget _ligneReserves(ProDa da, DonneesFiche d) {
    final c = compterReserves(d.reserves);
    return InkWell(
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ProReservesScreen(
                projectId: widget.projectId,
                titreChantier: _s(d.projet['title']))));
        _recharger();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: da.card,
          border: Border.all(color: da.frame),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          children: [
            Expanded(
              child:
                  Text('Réserves', style: da.text(14, weight: FontWeight.w600)),
            ),
            Text(
                c['toutes'] == 0
                    ? 'aucune'
                    : '${c['badge']} à traiter sur ${c['toutes']}',
                style: da.text(13, color: da.grey)),
            const SizedBox(width: 6),
            Icon(Icons.chevron_right, size: 18, color: da.grey),
          ],
        ),
      ),
    );
  }

  /// Tâches du chantier (PRO-02.7) : par lot, faites, bloquées.
  Widget _ligneTaches(ProDa da, DonneesFiche d) {
    final faites = d.taches.where((t) => t['done'] == true).length;
    return InkWell(
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ProTachesScreen(
                projectId: widget.projectId,
                titreChantier: _s(d.projet['title']))));
        _recharger();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: da.card,
          border: Border.all(color: da.frame),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text('Tâches', style: da.text(14, weight: FontWeight.w600)),
            ),
            Text(
                d.taches.isEmpty
                    ? 'aucune'
                    : '$faites faite${faites > 1 ? 's' : ''} sur ${d.taches.length}',
                style: da.text(13, color: da.grey)),
            const SizedBox(width: 6),
            Icon(Icons.chevron_right, size: 18, color: da.grey),
          ],
        ),
      ),
    );
  }

  /// Clôture (PRO-02.4) : réception, solde, dossier, avis.
  Widget _ligneCloture(ProDa da, DonneesFiche d) {
    return InkWell(
      onTap: () async {
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ProClotureScreen(
                projectId: widget.projectId,
                titreChantier: _s(d.projet['title']))));
        _recharger();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: da.card,
          border: Border.all(color: da.frame),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Row(
          children: [
            Expanded(
              child:
                  Text('Clôture', style: da.text(14, weight: FontWeight.w600)),
            ),
            Text('réception, solde, avis', style: da.text(13, color: da.grey)),
            const SizedBox(width: 6),
            Icon(Icons.chevron_right, size: 18, color: da.grey),
          ],
        ),
      ),
    );
  }

  Widget _kpis(ProDa da, ResumeFiche r) {
    Widget cellule(String label, String valeur, String detail) => Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 6, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: da.text(12, color: da.grey)),
                Text(valeur, style: da.text(20, weight: FontWeight.w700)),
                Text(detail,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: da.text(11, color: da.grey)),
              ],
            ),
          ),
        );
    return Container(
      decoration: BoxDecoration(
        color: da.card,
        border: Border(
          top: BorderSide(color: da.ink),
          bottom: BorderSide(color: da.line),
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            cellule('Avancement', '${r.avancement} %', r.sousAvancement),
            VerticalDivider(width: 1, color: da.line),
            cellule('Facturé', '${r.facturePourcent} %', r.sousFacture),
            VerticalDivider(width: 1, color: da.line),
            cellule('Fin', r.fin.isEmpty ? '—' : jourCourt(r.fin),
                r.fin.isEmpty ? 'pas encore planifié' : 'fin prévue'),
          ],
        ),
      ),
    );
  }

  Widget _onglets(ProDa da, List<(String, String, int)> onglets) => Container(
        padding: const EdgeInsets.fromLTRB(4, 6, 4, 0),
        decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFCFCFC9)))),
        child: Row(
          children: [
            for (final (i, (id, label, n)) in onglets.indexed) ...[
              if (i > 0) const SizedBox(width: 3),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _onglet = id),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(2, 8, 2, 7),
                    decoration: BoxDecoration(
                      color: _onglet == id
                          ? Colors.white
                          : const Color(0xFFDEDED6),
                      border: Border(
                        top: BorderSide(
                            color:
                                _onglet == id ? ProDa.prim : Colors.transparent,
                            width: 3),
                        left: const BorderSide(color: Color(0xFFCFCFC9)),
                        right: const BorderSide(color: Color(0xFFCFCFC9)),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(n >= 0 ? '$label $n' : label,
                        maxLines: 1,
                        style: da.text(12.5,
                            weight: _onglet == id
                                ? FontWeight.w700
                                : FontWeight.w600,
                            color: const Color(0xFF171B1E))),
                  ),
                ),
              ),
            ],
          ],
        ),
      );

  Widget _vide(ProDa da, String texte) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Text(texte, style: da.text(13, color: da.grey)),
      );

  List<Widget> _lots(
      ProDa da, List<LotFiche> lots, List<PhotoChantier> photos) {
    if (lots.isEmpty) {
      return [_vide(da, 'Pas encore de devis rattaché à ce chantier.')];
    }
    return [
      for (final lot in lots) ...[
        () {
          final ph = photosDuLot(photos, lot.nom,
              faites: lot.lignes.where((l) => l.faite).length,
              total: lot.lignes.length);
          return _carteLot(da, lot, ph);
        }(),
        const SizedBox(height: 8),
      ],
    ];
  }

  Widget _vignette(ProDa da, LotFiche lot, PhotoChantier? photo, String phase,
      {bool manquante = false}) {
    final libelle = phase == 'avant' ? 'Avant' : 'Après';
    final envoi = _photoEnCours == '${lot.nom}|$phase';
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Container(
              decoration: BoxDecoration(
                color: da.soft,
                border: Border.all(color: manquante ? da.ink : da.line),
                borderRadius: BorderRadius.circular(4),
              ),
              clipBehavior: Clip.antiAlias,
              child: photo != null && photo.url.isNotEmpty
                  ? Image.network(photo.url,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Center(
                          child: Text(libelle,
                              style: da.text(12, color: da.grey))))
                  : Center(
                      child: envoi
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2))
                          : TextButton(
                              onPressed: () => _prendrePhoto(lot.nom, phase),
                              child: Text(
                                  phase == 'avant'
                                      ? 'Photo avant'
                                      : 'Prendre la photo après',
                                  textAlign: TextAlign.center,
                                  style: da.text(12, weight: FontWeight.w600)),
                            ),
                    ),
            ),
          ),
          const SizedBox(height: 4),
          Text(libelle, style: da.text(12, weight: FontWeight.w700)),
          Text(
              photo != null
                  ? '${horodatage(photo.takenAt)} · ${photo.author}'
                  : phase == 'apres'
                      ? (manquante
                          ? 'obligatoire pour terminer le lot'
                          : 'à la fin du lot')
                      : 'au début du lot',
              style: da.text(11, color: da.grey)),
        ],
      ),
    );
  }

  Widget _carteLot(ProDa da, LotFiche lot,
      ({PhotoChantier? avant, PhotoChantier? apres, String etat}) ph) {
    final etat =
        ph.etat == 'apres_manquante' ? 'Photo après manquante' : lot.etat;
    return GestureDetector(
      onTap: () =>
          setState(() => _lotOuvert = _lotOuvert == lot.nom ? null : lot.nom),
      behavior: HitTestBehavior.opaque,
      child: ProCard(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Lot ${lot.numero} · ${lot.nom}',
                          style: da.text(14, weight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('${lot.dates} · ${lot.equipe}',
                          style: da.text(12, color: da.grey)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(eurosFiche(lot.montant),
                        style: da.text(13, weight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    ProTag(etat,
                        tone: ph.etat == 'apres_manquante'
                            ? ProTagTone.solid
                            : lot.etat == 'Terminé'
                                ? ProTagTone.grey
                                : ProTagTone.ink),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRect(
              child: LinearProgressIndicator(
                value: lot.pourcent / 100,
                minHeight: 4,
                color: da.ink,
                backgroundColor: const Color(0xFFE2E2DB),
              ),
            ),
            if (_lotOuvert == lot.nom) ...[
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _vignette(da, lot, ph.avant, 'avant'),
                  const SizedBox(width: 10),
                  _vignette(da, lot, ph.apres, 'apres',
                      manquante: ph.etat == 'apres_manquante'),
                ],
              ),
              const SizedBox(height: 8),
              for (final l in lot.lignes)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                      border: Border(top: BorderSide(color: da.line))),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(l.label,
                            style:
                                da.text(13, color: l.faite ? da.grey : null)),
                      ),
                      if (l.tache != null)
                        TextButton(
                          onPressed: _envoi.contains(_s(l.tache!['id']))
                              ? null
                              : () {
                                  final restantes =
                                      lot.lignes.where((x) => !x.faite).length;
                                  if (!l.faite &&
                                      restantes == 1 &&
                                      ph.apres == null) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                            content: Text(
                                                "Prenez d'abord la photo après : elle est obligatoire pour terminer le lot.")));
                                    return;
                                  }
                                  _basculer(l.tache!);
                                },
                          child: Text(l.faite ? 'Rouvrir' : 'Marquer fait',
                              style: da.text(12, weight: FontWeight.w600)),
                        )
                      else
                        Text('non planifié',
                            style: da.text(12, color: da.grey)),
                    ],
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _planning(ProDa da, DonneesFiche d, String aujourdhui) {
    String date(Map<String, dynamic> t) =>
        _s(t['startDate']).isNotEmpty ? _s(t['startDate']) : _s(t['dueDate']);
    final taches = d.taches
        .where((t) => t['done'] != true && date(t).isNotEmpty)
        .toList()
      ..sort((a, b) => date(a).compareTo(date(b)));
    final rdv = d.rdv
        .where((e) => _s(e['startAt']).compareTo(aujourdhui) >= 0)
        .toList()
      ..sort((a, b) => _s(a['startAt']).compareTo(_s(b['startAt'])));
    if (taches.isEmpty && rdv.isEmpty) {
      return [_vide(da, 'Rien de prévu pour le moment.')];
    }
    return [
      for (final e in rdv)
        _ligne(
            da,
            _s(e['title']).isEmpty ? 'Rendez-vous' : _s(e['title']),
            '${jourCourt(_s(e['startAt']))}${_s(e['startAt']).length >= 16 ? ', ${_s(e['startAt']).substring(11, 16)}' : ''}',
            'RDV'),
      for (final t in taches.take(20))
        _ligne(
            da,
            _s(t['label']),
            '${jourCourt(date(t))}${_s(t['endDate']).isNotEmpty ? ' → ${jourCourt(_s(t['endDate']))}' : ''} · ${_s(t['assignedTo']).isEmpty || t['assignedTo'] == 'Equipe' ? 'Équipe' : t['assignedTo']}',
            null),
    ];
  }

  List<Widget> _traiter(ProDa da, List<ATraiterFiche> items) => items.isEmpty
      ? [_vide(da, 'Rien à traiter pour ce chantier.')]
      : [
          for (final i in items)
            _ligne(da, i.titre, i.detail, i.etiquette, solide: i.bloquant),
        ];

  List<Widget> _docs(ProDa da, DonneesFiche d) {
    final lignes = <Widget>[
      if (d.devis != null)
        _ligne(da, 'Devis ${_s(d.devis!['quoteNumber'])}',
            '${eurosFiche((d.devis!['totalHt'] as num?) ?? 0)} HT', 'Devis'),
      for (final f in d.factures)
        _ligne(
            da,
            _s(f['invoiceNumber']).isEmpty ? 'Facture' : _s(f['invoiceNumber']),
            '${_s(f['type']).isEmpty ? 'Facture' : f['type']} · ${eurosFiche((f['amountTtc'] as num?) ?? 0)} TTC',
            switch (f['status']) {
              'Payee' => 'Payée',
              'Emise' => 'Envoyée',
              _ => _s(f['status']).isEmpty ? 'Brouillon' : _s(f['status']),
            }),
      for (final doc in d.documents)
        InkWell(
          onTap: _s(doc['url']).isEmpty
              ? null
              : () => launchUrl(Uri.parse(_s(doc['url'])),
                  mode: LaunchMode.externalApplication),
          child: _ligne(
              da,
              _s(doc['title']),
              [_s(doc['type']), _s(doc['category'])]
                  .where((s) => s.isNotEmpty)
                  .join(' · '),
              null),
        ),
      _ligne(da, 'Suivi Koji Client',
          d.acces == null ? 'pas encore activé' : 'activé', null),
    ];
    return lignes;
  }

  Widget _ligne(ProDa da, String titre, String detail, String? etiquette,
          {bool solide = false}) =>
      Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration:
            BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titre, style: da.text(14, weight: FontWeight.w500)),
                  if (detail.isNotEmpty)
                    Text(detail, style: da.text(12, color: da.grey)),
                ],
              ),
            ),
            if (etiquette != null) ...[
              const SizedBox(width: 8),
              ProTag(etiquette,
                  tone: solide ? ProTagTone.solid : ProTagTone.ink),
            ],
          ],
        ),
      );
}
