import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/apps/entreprise/chantiers/avis.dart';
import 'package:koji/apps/entreprise/chantiers/cloture.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';

String _s(dynamic v) => v == null ? '' : '$v';
int _n(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

final proAvisProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>(
        (ref, projectId) => ref.watch(proKojiWebProvider).avis(projectId));

/// Koji Pro, avis du client (maquette PRO-02.6) : note, critères, texte ;
/// réponse proposée par Koji, à relire et publier ; note de la KojiPage.
class ProAvisScreen extends ConsumerStatefulWidget {
  const ProAvisScreen({
    super.key,
    required this.projectId,
    required this.titreChantier,
    this.client = '',
  });

  final String projectId;
  final String titreChantier;
  final String client;

  @override
  ConsumerState<ProAvisScreen> createState() => _ProAvisScreenState();
}

class _ProAvisScreenState extends ConsumerState<ProAvisScreen> {
  TextEditingController? _reponse;
  bool _envoi = false;

  @override
  void dispose() {
    _reponse?.dispose();
    super.dispose();
  }

  Future<void> _publier() async {
    setState(() => _envoi = true);
    try {
      await ref.read(proKojiWebProvider).actionAvis(
          widget.projectId, 'repondre', {'texte': _reponse!.text.trim()});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Réponse publiée sur votre KojiPage.')));
      }
      ref.invalidate(proAvisProvider(widget.projectId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(e is ProKojiWebException
                ? e.message
                : "La réponse n'a pas pu être publiée.")));
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Widget _etoiles(ProDa da, int note, double taille) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Icon(i <= note ? Icons.star : Icons.star_border,
                size: taille, color: da.ink),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncD = ref.watch(proAvisProvider(widget.projectId));
    final d = asyncD.valueOrNull;
    final avis = d?['avis'] is Map ? Map<String, dynamic>.from(d!['avis']) : null;
    final stats = d?['stats'] is Map ? d!['stats'] as Map : const {};
    if (avis != null && _reponse == null) {
      final publiee = _s((avis['reponse'] as Map?)?['texte']);
      _reponse = TextEditingController(
          text: publiee.isNotEmpty
              ? publiee
              : reponseProposee(client: widget.client, note: _n(avis['note'])));
    }
    final criteres = avis?['criteres'] is Map ? avis!['criteres'] as Map : const {};
    final repondu = _s((avis?['reponse'] as Map?)?['texte']).isNotEmpty;
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
                      Text('Avis du client',
                          style: da.text(15,
                              weight: FontWeight.w700,
                              color: const Color(0xFFF5F5F2))),
                      Text(widget.titreChantier,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
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
                        ? Text('Avis indisponible pour le moment.',
                            style: da.text(14))
                        : const CircularProgressIndicator(strokeWidth: 2))
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                    children: [
                      if (avis == null)
                        Text(
                            d['accesClient'] == true
                                ? "Le client n'a pas encore donné son avis."
                                : "Le client n'a pas encore d'accès Koji Client : créez-le depuis la fiche du site pour lui demander son avis.",
                            style: da.text(14, color: da.grey))
                      else ...[
                        Text(
                            widget.client.isEmpty
                                ? 'Avis du client'
                                : 'Avis de ${widget.client}',
                            style: da.text(17, weight: FontWeight.w700)),
                        Text(
                            [
                              'reçu le ${dateCourte(jourLocal(_s(avis['creeLe'])))}',
                              if (avis['verifie'] == true)
                                'avis vérifié : chantier terminé et facturé dans Koji',
                            ].join(' · '),
                            style: da.text(12, color: da.grey)),
                        const SizedBox(height: 10),
                        Row(children: [
                          _etoiles(da, _n(avis['note']), 24),
                          const SizedBox(width: 8),
                          Text('${avis['note']} sur 5',
                              style: da.text(16, weight: FontWeight.w700)),
                        ]),
                        if (_s(avis['texte']).isNotEmpty)
                          Container(
                            margin: const EdgeInsets.symmetric(vertical: 10),
                            padding: const EdgeInsets.only(left: 12),
                            decoration: BoxDecoration(
                                border: Border(
                                    left: BorderSide(color: da.ink, width: 3))),
                            child: Text('« ${avis['texte']} »',
                                style: da.text(15)),
                          ),
                        Wrap(
                          spacing: 14,
                          runSpacing: 6,
                          children: [
                            for (final (id, label) in criteresAvis)
                              if (criteres[id] != null)
                                Row(mainAxisSize: MainAxisSize.min, children: [
                                  Text('$label ',
                                      style: da.text(12, color: da.grey)),
                                  _etoiles(da, _n(criteres[id]), 13),
                                ]),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Text(
                            repondu
                                ? 'VOTRE RÉPONSE · PUBLIÉE'
                                : 'VOTRE RÉPONSE · PROPOSÉE PAR KOJI',
                            style: da.text(11,
                                weight: FontWeight.w700, color: da.grey)),
                        const SizedBox(height: 6),
                        TextField(
                          controller: _reponse,
                          maxLines: 5,
                          minLines: 3,
                          maxLength: 1500,
                          style: da.text(14),
                          decoration: InputDecoration(
                            counterText: '',
                            filled: true,
                            fillColor: Colors.white,
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(4),
                                borderSide:
                                    const BorderSide(color: Color(0xFFD9D9D4))),
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                            color: da.card,
                            border: Border(top: BorderSide(color: da.ink))),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Avis sur votre KojiPage',
                                style: da.text(15, weight: FontWeight.w700)),
                            const SizedBox(height: 6),
                            if (_n(stats['nombre']) > 0)
                              Row(children: [
                                Text(moyenneTexte(stats['moyenne'] as num),
                                    style: da.text(28, weight: FontWeight.w600)),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                      '${stats['nombre']} avis vérifié${_n(stats['nombre']) > 1 ? 's' : ''} · ${stats['recommandent']} % recommandent',
                                      style: da.text(12, color: da.grey)),
                                ),
                              ])
                            else
                              Text("Pas encore d'avis vérifié.",
                                  style: da.text(13, color: da.grey)),
                            const SizedBox(height: 6),
                            Text(
                                'Tous les avis sont publiés, positifs comme négatifs ; vous pouvez répondre, pas supprimer.',
                                style: da.text(12, color: da.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
          ),
          if (avis != null)
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: ProPrimaryButton(
                  label: repondu ? 'Mettre à jour ma réponse' : 'Publier ma réponse',
                  expand: true,
                  onPressed: _envoi ? null : _publier,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
