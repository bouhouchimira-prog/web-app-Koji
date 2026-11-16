import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/devis/facture_acompte.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';

/// Choix faits dans l'écran de la facture d'acompte.
class AcompteChoix {
  const AcompteChoix({required this.pourcentage, required this.echeance, required this.message, required this.email, required this.adresse});
  final num pourcentage;
  final String echeance; // AAAA-MM-JJ
  final String message;
  final bool email;
  final String adresse;
}

/// Facture d'acompte (maquette PRO-03.4, téléphone) : plein écran depuis le
/// devis signé. Seul le pourcentage se choisit ; la facture reprend le
/// devis. « Enregistrer en brouillon » ou « Envoyer la facture d'acompte »
/// (le seul jaune).
class ProFactureAcompteScreen extends StatefulWidget {
  const ProFactureAcompteScreen({
    super.key,
    required this.numeroDevis,
    required this.client,
    this.email = '',
    required this.totalHt,
    required this.totalTtc,
    required this.tva,
    this.signeLe = '',
    this.debut,
    this.pourcentagePrevu = 30,
    this.restant,
    this.brouillon,
    required this.onValider,
    this.maintenant = DateTime.now,
  });

  final String numeroDevis;
  final String client;
  final String email;
  final double totalHt;
  final double totalTtc;
  final num tva;
  final String signeLe;
  final DateTime? debut;
  final num pourcentagePrevu;
  final double? restant;

  /// Facture d'acompte déjà en brouillon : elle s'envoie telle quelle.
  final Map<String, dynamic>? brouillon;

  /// envoyer = false : brouillon. Renvoie une erreur à afficher, ou null.
  final Future<String?> Function(AcompteChoix choix, {required bool envoyer}) onValider;
  final DateTime Function() maintenant;

  @override
  State<ProFactureAcompteScreen> createState() => _ProFactureAcompteScreenState();
}

class _ProFactureAcompteScreenState extends State<ProFactureAcompteScreen> {
  late num _pct = (widget.brouillon?['percent'] as num?) ?? widget.pourcentagePrevu;
  late bool _autre = !pourcentagesAcompte.contains(_pct);
  late final _autreCtrl = TextEditingController(text: _pct.toString());
  String _echeance = 'reception';
  late final _message = TextEditingController(
      text: messageAcompte(client: widget.client, pourcentage: _pct, debut: widget.debut));
  late final _adresse = TextEditingController(text: widget.email);
  bool _email = true;
  String _envoi = '';
  String _erreur = '';

  bool get _verrou => widget.brouillon != null || _envoi.isNotEmpty;
  double get _montant =>
      widget.brouillon != null ? ((widget.brouillon!['amountTtc'] as num?) ?? 0).toDouble() : montantAcompte(widget.totalTtc, _pct);

  @override
  void dispose() {
    _autreCtrl.dispose();
    _message.dispose();
    _adresse.dispose();
    super.dispose();
  }

  void _choisir(num p) {
    setState(() {
      _autre = false;
      _pct = p;
      _message.text = _message.text.replaceFirst(RegExp(r'de [\d,]+ % prévue'), 'de ${p.toString().replaceAll('.', ',')} % prévue');
    });
  }

  Future<void> _valider(bool envoyer) async {
    final manque = erreurAcompte(
      pourcentage: _pct,
      montant: _montant,
      restant: widget.brouillon == null ? widget.restant : null,
      envoyer: envoyer,
      email: _email,
      adresse: _adresse.text,
    );
    if (manque.isNotEmpty) {
      setState(() => _erreur = manque);
      return;
    }
    setState(() {
      _envoi = envoyer ? 'envoi' : 'brouillon';
      _erreur = '';
    });
    final jours = echeancesAcompte.firstWhere((e) => e.$1 == _echeance).$3;
    final erreur = await widget.onValider(
      AcompteChoix(
        pourcentage: _pct,
        echeance: dateEcheance(DateFormat('yyyy-MM-dd').format(widget.maintenant()), jours),
        message: _message.text.trim(),
        email: _email,
        adresse: _adresse.text.trim(),
      ),
      envoyer: envoyer,
    );
    if (!mounted) return;
    if (erreur == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _envoi = '';
      _erreur = erreur;
    });
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    Widget lab(String t) => Text(t.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6));
    final decoration = InputDecoration(
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
      filled: true,
      fillColor: da.card,
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFF8A8F98))),
      disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.ink, width: 1.5)),
    );
    final tauxTexte = widget.tva.toString().replaceAll('.', ',');
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
                  IconButton(
                    onPressed: _envoi.isNotEmpty ? null : () => Navigator.of(context).maybePop(),
                    tooltip: 'Retour',
                    icon: Icon(Icons.chevron_left, color: da.ink, size: 26),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("Facture d'acompte", style: da.text(15, weight: FontWeight.w700)),
                        Text(['Devis ${widget.numeroDevis}', widget.client].where((x) => x.trim().isNotEmpty).join(' · '),
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
            decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                lab('Devis signé'),
                const SizedBox(height: 2),
                Text([widget.numeroDevis, widget.client].where((x) => x.trim().isNotEmpty).join(' · '), style: da.text(16, weight: FontWeight.w700)),
                Text('${euros(widget.totalHt)} HT · ${euros(widget.totalTtc)} TTC${widget.signeLe.isEmpty ? '' : ' · signé le ${widget.signeLe}'}',
                    style: da.text(13, color: da.grey)),
                const SizedBox(height: 14),
                lab('Facture'),
                const SizedBox(height: 2),
                Text('${widget.brouillon?['invoiceNumber'] ?? 'Nouvelle facture'}', style: da.text(16, weight: FontWeight.w700)),
                Text('Acompte sur devis ${widget.numeroDevis}${widget.brouillon != null ? ' · brouillon' : ''}', style: da.text(13, color: da.grey)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          lab('Acompte'),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final p in pourcentagesAcompte) _Puce(libelle: '$p %', on: !_autre && _pct == p, onTap: _verrou ? null : () => _choisir(p)),
              _Puce(libelle: 'Autre', on: _autre, onTap: _verrou ? null : () => setState(() => _autre = true)),
              if (_autre)
                SizedBox(
                  width: 88,
                  height: 40,
                  child: TextField(
                    controller: _autreCtrl,
                    enabled: !_verrou,
                    keyboardType: TextInputType.number,
                    onChanged: (v) => setState(() => _pct = num.tryParse(v.replaceAll(',', '.')) ?? 0),
                    style: da.text(14),
                    decoration: decoration.copyWith(suffixText: '%'),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
            child: Column(
              children: [
                _Ligne(libelle: 'Base TTC', valeur: euros(widget.totalTtc)),
                Divider(height: 1, color: da.line),
                _Ligne(libelle: '${_pct.toString().replaceAll('.', ',')} %', valeur: euros(_montant)),
                Divider(height: 1, color: da.ink),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Expanded(child: lab('Montant de la facture')),
                          Text('${euros(_montant)} TTC', style: da.text(20, weight: FontWeight.w600)),
                        ],
                      ),
                      Text('dont TVA $tauxTexte % ${euros(tvaIncluse(_montant, widget.tva))}', style: da.text(12, color: da.grey)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          lab('Échéance'),
          const SizedBox(height: 4),
          DropdownButtonFormField<String>(
            initialValue: _echeance,
            isExpanded: true,
            decoration: decoration,
            style: da.text(14),
            items: [for (final (id, libelle, _) in echeancesAcompte) DropdownMenuItem(value: id, child: Text(libelle))],
            onChanged: _verrou ? null : (v) => setState(() => _echeance = v ?? _echeance),
          ),
          const SizedBox(height: 14),
          lab('Règlement'),
          const SizedBox(height: 4),
          Container(
            height: 44,
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(color: da.card, border: Border.all(color: const Color(0xFF8A8F98)), borderRadius: BorderRadius.circular(4)),
            child: Text('Virement · IBAN sur la facture', style: da.text(14)),
          ),
          const SizedBox(height: 14),
          lab('Message au client'),
          const SizedBox(height: 4),
          TextField(
            controller: _message,
            enabled: _envoi.isEmpty,
            minLines: 3,
            maxLines: 6,
            style: da.text(14, height: 1.5),
            decoration: decoration,
          ),
          const SizedBox(height: 14),
          lab('Envoi'),
          const SizedBox(height: 8),
          Material(
            color: da.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: _email ? da.ink : da.line)),
            child: InkWell(
              onTap: _envoi.isNotEmpty ? null : () => setState(() => _email = !_email),
              borderRadius: BorderRadius.circular(4),
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    SizedBox(width: 26, child: _email ? Icon(Icons.check, size: 18, color: da.ink) : null),
                    Text('E-mail avec le PDF', style: da.text(14, weight: _email ? FontWeight.w600 : FontWeight.w400, color: _email ? da.ink : da.grey)),
                  ],
                ),
              ),
            ),
          ),
          if (_email) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _adresse,
              enabled: _envoi.isEmpty,
              keyboardType: TextInputType.emailAddress,
              style: da.text(14),
              decoration: decoration.copyWith(hintText: 'E-mail du client', hintStyle: da.text(14, color: da.grey)),
            ),
          ],
          if (_erreur.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 12), child: Text(_erreur, style: da.text(13, weight: FontWeight.w600))),
          const SizedBox(height: 16),
          ProPrimaryButton(
            label: _envoi == 'envoi' ? 'Envoi…' : "Envoyer la facture d'acompte",
            icon: Icons.send_outlined,
            expand: true,
            onPressed: _envoi.isNotEmpty ? null : () => _valider(true),
          ),
          if (widget.brouillon == null) ...[
            const SizedBox(height: 10),
            SizedBox(
              height: 48,
              child: OutlinedButton(
                onPressed: _envoi.isNotEmpty ? null : () => _valider(false),
                style: OutlinedButton.styleFrom(
                  foregroundColor: da.ink,
                  side: const BorderSide(color: Color(0xFF8A8F98)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                ),
                child: Text(_envoi == 'brouillon' ? 'Enregistrement…' : 'Enregistrer en brouillon', style: da.text(15, weight: FontWeight.w600)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Puce extends StatelessWidget {
  const _Puce({required this.libelle, required this.on, this.onTap});
  final String libelle;
  final bool on;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Opacity(
      opacity: onTap == null && !on ? 0.45 : 1,
      child: Material(
        color: on ? da.fill : da.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: on ? da.fill : da.line)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Center(
              widthFactor: 1,
              child: Text(libelle, style: da.text(14, weight: on ? FontWeight.w600 : FontWeight.w500, color: on ? da.onFill : da.ink)),
            ),
          ),
        ),
      ),
    );
  }
}

class _Ligne extends StatelessWidget {
  const _Ligne({required this.libelle, required this.valeur});
  final String libelle;
  final String valeur;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Expanded(child: Text(libelle.toUpperCase(), style: da.text(11, weight: FontWeight.w600, color: da.grey, letterSpacing: 0.6))),
          Text(valeur, style: da.text(14, weight: FontWeight.w600)),
        ],
      ),
    );
  }
}
