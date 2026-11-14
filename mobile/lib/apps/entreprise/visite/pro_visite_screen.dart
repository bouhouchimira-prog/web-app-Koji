import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';

import 'package:koji/apps/entreprise/devis/devis_suivi.dart' show heureDeParis;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart' show proKojiWebProvider, ProKojiWebException;
import 'package:koji/apps/entreprise/visite/visite_mode.dart';
import 'package:koji/apps/entreprise/visite/visite_store.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';

/// Les visites du compte connecté, gardées sur le téléphone.
final visiteStoreProvider = ChangeNotifierProvider<VisiteStore>((ref) {
  final compte = ref.watch(authRepositoryProvider).currentUser?.id ?? 'anonyme';
  final store = VisiteStore(compte: compte, stockage: HiveVisiteStockage(), serveur: WebVisiteServeur(ref.read(proKojiWebProvider)));
  store.charger();
  return store;
});

const _rouge = Color(0xFFC4452D);
List<Map<String, dynamic>> _l(dynamic v) => [for (final x in (v as List?) ?? const []) if (x is Map) x as Map<String, dynamic>];
String _s(dynamic v) => v == null ? '' : '$v';

Future<List<int>?> _photoAppareil() async {
  final f = await ImagePicker().pickImage(source: ImageSource.camera, maxWidth: 1600, imageQuality: 75);
  return f == null ? null : await f.readAsBytes();
}

/// Mode visite (maquette PRO-03.8, téléphone) : préparer hors ligne, pièce
/// par pièce (photo, cote dictée, note, une question de Koji à la fois), à
/// vérifier, puis fin de visite : résumé au client, date promise du devis,
/// Devis guidé prérempli. Tout est gardé sur le téléphone et envoyé au
/// retour du réseau, sans action.
class ProVisiteScreen extends StatefulWidget {
  const ProVisiteScreen({
    super.key,
    required this.store,
    required this.visiteId,
    required this.onOuvrirDevis,
    this.prendrePhoto = _photoAppareil,
    this.auteur = '',
    this.maintenant = DateTime.now,
  });

  final VisiteStore store;
  final String visiteId;
  final Future<void> Function(Visite visite) onOuvrirDevis;
  final Future<List<int>?> Function() prendrePhoto;
  final String auteur;
  final DateTime Function() maintenant;

  @override
  State<ProVisiteScreen> createState() => _ProVisiteScreenState();
}

class _ProVisiteScreenState extends State<ProVisiteScreen> {
  String _vue = 'piece';
  String _pieceId = 'p1';
  String _ouvert = '';
  Timer? _horloge;
  final _resume = TextEditingController();
  bool _resumeEdite = false;
  bool _envoyerResume = true;
  String _devisPromis = '';
  bool _envoi = false;
  String _erreur = '';

  Visite get _v => widget.store.lire(widget.visiteId) ?? <String, dynamic>{'pieces': []};
  List<Map<String, dynamic>> get _pieces => _l(_v['pieces']);
  Map<String, dynamic> get _piece => _pieces.firstWhere((p) => p['id'] == _pieceId, orElse: () => _pieces.isNotEmpty ? _pieces.first : <String, dynamic>{});
  String get _nomClient => _s(_v['client']).isEmpty ? 'le client' : _s(_v['client']);
  String _jourParis() => DateFormat('yyyy-MM-dd').format(heureDeParis(widget.maintenant().toUtc()));
  String _heure(String iso) {
    final d = DateTime.tryParse(iso);
    return d == null ? '' : DateFormat("H 'h' mm").format(heureDeParis(d));
  }

  @override
  void initState() {
    super.initState();
    widget.store.addListener(_rafraichir);
    _horloge = Timer.periodic(const Duration(seconds: 30), (_) => _rafraichir());
    final dates = datesPromises(_jourParis());
    _devisPromis = _s(_v['devisPromis']).isNotEmpty ? _s(_v['devisPromis']) : dates.first.jour;
    _envoyerResume = _s(_v['email']).isNotEmpty;
  }

  @override
  void dispose() {
    widget.store.removeListener(_rafraichir);
    _horloge?.cancel();
    _resume.dispose();
    super.dispose();
  }

  void _rafraichir() {
    if (mounted) setState(() {});
  }

  Future<void> _modifier(void Function(Visite v) f) async {
    final v = _v;
    f(v);
    await widget.store.enregistrer(v);
    if (mounted) setState(() {});
  }

  String get _id => const Uuid().v4().substring(0, 8);
  String get _maintenantIso => widget.maintenant().toUtc().toIso8601String();

  // ── Actions ──────────────────────────────────────────────────────────────
  Future<void> _photo({String pointId = ''}) async {
    final octets = await widget.prendrePhoto();
    if (octets == null || !mounted) return;
    final id = _id;
    final ref = await widget.store.garderPhoto(widget.visiteId, id, octets);
    await _modifier((v) {
      final piece = _l(v['pieces']).firstWhere((p) => p['id'] == _piece['id']);
      (piece['photos'] as List).add(<String, dynamic>{'id': id, 'le': _maintenantIso, 'local': ref, if (pointId.isNotEmpty) 'pointId': pointId});
      if (pointId.isNotEmpty) {
        final pt = _l(piece['points']).where((x) => x['id'] == pointId).firstOrNull;
        if (pt != null) {
          pt['photoId'] = id;
          pt['envoye'] = false;
        }
      }
    });
  }

  Future<void> _cote() async {
    final cote = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _FeuilleCote(entete: [
        DateFormat('EEE dd/MM HH:mm', 'fr_FR').format(heureDeParis(widget.maintenant().toUtc())),
        if (widget.auteur.isNotEmpty) widget.auteur,
      ].join(' · ')),
    );
    if (cote == null) return;
    await _modifier((v) {
      final piece = _l(v['pieces']).firstWhere((p) => p['id'] == _piece['id']);
      (piece['cotes'] as List).add(<String, dynamic>{'id': _id, ...cote, 'le': _maintenantIso});
    });
  }

  Future<void> _note() async {
    final texte = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _FeuilleNote(),
    );
    if (texte == null || texte.trim().isEmpty) return;
    await _modifier((v) {
      final piece = _l(v['pieces']).firstWhere((p) => p['id'] == _piece['id']);
      (piece['notes'] as List).add(<String, dynamic>{'id': _id, 'texte': texte.trim(), 'le': _maintenantIso});
    });
  }

  Future<void> _repondre(String pointId, String reponse) => _modifier((v) {
        final piece = _l(v['pieces']).firstWhere((p) => p['id'] == _piece['id']);
        final pt = _l(piece['points']).firstWhere((x) => x['id'] == pointId);
        pt['reponse'] = reponse;
        pt['envoye'] = false;
      });

  Future<void> _ajouterPiece() async {
    final c = TextEditingController();
    final nom = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nouvelle pièce'),
        content: TextField(controller: c, autofocus: true, decoration: const InputDecoration(hintText: 'Couloir, cuisine…')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Ajouter')),
        ],
      ),
    );
    if (nom == null || nom.isEmpty) return;
    final id = 'p${_pieces.length + 1}-$_id';
    await _modifier((v) => (v['pieces'] as List).add(<String, dynamic>{'id': id, 'nom': nom, 'cotes': [], 'points': [], 'notes': [], 'photos': []}));
    setState(() => _pieceId = id);
  }

  Future<void> _modifierDemande() async {
    final c = TextEditingController(text: _s(_v['demande']));
    final texte = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ce que le client a décrit'),
        content: TextField(controller: c, autofocus: true, maxLines: 5, minLines: 3),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Enregistrer')),
        ],
      ),
    );
    if (texte == null) return;
    await _modifier((v) {
      v['demande'] = texte;
      final pieces = _l(v['pieces']);
      if (pieces.isNotEmpty && _l(pieces.first['points']).every((p) => _s(p['reponse']).isEmpty)) {
        pieces.first['points'] = listeAVerifier(texte);
      }
    });
  }

  Future<void> _ouvrirDevis() async {
    if (_envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    await _modifier((v) => v['devisPromis'] = _devisPromis);
    await widget.store.envoyer_(widget.visiteId);
    try {
      final email = _s(_v['email']);
      final r = await widget.store.serveur.resume(widget.visiteId,
          message: _resume.text.trim().isEmpty ? resumeClient(_v, _devisPromis) : _resume.text.trim(),
          devisPromis: _devisPromis,
          email: email,
          envoyer: _envoyerResume && email.isNotEmpty);
      await _modifier((v) {
        if (r['emailEnvoye'] == true) v['resumeEnvoyeLe'] = _maintenantIso;
      });
      if (!mounted) return;
      setState(() => _envoi = false);
      await widget.onOuvrirDevis(_v);
    } on ProKojiWebException catch (e) {
      if (mounted) {
        setState(() {
          _envoi = false;
          _erreur = e.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _envoi = false;
          _erreur = "Pas de réseau : la visite reste sur le téléphone. Le Devis guidé s'ouvre dès le retour du réseau.";
        });
      }
    }
  }

  // ── Écrans ───────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    if (!widget.store.charge && widget.store.lire(widget.visiteId) == null) {
      return Scaffold(backgroundColor: da.page, body: const Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    if (_s(_v['debut']).isEmpty) return _preparer(da);
    if (_s(_v['fin']).isNotEmpty) return _fin(da);
    return _enCours(da);
  }

  PreferredSizeWidget _barre(ProDa da, String titre, String sousTitre, {Widget? action}) => PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Material(
          color: da.card,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
              child: Row(
                children: [
                  IconButton(onPressed: () => Navigator.of(context).maybePop(), tooltip: 'Retour', icon: Icon(Icons.chevron_left, color: da.ink, size: 26)),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(titre, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(15, weight: FontWeight.w700)),
                        Text(sousTitre, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                      ],
                    ),
                  ),
                  if (action != null) action,
                  const SizedBox(width: 8),
                ],
              ),
            ),
          ),
        ),
      );

  Widget _carte(ProDa da, {required Widget child, EdgeInsets padding = const EdgeInsets.fromLTRB(14, 12, 14, 12)}) => Container(
        width: double.infinity,
        padding: padding,
        decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.ink, width: 2), left: BorderSide(color: da.line), right: BorderSide(color: da.line), bottom: BorderSide(color: da.line))),
        child: child,
      );

  Widget _titreCarte(ProDa da, String titre, {String compte = '', String droite = ''}) => Row(
        children: [
          Text(titre, style: da.text(15, weight: FontWeight.w700)),
          if (compte.isNotEmpty) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(border: Border.all(color: da.ink)),
              child: Text(compte, style: da.text(11, weight: FontWeight.w700)),
            ),
          ],
          const Spacer(),
          if (droite.isNotEmpty) Flexible(child: Text(droite, textAlign: TextAlign.right, style: da.text(12, color: da.grey))),
        ],
      );

  Widget _bandeau(ProDa da) {
    final attente = enAttente(_v);
    final texte = widget.store.horsLigne
        ? (attente > 0 ? 'Hors ligne · $attente élément${attente > 1 ? 's' : ''} en attente d\'envoi' : 'Hors ligne · tout est gardé sur le téléphone')
        : attente > 0
            ? '$attente élément${attente > 1 ? 's' : ''} en attente d\'envoi'
            : _s(_v['envoyeLe']).isNotEmpty
                ? 'Envoyé à Koji · ${_heure(_s(_v['envoyeLe']))}'
                : 'Gardé sur le téléphone';
    return Container(
      width: double.infinity,
      color: da.pill,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
      child: Row(children: [
        Icon(widget.store.horsLigne ? Icons.cloud_off_outlined : Icons.cloud_done_outlined, size: 15, color: da.grey),
        const SizedBox(width: 8),
        Expanded(child: Text(texte, style: da.text(12.5, color: da.ink, weight: FontWeight.w500))),
      ]),
    );
  }

  Widget _preparer(ProDa da) {
    final points = _l(_pieces.isNotEmpty ? _pieces.first['points'] : null);
    final rdv = DateTime.tryParse(_s(_v['rdvLe']));
    final titre = rdv == null ? 'Visite' : 'Visite · ${DateFormat("EEEE H 'h'", 'fr_FR').format(heureDeParis(rdv))}';
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(da, titre, [_s(_v['client']), _s(_v['adresse'])].where((x) => x.isNotEmpty).join(' · ')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  color: da.pill,
                  child: Row(children: [
                    Icon(Icons.offline_pin_outlined, size: 16, color: da.ink),
                    const SizedBox(width: 8),
                    Expanded(child: Text('Prête hors ligne : demande et questions', style: da.text(13, weight: FontWeight.w500))),
                  ]),
                ),
                const SizedBox(height: 12),
                _carte(da,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text('Ce que le client a décrit', style: da.text(12, color: da.grey))),
                        GestureDetector(onTap: _modifierDemande, child: Text('Modifier', style: da.text(12.5, weight: FontWeight.w600).copyWith(decoration: TextDecoration.underline))),
                      ]),
                      const SizedBox(height: 4),
                      Text(_s(_v['demande']).isEmpty ? 'Pas de demande écrite : ajoutez-la pour que Koji prépare les questions.' : _s(_v['demande']),
                          style: da.text(14, height: 1.45, color: _s(_v['demande']).isEmpty ? da.grey : da.ink)),
                    ])),
                const SizedBox(height: 10),
                _carte(da,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _titreCarte(da, 'À vérifier sur place', compte: '${points.length}'),
                      const SizedBox(height: 6),
                      for (final p in points)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 5),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Padding(padding: const EdgeInsets.only(top: 6), child: Container(width: 5, height: 5, color: da.ink)),
                            const SizedBox(width: 10),
                            Expanded(child: Text(_s(p['libelle']), style: da.text(14))),
                          ]),
                        ),
                    ])),
                const SizedBox(height: 8),
                Text("préparé par Koji d'après la demande et les lots prévus", style: da.text(12, color: da.grey)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: ProPrimaryButton(
                label: 'Commencer la visite',
                expand: true,
                onPressed: () => _modifier((v) => v['debut'] = _maintenantIso),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _enCours(ProDa da) {
    final debut = DateTime.tryParse(_s(_v['debut']));
    final minutes = debut == null ? 0 : widget.maintenant().toUtc().difference(debut).inMinutes;
    final points = _l(_piece['points']);
    final faits = points.where((p) => _s(p['reponse']).isNotEmpty).length;
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(
        da,
        _vue == 'verifier' ? 'À vérifier' : _s(_piece['nom']),
        _vue == 'verifier' ? '$faits sur ${points.length} · ${_piece['nom']}' : 'Visite en cours · $minutes min',
        action: TextButton(
          onPressed: () => _modifier((v) => v['fin'] = _maintenantIso).then((_) => setState(() => _resume.text = resumeClient(_v, _devisPromis))),
          style: TextButton.styleFrom(foregroundColor: da.ink),
          child: Text('Terminer', style: da.text(14, weight: FontWeight.w700)),
        ),
      ),
      body: Column(
        children: [
          _bandeau(da),
          Container(
            color: da.card,
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(children: [
                for (final p in _pieces) ...[
                  _onglet(da, _s(p['nom']), p['id'] == _piece['id'], () => setState(() => _pieceId = '${p['id']}')),
                  const SizedBox(width: 6),
                ],
                _onglet(da, '+ Pièce', false, _ajouterPiece),
                const SizedBox(width: 16),
                _onglet(da, 'Pièce', _vue == 'piece', () => setState(() => _vue = 'piece'), plein: true),
                const SizedBox(width: 6),
                _onglet(da, 'À vérifier $faits/${points.length}', _vue == 'verifier', () => setState(() => _vue = 'verifier'), plein: true),
              ]),
            ),
          ),
          Expanded(child: _vue == 'verifier' ? _verifier(da) : _vuePiece(da)),
          Container(
            decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.line))),
            child: SafeArea(
              top: false,
              child: Row(children: [
                _action(da, Icons.photo_camera_outlined, 'Photo', () => _photo()),
                _action(da, Icons.straighten, 'Cote', _cote),
                _action(da, Icons.mic_none, 'Note', _note),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _onglet(ProDa da, String label, bool on, VoidCallback onTap, {bool plein = false}) => Material(
        color: on ? (plein ? da.fill : da.card) : da.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2), side: BorderSide(color: on ? da.ink : da.line, width: on && !plein ? 1.5 : 1)),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
            child: Text(label, style: da.text(13, weight: FontWeight.w600, color: on && plein ? da.onFill : da.ink)),
          ),
        ),
      );

  Widget _action(ProDa da, IconData icone, String label, VoidCallback onTap) => Expanded(
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icone, size: 22, color: da.ink),
              const SizedBox(height: 2),
              Text(label, style: da.text(12.5, weight: FontWeight.w600)),
            ]),
          ),
        ),
      );

  Widget _vignette(ProDa da, Map<String, dynamic> photo, {double taille = 64}) => FutureBuilder<List<int>?>(
        future: widget.store.stockage.lirePhoto(_s(photo['local'])),
        builder: (_, s) => Container(
          width: taille,
          height: taille,
          color: da.pill,
          child: s.data == null ? Icon(Icons.image_outlined, color: da.grey, size: 20) : Image.memory(Uint8List.fromList(s.data!), fit: BoxFit.cover, gaplessPlayback: true, errorBuilder: (_, __, ___) => Icon(Icons.image_outlined, color: da.grey, size: 20)),
        ),
      );

  Widget _vuePiece(ProDa da) {
    final photos = _l(_piece['photos']);
    final cotes = _l(_piece['cotes']);
    final question = prochaineQuestion(_l(_piece['points']));
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      children: [
        if (photos.isNotEmpty) ...[
          Row(children: [
            for (final ph in photos.reversed.take(4)) ...[_vignette(da, ph), const SizedBox(width: 6)],
            if (photos.length > 4)
              Container(width: 64, height: 64, alignment: Alignment.center, color: da.pill, child: Text('+ ${photos.length - 4}', style: da.text(14, weight: FontWeight.w700))),
          ]),
          const SizedBox(height: 12),
        ],
        _carte(da,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _titreCarte(da, 'Cotes', compte: '${cotes.length}', droite: resumeSurfaces(cotes)),
              const SizedBox(height: 4),
              if (cotes.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text('Longueur, largeur et hauteur donnent le sol et les murs. Touchez « Cote » et dites la mesure.', style: da.text(13, color: da.grey)),
                ),
              for (final c in cotes)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 9),
                  decoration: BoxDecoration(border: Border(top: BorderSide(color: da.rule))),
                  child: Row(children: [
                    Expanded(child: Text(_s(c['libelle']).isEmpty ? 'Cote' : _s(c['libelle']), style: da.text(14, color: da.grey))),
                    Text(texteCoteCourt(c), style: da.text(14, weight: FontWeight.w600)),
                    GestureDetector(
                      onTap: () => _modifier((v) => (_l(v['pieces']).firstWhere((p) => p['id'] == _piece['id'])['cotes'] as List).removeWhere((x) => (x as Map)['id'] == c['id'])),
                      child: Padding(padding: const EdgeInsets.only(left: 10), child: Icon(Icons.close, size: 16, color: da.grey)),
                    ),
                  ]),
                ),
            ])),
        if (question != null) ...[
          const SizedBox(height: 12),
          _carte(da,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Question de Koji', style: da.text(12, color: da.grey)),
                const SizedBox(height: 2),
                Text(_s(question['question']), style: da.text(15, weight: FontWeight.w700)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final c in (question['choix'] as List? ?? const []))
                    _choix(da, '$c', false, () => _repondre('${question['id']}', '$c')),
                ]),
              ])),
        ],
        const SizedBox(height: 12),
        for (final n in _l(_piece['notes']))
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
            decoration: BoxDecoration(color: da.soft, border: Border(left: BorderSide(color: da.ink, width: 3))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('« ${n['texte']} »', style: da.text(13.5, height: 1.4)),
              Text(_heure(_s(n['le'])), style: da.text(11.5, color: da.grey)),
            ]),
          ),
      ],
    );
  }

  Widget _choix(ProDa da, String label, bool on, VoidCallback onTap) => Material(
        color: on ? da.fill : da.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: on ? da.fill : const Color(0xFF8A8F98))),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            child: Text(label, style: da.text(13.5, weight: FontWeight.w600, color: on ? da.onFill : da.ink)),
          ),
        ),
      );

  Widget _verifier(ProDa da) {
    final points = _l(_piece['points']);
    final props = propositions(points, _s(_piece['nom']));
    final decisions = (_v['propositions'] as Map?) ?? const {};
    final photos = _l(_piece['photos']);
    if (points.isEmpty) {
      return Padding(padding: const EdgeInsets.all(16), child: Text('Rien à vérifier dans cette pièce.', style: da.text(13, color: da.grey)));
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      children: [
        for (final (i, p) in points.indexed) ...[
          () {
            final fait = _s(p['reponse']).isNotEmpty;
            final ouvert = _ouvert == p['id'] || !fait && _ouvert.isEmpty && prochaineQuestion(points)?['id'] == p['id'];
            final preuve = photos.any((ph) => ph['pointId'] == p['id']) ? 'photo' : _s(p['detail']).isNotEmpty ? 'note' : '';
            return InkWell(
              onTap: () => setState(() => _ouvert = _ouvert == p['id'] ? '' : '${p['id']}'),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    SizedBox(
                      width: 26,
                      child: fait
                          ? Icon(Icons.check, size: 18, color: da.ink)
                          : Container(
                              width: 20,
                              height: 20,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: da.ink)),
                              child: Text('${i + 1}', style: da.text(11, weight: FontWeight.w700)),
                            ),
                    ),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_s(p['court']), style: da.text(14, weight: FontWeight.w700)),
                        Text(fait ? [_s(p['reponse']), _s(p['detail'])].where((x) => x.isNotEmpty).join(', ') : _s(p['libelle']),
                            style: da.text(12.5, color: da.grey, height: 1.35)),
                      ]),
                    ),
                    if (preuve.isNotEmpty) Text(preuve, style: da.text(12, color: da.grey)),
                  ]),
                  if (ouvert) ...[
                    const SizedBox(height: 10),
                    Text(_s(p['question']), style: da.text(13.5, weight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final c in (p['choix'] as List? ?? const [])) _choix(da, '$c', p['reponse'] == '$c', () => _repondre('${p['id']}', '$c')),
                    ]),
                    const SizedBox(height: 8),
                    _ChampDetail(
                      initial: _s(p['detail']),
                      onFini: (t) => _modifier((v) {
                        final pt = _l(_l(v['pieces']).firstWhere((x) => x['id'] == _piece['id'])['points']).firstWhere((x) => x['id'] == p['id']);
                        pt['detail'] = t;
                        pt['envoye'] = false;
                      }),
                    ),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => _photo(pointId: '${p['id']}'),
                        style: TextButton.styleFrom(foregroundColor: da.ink, padding: EdgeInsets.zero),
                        icon: const Icon(Icons.photo_camera_outlined, size: 18),
                        label: Text('Photo', style: da.text(13, weight: FontWeight.w600)),
                      ),
                    ),
                  ],
                ]),
              ),
            );
          }(),
          for (final prop in props.where((x) => x['pointId'] == p['id']))
            Container(
              margin: const EdgeInsets.only(top: 8, bottom: 4),
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              decoration: BoxDecoration(color: da.soft, border: Border(left: BorderSide(color: da.ink, width: 3))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text(_s(prop['texte']), style: da.text(13.5, height: 1.4)),
                const SizedBox(height: 10),
                if (decisions[prop['id']] == null) ...[
                  ProPrimaryButton(
                    label: 'Ajouter ${prop['court']}${prop['option'] == true ? ' en option' : ''}',
                    height: 42,
                    expand: true,
                    onPressed: () => _modifier((v) => (v['propositions'] ??= <String, dynamic>{})[prop['id']] = 'acceptee'),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: TextButton(
                      onPressed: () => _modifier((v) => (v['propositions'] ??= <String, dynamic>{})[prop['id']] = 'refusee'),
                      style: TextButton.styleFrom(foregroundColor: da.ink),
                      child: Text('Ne pas proposer', style: da.text(13.5, weight: FontWeight.w600)),
                    ),
                  ),
                ] else
                  Row(children: [
                    Expanded(
                      child: Text(decisions[prop['id']] == 'acceptee' ? 'Ajouté au devis${prop['option'] == true ? ', en option' : ''}' : 'Pas proposé',
                          style: da.text(13, weight: FontWeight.w600)),
                    ),
                    GestureDetector(
                      onTap: () => _modifier((v) => ((v['propositions'] as Map?) ?? {}).remove(prop['id'])),
                      child: Text('Changer', style: da.text(12.5, color: da.grey).copyWith(decoration: TextDecoration.underline)),
                    ),
                  ]),
              ]),
            ),
        ],
      ],
    );
  }

  Widget _fin(ProDa da) {
    if (!_resumeEdite && _resume.text.isEmpty) _resume.text = resumeClient(_v, _devisPromis);
    final compte = compteVisite(_v);
    final attente = enAttente(_v);
    final quantites = _pieces.fold<int>(0, (s, p) => s + quantitesCalculees(p, _s(_v['demande'])).length);
    final restantes = questionsRestantes(_v);
    final dates = datesPromises(DateFormat('yyyy-MM-dd').format(heureDeParis(DateTime.tryParse(_s(_v['debut'])) ?? widget.maintenant().toUtc())));
    final email = _s(_v['email']);
    final ecart = widget.store.ecartSecondes;
    final envoye = attente == 0 && _s(_v['envoyeLe']).isNotEmpty;
    Widget ligne(int n, String titre, String detail) => Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(border: Border(top: BorderSide(color: da.rule))),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: da.ink)),
              child: Text('$n', style: da.text(11, weight: FontWeight.w700)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(titre, style: da.text(14, weight: FontWeight.w600)),
                Text(detail, style: da.text(12.5, color: da.grey, height: 1.35)),
              ]),
            ),
          ]),
        );
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(da, 'Visite terminée', [dureeVisite(_s(_v['debut']), _s(_v['fin'])), _s(_v['client'])].where((x) => x.isNotEmpty).join(' · ')),
      body: Column(children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            children: [
              _carte(da,
                  padding: const EdgeInsets.fromLTRB(14, 2, 14, 2),
                  child: Column(children: [
                    ligne(1, 'Enregistré sur le téléphone', compte.texte),
                    ligne(
                        2,
                        envoye ? 'Envoyé à Koji' : 'Envoi à Koji en attente',
                        envoye
                            ? 'au retour du réseau, ${_heure(_s(_v['envoyeLe']))}${ecart == null ? '' : ecart.abs() > 120 ? ' · heure du téléphone décalée' : ' · heure vérifiée'}'
                            : '$attente élément${attente > 1 ? 's' : ''}, envoi automatique au retour du réseau'),
                    ligne(3, 'Devis guidé prêt', [
                      '$quantites quantité${quantites > 1 ? 's' : ''} calculée${quantites > 1 ? 's' : ''}',
                      '$restantes question${restantes > 1 ? 's' : ''} restante${restantes > 1 ? 's' : ''}',
                    ].join(' · ')),
                  ])),
              const SizedBox(height: 12),
              _carte(da,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Row(children: [
                      Expanded(child: Text('Envoyer un résumé à $_nomClient', style: da.text(14, weight: FontWeight.w700))),
                      Switch(
                        value: _envoyerResume && email.isNotEmpty,
                        activeTrackColor: da.fill,
                        onChanged: email.isEmpty ? null : (v) => setState(() => _envoyerResume = v),
                      ),
                    ]),
                    if (email.isEmpty) Text("Pas d'e-mail sur la visite : le résumé ne part pas.", style: da.text(12.5, color: da.grey)),
                    if (email.isNotEmpty && _envoyerResume)
                      TextField(
                        controller: _resume,
                        maxLines: 6,
                        minLines: 3,
                        onChanged: (_) => _resumeEdite = true,
                        style: da.text(13.5, height: 1.45),
                        decoration: InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: da.soft,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
                          helperText: 'Information seulement : aucun prix avant le devis.',
                          helperStyle: da.text(11.5, color: da.grey),
                        ),
                      ),
                  ])),
              const SizedBox(height: 12),
              Text('Devis promis pour', style: da.text(14, weight: FontWeight.w700)),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final d in dates)
                  _choix(da, d.label, _devisPromis == d.jour, () => setState(() {
                        _devisPromis = d.jour;
                        if (!_resumeEdite) _resume.text = resumeClient(_v, d.jour);
                      })),
                _choix(da, dates.any((d) => d.jour == _devisPromis) ? 'Autre date' : jourLong(_devisPromis), !dates.any((d) => d.jour == _devisPromis), () async {
                  final choisi = await showDatePicker(
                    context: context,
                    initialDate: DateTime.parse(_devisPromis),
                    firstDate: DateTime.parse(dates.first.jour),
                    lastDate: DateTime.parse(dates.first.jour).add(const Duration(days: 60)),
                    locale: const Locale('fr', 'FR'),
                  );
                  if (choisi == null) return;
                  setState(() {
                    _devisPromis = DateFormat('yyyy-MM-dd').format(choisi);
                    if (!_resumeEdite) _resume.text = resumeClient(_v, _devisPromis);
                  });
                }),
              ]),
              const SizedBox(height: 6),
              Text('rappel dans vos tâches la veille au soir', style: da.text(12, color: da.grey)),
              if (_erreur.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(_erreur, style: da.text(13, color: _rouge)),
              ],
              const SizedBox(height: 6),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => _modifier((v) => v['fin'] = ''),
                  style: TextButton.styleFrom(foregroundColor: da.ink, padding: EdgeInsets.zero),
                  child: Text('Reprendre la visite', style: da.text(13, weight: FontWeight.w600).copyWith(decoration: TextDecoration.underline)),
                ),
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: ProPrimaryButton(label: _envoi ? 'Envoi…' : 'Ouvrir le Devis guidé', expand: true, onPressed: _envoi ? null : _ouvrirDevis),
          ),
        ),
      ]),
    );
  }
}

class _ChampDetail extends StatefulWidget {
  const _ChampDetail({required this.initial, required this.onFini});
  final String initial;
  final ValueChanged<String> onFini;

  @override
  State<_ChampDetail> createState() => _ChampDetailState();
}

class _ChampDetailState extends State<_ChampDetail> {
  late final _c = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return TextField(
      controller: _c,
      style: da.text(13.5),
      onSubmitted: widget.onFini,
      onTapOutside: (_) {
        if (_c.text != widget.initial) widget.onFini(_c.text.trim());
        FocusScope.of(context).unfocus();
      },
      decoration: InputDecoration(
        isDense: true,
        hintText: 'Ce que vous avez vu (dictez ou tapez)',
        filled: true,
        fillColor: da.card,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
      ),
    );
  }
}

/// Cote dictée (maquette PRO-03.8, écran 3) : la phrase dite au micro du
/// clavier, ce que Koji a compris, le mur à choisir ; clavier si la dictée
/// ne passe pas.
class _FeuilleCote extends StatefulWidget {
  const _FeuilleCote({required this.entete});
  final String entete;

  @override
  State<_FeuilleCote> createState() => _FeuilleCoteState();
}

class _FeuilleCoteState extends State<_FeuilleCote> {
  final _phrase = TextEditingController();
  final _libelle = TextEditingController();
  final _mesure = TextEditingController();
  bool _clavier = false;
  String _choix = '';

  static const _murs = ['Longueur', 'Largeur', 'Hauteur', 'Mur', 'Fond', 'Porte', 'Fenêtre', 'Vasque'];

  @override
  void dispose() {
    _phrase.dispose();
    _libelle.dispose();
    _mesure.dispose();
    super.dispose();
  }

  Map<String, dynamic>? get _compris {
    final c = _clavier ? comprendreCote('${_libelle.text.trim().isEmpty ? 'x' : _libelle.text.trim()} ${_mesure.text}') : comprendreCote(_phrase.text);
    if (c == null) return null;
    final libelle = _choix.isNotEmpty
        ? (_choix == 'Fond' ? 'Mur du fond' : _choix == 'Vasque' ? 'Mur de la vasque' : _choix)
        : _clavier
            ? _libelle.text.trim()
            : '${c['libelle']}';
    return {...c, 'libelle': libelle};
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final compris = _compris;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        decoration: BoxDecoration(color: da.page, borderRadius: const BorderRadius.vertical(top: Radius.circular(8))),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(widget.entete, style: da.text(12, color: da.grey)),
            const SizedBox(height: 2),
            Text('Nouvelle cote', style: da.text(20, weight: FontWeight.w700)),
            const SizedBox(height: 12),
            if (!_clavier)
              TextField(
                controller: _phrase,
                autofocus: true,
                maxLines: 2,
                minLines: 1,
                onChanged: (_) => setState(() {}),
                style: da.text(16, height: 1.35),
                decoration: InputDecoration(
                  hintText: '« Mur du fond deux mètres quarante »',
                  helperText: 'Touchez le micro du clavier et dites la cote.',
                  helperStyle: da.text(11.5, color: da.grey),
                  filled: true,
                  fillColor: da.card,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
                ),
              )
            else
              Row(children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _libelle,
                    autofocus: true,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(isDense: true, labelText: 'Quoi', filled: true, fillColor: da.card, border: const OutlineInputBorder()),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _mesure,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(isDense: true, labelText: 'Mesure', hintText: '2,40 ou 83 x 204', filled: true, fillColor: da.card, border: const OutlineInputBorder()),
                  ),
                ),
              ]),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              decoration: BoxDecoration(color: da.card, border: Border(left: BorderSide(color: da.ink, width: 3))),
              child: Row(children: [
                Text('Koji a compris', style: da.text(12.5, color: da.grey)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    compris == null ? '…' : [if ('${compris['libelle']}'.isNotEmpty) compris['libelle'], texteCote(compris)].join(' · '),
                    textAlign: TextAlign.right,
                    style: da.text(15, weight: FontWeight.w700),
                  ),
                ),
              ]),
            ),
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final m in _murs)
                ChoiceChip(
                  label: Text(m, style: da.text(13, weight: FontWeight.w600, color: _choix == m ? da.onFill : da.ink)),
                  selected: _choix == m,
                  showCheckmark: false,
                  selectedColor: da.fill,
                  backgroundColor: da.card,
                  side: BorderSide(color: _choix == m ? da.fill : da.line),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  onSelected: (on) => setState(() => _choix = on ? m : ''),
                ),
            ]),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(
                child: ProPrimaryButton(
                  label: 'Enregistrer la cote',
                  expand: true,
                  onPressed: compris == null ? null : () => Navigator.of(context).pop(compris),
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () => setState(() => _clavier = !_clavier),
                style: TextButton.styleFrom(foregroundColor: da.ink),
                child: Text(_clavier ? 'Dictée' : 'Clavier', style: da.text(14, weight: FontWeight.w600)),
              ),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _FeuilleNote extends StatefulWidget {
  const _FeuilleNote();

  @override
  State<_FeuilleNote> createState() => _FeuilleNoteState();
}

class _FeuilleNoteState extends State<_FeuilleNote> {
  final _c = TextEditingController();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        decoration: BoxDecoration(color: da.page, borderRadius: const BorderRadius.vertical(top: Radius.circular(8))),
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
        child: SafeArea(
          top: false,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Note', style: da.text(20, weight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Votre voix seulement : jamais la conversation avec le client sans son accord.', style: da.text(12, color: da.grey)),
            const SizedBox(height: 10),
            TextField(
              controller: _c,
              autofocus: true,
              maxLines: 5,
              minLines: 2,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: '« Cliente veut garder le radiateur… »',
                helperText: 'Touchez le micro du clavier pour dicter.',
                filled: true,
                fillColor: da.card,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
              ),
            ),
            const SizedBox(height: 12),
            ProPrimaryButton(label: 'Enregistrer la note', expand: true, onPressed: _c.text.trim().isEmpty ? null : () => Navigator.of(context).pop(_c.text)),
          ]),
        ),
      ),
    );
  }
}

/// Préparer une visite : un rendez-vous à venir, ou une nouvelle visite.
Future<Visite?> preparerVisite(BuildContext context, WidgetRef ref) async {
  final store = ref.read(visiteStoreProvider);
  final api = ref.read(proKojiWebProvider);
  return showModalBottomSheet<Visite>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _FeuillePreparer(store: store, rendezVous: api.rendezVousAVenir),
  );
}

class _FeuillePreparer extends StatefulWidget {
  const _FeuillePreparer({required this.store, required this.rendezVous});
  final VisiteStore store;
  final Future<List<Map<String, dynamic>>> Function() rendezVous;

  @override
  State<_FeuillePreparer> createState() => _FeuillePreparerState();
}

class _FeuillePreparerState extends State<_FeuillePreparer> {
  final _client = TextEditingController();
  final _email = TextEditingController();
  final _adresse = TextEditingController();
  final _demande = TextEditingController();
  late final Future<List<Map<String, dynamic>>> _rdv = widget.rendezVous().catchError((_) => <Map<String, dynamic>>[]);
  String _eventId = '';
  String _rdvLe = '';
  bool _creation = false;

  @override
  void dispose() {
    _client.dispose();
    _email.dispose();
    _adresse.dispose();
    _demande.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    InputDecoration deco(String label, {String hint = ''}) => InputDecoration(
          isDense: true,
          labelText: label,
          hintText: hint.isEmpty ? null : hint,
          filled: true,
          fillColor: da.card,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
        );
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
        decoration: BoxDecoration(color: da.page, borderRadius: const BorderRadius.vertical(top: Radius.circular(8))),
        child: SafeArea(
          top: false,
          child: ListView(
            shrinkWrap: true,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            children: [
              Text('Préparer une visite', style: da.text(20, weight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text('Koji garde la demande et les questions sur le téléphone, même sans réseau.', style: da.text(12.5, color: da.grey)),
              const SizedBox(height: 12),
              FutureBuilder<List<Map<String, dynamic>>>(
                future: _rdv,
                builder: (_, s) {
                  final rdv = s.data ?? const [];
                  if (rdv.isEmpty) return const SizedBox.shrink();
                  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Text('Rendez-vous à venir', style: da.text(13, weight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    for (final e in rdv.take(5))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Material(
                          color: da.card,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: _eventId == e['id'] ? da.ink : da.line, width: _eventId == e['id'] ? 1.5 : 1)),
                          child: InkWell(
                            onTap: () => setState(() {
                              _eventId = '${e['id']}';
                              _rdvLe = '${e['startAt'] ?? ''}';
                              _client.text = '${e['clientName'] ?? ''}';
                              _adresse.text = '${e['address'] ?? ''}';
                              if ('${e['notes'] ?? ''}'.isNotEmpty) _demande.text = '${e['notes']}';
                            }),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(
                                  [
                                    DateTime.tryParse('${e['startAt']}') == null ? '' : DateFormat("EEE d MMM, H 'h' mm", 'fr_FR').format(heureDeParis(DateTime.parse('${e['startAt']}'))),
                                    '${e['clientName'] ?? ''}',
                                  ].where((x) => x.isNotEmpty).join(' · '),
                                  style: da.text(14, weight: FontWeight.w600),
                                ),
                                Text(['${e['title'] ?? ''}', '${e['address'] ?? ''}'].where((x) => x.isNotEmpty).join(' · '), style: da.text(12.5, color: da.grey)),
                              ]),
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                  ]);
                },
              ),
              TextField(controller: _client, decoration: deco('Client', hint: 'Mme Lefèvre'), onChanged: (_) => setState(() {})),
              const SizedBox(height: 8),
              TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: deco('E-mail du client', hint: 'pour le résumé de visite')),
              const SizedBox(height: 8),
              TextField(controller: _adresse, decoration: deco('Adresse du chantier')),
              const SizedBox(height: 8),
              TextField(
                controller: _demande,
                maxLines: 4,
                minLines: 2,
                decoration: deco('Ce que le client a décrit', hint: "Douche à l'italienne à la place de la baignoire…"),
              ),
              const SizedBox(height: 14),
              ProPrimaryButton(
                label: _creation ? 'Préparation…' : 'Préparer la visite',
                expand: true,
                onPressed: _client.text.trim().isEmpty || _creation
                    ? null
                    : () async {
                        setState(() => _creation = true);
                        final v = await widget.store.creer(
                          client: _client.text,
                          email: _email.text,
                          adresse: _adresse.text,
                          demande: _demande.text,
                          rdvLe: _rdvLe,
                          eventId: _eventId,
                        );
                        if (context.mounted) Navigator.of(context).pop(v);
                      },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
