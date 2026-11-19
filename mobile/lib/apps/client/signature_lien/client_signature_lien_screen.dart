import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_signature_pad.dart';
import 'package:koji/apps/client/signature_lien/signature_lien_api.dart';
import 'package:koji/design/koji_client_charte.dart';

const _aideKoji = 'contact@getkoji.io';

enum _Etape { connexion, chargement, signer, signe, retracte, invalide }

/// « J'ai reçu un lien de signature » (maquette CLI-07, téléphone) : le
/// devis reçu par e-mail se signe dans l'app, sans compte Koji Client.
/// Connexion avec l'identifiant et le mot de passe reçus (le lien collé
/// remplit l'identifiant), puis trois états : signer, signé (« Et
/// maintenant »), lien qui n'ouvre plus de devis. Gabarit web :
/// app/signature/[token]/page.jsx ; mêmes routes, mêmes libellés (le site
/// les fabrique). Cases jamais cochées d'avance, un seul bouton marine.
class ClientSignatureLienScreen extends ConsumerStatefulWidget {
  const ClientSignatureLienScreen({super.key, this.lien = ''});

  /// Lien ou identifiant déjà connu (texte collé, ouverture depuis un écran).
  final String lien;

  @override
  ConsumerState<ClientSignatureLienScreen> createState() =>
      _ClientSignatureLienScreenState();
}

class _ClientSignatureLienScreenState
    extends ConsumerState<ClientSignatureLienScreen> {
  _Etape _etape = _Etape.connexion;
  final _lien = TextEditingController();
  final _identifiant = TextEditingController();
  final _motDePasse = TextEditingController();
  final _nom = TextEditingController();
  bool _envoi = false;
  String _erreur = '';

  String _jeton = '';
  Map<String, dynamic> _quote = const {};
  Map<String, dynamic> _vue = const {};
  Map<String, dynamic> _entreprise = const {};
  Map<String, dynamic> _exemplaire = const {};

  bool _detail = false;
  bool _mentionTva = false;
  bool _demarrage = false;
  bool _accord = false;
  final _signature = ClSignatureControleur();

  bool _retractation = false;
  bool _confirmer = false;

  SignatureLienApi get _api => ref.read(signatureLienApiProvider);

  @override
  void initState() {
    super.initState();
    _signature.addListener(_rafraichir);
    if (widget.lien.isNotEmpty) {
      _lien.text = widget.lien;
      _lireLien(widget.lien);
    }
  }

  void _rafraichir() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _signature.removeListener(_rafraichir);
    _signature.dispose();
    _lien.dispose();
    _identifiant.dispose();
    _motDePasse.dispose();
    _nom.dispose();
    super.dispose();
  }

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/client-home');
    }
  }

  /// Un lien collé : l'identifiant qu'il porte remplit le champ.
  void _lireLien(String texte) {
    final lu = lireLienSignature(texte);
    if (lu.identifiant.isNotEmpty) _identifiant.text = lu.identifiant;
    setState(() => _erreur = '');
  }

  Future<void> _coller() async {
    final presse = await Clipboard.getData(Clipboard.kTextPlain);
    final texte = presse?.text?.trim() ?? '';
    if (texte.isEmpty) return;
    _lien.text = texte;
    _lireLien(texte);
  }

  Future<void> _connexion() async {
    if (_envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final jeton = await _api.connexion(
        identifiant: _identifiant.text.trim(),
        motDePasse: _motDePasse.text,
      );
      _motDePasse.clear();
      _jeton = jeton;
      await _charger();
    } catch (err) {
      if (!mounted) return;
      setState(() => _erreur = err is KojiWebApiException
          ? err.message
          : 'Connexion impossible. Vérifiez votre réseau et réessayez.');
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _charger() async {
    setState(() => _etape = _Etape.chargement);
    try {
      _montrer(await _api.lire(_jeton));
    } on SignatureSessionExpiree {
      _seReconnecter();
    } on LienSignatureInvalide catch (e) {
      if (mounted) {
        setState(() {
          _entreprise = e.entreprise;
          _etape = _Etape.invalide;
        });
      }
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _etape = _Etape.connexion;
        _erreur = err is KojiWebApiException
            ? err.message
            : "Le devis n'a pas pu être chargé. Vérifiez votre connexion.";
      });
    }
  }

  void _seReconnecter() {
    if (!mounted) return;
    setState(() {
      _etape = _Etape.connexion;
      _erreur =
          'Session de signature expirée. Reconnectez-vous avec vos identifiants.';
    });
  }

  void _montrer(Map<String, dynamic> reponse) {
    if (!mounted) return;
    final quote = mapSite(reponse['quote']);
    final vue = mapSite(reponse['vue']);
    final devis = mapSite(vue['devis']);
    setState(() {
      if (quote.isNotEmpty) _quote = {..._quote, ...quote};
      if (vue.isNotEmpty) _vue = vue;
      if (_nom.text.isEmpty) _nom.text = texteSite(vue['nom']);
      final regles = mapSite(devis['signature']);
      _etape = _quote['retracteLe'] is String &&
              (_quote['retracteLe'] as String).isNotEmpty
          ? _Etape.retracte
          : devis['etat'] == 'signe'
              ? _Etape.signe
              : devis['etat'] == 'a_signer' && regles.isNotEmpty
                  ? _Etape.signer
                  : _Etape.invalide;
    });
  }

  Future<void> _signer(Map<String, dynamic> regles) async {
    if (_envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final image = await _signature.enPng();
      if (image.isEmpty) {
        setState(() => _erreur = 'Signez dans le cadre avant de valider.');
        return;
      }
      final reponse = await _api.signer(_jeton, {
        'signerName': _nom.text.trim(),
        'mentionTva': regles['mentionTva'] != null && _mentionTva,
        'demandeExpresse': regles['demarrage'] != null && _demarrage,
        'consent': _accord,
        'signature': image,
      });
      _exemplaire = mapSite(reponse['exemplaire']);
      _montrer(reponse);
    } on SignatureSessionExpiree {
      _seReconnecter();
    } on LienSignatureInvalide catch (e) {
      if (mounted) {
        setState(() {
          _entreprise = e.entreprise;
          _etape = _Etape.invalide;
        });
      }
    } catch (err) {
      if (!mounted) return;
      setState(() => _erreur =
          err is KojiWebApiException ? err.message : 'Signature impossible.');
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _retracter() async {
    if (_envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final reponse = await _api.retracter(_jeton);
      final quote = mapSite(reponse['quote']);
      if (!mounted) return;
      setState(() {
        _quote = {..._quote, ...quote};
        _etape = _Etape.retracte;
      });
    } on SignatureSessionExpiree {
      _seReconnecter();
    } catch (err) {
      if (!mounted) return;
      setState(() => _erreur = err is KojiWebApiException
          ? err.message
          : "La rétractation n'a pas pu être enregistrée.");
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _pdf(String titre) async {
    try {
      final octets = await _api.pdf(_jeton);
      final dossier = await getTemporaryDirectory();
      final fichier = File('${dossier.path}/koji-${nomDeFichier(titre)}.pdf');
      await fichier.writeAsBytes(octets);
      await Share.shareXFiles(
          [XFile(fichier.path, mimeType: 'application/pdf')]);
    } on SignatureSessionExpiree {
      _seReconnecter();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Le PDF n'a pas pu être ouvert.")));
    }
  }

  Future<void> _ecrire(String email) async {
    try {
      await launchUrl(Uri(scheme: 'mailto', path: email),
          mode: LaunchMode.externalApplication);
    } catch (_) {
      // Pas d'application d'e-mail : rien d'autre à faire ici.
    }
  }

  void _suivreChantier() {
    final connecte = ref.read(kojiWebApiClientProvider).isLoggedIn;
    context.go(connecte ? '/client-home' : '/client/marketplace/login');
  }

  @override
  Widget build(BuildContext context) {
    final devis = mapSite(_vue['devis']);
    final entreprise = texteSite(mapSite(devis['entreprise'])['nom']);
    final (titre, sousTitre) = switch (_etape) {
      _Etape.signer => (
          'Signer le devis',
          entreprise.isEmpty
              ? 'lien reçu par e-mail'
              : '$entreprise · lien reçu par e-mail'
        ),
      _Etape.signe => (
          'Devis signé',
          texteSite(devis['signeLe']).replaceFirst(' à ', ' · ')
        ),
      _Etape.retracte => ('Devis annulé', entreprise),
      _Etape.invalide => (
          'Lien non valide',
          'déjà utilisé, expiré ou remplacé'
        ),
      _ => ('Signer un devis', 'lien reçu par e-mail, sans compte'),
    };
    final corps = switch (_etape) {
      _Etape.chargement => const Center(
          child: SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
                strokeWidth: 2, color: ClCharte.marine),
          ),
        ),
      _Etape.signer => ClCorps(children: _ecranSigner(devis)),
      _Etape.signe => ClCorps(children: _ecranSigne(devis)),
      _Etape.retracte => ClCorps(children: _ecranRetracte()),
      _Etape.invalide => ClCorps(children: _ecranInvalide()),
      _Etape.connexion => ClCorps(children: _ecranConnexion()),
    };
    return ClEcran(
        titre: titre, sousTitre: sousTitre, onRetour: _retour, corps: corps);
  }

  Widget _message() => Semantics(
        liveRegion: true,
        child:
            Text(_erreur, style: ClCharte.texte(13, graisse: FontWeight.w600)),
      );

  // ─── Connexion ──────────────────────────────────────────────────────

  List<Widget> _ecranConnexion() {
    final pret =
        _identifiant.text.trim().isNotEmpty && _motDePasse.text.isNotEmpty;
    return [
      Text("J'ai reçu un lien de signature", style: ClCharte.titre(22)),
      Text(
          "L'entreprise vous a envoyé le devis par e-mail, avec un "
          'identifiant et un mot de passe. Pas de compte à créer : '
          'vérifiez, signez, vous recevez votre exemplaire.',
          style: ClCharte.texte(14, hauteur: 1.5)),
      ClChamp(
        label: 'Lien reçu par e-mail (facultatif)',
        controller: _lien,
        hint: 'Collez le lien, il remplit l\'identifiant',
        keyboardType: TextInputType.url,
        onChanged: _lireLien,
      ),
      Align(
        alignment: Alignment.centerLeft,
        child: ClLien('Coller le lien', onTap: _coller),
      ),
      ClChamp(
        label: 'Identifiant',
        controller: _identifiant,
        hint: 'Ex. Koji-CH8594',
        onChanged: (_) => setState(() => _erreur = ''),
      ),
      ClChamp(
        label: 'Mot de passe',
        controller: _motDePasse,
        masque: true,
        textInputAction: TextInputAction.go,
        onChanged: (_) => setState(() => _erreur = ''),
        onSubmitted: (_) => pret ? _connexion() : null,
      ),
      if (_erreur.isNotEmpty) _message(),
      ClBouton('Ouvrir le devis',
          charge: _envoi, onPressed: pret ? _connexion : null),
      const ClNote(
          "L'identifiant et le mot de passe sont dans l'e-mail du devis. Un "
          'lien vaut 30 jours, comme le devis ; une nouvelle version '
          'remplace le lien précédent.'),
    ];
  }

  // ─── Signer ─────────────────────────────────────────────────────────

  List<Widget> _ecranSigner(Map<String, dynamic> devis) {
    final regles = mapSite(devis['signature']);
    final mention = mapSite(regles['mentionTva']);
    final demarrage = mapSite(regles['demarrage']);
    final acompte = mapSite(devis['acompte']);
    final lignes = listeSite(devis['lignes']);
    final tva = listeSite(devis['totaux'])
        .map((t) => texteSite(t['libelle']))
        .firstWhere((l) => l.startsWith('TVA'), orElse: () => '')
        .split(' · ')
        .first;
    final complet = _accord &&
        (mention.isEmpty || _mentionTva) &&
        _nom.text.trim().isNotEmpty &&
        !_signature.vide;
    return [
      ClPrix(
        titre: texteSite(devis['titre']),
        montant: '${texteSite(devis['totalTtc'])} TTC',
        detail: [
          if (tva.isNotEmpty) tva,
          if (acompte.isNotEmpty)
            '${texteSite(acompte['detail']).split(' · ').first} à la signature',
        ].join(' · '),
      ),
      ClRangee(
        icone: ClIcones.document,
        titre: _detail ? 'Masquer le devis' : 'Lire le devis complet',
        detail: '${lignes.length} ligne${lignes.length > 1 ? 's' : ''} · PDF',
        fin: Text(_detail ? '˄' : '›',
            style: ClCharte.texte(20, couleur: ClCharte.gris, hauteur: 1)),
        onTap: () => setState(() => _detail = !_detail),
      ),
      if (_detail) ...[
        _DevisLisible(devis),
        ClBouton('Télécharger le PDF',
            secondaire: true, onPressed: () => _pdf(texteSite(devis['titre']))),
      ],
      ClChamp(
        label: 'Votre nom',
        controller: _nom,
        onChanged: (_) => setState(() {}),
      ),
      if (texteSite(regles['retractation']).isNotEmpty)
        ClInfo(texteSite(regles['retractation'])),
      if (mention.isNotEmpty)
        ClCase(
          cochee: _mentionTva,
          onChanged: (v) => setState(() => _mentionTva = v),
          label: texteSite(mention['libelle']),
          detail: texteSite(mention['texte']),
        ),
      if (demarrage.isNotEmpty)
        ClCase(
          cochee: _demarrage,
          onChanged: (v) => setState(() => _demarrage = v),
          label: texteSite(demarrage['libelle']),
        ),
      ClCase(
        cochee: _accord,
        onChanged: (v) => setState(() => _accord = v),
        label: texteSite(regles['acceptation']),
      ),
      ClPaveSignature(
          controleur: _signature, libelle: 'Votre signature, au doigt'),
      if (_erreur.isNotEmpty) _message(),
      ClBouton('Signer le devis',
          charge: _envoi, onPressed: complet ? () => _signer(regles) : null),
      if (texteSite(regles['preuve']).isNotEmpty)
        ClNote(texteSite(regles['preuve'])),
    ];
  }

  // ─── Signé ──────────────────────────────────────────────────────────

  List<Widget> _ecranSigne(Map<String, dynamic> devis) {
    final apres = mapSite(_vue['apres']);
    final etapes = listeSite(apres['etapes']);
    final retractation = mapSite(devis['retractation']);
    final entreprise = texteSite(mapSite(devis['entreprise'])['nom']);
    return [
      Text("Merci, c'est signé.", style: ClCharte.titre(24)),
      if (texteSite(apres['texte']).isNotEmpty)
        Text(texteSite(apres['texte']), style: ClCharte.texte(14, hauteur: 1.5))
      else if (_exemplaire['envoye'] == true)
        Text(
            'Votre exemplaire et le formulaire de rétractation arrivent par '
            'e-mail.',
            style: ClCharte.texte(14, hauteur: 1.5)),
      ClRangee(
        icone: ClIcones.document,
        titre: texteSite(devis['titre']).replaceFirst('Devis', 'Devis signé'),
        detail: [
          if (entreprise.isNotEmpty) entreprise,
          '${texteSite(devis['totalTtc'])} TTC · PDF',
        ].join(' · '),
        onTap: () => _pdf(texteSite(devis['titre'])),
      ),
      if (etapes.isNotEmpty) ...[
        const ClSection('Et maintenant'),
        for (final e in etapes)
          ClRangee(titre: texteSite(e['titre']), detail: texteSite(e['texte'])),
      ],
      ClBouton('Suivre mon chantier', onPressed: _suivreChantier),
      ClBouton('Plus tard', secondaire: true, onPressed: _retour),
      if (retractation['etat'] == 'ouvert') ..._blocRetractation(retractation),
    ];
  }

  /// « Je changerai d'avis » : même bloc que la page du lien sur le site.
  List<Widget> _blocRetractation(Map<String, dynamic> r) {
    final lignes = ((r['formulaire'] is List) ? r['formulaire'] as List : [])
        .whereType<String>()
        .toList();
    return [
      Align(
        alignment: Alignment.centerLeft,
        child: ClLien("Je changerai d'avis : où est le formulaire ?",
            onTap: () => setState(() {
                  _retractation = !_retractation;
                  _confirmer = false;
                })),
      ),
      if (_retractation)
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: ClCharte.blanc,
            border: Border.all(color: ClCharte.ligne),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                  texteSite(r['jusquau']).isNotEmpty
                      ? texteSite(r['jusquau'])
                      : texteSite(r['texte']),
                  style: ClCharte.texte(13, graisse: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(
                  'Le formulaire est à la dernière page de votre exemplaire. '
                  "Vous pouvez aussi l'envoyer à l'entreprise, ou annuler ici.",
                  style: ClCharte.texte(13)),
              for (final (i, l) in lignes.indexed) ...[
                const SizedBox(height: 6),
                Text(l,
                    style: ClCharte.texte(13,
                        graisse: i == 0 ? FontWeight.w700 : FontWeight.w400)),
              ],
              const SizedBox(height: 10),
              if (_confirmer) ...[
                Text(
                    "Confirmez-vous l'annulation de ce devis ? L'entreprise en "
                    'sera prévenue et vous rembourse les sommes versées sous '
                    '14 jours.',
                    style: ClCharte.texte(13, hauteur: 1.45)),
                const SizedBox(height: 10),
                ClBouton('Garder le devis',
                    secondaire: true,
                    onPressed: () => setState(() => _confirmer = false)),
                const SizedBox(height: 8),
                ClBouton('Je me rétracte',
                    secondaire: true, charge: _envoi, onPressed: _retracter),
              ] else
                ClBouton('Me rétracter',
                    secondaire: true,
                    onPressed: () => setState(() => _confirmer = true)),
              if (_erreur.isNotEmpty) ...[
                const SizedBox(height: 8),
                _message(),
              ],
            ],
          ),
        ),
    ];
  }

  // ─── Annulé ─────────────────────────────────────────────────────────

  List<Widget> _ecranRetracte() {
    return [
      Text('Devis annulé', style: ClCharte.titre(24)),
      Text(
          "Vous vous êtes rétracté. L'entreprise est prévenue et vous "
          'rembourse les sommes versées sous 14 jours.',
          style: ClCharte.texte(14, hauteur: 1.5)),
      ClLien('Une question ? Aide Koji', onTap: () => _ecrire(_aideKoji)),
    ];
  }

  // ─── Lien non valide ────────────────────────────────────────────────

  List<Widget> _ecranInvalide() {
    final email = texteSite(_entreprise['email']).isNotEmpty
        ? texteSite(_entreprise['email'])
        : texteSite(mapSite(_quote['company'])['email']);
    final nom = texteSite(_entreprise['nom']).isNotEmpty
        ? texteSite(_entreprise['nom'])
        : texteSite(mapSite(_quote['company'])['name']);
    return [
      Text("Ce lien n'ouvre plus de devis", style: ClCharte.titre(24)),
      Text(
          'Déjà signé : votre exemplaire est dans vos e-mails. Expiré ou '
          'remplacé : demandez un nouveau lien à l\'entreprise.',
          style: ClCharte.texte(14, hauteur: 1.5)),
      const ClRangee(
          titre: 'Déjà signé ?',
          detail: 'Votre exemplaire vous a été envoyé par e-mail au moment '
              'de la signature.'),
      const ClRangee(
          titre: 'Lien expiré ?',
          detail: 'Un lien de signature vaut 30 jours, comme le devis. '
              "L'entreprise peut vous renvoyer le devis."),
      const ClRangee(
          titre: 'Nouvelle version ?',
          detail: 'Utilisez le lien et le mot de passe du dernier e-mail '
              'reçu ; les versions précédentes ne se signent plus.'),
      const ClInfo('Vous avez un compte Koji Client avec l\'e-mail donné à '
          "l'entreprise ? Le devis à signer y est aussi."),
      if (email.isNotEmpty)
        ClBouton(nom.isEmpty ? "Écrire à l'entreprise" : 'Écrire à $nom',
            secondaire: true, onPressed: () => _ecrire(email)),
      ClBouton('Se connecter à Koji Client',
          secondaire: true, onPressed: _suivreChantier),
      ClLien('Une question ? Aide Koji', onTap: () => _ecrire(_aideKoji)),
    ];
  }
}

/// Le devis lisible : lignes, totaux, l'entreprise (comme `.kc2-doc`).
class _DevisLisible extends StatelessWidget {
  const _DevisLisible(this.devis);

  final Map<String, dynamic> devis;

  @override
  Widget build(BuildContext context) {
    final gris = ClCharte.texte(12, couleur: ClCharte.gris);
    final ent = mapSite(devis['entreprise']);
    const filet = BorderSide(color: Color(0xFFEFEBE3));
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.ligne),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(texteSite(devis['titre']), style: ClCharte.titre(20)),
          Text(
              [texteSite(ent['nom']), texteSite(devis['date'])]
                  .where((t) => t.isNotEmpty)
                  .join(' · '),
              style: gris),
          if (texteSite(devis['objet']).isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(texteSite(devis['objet']), style: gris),
          ],
          const SizedBox(height: 10),
          for (final l in listeSite(devis['lignes']))
            Container(
              padding: const EdgeInsets.symmetric(vertical: 9),
              decoration: const BoxDecoration(border: Border(bottom: filet)),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(texteSite(l['libelle']),
                            style: ClCharte.texte(14)),
                        if ([texteSite(l['quantite']), texteSite(l['note'])]
                            .any((t) => t.isNotEmpty && t != '1'))
                          Text(
                              [texteSite(l['quantite']), texteSite(l['note'])]
                                  .where((t) => t.isNotEmpty && t != '1')
                                  .join(' · '),
                              style: gris),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(texteSite(l['montantHt']), style: ClCharte.texte(14)),
                ],
              ),
            ),
          const SizedBox(height: 12),
          for (final t in listeSite(devis['totaux']))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                children: [
                  Expanded(
                    child: Text(texteSite(t['libelle']),
                        textAlign: TextAlign.right,
                        style: ClCharte.texte(13, couleur: ClCharte.gris)),
                  ),
                  const SizedBox(width: 20),
                  Text(texteSite(t['montant']),
                      style: t['fort'] == true
                          ? ClCharte.titre(18)
                          : ClCharte.texte(13, graisse: FontWeight.w600)),
                ],
              ),
            ),
          if (texteSite(ent['detail']).isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(texteSite(ent['nom']),
                style: ClCharte.texte(13, graisse: FontWeight.w700)),
            Text(texteSite(ent['detail']), style: gris),
          ],
        ],
      ),
    );
  }
}
