import 'package:flutter/material.dart';

import 'package:koji/apps/entreprise/devis/devis_envoi.dart';
import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';

/// Envoyer le devis (maquette PRO-03.2, téléphone) : plein écran. Les
/// réglages du devis (validité, acompte, règlement, TVA) se changent ici,
/// le message est proposé et modifiable, puis l'envoi : Koji Client avec
/// signature en ligne, e-mail avec le PDF, SMS. Un seul jaune.
class ProEnvoiDevisScreen extends StatefulWidget {
  const ProEnvoiDevisScreen({
    super.key,
    required this.numero,
    required this.client,
    this.email = '',
    this.telephone = '',
    this.projet = '',
    this.debut,
    required this.totalHt,
    required this.tva,
    required this.validite,
    required this.acompte,
    required this.solde,
    required this.lignes,
    required this.lots,
    required this.onEnvoyer,
    this.onApercu,
    this.maintenant = DateTime.now,
  });

  final String numero;
  final String client;
  final String email;
  final String telephone;
  final String projet;
  final DateTime? debut;
  final double totalHt;
  final num tva;
  final int validite;
  final int acompte;
  final String solde;
  final int lignes;
  final int lots;

  /// Envoie et renvoie une erreur à afficher, ou null si c'est parti.
  final Future<String?> Function(EnvoiDevisChoix choix) onEnvoyer;
  final Future<void> Function(EnvoiDevisChoix choix)? onApercu;
  final DateTime Function() maintenant;

  @override
  State<ProEnvoiDevisScreen> createState() => _ProEnvoiDevisScreenState();
}

class _ProEnvoiDevisScreenState extends State<ProEnvoiDevisScreen> {
  late int _validite = validites.contains(widget.validite) ? widget.validite : 30;
  late int _acompte = widget.acompte;
  late String _solde = soldeDe(widget.solde);
  late num _tva = widget.tva;
  late final _message = TextEditingController(
      text: messageEnvoi(client: widget.client, projet: widget.projet, debut: widget.debut));
  late final _adresse = TextEditingController(text: widget.email);
  late final _telephone = TextEditingController(text: widget.telephone);
  late bool _modifierClient = widget.email.isEmpty;
  bool _kojiClient = true;
  bool _email = true;
  bool _sms = false;
  bool _envoi = false;
  String _erreur = '';

  @override
  void dispose() {
    _message.dispose();
    _adresse.dispose();
    _telephone.dispose();
    super.dispose();
  }

  double get _montantTva => widget.totalHt * _tva / 100;
  double get _ttc => widget.totalHt + _montantTva;

  EnvoiDevisChoix get _choix => EnvoiDevisChoix(
        validite: _validite,
        acompte: _acompte,
        solde: _solde,
        tva: _tva,
        message: _message.text.trim(),
        adresse: _adresse.text.trim(),
        telephone: _telephone.text.trim(),
        kojiClient: _kojiClient,
        email: _email,
        sms: _sms,
      );

  Future<void> _envoyer() async {
    final manque = erreurEnvoi(
        kojiClient: _kojiClient, email: _email, sms: _sms, adresse: _adresse.text, telephone: _telephone.text);
    if (manque.isNotEmpty) {
      setState(() => _erreur = manque);
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    final erreur = await widget.onEnvoyer(_choix);
    if (!mounted) return;
    if (erreur == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _envoi = false;
      _erreur = erreur;
    });
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final soldes = [
      ...reglements,
      if (!reglements.any((r) => r.$1 == _solde)) (_solde, libelleReglement('Solde — $_solde')),
    ];
    final taux = [...tauxTvaApp, if (!tauxTvaApp.contains(_tva)) _tva];
    final listeAcomptes = [...acomptes, if (!acomptes.contains(_acompte)) _acompte]..sort();
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
                    onPressed: _envoi ? null : () => Navigator.of(context).maybePop(),
                    tooltip: 'Retour',
                    icon: Icon(Icons.chevron_left, color: da.ink, size: 26),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Envoyer le devis', style: da.text(15, weight: FontWeight.w700)),
                        Text([widget.numero, widget.client].where((x) => x.isNotEmpty).join(' · '),
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
              ),
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        children: [
          _resume(da),
          const SizedBox(height: 14),
          _champ(da, 'Validité', DropdownButtonFormField<int>(
            initialValue: _validite,
            isExpanded: true,
            decoration: _decoration(da),
            style: da.text(14),
            items: [for (final j in validites) DropdownMenuItem(value: j, child: Text(libelleValidite(j, widget.maintenant())))],
            onChanged: _envoi ? null : (v) => setState(() => _validite = v ?? _validite),
          )),
          _champ(da, 'Acompte à la signature', DropdownButtonFormField<int>(
            key: ValueKey('acompte-$_tva'),
            initialValue: _acompte,
            isExpanded: true,
            decoration: _decoration(da),
            style: da.text(14),
            items: [for (final p in listeAcomptes) DropdownMenuItem(value: p, child: Text(libelleAcompte(p, _ttc)))],
            onChanged: _envoi ? null : (v) => setState(() => _acompte = v ?? _acompte),
          )),
          _champ(da, 'Règlement', DropdownButtonFormField<String>(
            initialValue: _solde,
            isExpanded: true,
            decoration: _decoration(da),
            style: da.text(14),
            items: [for (final (s, l) in soldes) DropdownMenuItem(value: s, child: Text(l))],
            onChanged: _envoi ? null : (v) => setState(() => _solde = v ?? _solde),
          )),
          _champ(da, 'TVA réduite', DropdownButtonFormField<num>(
            initialValue: _tva,
            isExpanded: true,
            decoration: _decoration(da),
            style: da.text(14),
            items: [for (final t in taux) DropdownMenuItem(value: t, child: Text(libelleTva(t)))],
            onChanged: _envoi ? null : (v) => setState(() => _tva = v ?? _tva),
          )),
          _champ(da, 'Message au client', TextField(
            controller: _message,
            enabled: !_envoi,
            minLines: 4,
            maxLines: 8,
            style: da.text(14, height: 1.5),
            decoration: _decoration(da),
          )),
          Text('ENVOI', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
          const SizedBox(height: 8),
          _case(da, 'Koji Client, avec signature en ligne', _kojiClient, (v) => setState(() => _kojiClient = v)),
          _case(da, 'E-mail avec le PDF', _email, (v) => setState(() => _email = v)),
          _case(da, 'SMS de notification', _sms, (v) => setState(() => _sms = v)),
          const SizedBox(height: 6),
          _pdf(da),
          if (_erreur.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_erreur, style: da.text(13, weight: FontWeight.w600)),
            ),
          const SizedBox(height: 16),
          ProPrimaryButton(
            label: _envoi ? 'Envoi…' : 'Envoyer le devis',
            icon: Icons.send_outlined,
            expand: true,
            onPressed: _envoi ? null : _envoyer,
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 48,
            child: OutlinedButton(
              onPressed: _envoi ? null : () => Navigator.of(context).maybePop(),
              style: OutlinedButton.styleFrom(
                foregroundColor: da.ink,
                side: const BorderSide(color: Color(0xFF8A8F98)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
              ),
              child: Text('Retour au devis', style: da.text(15, weight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _decoration(ProDa da) => InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 11),
        filled: true,
        fillColor: da.card,
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFF8A8F98))),
        disabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.ink, width: 1.5)),
      );

  Widget _champ(ProDa da, String libelle, Widget champ) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(libelle.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
            const SizedBox(height: 4),
            champ,
          ],
        ),
      );

  Widget _lab(ProDa da, String t) =>
      Text(t.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6));

  Widget _resume(ProDa da) {
    final coord = [_adresse.text.trim(), _telephone.text.trim()].where((x) => x.isNotEmpty).join(' · ');
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _lab(da, 'Client'),
          const SizedBox(height: 2),
          Text(widget.client.isEmpty ? 'Client' : widget.client, style: da.text(16, weight: FontWeight.w700)),
          if (_modifierClient) ...[
            const SizedBox(height: 6),
            TextField(
              controller: _adresse,
              keyboardType: TextInputType.emailAddress,
              onChanged: (_) => setState(() {}),
              style: da.text(14),
              decoration: _decoration(da).copyWith(hintText: 'E-mail du client', hintStyle: da.text(14, color: da.grey)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _telephone,
              keyboardType: TextInputType.phone,
              onChanged: (_) => setState(() {}),
              style: da.text(14),
              decoration: _decoration(da).copyWith(hintText: 'Téléphone', hintStyle: da.text(14, color: da.grey)),
            ),
          ] else
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(coord.isEmpty ? 'coordonnées à renseigner' : coord, style: da.text(13, color: da.grey)),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => setState(() => _modifierClient = true),
                  child: Text('Modifier',
                      style: da.text(13, weight: FontWeight.w600).copyWith(decoration: TextDecoration.underline)),
                ),
              ],
            ),
          const SizedBox(height: 14),
          _lab(da, 'Devis ${widget.numero}'),
          const SizedBox(height: 2),
          Text('${euros(widget.totalHt)} HT', style: da.text(16, weight: FontWeight.w700)),
          Text('TVA ${libelleTva(_tva).split(' · ').first} ${euros(_montantTva)} · ${euros(_ttc)} TTC',
              style: da.text(13, color: da.grey)),
        ],
      ),
    );
  }

  Widget _case(ProDa da, String libelle, bool on, ValueChanged<bool> changer) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Material(
          color: da.card,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4), side: BorderSide(color: on ? da.ink : da.line)),
          child: InkWell(
            onTap: _envoi ? null : () => changer(!on),
            borderRadius: BorderRadius.circular(4),
            child: Semantics(
              checked: on,
              label: libelle,
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Row(
                  children: [
                    SizedBox(width: 26, child: on ? Icon(Icons.check, size: 18, color: da.ink) : null),
                    Expanded(
                      child: Text(libelle,
                          style: da.text(14, weight: on ? FontWeight.w600 : FontWeight.w400, color: on ? da.ink : da.grey)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );

  Widget _pdf(ProDa da) => Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 6, 12),
        decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
        child: Row(
          children: [
            Icon(Icons.description_outlined, color: da.ink, size: 22),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(nomFichierDevis(widget.numero, widget.client),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(14, weight: FontWeight.w700)),
                  Text(resumePdf(widget.lignes, widget.lots), style: da.text(12, color: da.grey)),
                ],
              ),
            ),
            if (widget.onApercu != null)
              TextButton(
                onPressed: _envoi ? null : () => widget.onApercu!(_choix),
                style: TextButton.styleFrom(foregroundColor: da.ink),
                child: Text('Aperçu', style: da.text(13, weight: FontWeight.w600)),
              ),
          ],
        ),
      );
}
