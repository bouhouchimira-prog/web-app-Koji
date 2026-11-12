import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/fiche_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

/// Réserves et photos du chantier, lues sur le site.
typedef DonneesReserves = ({
  List<Reserve> reserves,
  List<PhotoChantier> photos,
  List<Map<String, dynamic>> equipe,
});

final proReservesProvider = FutureProvider.autoDispose
    .family<DonneesReserves, String>((ref, projectId) async {
  final api = ref.watch(proKojiWebProvider);
  final r = await api.reserves(projectId);
  final photos = await api
      .photosChantier(projectId)
      .catchError((_) => <Map<String, dynamic>>[]);
  final equipe = await api
      .liste('/api/workers', 'workers')
      .catchError((_) => <Map<String, dynamic>>[]);
  return (
    reserves: r.map(Reserve.new).toList(),
    photos: photos.map(PhotoChantier.fromJson).toList(),
    equipe: equipe,
  );
});

/// Prend une photo à l'appareil (jamais la galerie). Remplaçable en test.
typedef PrisePhoto = Future<List<int>?> Function();

Future<List<int>?> prendrePhotoAppareil() async {
  final image = await ImagePicker()
      .pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 80);
  return image?.readAsBytes();
}

/// Koji Pro, Réserves (maquette PRO-02.3, téléphone) : filtres, une ligne
/// par réserve, « Ajouter une réserve en photo » (photo, texte, lieu,
/// attribution, date) ; une réserve touchée : ses photos, « Prendre la photo
/// de la levée », puis « Valider la levée » ou « Refuser, à refaire ».
class ProReservesScreen extends ConsumerStatefulWidget {
  const ProReservesScreen({
    super.key,
    required this.projectId,
    this.titreChantier = '',
    this.equipe = const [],
    this.prisePhoto,
  });

  final String projectId;
  final String titreChantier;

  /// Compagnons et sous-traitants (attribution).
  final List<Map<String, dynamic>> equipe;
  final PrisePhoto? prisePhoto;

  @override
  ConsumerState<ProReservesScreen> createState() => _ProReservesScreenState();
}

class _ProReservesScreenState extends ConsumerState<ProReservesScreen> {
  String _filtre = 'toutes';
  bool _envoi = false;

  ProKojiWebClient get _api => ref.read(proKojiWebProvider);
  void _recharger() => ref.invalidate(proReservesProvider(widget.projectId));

  void _message(String texte) => ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(texte)));

  Future<T?> _travail<T>(Future<T> Function() f) async {
    setState(() => _envoi = true);
    try {
      return await f();
    } catch (e) {
      if (mounted) {
        _message(e is ProKojiWebException
            ? e.message
            : "L'envoi n'a pas abouti. Vérifiez la connexion.");
      }
      return null;
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _ajouter() async {
    final octets = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (octets == null || !mounted) return;
    final saisie = await _formulaire();
    if (saisie == null) return;
    await _travail(() async {
      final reserve = await _api.creerReserve({
        'projectId': widget.projectId,
        ...saisie,
      });
      await _api.envoyerPhoto(
        projectId: widget.projectId,
        lot: '',
        phase: 'reserve',
        octets: octets,
        reserveId: '${reserve['id']}',
      );
      _recharger();
      if (mounted) _message('${reserve['numero']} créée.');
    });
  }

  List<Map<String, dynamic>> get _equipe => widget.equipe.isNotEmpty
      ? widget.equipe
      : ref.read(proReservesProvider(widget.projectId)).valueOrNull?.equipe ??
          const [];

  Future<Map<String, dynamic>?> _formulaire() {
    final da = ProDa.of(context);
    final equipe = _equipe;
    final titre = TextEditingController();
    final lieu = TextEditingController();
    var qui = '';
    DateTime? pour;
    return showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: da.page,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(
              16, 16, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Nouvelle réserve',
                    style: da.text(17, weight: FontWeight.w700)),
                Text(
                    "${DateFormat('dd/MM HH:mm').format(DateTime.now())} · date et auteur posés par Koji",
                    style: da.text(12, color: da.grey)),
                const SizedBox(height: 12),
                TextField(
                  controller: titre,
                  autofocus: true,
                  maxLength: 200,
                  decoration: const InputDecoration(
                      labelText: 'La réserve',
                      hintText: 'Carreau fêlé derrière le WC',
                      counterText: ''),
                ),
                TextField(
                  controller: lieu,
                  maxLength: 120,
                  decoration: const InputDecoration(
                      labelText: 'Où', hintText: 'Mur WC', counterText: ''),
                ),
                const SizedBox(height: 12),
                Text('Pour', style: da.text(13, color: da.grey)),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final (id, label) in [
                      ('moi', 'Vous'),
                      for (final w in equipe)
                        (
                          '${w['id']}',
                          '${w['name']}${w['type'] == 'Sous-traitant' ? ' · sous-traitant' : ''}'
                        ),
                    ])
                      ChoiceChip(
                        label: Text(label),
                        selected: qui == id,
                        onSelected: (_) => setSheet(() => qui = id),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().add(const Duration(days: 3)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (d != null) setSheet(() => pour = d);
                  },
                  child: Text(pour == null
                      ? 'Avant le…'
                      : 'Avant le ${DateFormat('d MMM', 'fr_FR').format(pour!)}'),
                ),
                const SizedBox(height: 16),
                ProPrimaryButton(
                  label: 'Créer la réserve',
                  expand: true,
                  onPressed: () {
                    if (titre.text.trim().isEmpty) return;
                    Map<String, dynamic>? w;
                    for (final x in equipe) {
                      if ('${x['id']}' == qui) w = x;
                    }
                    Navigator.of(context).pop({
                      'titre': titre.text.trim(),
                      'lieu': lieu.text.trim(),
                      'attribueeA': qui,
                      'attribueeNom': qui == 'moi'
                          ? 'Vous'
                          : w == null
                              ? ''
                              : '${w['name']}${w['type'] == 'Sous-traitant' ? ' · sous-traitant' : ''}',
                      'pourLe': pour == null
                          ? ''
                          : DateFormat('yyyy-MM-dd').format(pour!),
                    });
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _lever(Reserve r) async {
    final octets = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    if (octets == null || !mounted) return;
    await _travail(() async {
      final photo = await _api.envoyerPhoto(
        projectId: widget.projectId,
        lot: '',
        phase: 'levee',
        octets: octets,
        reserveId: r.id,
      );
      await _api.actionReserve(r.id, 'faite', {'photoLeveeId': photo['id']});
      _recharger();
    });
  }

  Future<void> _action(Reserve r, String action) async {
    await _travail(() async {
      final maj = await _api.actionReserve(r.id, action);
      _recharger();
      if (mounted) {
        _message(action == 'valider'
            ? '${maj['numero'] ?? r.numero} levée.'
            : '${r.numero} à refaire.');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncDonnees = ref.watch(proReservesProvider(widget.projectId));
    final d = asyncDonnees.valueOrNull;
    final reserves = d?.reserves ?? const <Reserve>[];
    final comptes = compterReserves(reserves);
    final aujourdhui = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final visibles = reserves
        .where((r) => _filtre == 'toutes' || r.statut == _filtre)
        .toList();
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: const Color(0xFF171B1E),
            padding: EdgeInsets.fromLTRB(
                6, MediaQuery.paddingOf(context).top + 6, 16, 8),
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
                      Text('Réserves',
                          style: da.text(15,
                              weight: FontWeight.w700,
                              color: const Color(0xFFF5F5F2))),
                      if (widget.titreChantier.isNotEmpty)
                        Text(widget.titreChantier,
                            style: da.text(12, color: const Color(0xFFA7ABB2))),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: d == null
                ? Center(
                    child: asyncDonnees.hasError
                        ? Text('Réserves indisponibles pour le moment.',
                            style: da.text(14))
                        : const CircularProgressIndicator(strokeWidth: 2))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                    children: [
                      Text('Réserves · ${comptes['toutes']}',
                          style: da.text(17, weight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: ProSegmented<String>(
                          options: [
                            for (final (id, label) in filtresReserves)
                              (id, label, comptes[id] ?? 0),
                          ],
                          value: _filtre,
                          onChanged: (v) => setState(() => _filtre = v),
                        ),
                      ),
                      const SizedBox(height: 10),
                      if (visibles.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          child: Text(
                              reserves.isEmpty
                                  ? 'Aucune réserve. Prenez la première en photo.'
                                  : 'Aucune réserve dans ce filtre.',
                              style: da.text(13, color: da.grey)),
                        ),
                      for (final r in visibles)
                        _ligne(da, r, d.photos, aujourdhui),
                    ],
                  ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: ProPrimaryButton(
                label: 'Ajouter une réserve en photo',
                icon: Icons.photo_camera_outlined,
                expand: true,
                onPressed: _envoi ? null : _ajouter,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ligne(
      ProDa da, Reserve r, List<PhotoChantier> photos, String aujourdhui) {
    final e = etiquetteReserve(r, aujourdhui);
    return InkWell(
      onTap: () => _detail(r, photos),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration:
            BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${r.numero} · ${r.titre}',
                      style: da.text(14, weight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(ligneReserve(r), style: da.text(12, color: da.grey)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            ProTag(e.label,
                tone: e.plein
                    ? ProTagTone.solid
                    : r.statut == 'levee'
                        ? ProTagTone.grey
                        : ProTagTone.ink),
          ],
        ),
      ),
    );
  }

  void _detail(Reserve r, List<PhotoChantier> photos) {
    final da = ProDa.of(context);
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: da.page,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                  [
                    r.numero,
                    r.lieu,
                    if (r.attribueeNom.isNotEmpty) r.attribueeNom
                  ].where((s) => s.isNotEmpty).join(' · '),
                  style: da.text(12, color: da.grey)),
              Text(r.titre, style: da.text(17, weight: FontWeight.w700)),
              const SizedBox(height: 12),
              Row(
                children: [
                  for (final (phase, libelle) in [
                    ('reserve', 'Réserve'),
                    ('levee', 'Levée')
                  ]) ...[
                    if (phase == 'levee') const SizedBox(width: 10),
                    Expanded(
                      child: _photoReserve(da, r, photos, phase, libelle),
                    ),
                  ],
                ],
              ),
              if (r.note.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text('« ${r.note} »', style: da.text(14)),
              ],
              const SizedBox(height: 16),
              if (r.statut == 'faite') ...[
                ProPrimaryButton(
                  label: 'Valider la levée',
                  expand: true,
                  onPressed: () {
                    Navigator.of(context).pop();
                    _action(r, 'valider');
                  },
                ),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pop();
                    _action(r, 'refuser');
                  },
                  child: Text('Refuser, à refaire',
                      style: da.text(14, weight: FontWeight.w600)),
                ),
              ] else if (r.statut != 'levee')
                ProPrimaryButton(
                  label: 'Prendre la photo de la réserve levée',
                  icon: Icons.photo_camera_outlined,
                  expand: true,
                  onPressed: () {
                    Navigator.of(context).pop();
                    _lever(r);
                  },
                )
              else
                Text(ligneReserve(r), style: da.text(13, color: da.grey)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _photoReserve(ProDa da, Reserve r, List<PhotoChantier> photos,
      String phase, String libelle) {
    PhotoChantier? p;
    for (final x in photos) {
      if (x.phase == phase && x.reserveId == r.id) p = x;
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Container(
            decoration: BoxDecoration(
              color: da.soft,
              border: Border.all(color: da.line),
              borderRadius: BorderRadius.circular(4),
            ),
            clipBehavior: Clip.antiAlias,
            child: p != null && p.url.isNotEmpty
                ? Image.network(p.url,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
                        child:
                            Text(libelle, style: da.text(12, color: da.grey))))
                : Center(
                    child: Text(
                        phase == 'levee'
                            ? 'Pas encore de levée'
                            : 'Pas de photo',
                        style: da.text(12, color: da.grey))),
          ),
        ),
        const SizedBox(height: 4),
        Text(libelle, style: da.text(12, weight: FontWeight.w700)),
        if (p != null)
          Text('${horodatage(p.takenAt)} · ${p.author}',
              style: da.text(11, color: da.grey)),
      ],
    );
  }
}
