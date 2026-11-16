import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/pro_cloture_screen.dart' show RenduSignature, SignatureController, SignatureZone, signaturePng;
import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/devis/devis_suivi.dart' show heureDeParis;
import 'package:koji/apps/entreprise/devis/signature_lieu.dart';
import 'package:koji/apps/entreprise/devis/tva.dart' show estTauxReduit, mentionTauxReduit;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';

/// Ce que le client a fait sur le téléphone : lieu, nom, signature (PNG),
/// cases cochées par lui avec leur heure (ISO), '' si non cochée.
class SignatureSurPlace {
  const SignatureSurPlace({
    required this.lieu,
    required this.signataire,
    required this.png,
    required this.demandeExpresse,
    required this.mentionTva,
    required this.exemplaireEmail,
    required this.jour,
  });
  final String lieu;
  final String signataire;
  final Uint8List png;
  final String demandeExpresse;
  final String mentionTva;
  final String exemplaireEmail;

  /// Jour de la signature à Paris (AAAA-MM-JJ).
  final String jour;
}

/// Résultat renvoyé par le serveur après la signature.
class SigneSurPlace {
  const SigneSurPlace({this.retractationJusquau = '', this.acompteAPartirDu = '', this.demarrageDemande = '', this.exemplaireEnvoye, this.erreur});
  final String retractationJusquau;
  final String acompteAPartirDu;
  final String demarrageDemande;

  /// true : e-mail parti ; false : pas parti ; null : pas demandé.
  final bool? exemplaireEnvoye;
  final String? erreur;
}

/// Faire signer (maquette PRO-03.7, téléphone) : « Envoyer pour signature »
/// ou « Faire signer maintenant » chez le client (« Vous êtes dans vos
/// locaux ? » en lien discret), le téléphone passe au client qui lit, coche
/// lui-même et signe, puis ce que Koji applique : exemplaire, acompte
/// bloqué, fin du délai de rétractation.
class ProFaireSignerScreen extends StatefulWidget {
  const ProFaireSignerScreen({
    super.key,
    required this.numeroDevis,
    required this.version,
    required this.client,
    required this.titre,
    required this.totalTtc,
    required this.onEnvoyer,
    required this.onSigner,
    this.email = '',
    this.clientType = 'particulier',
    this.tauxTva = 20,
    this.autoliquidation = false,
    this.acomptePct = 0,
    this.debut = '',
    this.onDecaler,
    this.onLancer,
    this.onPdf,
    this.rendu = signaturePng,
    this.maintenant = DateTime.now,
  });

  final String numeroDevis;
  final int version;
  final String client;
  final String titre;
  final double totalTtc;
  final String email;
  final String clientType;
  final num tauxTva;
  final bool autoliquidation;
  final num acomptePct;

  /// Démarrage prévu (AAAA-MM-JJ) ou ''.
  final String debut;
  final VoidCallback onEnvoyer;
  final Future<SigneSurPlace> Function(SignatureSurPlace s) onSigner;

  /// Décale le démarrage au jour donné ; renvoie une erreur ou null.
  final Future<String?> Function(String jour)? onDecaler;
  final VoidCallback? onLancer;
  final VoidCallback? onPdf;
  final RenduSignature rendu;
  final DateTime Function() maintenant;

  @override
  State<ProFaireSignerScreen> createState() => _ProFaireSignerScreenState();
}

class _ProFaireSignerScreenState extends State<ProFaireSignerScreen> {
  String _etape = 'choix';
  String _lieu = 'domicile';
  bool _proposer = true;
  late String _debut = widget.debut;
  final Map<String, String> _cases = {};
  late final _nom = TextEditingController(text: widget.client);
  final _signature = SignatureController();
  bool _envoi = false;
  String _erreur = '';
  SigneSurPlace? _fait;
  String _signeLe = '';

  String get _nomClient => widget.client.trim().isEmpty ? 'le client' : widget.client.trim();
  String get _jour => DateFormat('yyyy-MM-dd').format(heureDeParis(widget.maintenant().toUtc()));
  ReglesSignature get _regles => reglesSignature(_lieu, widget.clientType);
  String get _fin => finRetractation(_jour, _lieu, widget.clientType);
  String get _acompteLe => acompteAPartirDu(_jour, _lieu, widget.clientType);
  bool get _avantFin => _regles.retractation && demarrageAvantFin(_debut, _fin);
  bool get _reduit => !widget.autoliquidation && estTauxReduit(widget.tauxTva);
  double get _acompteTtc => widget.totalTtc * widget.acomptePct / 100;
  bool get _peutSigner => !_signature.vide && _nom.text.trim().isNotEmpty && (!_reduit || (_cases['mentionTva'] ?? '').isNotEmpty);

  @override
  void dispose() {
    _nom.dispose();
    _signature.dispose();
    super.dispose();
  }

  void _cocher(String cle, bool v) =>
      setState(() => v ? _cases[cle] = widget.maintenant().toUtc().toIso8601String() : _cases.remove(cle));

  Future<void> _signer() async {
    if (!_peutSigner || _envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final png = Uint8List.fromList(await widget.rendu(_signature.traits, _signature.taille));
      final r = await widget.onSigner(SignatureSurPlace(
        lieu: _lieu,
        signataire: _nom.text.trim(),
        png: png,
        demandeExpresse: _avantFin && _proposer ? _cases['demandeExpresse'] ?? '' : '',
        mentionTva: _reduit ? _cases['mentionTva'] ?? '' : '',
        exemplaireEmail: widget.email.isNotEmpty ? _cases['exemplaireEmail'] ?? '' : '',
        jour: _jour,
      ));
      if (!mounted) return;
      if (r.erreur != null) {
        setState(() {
          _envoi = false;
          _erreur = r.erreur!;
        });
        return;
      }
      final h = heureDeParis(widget.maintenant().toUtc());
      setState(() {
        _envoi = false;
        _fait = r;
        _signeLe = '${DateFormat('d MMM', 'fr_FR').format(h)}, ${DateFormat("H 'h' mm").format(h)}';
        _etape = 'fait';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _envoi = false;
        _erreur = "La signature n'a pas pu être enregistrée.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    if (_etape == 'client') return _ecranClient(da);
    final fait = _etape == 'fait';
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
                    onPressed: () => Navigator.of(context).maybePop(fait),
                    tooltip: 'Retour',
                    icon: Icon(Icons.chevron_left, color: da.ink, size: 26),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(fait ? 'Devis signé' : 'Faire signer', style: da.text(15, weight: FontWeight.w700)),
                        Text(
                          fait
                              ? widget.titre
                              : ['Devis ${widget.numeroDevis} v${widget.version}', widget.client].where((x) => x.trim().isNotEmpty).join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: da.text(12, color: da.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      body: fait ? _ecranFait(da) : _ecranChoix(da),
    );
  }

  Widget _ligne(ProDa da, String gauche, String droite, {String? numero}) => Container(
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (numero != null) ...[
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: da.ink)),
                child: Text(numero, style: da.text(11, weight: FontWeight.w700)),
              ),
              const SizedBox(width: 10),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(gauche, style: da.text(14, weight: FontWeight.w600)),
                  if (droite.isNotEmpty) Text(droite, style: da.text(12.5, color: da.grey, height: 1.35)),
                ],
              ),
            ),
          ],
        ),
      );

  Widget _option(ProDa da, {required String titre, required String detail, required bool choisi, required VoidCallback onTap}) => Material(
        color: da.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
          side: BorderSide(color: choisi ? da.ink : da.line, width: choisi ? 1.5 : 1),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titre, style: da.text(15, weight: FontWeight.w700)),
                      Text(detail, style: da.text(12.5, color: da.grey)),
                    ],
                  ),
                ),
                Icon(choisi ? Icons.radio_button_checked : Icons.chevron_right, size: 20, color: choisi ? da.ink : da.grey),
              ],
            ),
          ),
        ),
      );

  Widget _ecranChoix(ProDa da) {
    final regles = _regles;
    final particulier = widget.clientType != 'societe';
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            children: [
              _option(da,
                  titre: 'Envoyer pour signature',
                  detail: '$_nomClient signe en ligne, dans son espace Koji',
                  choisi: false,
                  onTap: widget.onEnvoyer),
              const SizedBox(height: 8),
              _option(da,
                  titre: 'Faire signer maintenant',
                  detail: _lieu == 'locaux' ? 'sur votre téléphone, dans vos locaux' : 'sur votre téléphone, chez $_nomClient',
                  choisi: true,
                  onTap: () => setState(() => _lieu = 'domicile')),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: () => setState(() => _lieu = _lieu == 'locaux' ? 'domicile' : 'locaux'),
                  style: TextButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 8), foregroundColor: da.ink),
                  child: Text(_lieu == 'locaux' ? 'Vous êtes chez $_nomClient ?' : 'Vous êtes dans vos locaux ?',
                      style: da.text(13, weight: FontWeight.w600).copyWith(decoration: TextDecoration.underline)),
                ),
              ),
              Container(
                padding: const EdgeInsets.fromLTRB(14, 2, 14, 2),
                decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (regles.retractation)
                      _ligne(da, "Rétractation jusqu'au ${jourCourt(_fin)}", 'formulaire joint automatiquement')
                    else
                      _ligne(da, 'Pas de droit de rétractation', particulier ? 'signé dans vos locaux' : 'client professionnel'),
                    if (_acompteLe.isNotEmpty)
                      _ligne(
                          da,
                          widget.acomptePct > 0 ? 'Acompte le ${jourCourt(_acompteLe)}' : 'Aucun paiement avant le ${jourCourt(_acompteLe)}',
                          widget.acomptePct > 0 ? "aucun paiement avant · facture d'acompte (${euros(_acompteTtc)} TTC) à envoyer ce jour-là" : 'aucun acompte prévu'),
                    if (_avantFin) ...[
                      _ligne(da, 'Démarrage le ${jourCourt(_debut)}, avant la fin du délai',
                          "$_nomClient pourra le demander en cochant une case ; sinon vous décalez"),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            _bouton(da, 'Lui proposer le ${jourCourt(_debut)}', on: _proposer, onTap: () => setState(() => _proposer = true)),
                            if (widget.onDecaler != null)
                              _bouton(da, 'Décaler au ${libelleLundi(lundiApres(_fin))}', onTap: () async {
                                final jour = lundiApres(_fin);
                                final erreur = await widget.onDecaler!(jour);
                                if (!mounted) return;
                                setState(() {
                                  if (erreur == null) _debut = jour;
                                  _erreur = erreur ?? '';
                                });
                              }),
                          ],
                        ),
                      ),
                    ],
                    if (_reduit) _ligne(da, 'Mention TVA ${'${widget.tauxTva}'.replaceAll('.', ',')} %', 'certifiée par $_nomClient à la signature'),
                    _ligne(da, 'Exemplaire de $_nomClient',
                        widget.email.isNotEmpty ? "par e-mail s'il l'accepte, sinon PDF à imprimer" : "PDF à imprimer (pas d'e-mail sur la fiche)"),
                  ],
                ),
              ),
              if (_erreur.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(_erreur, style: da.text(13, color: const Color(0xFFC4452D))),
              ],
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: ProPrimaryButton(
              label: 'Passer le téléphone à $_nomClient',
              expand: true,
              onPressed: () => setState(() {
                _cases.clear();
                _signature.effacer();
                _erreur = '';
                _etape = 'client';
              }),
            ),
          ),
        ),
      ],
    );
  }

  Widget _bouton(ProDa da, String libelle, {bool on = false, required VoidCallback onTap}) => Material(
        color: da.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
          side: BorderSide(color: on ? da.ink : const Color(0xFF8A8F98), width: on ? 1.5 : 1),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            child: Text(libelle, style: da.text(13, weight: FontWeight.w600)),
          ),
        ),
      );

  Widget _case(ProDa da, String cle, String texte, {String petit = ''}) {
    final coche = (_cases[cle] ?? '').isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: da.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: coche ? da.ink : da.line)),
        child: InkWell(
          onTap: () => _cocher(cle, !coche),
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 28,
                  height: 22,
                  child: Checkbox(
                    value: coche,
                    onChanged: (v) => _cocher(cle, v ?? false),
                    activeColor: da.fill,
                    checkColor: da.onFill,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(texte, style: da.text(13.5, height: 1.4)),
                      if (petit.isNotEmpty) Text(petit, style: da.text(11.5, color: da.grey, height: 1.35)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Écran tendu au client : rien d'autre que ce qu'il lit, coche et signe.
  Widget _ecranClient(ProDa da) {
    final regles = _regles;
    return Scaffold(
      backgroundColor: da.page,
      body: SafeArea(
        child: ListenableBuilder(
          listenable: Listenable.merge([_signature, _nom]),
          builder: (context, _) => Column(
            children: [
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 16),
                  children: [
                    Text('Avant de signer', style: da.text(22, weight: FontWeight.w700)),
                    Text('à lire par $_nomClient', style: da.text(13, color: da.grey)),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                      decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.ink, width: 2), left: BorderSide(color: da.line), right: BorderSide(color: da.line), bottom: BorderSide(color: da.line))),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Votre devis', style: da.text(12, color: da.grey)),
                          Text('${widget.titre} · version ${widget.version}', style: da.text(14, weight: FontWeight.w700)),
                          Text('${euros(widget.totalTtc)} TTC', style: da.text(20, weight: FontWeight.w700)),
                          if (widget.acomptePct > 0) Text(texteAcompte(widget.acomptePct, _acompteTtc, _acompteLe), style: da.text(12.5, color: da.grey)),
                        ],
                      ),
                    ),
                    if (regles.retractation) ...[
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                        decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.ink, width: 2), left: BorderSide(color: da.line), right: BorderSide(color: da.line), bottom: BorderSide(color: da.line))),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Votre droit de rétractation', style: da.text(14, weight: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Text(texteRetractation(_fin), style: da.text(13.5, height: 1.45)),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    if (_avantFin && _proposer) _case(da, 'demandeExpresse', texteDemandeExpresse(_debut)),
                    if (_reduit)
                      _case(da, 'mentionTva',
                          "Logement de plus de 2 ans, à usage d'habitation · mention pour la TVA à ${'${widget.tauxTva}'.replaceAll('.', ',')} %",
                          petit: mentionTauxReduit),
                    if (widget.email.isNotEmpty)
                      _case(da, 'exemplaireEmail', 'Je reçois mon exemplaire par e-mail · ${masquerEmail(widget.email)}',
                          petit: "sinon l'entreprise l'imprime"),
                    Text('Cases cochées par $_nomClient, jamais à l\'avance.', style: da.text(12, color: da.grey)),
                    const SizedBox(height: 12),
                    Text('NOM DU SIGNATAIRE', style: da.text(11, weight: FontWeight.w600, color: const Color(0xFF5B5F66))),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _nom,
                      style: da.text(15),
                      decoration: InputDecoration(
                        hintText: 'Nom et prénom',
                        isDense: true,
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFFCFCFC9))),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SignatureZone(label: 'Signature de $_nomClient', controller: _signature),
                    if (_erreur.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(_erreur, style: da.text(13, color: const Color(0xFFC4452D))),
                    ],
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                child: Row(
                  children: [
                    TextButton(
                      onPressed: _envoi ? null : () => setState(() => _etape = 'choix'),
                      style: TextButton.styleFrom(foregroundColor: da.ink),
                      child: Text('Retour', style: da.text(14, weight: FontWeight.w600)),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ProPrimaryButton(
                        label: _envoi ? 'Signature…' : 'Signer',
                        expand: true,
                        onPressed: _peutSigner && !_envoi ? _signer : null,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _ecranFait(ProDa da) {
    final r = _fait!;
    final lieu = _lieu == 'locaux' ? 'dans vos locaux' : 'chez $_nomClient';
    final exemplaire = r.exemplaireEnvoye == true
        ? ('Copie et formulaire envoyés', 'par e-mail${_regles.retractation ? ', avec le formulaire de rétractation' : ''}')
        : r.exemplaireEnvoye == false
            ? ("L'e-mail n'est pas parti", 'imprimez le PDF et remettez-le à $_nomClient')
            : ('Exemplaire à imprimer', 'PDF du devis signé${_regles.retractation ? ', avec le formulaire de rétractation' : ''}');
    var n = 0;
    return Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
            children: [
              Container(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 4),
                decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(widget.titre, style: da.text(16, weight: FontWeight.w700))),
                        Icon(Icons.check_circle_outline, size: 18, color: da.ink),
                        const SizedBox(width: 4),
                        Text('Signé', style: da.text(13, weight: FontWeight.w700)),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text('Signé $lieu $_signeLe · version ${widget.version} · ${euros(widget.totalTtc)} TTC', style: da.text(12.5, color: da.grey)),
                    const SizedBox(height: 6),
                    _ligne(da, exemplaire.$1, exemplaire.$2, numero: '${++n}'),
                    if (r.exemplaireEnvoye != true && widget.onPdf != null)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(
                          onPressed: widget.onPdf,
                          style: TextButton.styleFrom(foregroundColor: da.ink),
                          child: Text('PDF à imprimer', style: da.text(13, weight: FontWeight.w600).copyWith(decoration: TextDecoration.underline)),
                        ),
                      ),
                    if (r.acompteAPartirDu.isNotEmpty)
                      _ligne(da, "Acompte bloqué jusqu'au ${jourCourt(r.acompteAPartirDu)}", 'facture à envoyer à partir de cette date', numero: '${++n}'),
                    if (r.retractationJusquau.isNotEmpty)
                      _ligne(
                          da,
                          'Fin du délai le ${jourCourt(r.retractationJusquau)}',
                          r.demarrageDemande.isNotEmpty
                              ? 'démarrage le ${jourCourt(r.demarrageDemande)} demandé par $_nomClient'
                              : 'pas de démarrage avant cette date',
                          numero: '${++n}'),
                  ],
                ),
              ),
              if (r.retractationJusquau.isNotEmpty) ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(color: da.soft, border: Border.all(color: da.line)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Si $_nomClient se rétracte', style: da.text(14, weight: FontWeight.w700)),
                      Text('Devis annulé, chantier retiré du planning', style: da.text(13)),
                      Text('remboursement à faire sous 14 jours · Koji vous prévient', style: da.text(12.5, color: da.grey)),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        if (widget.onLancer != null)
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
              child: ProPrimaryButton(label: 'Lancer le chantier', icon: Icons.add, expand: true, onPressed: widget.onLancer),
            ),
          ),
      ],
    );
  }
}
