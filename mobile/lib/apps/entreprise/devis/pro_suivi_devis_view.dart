import 'package:flutter/material.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/devis/devis_liste.dart' show statutDevis;
import 'package:koji/apps/entreprise/devis/devis_suivi.dart';
import 'package:koji/apps/entreprise/devis/devis_versions.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';

/// Un lot du devis, en lecture seule.
class SuiviLot {
  const SuiviLot(this.code, this.nom, this.total, this.lignes);
  final String code;
  final String nom;
  final double total;
  final List<(String, double, bool)> lignes; // désignation, total HT, variante
}

/// Après l'envoi (maquette PRO-03.3, téléphone) : le montant, le suivi
/// Envoyé → Vu → Signé → Chantier lancé, puis Relancer / Modifier ; une fois
/// signé, l'acompte et « Lancer le chantier » (le seul jaune). Le devis
/// suit, en lecture seule.
class ProSuiviDevisView extends StatelessWidget {
  const ProSuiviDevisView({
    super.key,
    required this.titre,
    required this.sousTitre,
    required this.devis,
    required this.lots,
    required this.totalHt,
    required this.totalTtc,
    required this.aujourdhui,
    required this.onRetour,
    required this.onRelancer,
    required this.onModifier,
    required this.onPdf,
    this.chantierLance = false,
    this.onLancer,
    this.onVoirChantier,
    this.onCreerAcompte,
    this.factureAcompte,
  });

  final String titre;
  final String sousTitre;

  /// Le devis au format du site (sentAt, viewedAt, signedAt, versions…).
  final Map<String, dynamic> devis;
  final List<SuiviLot> lots;
  final double totalHt;
  final double totalTtc;
  final String aujourdhui;
  final bool chantierLance;
  final VoidCallback onRetour;
  final VoidCallback onRelancer;
  final VoidCallback onModifier;
  final VoidCallback onPdf;
  final VoidCallback? onLancer;
  final VoidCallback? onVoirChantier;
  final VoidCallback? onCreerAcompte;

  /// Facture d'acompte déjà faite sur ce devis (brouillon, émise, payée).
  final Map<String, dynamic>? factureAcompte;

  bool get _signe => devis['status'] == 'Signe' || devis['signatureStatus'] == 'Signe';

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final statut = statutDevis(devis, aujourdhui);
    final version = int.tryParse('${((devis['versions'] as List?)?.lastOrNull as Map?)?['number'] ?? devis['versionNumber'] ?? 1}') ?? 1;
    final jalons = (devis['paymentMilestones'] as List?) ?? const [];
    final acompte = jalons.isNotEmpty ? ((jalons.first as Map)['percent'] as num?) ?? 0 : 0;
    return Scaffold(
      backgroundColor: da.page,
      appBar: PreferredSize(
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
                  IconButton(onPressed: onRetour, tooltip: 'Retour', icon: Icon(Icons.chevron_left, color: da.ink, size: 26)),
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
                  if (_signe) _Sceau(da: da) else ProTag(statut.label, tone: statut.id == 'envoye' ? ProTagTone.ink : ProTagTone.grey),
                  const SizedBox(width: 14),
                ],
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          Text('${euros(totalHt)} HT', style: da.text(24, weight: FontWeight.w600)),
          Text('${euros(totalTtc)} TTC · version $version', style: da.text(13, color: da.grey)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
            child: Column(
              children: [
                for (final (i, e) in etapesSuivi(devis, aujourdhui: aujourdhui, chantierLance: chantierLance).indexed)
                  _Etape(etape: e, derniere: i == 3),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Text(noteSuivi(devis, aujourdhui: aujourdhui), style: da.text(13, color: da.grey, height: 1.5)),
          const SizedBox(height: 12),
          if (!_signe)
            Row(
              children: [
                if (statut.id != 'expire') ...[
                  Expanded(
                    child: statut.id == 'relancer'
                        ? ProPrimaryButton(label: 'Relancer', height: 44, expand: true, onPressed: onRelancer)
                        : _Secondaire(libelle: 'Relancer', onTap: onRelancer),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(child: _Secondaire(libelle: 'Modifier', onTap: onModifier)),
              ],
            )
          else ...[
            if (acompte > 0)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text('Acompte prévu', style: da.text(13, color: da.grey))),
                        Text('$acompte % · ${euros(((devis['totalTtc'] as num?) ?? totalTtc) * acompte / 100)} TTC',
                            style: da.text(13, weight: FontWeight.w600)),
                      ],
                    ),
                    if (factureAcompte != null && factureAcompte!['status'] != 'Brouillon') ...[
                      const SizedBox(height: 8),
                      Text(
                        'Facture ${factureAcompte!['invoiceNumber'] ?? ''} · ${factureAcompte!['status'] == 'Payee' ? 'payée' : 'envoyée'}',
                        style: da.text(13, color: da.grey),
                      ),
                    ] else if (onCreerAcompte != null) ...[
                      if (factureAcompte != null) ...[
                        const SizedBox(height: 8),
                        Text('Facture ${factureAcompte!['invoiceNumber'] ?? ''} en brouillon, pas encore envoyée.', style: da.text(13, color: da.grey)),
                      ],
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 40,
                        child: _Secondaire(
                          libelle: factureAcompte != null ? "Envoyer la facture d'acompte" : "Créer la facture d'acompte",
                          onTap: onCreerAcompte!,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 12),
            if (!chantierLance && onLancer != null)
              ProPrimaryButton(label: 'Lancer le chantier', icon: Icons.add, height: 48, expand: true, onPressed: onLancer)
            else if (chantierLance && onVoirChantier != null)
              SizedBox(height: 44, child: _Secondaire(libelle: 'Voir le chantier', onTap: onVoirChantier!)),
          ],
          ..._ceQuiChange(da),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(child: Text('Devis', style: da.text(17, weight: FontWeight.w700))),
              ProPill(label: 'PDF', onTap: onPdf),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final lot in lots.where((l) => l.lignes.isNotEmpty)) ...[
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                    decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.ink))),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(lot.code.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
                        const SizedBox(width: 10),
                        Expanded(child: Text(lot.nom, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(15, weight: FontWeight.w700))),
                        Text(euros(lot.total), style: da.text(14, weight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  for (final (label, total, variante) in lot.lignes)
                    Container(
                      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(variante ? '$label · variante' : label, style: da.text(13, height: 1.35, color: variante ? da.grey : da.ink)),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 84,
                            child: Text(euros(total), textAlign: TextAlign.right, style: da.text(13, weight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

extension on ProSuiviDevisView {
  // Versions (maquette PRO-03.6) : ce qui a changé depuis la version
  // précédente, lignes concernées seulement.
  List<Widget> _ceQuiChange(ProDa da) {
    final versions = ((devis['versions'] as List?) ?? const []).whereType<Map>().toList();
    if (versions.length < 2) return const [];
    final avant = versions[versions.length - 2];
    final apres = versions.last;
    final e = ecartsVersions(avant, apres, tauxTva: (devis['vatRate'] as num?) ?? 0);
    return [
      const SizedBox(height: 16),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Ce qui a changé · version ${int.tryParse('${apres['number']}') ?? versions.length}', style: da.text(15, weight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(resumeEcarts(e), style: da.text(12, color: da.grey)),
            for (final l in e.lignes)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(border: Border.all(color: l.kind == 'del' ? da.grey : da.ink), borderRadius: BorderRadius.circular(4)),
                      child: Text(libelleEcart(l.kind), style: da.text(11, weight: FontWeight.w700, color: l.kind == 'del' ? da.grey : da.ink)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(l.labelAvant.isNotEmpty ? '${l.label} au lieu de ${l.labelAvant}' : l.label,
                          style: da.text(13, height: 1.35, color: l.kind == 'del' ? da.grey : da.ink)),
                    ),
                    const SizedBox(width: 8),
                    Text(signe(l.ecart), style: da.text(13, weight: FontWeight.w600)),
                  ],
                ),
              ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: Text('Total TTC', style: da.text(13, color: da.grey))),
                Text('${euros(e.totalTtc.$1)} → ${euros(e.totalTtc.$2)}', style: da.text(13, weight: FontWeight.w600)),
              ],
            ),
          ],
        ),
      ),
    ];
  }
}

class _Etape extends StatelessWidget {
  const _Etape({required this.etape, required this.derniere});
  final EtapeSuivi etape;
  final bool derniere;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final fait = etape.etat == 'done';
    final aVenir = etape.etat == 'todo';
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    color: fait ? da.ink : da.card,
                    shape: BoxShape.circle,
                    border: Border.all(color: aVenir ? const Color(0xFFC9C4B9) : da.ink, width: etape.etat == 'now' ? 2 : 1.5),
                  ),
                  child: fait ? Icon(Icons.check, size: 12, color: da.card) : null,
                ),
                if (!derniere) Expanded(child: Container(width: 1, color: da.line)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: derniere ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(etape.label,
                      style: da.text(14, weight: aVenir ? FontWeight.w500 : FontWeight.w600, color: aVenir ? const Color(0xFF8A8F98) : da.ink)),
                  if (etape.detail.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(etape.detail, style: da.text(12, color: da.grey)),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Sceau extends StatelessWidget {
  const _Sceau({required this.da});
  final ProDa da;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Transform.rotate(
            angle: -0.14,
            child: Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: da.ink, width: 2.5)),
              child: Icon(Icons.check, size: 13, color: da.ink),
            ),
          ),
          const SizedBox(width: 8),
          Text('Signé', style: da.text(13, weight: FontWeight.w700)),
        ],
      );
}

class _Secondaire extends StatelessWidget {
  const _Secondaire({required this.libelle, required this.onTap});
  final String libelle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Material(
      color: da.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: const BorderSide(color: Color(0xFF8A8F98))),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 44,
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Text(libelle, style: da.text(14, weight: FontWeight.w600)),
        ),
      ),
    );
  }
}
