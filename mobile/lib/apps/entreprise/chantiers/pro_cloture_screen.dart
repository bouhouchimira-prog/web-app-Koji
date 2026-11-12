import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/chantiers/pro_dossier_screen.dart';
import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

String _s(dynamic v) => v == null ? '' : '$v';

/// Données de la clôture, lues sur le site (mêmes routes que l'onglet
/// Clôture de la fiche web).
typedef DonneesCloture = ({
  Map<String, dynamic>? cloture,
  Map<String, dynamic>? devis,
  List<Map<String, dynamic>> factures,
  List<Map<String, dynamic>> avenants,
  List<Reserve> reserves,
});

final proClotureProvider = FutureProvider.autoDispose
    .family<DonneesCloture, String>((ref, projectId) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(Future<List<Map<String, dynamic>>> f) =>
      f.catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    lire(api.liste('/api/quotes', 'quotes')),
    lire(api.liste('/api/invoices', 'invoices')),
    lire(api.reserves(projectId)),
  ]);
  final devis = r[0].where((q) => _s(q['projectId']) == projectId).toList();
  final quoteId = devis.isEmpty ? '' : _s(devis.first['id']);
  final cloture = await api.cloture(projectId).catchError((_) => null);
  final avenants =
      quoteId.isEmpty ? <Map<String, dynamic>>[] : await lire(api.avenants(quoteId));
  return (
    cloture: cloture,
    devis: devis.isEmpty ? null : devis.first,
    factures:
        facturesDuChantier(r[1], projectId: projectId, quoteId: quoteId),
    avenants: avenants,
    reserves: r[2].map(Reserve.new).toList(),
  );
});

/// Rend les traits d'une signature en PNG (trait noir, fond transparent).
typedef RenduSignature = Future<List<int>> Function(
    List<List<Offset>> traits, Size taille);

Future<List<int>> signaturePng(List<List<Offset>> traits, Size taille) async {
  final rec = ui.PictureRecorder();
  final canvas = Canvas(rec)..scale(2);
  _SignaturePainter(traits).paint(canvas, taille);
  final image = await rec
      .endRecording()
      .toImage((taille.width * 2).round(), (taille.height * 2).round());
  final data = await image.toByteData(format: ui.ImageByteFormat.png);
  return data!.buffer.asUint8List();
}

/// Koji Pro, clôture du chantier (maquette PRO-02.4, téléphone « Clôturer
/// le chantier ») : réception, réserves, facture de solde, dossier, avis ;
/// le bouton du bas fait l'étape en cours.
class ProClotureScreen extends ConsumerStatefulWidget {
  const ProClotureScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    this.rendu = signaturePng,
    this.maintenant = DateTime.now,
  });

  final String projectId;
  final String titreChantier;
  final RenduSignature rendu;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProClotureScreen> createState() => _ProClotureScreenState();
}

class _ProClotureScreenState extends ConsumerState<ProClotureScreen> {
  bool _envoi = false;

  void _recharger() => ref.invalidate(proClotureProvider(widget.projectId));

  Future<void> _faire(EtapeCloture e, DonneesCloture d, Solde solde) async {
    switch (e.id) {
      case 'reception':
        final lots = ((d.devis?['items'] as List?) ?? const [])
            .map((l) => _s((l as Map)['room']).trim())
            .toSet()
            .length;
        final signe = await Navigator.of(context).push<bool>(MaterialPageRoute(
            builder: (_) => ProPvScreen(
                  projectId: widget.projectId,
                  titreChantier: widget.titreChantier,
                  reserves: d.reserves.where((r) => r.statut != 'levee').toList(),
                  travaux: travauxReceptionnes(d.devis, lots, solde.avenants),
                  signataire: _s(d.devis?['client']),
                  rendu: widget.rendu,
                  maintenant: widget.maintenant,
                )));
        if (signe == true) _recharger();
      case 'reserves':
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ProReservesScreen(
                projectId: widget.projectId,
                titreChantier: widget.titreChantier)));
        _recharger();
      case 'solde':
        await context.push('/chantier/facturation/create', extra: {
          'quoteId': _s(d.devis?['id']),
          'type': typeFactureSolde,
          'amountMode': 'fixed',
          'fixedAmount': solde.soldeTtc,
          'notes': noteSolde(solde, _s((d.cloture?['pv'] as Map?)?['signeLe'])),
        });
        _recharger();
      case 'dossier':
        await Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ProDossierScreen(
                projectId: widget.projectId,
                titreChantier: widget.titreChantier)));
        _recharger();
      case 'avis':
        setState(() => _envoi = true);
        try {
          await ref
              .read(proKojiWebProvider)
              .majCloture(widget.projectId, 'avis', {'programme': true});
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                content: Text(
                    "Demande d'avis programmée avec la facture de solde.")));
          }
          _recharger();
        } catch (err) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(err is ProKojiWebException
                    ? err.message
                    : "La demande d'avis n'a pas pu être programmée.")));
          }
        } finally {
          if (mounted) setState(() => _envoi = false);
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncD = ref.watch(proClotureProvider(widget.projectId));
    final d = asyncD.valueOrNull;
    final solde = d == null
        ? null
        : montantsSolde(
            devis: d.devis,
            avenants: d.avenants,
            factures: d.factures,
            taux: ((d.cloture?['retenue'] as Map?)?['taux'] as num?)?.toInt() ?? 0);
    final etapes = d == null
        ? const <EtapeCloture>[]
        : etapesCloture(
            cloture: d.cloture,
            reserves: d.reserves,
            solde: solde!,
            factureSolde: factureDeSolde(d.factures));
    final enCours = etapes.where((e) => e.etat == 'cur').firstOrNull;
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Entete(
              titre: widget.titreChantier.isEmpty
                  ? 'Clôturer le chantier'
                  : widget.titreChantier,
              sousTitre: 'Clôture · Koji prépare chaque étape'),
          Expanded(
            child: d == null
                ? Center(
                    child: asyncD.hasError
                        ? Text('Clôture indisponible pour le moment.',
                            style: da.text(14))
                        : const CircularProgressIndicator(strokeWidth: 2))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                    children: [
                      for (final (i, e) in etapes.indexed)
                        _etape(da, i + 1, e, premiere: i == 0),
                    ],
                  ),
          ),
          if (enCours != null && enCours.action.isNotEmpty && d != null)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: ProPrimaryButton(
                  label: enCours.action,
                  expand: true,
                  onPressed: _envoi ? null : () => _faire(enCours, d, solde!),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _etape(ProDa da, int n, EtapeCloture e, {bool premiere = false}) {
    final ok = e.etat == 'ok';
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
          border: premiere
              ? null
              : const Border(top: BorderSide(color: Color(0xFFE6E6E1)))),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: ok ? const Color(0xFF171B1E) : const Color(0xFFF1F1EC),
              border: e.etat == 'cur'
                  ? Border.all(color: const Color(0xFF171B1E), width: 1.5)
                  : null,
            ),
            child: ok
                ? const Icon(Icons.check, size: 15, color: Colors.white)
                : Text('$n', style: da.text(13, weight: FontWeight.w700)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(e.titre,
                    style: da.text(14,
                        weight: ok ? FontWeight.w500 : FontWeight.w700)),
                Text(e.court, style: da.text(12, color: const Color(0xFF5B5F66))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Entete extends StatelessWidget {
  const _Entete({required this.titre, required this.sousTitre});
  final String titre;
  final String sousTitre;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
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
                Text(titre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: da.text(15,
                        weight: FontWeight.w700,
                        color: const Color(0xFFF5F5F2))),
                Text(sousTitre,
                    style: da.text(12, color: const Color(0xFFA7ABB2))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Procès-verbal de réception signé sur le téléphone (maquette PRO-02.2,
/// « Réception · PV signé sur le téléphone ») : réserves inscrites, travaux
/// réceptionnés, signature du client puis la vôtre.
class ProPvScreen extends ConsumerStatefulWidget {
  const ProPvScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    required this.reserves,
    required this.travaux,
    this.signataire = '',
    this.rendu = signaturePng,
    this.maintenant = DateTime.now,
  });

  final String projectId;
  final String titreChantier;
  final List<Reserve> reserves;
  final String travaux;
  final String signataire;
  final RenduSignature rendu;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProPvScreen> createState() => _ProPvScreenState();
}

class _ProPvScreenState extends ConsumerState<ProPvScreen> {
  late final _nom = TextEditingController(text: widget.signataire);
  final _client = SignatureController();
  final _pro = SignatureController();
  bool _envoi = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_client, _pro]) {
      c.addListener(() => setState(() {}));
    }
    _nom.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _nom.dispose();
    _client.dispose();
    _pro.dispose();
    super.dispose();
  }

  Future<void> _valider() async {
    setState(() => _envoi = true);
    try {
      await ref.read(proKojiWebProvider).signerPv(
            projectId: widget.projectId,
            signataire: _nom.text.trim(),
            signatureClient: await widget.rendu(_client.traits, _client.taille),
            signaturePro: await widget.rendu(_pro.traits, _pro.taille),
          );
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is ProKojiWebException
                ? e.message
                : "Le procès-verbal n'a pas pu être enregistré.")));
        setState(() => _envoi = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final n = widget.reserves.length;
    final jour = DateFormat('d MMM', 'fr_FR').format(widget.maintenant());
    final pret = !_client.vide && !_pro.vide && _nom.text.trim().isNotEmpty;
    Widget carte(String titre, List<String> lignes) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(
              left: BorderSide(color: Color(0xFF171B1E), width: 3),
              top: BorderSide(color: Color(0xFFCFCFC9)),
              right: BorderSide(color: Color(0xFFCFCFC9)),
              bottom: BorderSide(color: Color(0xFFCFCFC9)),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titre, style: da.text(14, weight: FontWeight.w700)),
              for (final l in lignes)
                Text(l, style: da.text(12, color: da.grey)),
            ],
          ),
        );
    return Scaffold(
      backgroundColor: da.page,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Entete(
              titre: 'Procès-verbal de réception',
              sousTitre: [widget.titreChantier, jour]
                  .where((s) => s.isNotEmpty)
                  .join(' · ')),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              children: [
                carte(
                    n == 0
                        ? 'Réception sans réserve'
                        : 'Réception avec $n réserve${n > 1 ? 's' : ''}',
                    [
                      for (final r in widget.reserves)
                        [
                          r.numero,
                          r.titre,
                          r.pourLe.isEmpty
                              ? 'à lever'
                              : 'à lever avant le ${dateCourte(r.pourLe)}'
                        ].join(' · '),
                    ]),
                carte('Travaux réceptionnés', [widget.travaux]),
                Text('SIGNE POUR LE CLIENT',
                    style: da.text(11,
                        weight: FontWeight.w600,
                        color: const Color(0xFF5B5F66))),
                const SizedBox(height: 6),
                TextField(
                  controller: _nom,
                  style: da.text(15),
                  decoration: InputDecoration(
                    hintText: 'Nom et prénom',
                    isDense: true,
                    filled: true,
                    fillColor: Colors.white,
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(4),
                        borderSide: const BorderSide(color: Color(0xFFCFCFC9))),
                  ),
                ),
                const SizedBox(height: 12),
                SignatureZone(
                    label:
                        'Signature de ${_nom.text.trim().isEmpty ? 'votre client' : _nom.text.trim()}',
                    controller: _client),
                const SizedBox(height: 12),
                SignatureZone(label: 'Votre signature', controller: _pro),
                const SizedBox(height: 10),
                Text(
                    "La date et l'heure sont posées par Koji. Les garanties partent de ce jour.",
                    style: da.text(12, color: da.grey)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: ProPrimaryButton(
                label: _envoi ? 'Enregistrement…' : 'Valider la réception',
                expand: true,
                onPressed: pret && !_envoi ? _valider : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Traits d'une signature au doigt.
class SignatureController extends ChangeNotifier {
  final List<List<Offset>> traits = [];
  Size taille = const Size(300, 110);

  bool get vide => traits.isEmpty;

  void commencer(Offset p) {
    traits.add([p]);
    notifyListeners();
  }

  void continuer(Offset p) {
    if (traits.isEmpty) return;
    traits.last.add(p);
    notifyListeners();
  }

  void effacer() {
    traits.clear();
    notifyListeners();
  }
}

class SignatureZone extends StatelessWidget {
  const SignatureZone(
      {super.key, required this.label, required this.controller});
  final String label;
  final SignatureController controller;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFCFCFC9))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(label.toUpperCase(),
                    style: da.text(11,
                        weight: FontWeight.w600,
                        color: const Color(0xFF5B5F66))),
              ),
              if (!controller.vide)
                GestureDetector(
                  onTap: controller.effacer,
                  child: Text('Effacer',
                      style: da.text(12, weight: FontWeight.w600)),
                ),
            ],
          ),
          LayoutBuilder(builder: (context, c) {
            controller.taille = Size(c.maxWidth, 110);
            return GestureDetector(
              behavior: HitTestBehavior.opaque,
              onPanStart: (e) => controller.commencer(e.localPosition),
              onPanUpdate: (e) => controller.continuer(e.localPosition),
              child: SizedBox(
                height: 110,
                child: Stack(
                  children: [
                    if (controller.vide)
                      Center(
                          child: Text('Signez ici',
                              style: da.text(13,
                                  color: const Color(0xFFA3A39D)))),
                    Positioned.fill(
                      child: CustomPaint(
                          painter: _SignaturePainter(controller.traits)),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _SignaturePainter extends CustomPainter {
  _SignaturePainter(this.traits);
  final List<List<Offset>> traits;

  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = const Color(0xFF171B1E)
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    for (final t in traits) {
      if (t.isEmpty) continue;
      final path = Path()..moveTo(t.first.dx, t.first.dy);
      for (final o in t.skip(1)) {
        path.lineTo(o.dx, o.dy);
      }
      if (t.length == 1) path.lineTo(t.first.dx + 0.1, t.first.dy + 0.1);
      canvas.drawPath(path, p);
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter old) => true;
}
