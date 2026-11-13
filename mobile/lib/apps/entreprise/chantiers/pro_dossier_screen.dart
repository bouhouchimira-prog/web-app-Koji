import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/chantiers/dossier_fin.dart';
import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart';
import 'package:koji/apps/entreprise/chantiers/reserves.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

String _s(dynamic v) => v == null ? '' : '$v';

typedef DonneesDossier = ({
  Map<String, dynamic>? cloture,
  Map<String, dynamic>? devis,
  List<String> avenants,
  List<Map<String, dynamic>> factures,
  List<Map<String, dynamic>> photos,
  List<Reserve> reserves,
  Map<String, dynamic> dossier,
  Map<String, dynamic>? decennale,
  String email,
});

final proDossierProvider = FutureProvider.autoDispose
    .family<DonneesDossier, String>((ref, projectId) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(
          Future<List<Map<String, dynamic>>> f) =>
      f.catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    lire(api.liste('/api/quotes', 'quotes')),
    lire(api.liste('/api/invoices', 'invoices')),
    lire(api.reserves(projectId)),
    lire(api.photosChantier(projectId)),
  ]);
  final devis = r[0].where((q) => _s(q['projectId']) == projectId).toList();
  final quoteId = devis.isEmpty ? '' : _s(devis.first['id']);
  final cloture = await api.cloture(projectId).catchError((_) => null);
  final dossier = await api
      .dossierFin(projectId)
      .catchError((_) => <String, dynamic>{});
  final avenants = quoteId.isEmpty
      ? <Map<String, dynamic>>[]
      : await lire(api.avenants(quoteId));
  return (
    cloture: cloture,
    devis: devis.isEmpty ? null : devis.first,
    avenants: avenants
        .where((a) => _s(a['status']) == 'Signe')
        .map((a) => _s(a['numero']))
        .toList(),
    factures: facturesDuChantier(r[1], projectId: projectId, quoteId: quoteId),
    photos: r[3],
    reserves: r[2].map(Reserve.new).toList(),
    dossier: dossier['dossier'] is Map
        ? Map<String, dynamic>.from(dossier['dossier'])
        : <String, dynamic>{},
    decennale: dossier['decennale'] is Map
        ? Map<String, dynamic>.from(dossier['decennale'])
        : null,
    email: devis.isEmpty ? '' : _s(devis.first['clientEmail']),
  );
});

/// Koji Pro, dossier de fin de chantier (maquette PRO-02.5, téléphone) :
/// les huit pièces, ce qui manque (« À faire »), envoi au client en PDF.
class ProDossierScreen extends ConsumerStatefulWidget {
  const ProDossierScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    this.prisePhoto = prendrePhotoAppareil,
    this.maintenant = DateTime.now,
  });

  final String projectId;
  final String titreChantier;
  final PrisePhoto prisePhoto;
  final DateTime Function() maintenant;

  @override
  ConsumerState<ProDossierScreen> createState() => _ProDossierScreenState();
}

class _ProDossierScreenState extends ConsumerState<ProDossierScreen> {
  bool _envoi = false;

  void _recharger() => ref.invalidate(proDossierProvider(widget.projectId));

  void _dire(String texte) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(texte)));

  Future<void> _ajouterPlan() async {
    final octets = await widget.prisePhoto();
    if (octets == null || !mounted) return;
    setState(() => _envoi = true);
    try {
      await ref.read(proKojiWebProvider).ajouterPieceDossier(
          projectId: widget.projectId,
          kind: 'plan',
          octets: octets,
          titre: 'Schéma des réseaux');
      if (mounted) _dire('Plan des réseaux ajouté au dossier.');
      _recharger();
    } catch (e) {
      if (mounted) {
        _dire(e is ProKojiWebException ? e.message : "La photo n'a pas pu être ajoutée.");
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _envoyer(String email) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Envoyer le dossier ?'),
        content: Text(
            'Le dossier de fin de chantier part à $email, avec la facture de solde et les notices. Le client le retrouve aussi dans Koji Client.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(c).pop(false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.of(c).pop(true),
              child: const Text('Envoyer')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _envoi = true);
    try {
      await ref.read(proKojiWebProvider).envoyerDossier(widget.projectId);
      if (mounted) _dire('Dossier envoyé à $email.');
      _recharger();
    } catch (e) {
      if (mounted) {
        _dire(e is ProKojiWebException ? e.message : "Le dossier n'a pas pu partir.");
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncD = ref.watch(proDossierProvider(widget.projectId));
    final d = asyncD.valueOrNull;
    final elements = d == null
        ? const <ElementDossier>[]
        : elementsDossierTelephone(
            cloture: d.cloture,
            devis: d.devis,
            avenants: d.avenants,
            factures: d.factures,
            factureSolde: factureDeSolde(d.factures),
            photos: d.photos,
            pieces: ((d.dossier['pieces'] as List?) ?? const [])
                .map((p) => Map<String, dynamic>.from(p as Map))
                .toList(),
            decennale: d.decennale,
            reserves: d.reserves,
            aujourdhui: DateFormat('yyyy-MM-dd').format(widget.maintenant()),
          );
    final prets = elements.where((e) => e.ok).length;
    final remisLe = _s(d?.dossier['remisLe']);
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
                      Text(
                          widget.titreChantier.isEmpty
                              ? 'Dossier de fin de chantier'
                              : widget.titreChantier,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: da.text(15,
                              weight: FontWeight.w700,
                              color: const Color(0xFFF5F5F2))),
                      Text(
                          d == null
                              ? 'Dossier de fin de chantier'
                              : 'Dossier de fin de chantier · $prets sur ${elements.length}',
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
                    child: asyncD.hasError
                        ? Text('Dossier indisponible pour le moment.',
                            style: da.text(14))
                        : const CircularProgressIndicator(strokeWidth: 2))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    children: [
                      for (final e in elements) _ligne(da, e),
                      if (remisLe.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                              'Envoyé le ${dateCourte(jourLocal(remisLe))} à ${_s(d.dossier['envoyeA'])}',
                              style: da.text(12, color: da.grey)),
                        ),
                      if (d.email.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                              "Pas d'e-mail client sur ce chantier : ajoutez-le au devis pour envoyer le dossier.",
                              style: da.text(12, color: const Color(0xFFB42318))),
                        ),
                    ],
                  ),
          ),
          if (d != null)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: ProPrimaryButton(
                  label: remisLe.isEmpty
                      ? 'Envoyer au client (PDF)'
                      : 'Renvoyer au client (PDF)',
                  expand: true,
                  onPressed: _envoi || d.email.isEmpty
                      ? null
                      : () => _envoyer(d.email),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _ligne(ProDa da, ElementDossier e) {
    final plan = e.id == 'plan' && !e.ok;
    return InkWell(
      onTap: plan && !_envoi ? _ajouterPlan : null,
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
                  Text(e.titre, style: da.text(14, weight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(e.detail, style: da.text(12, color: da.grey)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (e.ok)
              Icon(Icons.check, size: 18, color: da.ink)
            else
              const ProTag('À faire', tone: ProTagTone.ink),
          ],
        ),
      ),
    );
  }
}
