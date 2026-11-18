import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_shell.dart';
import 'package:koji/apps/client/client_signature_pad.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

const _onglets = [
  ('devis', 'Devis'),
  ('chantier', 'Chantier'),
  ('paiements', 'Paiements'),
  ('documents', 'Documents'),
];

// Pictogrammes de la maquette (`.cl-row .ic`).
const _icMaison = 'M4 20h16M6 20V9l6-4 6 4v11';
const _icPhoto =
    'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z';
const _icMessage = 'M4 5h16v11H9l-5 4z';

/// Koji Client · « signer, suivre, payer » (maquette CLI-02) : un devis ou un
/// chantier du site (GET /api/client/chantier/{quoteId}) en quatre onglets.
/// Devis : le devis lisible, puis la signature dans l'app (cases non
/// cochées, signature au doigt, un seul bouton marine). Chantier :
/// avancement, étapes, signaler, écrire. Paiements : factures, sans paiement
/// en ligne. Documents : chaque fichier s'ouvre avec la session du site.
/// Gabarit web : app/client/chantier/[id]/page.jsx ; mêmes libellés.
class ClientDevisChantierScreen extends ConsumerStatefulWidget {
  const ClientDevisChantierScreen({
    super.key,
    required this.quoteId,
    this.onglet,
  });

  final String quoteId;

  /// « ?onglet=devis|chantier|paiements|documents » ; sinon celui du site.
  final String? onglet;

  @override
  ConsumerState<ClientDevisChantierScreen> createState() =>
      _ClientDevisChantierScreenState();
}

class _ClientDevisChantierScreenState
    extends ConsumerState<ClientDevisChantierScreen> {
  String? _onglet;

  /// Vue renvoyée par la signature : elle remplace celle du chargement.
  Map<String, dynamic>? _vueSignee;
  String _merci = '';
  bool _detail = false;
  bool _ecarts = false;

  // Signature (cases jamais cochées d'avance).
  bool _mentionTva = false;
  bool _demarrage = false;
  bool _accord = false;
  final _signature = ClSignatureControleur();
  bool _envoi = false;
  String _erreur = '';

  // « Signaler quelque chose ».
  bool _signaler = false;
  final _message = TextEditingController();
  bool _envoiAlerte = false;
  String _etatAlerte = '';

  @override
  void initState() {
    super.initState();
    final demande = widget.onglet;
    if (_onglets.any((o) => o.$1 == demande)) _onglet = demande;
    _signature.addListener(_rafraichir);
  }

  void _rafraichir() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _signature.removeListener(_rafraichir);
    _signature.dispose();
    _message.dispose();
    super.dispose();
  }

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/client-home');
    }
  }

  void _dire(String texte) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texte)));
  }

  Future<void> _ouvrirFichier(String chemin, String titre) async {
    try {
      await ref.read(clientOuvrirFichierProvider)(chemin, titre);
    } catch (err) {
      _dire(err is KojiWebApiException
          ? err.message
          : "Impossible d'ouvrir le document.");
    }
  }

  /// « Écrire à l'entreprise » : la conversation de la demande dans
  /// Messages, sinon l'e-mail de l'entreprise.
  Future<void> _contacter(Map<String, dynamic> contact) async {
    final lien = texteSite(contact['lien']);
    final route = contact['externe'] == true ? null : routeAppDuLienSite(lien);
    if (route != null) {
      context.push(route);
      return;
    }
    final uri = Uri.tryParse(
        lien.startsWith('/') ? '${KojiWebApiConfig.baseUrl}$lien' : lien);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      _dire("Impossible d'ouvrir le contact de l'entreprise.");
    }
  }

  Future<void> _actualiser() async {
    setState(() => _vueSignee = null);
    ref.invalidate(clientChantierSiteProvider(widget.quoteId));
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
      final reponse =
          await ref.read(marketplaceRepositoryProvider).signerDevisClient(
                widget.quoteId,
                mentionTva: regles['mentionTva'] != null && _mentionTva,
                demandeExpresse: regles['demarrage'] != null && _demarrage,
                consent: _accord,
                signature: image,
              );
      final exemplaire = mapSite(reponse['exemplaire']);
      final vue = reponse['vue'];
      if (!mounted) return;
      setState(() {
        if (vue is Map<String, dynamic>) _vueSignee = vue;
        _onglet = 'devis';
        _merci = "Merci, c'est signé."
            '${exemplaire['envoye'] == true ? ' Votre exemplaire part par e-mail.' : ''}';
      });
      if (vue is! Map<String, dynamic>) {
        ref.invalidate(clientChantierSiteProvider(widget.quoteId));
      }
      ref.invalidate(clientProjetsProvider);
    } catch (err) {
      if (!mounted) return;
      setState(() => _erreur = err is KojiWebApiException
          ? err.message
          : "La signature n'a pas pu être enregistrée.");
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _envoyerAlerte(Map<String, dynamic> vue) async {
    final texte = _message.text.trim();
    if (texte.isEmpty || _envoiAlerte) return;
    setState(() {
      _envoiAlerte = true;
      _etatAlerte = '';
    });
    try {
      await ref.read(marketplaceRepositoryProvider).signalerChantier(
            quoteId: widget.quoteId,
            projectId: texteSite(vue['projectId']),
            message: texte,
          );
      _message.clear();
      if (mounted) setState(() => _etatAlerte = 'envoye');
    } catch (_) {
      if (mounted) setState(() => _etatAlerte = 'erreur');
    } finally {
      if (mounted) setState(() => _envoiAlerte = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
      // Ouvert sans session du site : « Retrouver mon projet » d'abord.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/client/marketplace/login');
      });
      return const Scaffold(
        backgroundColor: ClCharte.riz,
        body: Center(
          child: CircularProgressIndicator(
              strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    }

    final provider = clientChantierSiteProvider(widget.quoteId);
    final async = ref.watch(provider);
    final vue = _vueSignee ?? async.valueOrNull;

    if (vue == null) {
      return ClEcran(
        titre: async.hasError ? _titreErreur(async.error) : 'Chantier',
        onRetour: _retour,
        corps: async.hasError
            ? ClCorps(children: _erreurChargement(async.error))
            : const Center(
                child: SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: ClCharte.marine),
                ),
              ),
      );
    }

    final devis = mapSite(vue['devis']);
    final onglet = _onglet ??
        (_onglets.any((o) => o.$1 == vue['ongletParDefaut'])
            ? vue['ongletParDefaut'] as String
            : 'devis');
    final (titre, sousTitre) = _titres(vue, devis, onglet);
    final sansBarre = onglet == 'devis' && devis['etat'] == 'a_signer';

    final blocs = switch (onglet) {
      'chantier' => _ongletChantier(vue),
      'paiements' => _ongletPaiements(vue),
      'documents' => _ongletDocuments(vue),
      _ => _ongletDevis(vue, devis),
    };

    final page = Scaffold(
      backgroundColor: ClCharte.riz,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClBarre(titre: titre, sousTitre: sousTitre, onRetour: _retour),
          ClOnglets(
            onglets: _onglets,
            actif: onglet,
            onChoisir: (cle) => setState(() => _onglet = cle),
          ),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: ClLargeur(
                child: ClCorps(
                  key: PageStorageKey('cli02-$onglet'),
                  onRefresh: _actualiser,
                  children: blocs,
                ),
              ),
            ),
          ),
        ],
      ),
    );

    // Téléphone : la barre du bas, sauf pendant la signature (maquette).
    final telephone = MediaQuery.sizeOf(context).width < KojiBreakpoints.wide;
    if (!telephone || sansBarre) return page;
    return ClientPageAvecBarre(
      onglet: onglet == 'paiements' ? '/client/paiements' : '/client-home',
      child: page,
    );
  }

  String _titreErreur(Object? err) =>
      err is KojiWebApiException && err.statusCode == 404
          ? 'Devis introuvable'
          : 'Chantier';

  List<Widget> _erreurChargement(Object? err) {
    if (err is KojiWebApiException && err.statusCode == 404) {
      return [
        Text("Ce devis n'existe pas, ou il n'est pas rattaché à votre compte.",
            style: ClCharte.texte(14, hauteur: 1.5)),
        ClBouton('Retour à mes projets',
            secondaire: true, onPressed: () => context.go('/client-home')),
      ];
    }
    if (err is KojiWebApiException && err.statusCode == 401) {
      return [
        Text(
            'Votre session a expiré. Connectez-vous pour retrouver votre '
            'chantier.',
            style: ClCharte.texte(14, hauteur: 1.5)),
        ClBouton('Se connecter',
            onPressed: () => context.go('/client/marketplace/login')),
      ];
    }
    return [
      Text("Le chantier n'a pas pu être chargé.",
          style: ClCharte.texte(14, couleur: ClCharte.gris)),
      ClBouton('Réessayer',
          secondaire: true,
          onPressed: () =>
              ref.invalidate(clientChantierSiteProvider(widget.quoteId))),
    ];
  }

  /// Titre et sous-titre de la barre, onglet par onglet (comme le site).
  (String, String) _titres(
      Map<String, dynamic> vue, Map<String, dynamic> devis, String onglet) {
    final titreVue = texteSite(vue['titre']);
    switch (onglet) {
      case 'chantier':
        final titreChantier = texteSite(mapSite(vue['chantier'])['titre']);
        const prefixe = 'Votre chantier · ';
        final suite = titreChantier.startsWith(prefixe)
            ? titreChantier.substring(prefixe.length)
            : '';
        return (
          'Votre chantier',
          [titreVue, suite].where((t) => t.isNotEmpty).join(' · ')
        );
      case 'paiements':
        return ('Paiements', titreVue);
      case 'documents':
        return ('Documents', titreVue);
      default:
        final version = devis['version'] is num ? devis['version'] as num : 1;
        final titreEcran = texteSite(devis['titreEcran']);
        return (
          titreEcran.isEmpty ? 'Devis' : titreEcran,
          '${texteSite(vue['entreprise'])}${version > 1 ? ' · version $version' : ''}'
        );
    }
  }

  // ─── Devis ──────────────────────────────────────────────────────────

  List<Widget> _ongletDevis(
      Map<String, dynamic> vue, Map<String, dynamic> devis) {
    final acompte = mapSite(devis['acompte']);
    final changements = mapSite(devis['changements']);
    final version = devis['version'] is num ? devis['version'] as num : 1;
    final lignes = listeSite(devis['lignes']);
    final regles = mapSite(devis['signature']);
    final aSigner = devis['etat'] == 'a_signer' && regles.isNotEmpty;
    final contact = mapSite(vue['contact']);
    final entreprise = texteSite(vue['entreprise']);

    return [
      ClPrix(
        titre: texteSite(vue['titre']),
        montant: '${texteSite(devis['totalTtc'])} TTC',
        detail: acompte.isNotEmpty
            ? '${texteSite(acompte['detail']).split(' · ').first} : '
                '${texteSite(acompte['montant'])}'
            : texteSite(devis['titre']),
        lien: changements.isEmpty
            ? ''
            : 'ce qui change depuis la version ${version - 1}',
        onLien: () => setState(() {
          _detail = true;
          _ecarts = true;
        }),
      ),
      ClRangee(
        icone: ClIcones.document,
        titre: _detail ? 'Masquer le détail du devis' : 'Lire le devis complet',
        detail: '${lignes.length} ligne${lignes.length > 1 ? 's' : ''} · '
            '${texteSite(devis['titre'])}',
        fin: Text(_detail ? '˄' : '›',
            style: ClCharte.texte(20, couleur: ClCharte.gris, hauteur: 1)),
        onTap: () => setState(() => _detail = !_detail),
      ),
      if (_detail)
        _DocDevis(
          devis: devis,
          entreprise: entreprise,
          ecarts: _ecarts,
          onEcarts: () => setState(() => _ecarts = !_ecarts),
        ),
      if (aSigner)
        ..._formulaireSignature(regles, contact, entreprise)
      else ...[
        if (_merci.isNotEmpty) ClInfo(_merci),
        if (texteSite(mapSite(devis['retractation'])['texte']).isNotEmpty)
          ClInfo(texteSite(mapSite(devis['retractation'])['texte'])),
        if (devis['etat'] == 'autre')
          const ClInfo("Ce devis n'est pas encore envoyé pour signature par "
              "l'entreprise."),
        if (texteSite(devis['pdf']).isNotEmpty)
          ClBouton(
            devis['etat'] == 'signe'
                ? 'Télécharger le devis signé'
                : 'Télécharger le devis',
            onPressed: () => _ouvrirFichier(
                texteSite(devis['pdf']), texteSite(devis['titre'])),
          ),
        if (contact.isNotEmpty)
          ClBouton("Poser une question à l'entreprise",
              secondaire: true, onPressed: () => _contacter(contact)),
        if (devis['etat'] == 'signe')
          ClNote('Le devis est établi et signé avec $entreprise. Koji '
              'conserve la preuve de signature (date, heure, appareil).'),
      ],
    ];
  }

  List<Widget> _formulaireSignature(Map<String, dynamic> regles,
      Map<String, dynamic> contact, String entreprise) {
    final retractation = texteSite(regles['retractation']);
    final mention = mapSite(regles['mentionTva']);
    final demarrage = mapSite(regles['demarrage']);
    final complet = _accord &&
        (mention.isEmpty || _mentionTva) &&
        !_signature.vide;
    return [
      if (retractation.isNotEmpty) ClInfo(retractation),
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
      ClPaveSignature(controleur: _signature),
      if (_erreur.isNotEmpty)
        Semantics(
          liveRegion: true,
          child: Text(_erreur,
              style: ClCharte.texte(13, graisse: FontWeight.w600)),
        ),
      ClBouton('Signer le devis',
          charge: _envoi,
          onPressed: complet ? () => _signer(regles) : null),
      if (contact.isNotEmpty)
        ClBouton("Poser une question à l'entreprise",
            secondaire: true, onPressed: () => _contacter(contact)),
      ClNote('Le devis est établi et signé avec $entreprise. '
          '${texteSite(regles['preuve'])}'),
    ];
  }

  // ─── Chantier ───────────────────────────────────────────────────────

  List<Widget> _ongletChantier(Map<String, dynamic> vue) {
    final c = mapSite(vue['chantier']);
    if (c.isEmpty) {
      return const [
        ClVide('Le suivi du chantier commence après la signature du devis.'),
      ];
    }
    final avancement = mapSite(c['avancement']);
    final pourcent =
        ((avancement['pourcent'] is num ? avancement['pourcent'] as num : 0)
                    .clamp(0, 100) /
                100)
            .toDouble();
    final prochaine = mapSite(c['prochaine']);
    final signaler = mapSite(c['signaler']);
    final contact = mapSite(vue['contact']);
    final etapes = listeSite(c['etapes']);
    return [
      Semantics(
        label: 'Avancement',
        value: '${(pourcent * 100).round()} %',
        child: Container(
          height: 6,
          color: ClCharte.ligne,
          alignment: Alignment.centerLeft,
          child: FractionallySizedBox(
            widthFactor: pourcent,
            child: const ColoredBox(
                color: ClCharte.marine, child: SizedBox.expand()),
          ),
        ),
      ),
      Text(texteSite(avancement['texte']),
          style: ClCharte.texte(12, couleur: ClCharte.gris)),
      if (prochaine.isNotEmpty)
        ClRangee(
          icone: _icMaison,
          titre: texteSite(prochaine['titre']),
          detail: texteSite(prochaine['texte']),
        ),
      // Après la réception, une réserve se signale avec la fin de chantier,
      // que l'app n'a pas encore : seule l'alerte d'avant la réception.
      if (signaler['mode'] == 'alerte')
        _signaler
            ? _formulaireAlerte(vue)
            : ClRangee(
                icone: _icPhoto,
                titre: 'Signaler quelque chose',
                detail: texteSite(signaler['sousTitre']),
                onTap: () => setState(() {
                  _signaler = true;
                  _etatAlerte = '';
                }),
              ),
      if (contact.isNotEmpty)
        ClRangee(
          icone: _icMessage,
          titre: "Écrire à l'entreprise",
          detail: texteSite(contact['sousTitre']),
          onTap: () => _contacter(contact),
        ),
      if (etapes.isNotEmpty) _Etapes(etapes),
    ];
  }

  Widget _formulaireAlerte(Map<String, dynamic> vue) {
    final fermer = ClBouton('Fermer',
        secondaire: true, onPressed: () => setState(() => _signaler = false));
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.marine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: _etatAlerte == 'envoye'
            ? [
                ClInfo("C'est envoyé : ${texteSite(vue['entreprise'])} est "
                    'prévenue et vous répond.'),
                const SizedBox(height: 10),
                fermer,
              ]
            : [
                ClChamp(
                  label: 'Votre message',
                  controller: _message,
                  maxLines: 3,
                  hint: 'Ce que vous avez remarqué, où, depuis quand.',
                  onChanged: (_) => setState(() {}),
                ),
                if (_etatAlerte == 'erreur') ...[
                  const SizedBox(height: 8),
                  Text("Le message n'est pas parti. Réessayez.",
                      style: ClCharte.texte(13, graisse: FontWeight.w600)),
                ],
                const SizedBox(height: 10),
                ClBouton('Envoyer',
                    charge: _envoiAlerte,
                    onPressed: _message.text.trim().isEmpty
                        ? null
                        : () => _envoyerAlerte(vue)),
                const SizedBox(height: 10),
                ClBouton('Annuler',
                    secondaire: true,
                    onPressed: () => setState(() => _signaler = false)),
              ],
      ),
    );
  }

  // ─── Paiements ──────────────────────────────────────────────────────

  List<Widget> _ongletPaiements(Map<String, dynamic> vue) {
    final p = mapSite(vue['paiements']);
    final aPayer = mapSite(p['aPayer']);
    return [
      ...clListePaiements(p, ouvrir: _ouvrirFichier),
      if (aPayer.isNotEmpty) ...[
        ClPrix(
          titre: texteSite(aPayer['titre']),
          montant: texteSite(aPayer['montant']),
          detail: texteSite(aPayer['detail']),
        ),
        if (texteSite(aPayer['pdf']).isNotEmpty)
          ClBouton('Télécharger la facture',
              onPressed: () => _ouvrirFichier(
                  texteSite(aPayer['pdf']), texteSite(aPayer['detail']))),
      ] else if (listeSite(p['lignes']).isNotEmpty)
        const ClInfo('Rien à payer pour le moment.'),
      if (texteSite(p['note']).isNotEmpty) ClNote(texteSite(p['note'])),
    ];
  }

  // ─── Documents ──────────────────────────────────────────────────────

  List<Widget> _ongletDocuments(Map<String, dynamic> vue) {
    final docs = mapSite(vue['documents']);
    return [
      for (final d in listeSite(docs['liste']))
        texteSite(d['lien']).isEmpty
            ? Opacity(
                opacity: 0.75,
                child: ClRangee(
                  icone: ClIcones.document,
                  titre: texteSite(d['titre']),
                  detail: texteSite(d['detail']),
                ),
              )
            : ClRangee(
                icone: ClIcones.document,
                titre: texteSite(d['titre']),
                detail: texteSite(d['detail']),
                onTap: () => _ouvrirFichier(
                    texteSite(d['lien']), texteSite(d['titre'])),
              ),
      if (texteSite(docs['note']).isNotEmpty) ClNote(texteSite(docs['note'])),
    ];
  }
}

/// Le devis lisible en entier (`.cw-doc`) : lignes regroupées par lot,
/// totaux, ce qui change depuis la version précédente, l'entreprise.
class _DocDevis extends StatelessWidget {
  const _DocDevis({
    required this.devis,
    required this.entreprise,
    required this.ecarts,
    required this.onEcarts,
  });

  final Map<String, dynamic> devis;
  final String entreprise;
  final bool ecarts;
  final VoidCallback onEcarts;

  @override
  Widget build(BuildContext context) {
    final lignes = listeSite(devis['lignes']);
    final lots = <String>[];
    for (final l in lignes) {
      final lot = texteSite(l['lot']);
      if (lot.isNotEmpty && !lots.contains(lot)) lots.add(lot);
    }
    final parLot = lots.length > 1;
    final changements = mapSite(devis['changements']);
    final ent = mapSite(devis['entreprise']);
    final gris = ClCharte.texte(12, couleur: ClCharte.gris);
    const filet = BorderSide(color: Color(0xFFEFEBE3));

    Widget ligne(Map<String, dynamic> l) {
      final note = texteSite(l['note']);
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: const BoxDecoration(border: Border(bottom: filet)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(texteSite(l['libelle']), style: ClCharte.texte(14)),
                  if (note.isNotEmpty) Text(note, style: gris),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(texteSite(l['montantHt']), style: ClCharte.texte(14)),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.ligne),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.only(bottom: 10),
            decoration: const BoxDecoration(
              border: Border(
                  bottom: BorderSide(color: ClCharte.marine, width: 2)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(texteSite(devis['titre']), style: ClCharte.titre(20)),
                Text(
                  [
                    entreprise,
                    texteSite(devis['date']),
                    texteSite(devis['validite']),
                  ].where((t) => t.isNotEmpty).join(' · '),
                  style: ClCharte.texte(13, couleur: ClCharte.gris),
                ),
              ],
            ),
          ),
          if (texteSite(devis['objet']).isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(texteSite(devis['objet']), style: gris),
          ],
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.symmetric(vertical: 6),
            decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: ClCharte.ligne))),
            child: Row(
              children: [
                Expanded(
                    child: Text('Travaux',
                        style: gris.copyWith(fontWeight: FontWeight.w600))),
                Text('Montant HT',
                    style: gris.copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          if (parLot)
            for (final lot in lots) ...[
              Container(
                padding: const EdgeInsets.only(top: 14, bottom: 4),
                decoration: const BoxDecoration(
                    border: Border(bottom: BorderSide(color: ClCharte.ligne))),
                child: Text(lot,
                    style: ClCharte.texte(12, graisse: FontWeight.w700)),
              ),
              for (final l in lignes.where((l) => texteSite(l['lot']) == lot))
                ligne(l),
            ]
          else
            for (final l in lignes) ligne(l),
          const SizedBox(height: 14),
          for (final t in listeSite(devis['totaux']))
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(
                    child: Text(texteSite(t['libelle']),
                        textAlign: TextAlign.right,
                        style: ClCharte.texte(14, couleur: ClCharte.gris)),
                  ),
                  const SizedBox(width: 24),
                  Text(
                    texteSite(t['montant']),
                    style: t['fort'] == true
                        ? ClCharte.titre(20)
                        : ClCharte.texte(14, graisse: FontWeight.w600),
                  ),
                ],
              ),
            ),
          if (changements.isNotEmpty) ...[
            const SizedBox(height: 8),
            ClLien(texteSite(changements['texte']), taille: 14, onTap: onEcarts),
            if (ecarts) ...[
              const SizedBox(height: 8),
              _Ecarts(changements),
            ],
          ],
          if (texteSite(ent['detail']).isNotEmpty) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.only(top: 12),
              decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: ClCharte.ligne))),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(texteSite(ent['nom']),
                      style: ClCharte.texte(13, graisse: FontWeight.w700)),
                  Text(texteSite(ent['detail']), style: gris),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Écarts avec la version précédente (`.kc2-ecarts`).
class _Ecarts extends StatelessWidget {
  const _Ecarts(this.changements);

  final Map<String, dynamic> changements;

  @override
  Widget build(BuildContext context) {
    final avant = mapSite(changements['avant']);
    Widget rangee(Widget gauche, String droite) => Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: gauche),
              const SizedBox(width: 12),
              Text('$droite TTC',
                  style: ClCharte.texte(13, graisse: FontWeight.w700)),
            ],
          ),
        );
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 6),
      decoration: BoxDecoration(
        color: ClCharte.riz,
        border: Border.all(color: ClCharte.ligne),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final l in listeSite(changements['lignes']))
            rangee(
              Text.rich(
                TextSpan(children: [
                  WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                          border: Border.all(color: ClCharte.marine)),
                      child: Text(texteSite(l['type']),
                          style: ClCharte.texte(11, graisse: FontWeight.w700)),
                    ),
                  ),
                  TextSpan(text: texteSite(l['libelle'])),
                ]),
                style: ClCharte.texte(13),
              ),
              texteSite(l['ecart']),
            ),
          if (avant.isNotEmpty)
            rangee(Text(texteSite(avant['titre']), style: ClCharte.texte(13)),
                texteSite(avant['total'])),
          if (texteSite(changements['note']).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(texteSite(changements['note']),
                  style: ClCharte.texte(12, couleur: ClCharte.gris)),
            ),
        ],
      ),
    );
  }
}

/// Étapes du chantier (`.cw-steps`) : faite (rond marine et coche), en
/// cours (rond sable), à venir (numéro).
class _Etapes extends StatelessWidget {
  const _Etapes(this.etapes);

  final List<Map<String, dynamic>> etapes;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: ClCharte.blanc,
        border: Border.all(color: ClCharte.ligne),
      ),
      child: Column(
        children: [
          for (final (i, e) in etapes.indexed)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                border: i == 0
                    ? null
                    : const Border(top: BorderSide(color: Color(0xFFEFEBE3))),
              ),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: switch (e['etat']) {
                        'fait' => ClCharte.marine,
                        'en_cours' => ClCharte.sable,
                        _ => null,
                      },
                      border: Border.all(color: ClCharte.marine, width: 1.5),
                    ),
                    child: e['etat'] == 'fait'
                        ? const KojiIcon(KojiIcons.check,
                            size: 14, color: ClCharte.blanc, strokeWidth: 3)
                        : Text('${i + 1}',
                            style: ClCharte.texte(13,
                                graisse: FontWeight.w700, hauteur: 1)),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(texteSite(e['titre']),
                            style:
                                ClCharte.texte(14, graisse: FontWeight.w700)),
                        if (texteSite(e['detail']).isNotEmpty)
                          Text(texteSite(e['detail']),
                              style: ClCharte.texte(12,
                                  couleur: ClCharte.gris)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
