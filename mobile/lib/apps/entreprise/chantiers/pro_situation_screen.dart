import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart' show ProKojiWebException;

// Situation de travaux (maquette PRO-06, téléphone) : avancement cumulé par
// lot, prérempli depuis le suivi des lots ; déjà facturé et retenue de
// garantie déduits. Port de lib/situation-travaux.js (mêmes exemples dans
// test/pro_situation_test.dart) ; le site recalcule tout à l'enregistrement.

double _r2(num n) => (n * 100).roundToDouble() / 100;

class LotSituation {
  const LotSituation(this.nom, this.ht, this.pct);
  final String nom;
  final double ht;
  final int pct;
  double get montant => _r2(ht * pct / 100);
}

class Situation {
  const Situation({required this.lots, required this.cumuleHt, required this.dejaFactureHt, required this.retenueHt, required this.ht, required this.tva, required this.ttc});
  final List<LotSituation> lots;
  final double cumuleHt;
  final double dejaFactureHt;
  final double retenueHt;
  final double ht;
  final double tva;
  final double ttc;
}

Situation calculerSituation(List<LotSituation> lots, {double dejaFactureHt = 0, double tauxRetenue = 0, double tauxTva = 20}) {
  final cumule = _r2(lots.fold<double>(0, (s, l) => s + l.montant));
  final base = _r2((cumule - dejaFactureHt).clamp(0, double.infinity));
  final retenue = _r2(base * tauxRetenue / 100);
  final ht = _r2(base - retenue);
  final tva = _r2(ht * tauxTva / 100);
  return Situation(lots: lots, cumuleHt: cumule, dejaFactureHt: _r2(dejaFactureHt), retenueHt: retenue, ht: ht, tva: tva, ttc: _r2(ht + tva));
}

/// Avancement arrondi à 5 %.
int arrondi5(num pct) => ((pct.clamp(0, 100) / 5).round() * 5).toInt();

class SituationChoix {
  const SituationChoix({required this.lots, required this.tauxRetenue, required this.echeance, required this.message, required this.email});
  final Map<String, int> lots;
  final double tauxRetenue;
  final String echeance;
  final String message;
  final bool email;
}

class ProSituationScreen extends StatefulWidget {
  const ProSituationScreen({
    super.key,
    required this.chantier,
    required this.client,
    required this.numeroDevis,
    required this.totalDevisHt,
    required this.lots,
    required this.dejaFactureHt,
    required this.tauxTva,
    required this.onValider,
    this.numero = 1,
    this.dejaFactureLibelle = '',
    this.email = '',
    this.maintenant = DateTime.now,
  });

  final String chantier;
  final String client;
  final String numeroDevis;
  final double totalDevisHt;
  final List<LotSituation> lots;
  final double dejaFactureHt;
  final double tauxTva;
  final int numero;
  final String dejaFactureLibelle;
  final String email;

  /// Renvoie la facture (numéro, montant) ou lève une erreur.
  final Future<Map<String, dynamic>> Function(SituationChoix choix, {required bool envoyer}) onValider;
  final DateTime Function() maintenant;

  @override
  State<ProSituationScreen> createState() => _ProSituationScreenState();
}

class _ProSituationScreenState extends State<ProSituationScreen> {
  late final Map<String, int> _pcts = {for (final l in widget.lots) l.nom: l.pct};
  bool _retenue = false;
  int _delai = 30;
  late final _message = TextEditingController(text: _messageInitial());
  late bool _email = widget.email.isNotEmpty;
  String _envoi = '';
  String _erreur = '';
  Map<String, dynamic>? _fait;

  String _messageInitial() {
    final finis = widget.lots.where((l) => l.pct >= 100).map((l) => l.nom.toLowerCase()).toList();
    final enCours = widget.lots.where((l) => l.pct > 0 && l.pct < 100).map((l) => '${l.nom.toLowerCase()} à ${l.pct} %').toList();
    final point = [if (finis.isNotEmpty) '${finis.join(' et ')} ${finis.length > 1 ? 'terminés' : 'terminé'}', ...enCours].join(', ');
    return 'Bonjour${widget.client.isNotEmpty ? ' ${widget.client}' : ''}, voici la situation n° ${widget.numero}${point.isNotEmpty ? ' : $point' : ''}. Les photos sont dans votre espace Koji.';
  }

  Situation get _sit => calculerSituation([for (final l in widget.lots) LotSituation(l.nom, l.ht, _pcts[l.nom] ?? 0)],
      dejaFactureHt: widget.dejaFactureHt, tauxRetenue: _retenue ? 5 : 0, tauxTva: widget.tauxTva);

  String get _echeance => DateFormat('yyyy-MM-dd').format(widget.maintenant().add(Duration(days: _delai)));

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _valider(bool envoyer) async {
    setState(() {
      _envoi = envoyer ? 'envoi' : 'brouillon';
      _erreur = '';
    });
    try {
      final f = await widget.onValider(
          SituationChoix(lots: Map.of(_pcts), tauxRetenue: _retenue ? 5 : 0, echeance: _echeance, message: _message.text.trim(), email: _email),
          envoyer: envoyer);
      setState(() {
        _envoi = '';
        _fait = f;
      });
    } on ProKojiWebException catch (e) {
      setState(() {
        _envoi = '';
        _erreur = e.message;
      });
    } catch (_) {
      setState(() {
        _envoi = '';
        _erreur = "La situation n'a pas pu être enregistrée.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final sit = _sit;
    Widget ligne(String k, String v, {bool fort = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Row(children: [
            Expanded(child: Text(k, style: da.text(13, color: da.grey))),
            Text(v, style: da.text(fort ? 17 : 13.5, weight: fort ? FontWeight.w700 : FontWeight.w600)),
          ]),
        );
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
              child: Row(children: [
                IconButton(onPressed: () => Navigator.of(context).maybePop(_fait != null), tooltip: 'Retour', icon: Icon(Icons.chevron_left, color: da.ink, size: 26)),
                Expanded(
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Situation n° ${widget.numero}', style: da.text(15, weight: FontWeight.w700)),
                    Text([widget.chantier, widget.client].where((x) => x.isNotEmpty).join(' · '), maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                  ]),
                ),
              ]),
            ),
          ),
        ),
      ),
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), children: [
            if (_fait != null)
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(color: da.card, border: Border(left: BorderSide(color: da.ink, width: 3))),
                child: Text('Situation n° ${widget.numero} ${_fait!['status'] == 'Emise' ? 'envoyée' : 'enregistrée en brouillon'} · ${_fait!['invoiceNumber'] ?? ''} · ${euros((_fait!['amountTtc'] as num?) ?? sit.ttc)} TTC',
                    style: da.text(14, weight: FontWeight.w600)),
              )
            else ...[
              Text('AVANCEMENT CUMULÉ PAR LOT', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
              Text('Koji pré-remplit depuis le suivi des lots', style: da.text(12, color: da.grey)),
              for (final (i, l) in sit.lots.indexed)
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Lot ${(i + 1).toString().padLeft(2, '0')} · ${l.nom}', style: da.text(14, weight: FontWeight.w600)),
                        Text('${euros(l.ht)} au devis', style: da.text(12, color: da.grey)),
                      ]),
                    ),
                    IconButton(onPressed: () => setState(() => _pcts[l.nom] = arrondi5((_pcts[l.nom] ?? 0) - 5)), icon: const Icon(Icons.remove, size: 16), tooltip: 'Moins 5 %'),
                    SizedBox(width: 44, child: Text('${l.pct} %', textAlign: TextAlign.center, style: da.text(14, weight: FontWeight.w700))),
                    IconButton(onPressed: () => setState(() => _pcts[l.nom] = arrondi5((_pcts[l.nom] ?? 0) + 5)), icon: const Icon(Icons.add, size: 16), tooltip: 'Plus 5 %'),
                    SizedBox(width: 86, child: Text(euros(l.montant), textAlign: TextAlign.right, style: da.text(13.5, weight: FontWeight.w600))),
                  ]),
                ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
                decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
                child: Column(children: [
                  ligne('Travaux réalisés cumulés HT', euros(sit.cumuleHt)),
                  ligne('Déjà facturé${widget.dejaFactureLibelle.isNotEmpty ? ' · ${widget.dejaFactureLibelle}' : ''}', '− ${euros(sit.dejaFactureHt)}'),
                  Row(children: [
                    Checkbox(value: _retenue, activeColor: da.fill, onChanged: (v) => setState(() => _retenue = v ?? false)),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _retenue = !_retenue),
                        child: Text('Retenue de garantie 5 %', style: da.text(13, color: da.grey)),
                      ),
                    ),
                    Text(_retenue ? '− ${euros(sit.retenueHt)}' : '—', style: da.text(13.5, weight: FontWeight.w600)),
                  ]),
                  Container(
                    decoration: BoxDecoration(border: Border(top: BorderSide(color: da.ink))),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      ligne('Montant de la situation', '${euros(sit.ttc)} TTC', fort: true),
                      Text('${euros(sit.ht)} HT · TVA ${'${widget.tauxTva}'.replaceAll('.0', '').replaceAll('.', ',')} % ${euros(sit.tva)}', style: da.text(11.5, color: da.grey)),
                      const SizedBox(height: 8),
                    ]),
                  ),
                ]),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Text('Échéance', style: da.text(13.5, weight: FontWeight.w600)),
                const Spacer(),
                DropdownButton<int>(
                  value: _delai,
                  items: [for (final (j, l) in const [(0, 'À réception'), (15, '15 jours'), (30, '30 jours'), (45, '45 jours')]) DropdownMenuItem(value: j, child: Text(l, style: da.text(14)))],
                  onChanged: (v) => setState(() => _delai = v ?? 30),
                ),
              ]),
              const SizedBox(height: 8),
              Text('MESSAGE AU CLIENT', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
              const SizedBox(height: 6),
              TextField(
                controller: _message,
                maxLines: 4,
                minLines: 2,
                style: da.text(13.5, height: 1.45),
                decoration: InputDecoration(filled: true, fillColor: da.card, border: OutlineInputBorder(borderRadius: BorderRadius.circular(2), borderSide: BorderSide(color: da.line))),
              ),
              CheckboxListTile(
                value: _email,
                onChanged: widget.email.isEmpty ? null : (v) => setState(() => _email = v ?? false),
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                activeColor: da.fill,
                title: Text('E-mail avec le PDF', style: da.text(13.5)),
              ),
              if (sit.ht <= 0) Text("L'avancement ne dépasse pas encore ce qui est déjà facturé.", style: da.text(12.5, color: da.grey)),
              if (_erreur.isNotEmpty) Text(_erreur, style: da.text(13, color: const Color(0xFFC4452D))),
            ],
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: _fait != null
                ? ProPrimaryButton(label: 'Terminé', expand: true, onPressed: () => Navigator.of(context).maybePop(true))
                : Row(children: [
                    TextButton(
                      onPressed: _envoi.isNotEmpty || sit.ht <= 0 ? null : () => _valider(false),
                      style: TextButton.styleFrom(foregroundColor: da.ink),
                      child: Text(_envoi == 'brouillon' ? 'Enregistrement…' : 'Brouillon', style: da.text(14, weight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: ProPrimaryButton(label: _envoi == 'envoi' ? 'Envoi…' : 'Envoyer la situation', expand: true, onPressed: _envoi.isNotEmpty || sit.ht <= 0 ? null : () => _valider(true))),
                  ]),
          ),
        ),
      ]),
    );
  }
}
