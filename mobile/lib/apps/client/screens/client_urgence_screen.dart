import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart'
    show ClPrix, clientOuvrirFichierProvider;
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/features/urgences/urgences_logic.dart';

// Koji Client · commander une urgence (maquette PRO-17, écrans A à D) :
// A choisir l'urgence (encadré gaz), B deux questions, photo facultative,
// adresse et prix des artisans disponibles (jamais un prix Koji), C un
// artisan a accepté (confirmer ou annuler sans frais), D suivre son arrivée
// (Confirmée, En route, Sur place, Facture), puis devis avant travaux et
// facture de l'intervention. Données : /api/client/urgences du site.
// Gabarit web : app/client/urgence/[[...id]]/page.jsx.

const clientUrgenceRoute = '/client/urgence';
String clientUrgenceQuestionsRoute(String categorie) =>
    '/client/urgence/nouvelle/$categorie';
String clientUrgenceSuiviRoute(String id) => '/client/urgence/$id';

final urgencesClientRepositoryProvider = Provider<UrgencesClientRepository>(
    (ref) => UrgencesClientRepository(ref.watch(kojiWebApiClientProvider)));

String _erreur(Object e) =>
    e is KojiWebApiException ? e.message : 'Connexion impossible. Réessayez.';

void _retour(BuildContext context, [String repli = '/client-home']) {
  if (context.canPop()) {
    context.pop();
  } else {
    context.go(repli);
  }
}

Widget _connexion(BuildContext context) => ClEcran(
      titre: 'Urgence',
      sousTitre: 'connexion nécessaire',
      onRetour: () => _retour(context),
      corps: ClCorps(children: [
        const ClInfo('Connectez-vous à votre espace Koji pour commander une '
            'urgence : l\'artisan qui accepte reçoit votre adresse et votre '
            'téléphone quand vous confirmez.'),
        ClBouton('Se connecter',
            onPressed: () => context.push('/client/marketplace/login')),
      ]),
    );

// ── A · Choisir l'urgence ──────────────────────────────────────────────────

class ClientUrgenceScreen extends ConsumerStatefulWidget {
  const ClientUrgenceScreen({super.key, this.categorie});
  final String? categorie;
  @override
  ConsumerState<ClientUrgenceScreen> createState() =>
      _ClientUrgenceScreenState();
}

class _ClientUrgenceScreenState extends ConsumerState<ClientUrgenceScreen> {
  Map<String, dynamic>? _accueil;
  String _message = '';

  UrgencesClientRepository get _repo =>
      ref.read(urgencesClientRepositoryProvider);

  @override
  void initState() {
    super.initState();
    if (_repo.connecte) _charger();
  }

  Future<void> _charger() async {
    try {
      final a = await _repo.accueil();
      if (mounted) setState(() => _accueil = a);
    } catch (e) {
      if (mounted) setState(() => _message = _erreur(e));
    }
  }

  Future<Uint8List?> _photo() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
              title: const Text('Prendre une photo'),
              onTap: () => Navigator.pop(c, ImageSource.camera)),
          ListTile(
              title: const Text('Choisir dans la galerie'),
              onTap: () => Navigator.pop(c, ImageSource.gallery)),
        ]),
      ),
    );
    if (source == null) return null;
    final f = await ImagePicker()
        .pickImage(source: source, maxWidth: 1600, imageQuality: 80);
    return f?.readAsBytes();
  }

  @override
  Widget build(BuildContext context) {
    if (!_repo.connecte) return _connexion(context);
    final a = _accueil;
    if (a == null) {
      return ClEcran(
        titre: 'Urgence',
        sousTitre: 'un artisan chez vous rapidement',
        onRetour: () => _retour(context),
        corps: ClCorps(children: [
          _message.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: ClCharte.marine))
              : Text(_message, style: ClCharte.texte(14)),
        ]),
      );
    }
    final c = widget.categorie == null ? null : categorieUrgence(widget.categorie!);
    if (c == null) {
      final enCours = listeDe(a['urgences']).where((u) => u['enCours'] == true);
      return UrgenceChoixView(
        enCours: enCours.isEmpty ? null : enCours.first,
        onRetour: () => _retour(context),
        onChoisir: (id) => context.push(clientUrgenceQuestionsRoute(id)),
        onSuivre: (id) => context.push(clientUrgenceSuiviRoute(id)),
      );
    }
    return UrgenceQuestionsView(
      categorie: c,
      adresse: texteDe(a['adresse']),
      telephone: texteDe(a['telephone']),
      onRetour: () => _retour(context, clientUrgenceRoute),
      demanderPrix: (adresse) => _repo.prix(c.id, adresse),
      choisirPhoto: _photo,
      commander: (corps) async {
        final u = await _repo.agir({'action': 'commander', ...corps});
        if (context.mounted) {
          context.pushReplacement(clientUrgenceSuiviRoute(texteDe(u['id'])));
        }
      },
      onRendezVous: () => context.push('/client/marketplace/new'),
    );
  }
}

class UrgenceChoixView extends StatelessWidget {
  const UrgenceChoixView({
    super.key,
    required this.onChoisir,
    required this.onSuivre,
    this.onRetour,
    this.enCours,
  });

  final ValueChanged<String> onChoisir;
  final ValueChanged<String> onSuivre;
  final VoidCallback? onRetour;
  final Map<String, dynamic>? enCours;

  @override
  Widget build(BuildContext context) {
    final e = enCours;
    return ClEcran(
      titre: 'Urgence',
      sousTitre: 'un artisan chez vous rapidement',
      onRetour: onRetour,
      corps: ClCorps(children: [
        if (e != null)
          ClRangee(
            titre: texteDe(e['titre']),
            detail: 'urgence en cours',
            onTap: () => onSuivre(texteDe(e['id'])),
          ),
        const ClTitre('Que se passe-t-il ?'),
        LayoutBuilder(builder: (context, box) {
          final largeur = (box.maxWidth - 8) / 2;
          return Wrap(spacing: 8, runSpacing: 8, children: [
            for (final c in categoriesUrgence)
              SizedBox(
                width: largeur,
                child: Semantics(
                  button: true,
                  label: c.label,
                  excludeSemantics: true,
                  child: InkWell(
                    onTap: () => onChoisir(c.id),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 86),
                      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
                      decoration: BoxDecoration(
                          color: ClCharte.blanc,
                          border: Border.all(color: ClCharte.ligne)),
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            KojiIcon(c.icone, size: 24, color: ClCharte.marine),
                            const SizedBox(height: 10),
                            Text(c.label,
                                style: ClCharte.texte(14,
                                    graisse: FontWeight.w700)),
                          ]),
                    ),
                  ),
                ),
              ),
          ]);
        }),
        Container(
          color: ClCharte.marine,
          padding: const EdgeInsets.all(12),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const KojiIcon('M12 3l9 16H3zM12 10v4M12 17v.5',
                size: 20, color: ClCharte.blanc),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Odeur de gaz ?',
                        style: ClCharte.texte(14,
                            graisse: FontWeight.w700, couleur: ClCharte.blanc)),
                    const SizedBox(height: 2),
                    Text(texteGaz,
                        style: ClCharte.texte(12,
                            couleur: ClCharte.clair, hauteur: 1.4)),
                  ]),
            ),
          ]),
        ),
        Center(
          child: Text('Prix affiché avant de commander · artisans vérifiés par Koji',
              textAlign: TextAlign.center,
              style: ClCharte.texte(12, couleur: ClCharte.gris)),
        ),
      ]),
    );
  }
}

// ── B · 2 questions et le prix ─────────────────────────────────────────────

class UrgenceQuestionsView extends StatefulWidget {
  const UrgenceQuestionsView({
    super.key,
    required this.categorie,
    required this.demanderPrix,
    required this.commander,
    this.choisirPhoto,
    this.onRetour,
    this.onRendezVous,
    this.adresse = '',
    this.telephone = '',
    this.reponses = const {},
    this.prix,
  });

  final CategorieUrgence categorie;
  final Future<Map<String, dynamic>> Function(String adresse) demanderPrix;
  final Future<void> Function(Map<String, dynamic> corps) commander;
  final Future<Uint8List?> Function()? choisirPhoto;
  final VoidCallback? onRetour;
  final VoidCallback? onRendezVous;
  final String adresse;
  final String telephone;

  /// Réponses et prix déjà connus (images de référence).
  final Map<String, String> reponses;
  final Map<String, dynamic>? prix;

  @override
  State<UrgenceQuestionsView> createState() => _UrgenceQuestionsViewState();
}

class _UrgenceQuestionsViewState extends State<UrgenceQuestionsView> {
  late final Map<String, String> _reponses = {...widget.reponses};
  late final _adresse = TextEditingController(text: widget.adresse);
  final _complement = TextEditingController();
  late final _telephone = TextEditingController(text: widget.telephone);
  late Map<String, dynamic>? _prix = widget.prix;
  String _erreurPrix = '';
  String _probleme = '';
  Uint8List? _photo;
  bool _envoi = false;
  Timer? _attente;

  @override
  void initState() {
    super.initState();
    if (_prix == null && _adresse.text.trim().length >= 6) _chercherPrix();
  }

  @override
  void dispose() {
    _attente?.cancel();
    _adresse.dispose();
    _complement.dispose();
    _telephone.dispose();
    super.dispose();
  }

  void _adresseChangee(String _) {
    _attente?.cancel();
    _attente = Timer(const Duration(milliseconds: 800), _chercherPrix);
  }

  Future<void> _chercherPrix() async {
    final q = _adresse.text.trim();
    if (q.length < 6) return;
    try {
      final p = await widget.demanderPrix(q);
      if (mounted && _adresse.text.trim() == q) {
        setState(() {
          _prix = p;
          _erreurPrix = '';
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _prix = null;
          _erreurPrix = _erreur(e);
        });
      }
    }
  }

  Future<void> _ajouterPhoto() async {
    final b = await widget.choisirPhoto?.call();
    if (b == null || !mounted) return;
    if (!estJpeg(b)) {
      setState(() => _probleme = 'Photo illisible : prenez-la en JPEG.');
      return;
    }
    setState(() {
      _photo = b;
      _probleme = '';
    });
  }

  Future<void> _commander() async {
    setState(() {
      _envoi = true;
      _probleme = '';
    });
    try {
      await widget.commander({
        'categorie': widget.categorie.id,
        'reponses': _reponses,
        'adresse': _adresse.text.trim(),
        'complement': _complement.text.trim(),
        'telephone': _telephone.text.trim(),
        if (_photo != null) 'photo': dataUrlJpeg(_photo!),
      });
    } catch (e) {
      if (mounted) setState(() => _probleme = _erreur(e));
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.categorie;
    final prix = mapDe(_prix?['prix']);
    final disponibles = (_prix?['disponibles'] as num?)?.toInt() ?? 0;
    final possible = reponsesCompletes(c, _reponses) &&
        telephoneValide(_telephone.text) &&
        prix.isNotEmpty;
    return ClEcran(
      titre: c.label,
      sousTitre: '2 questions et c\'est parti',
      onRetour: widget.onRetour,
      corps: ClCorps(children: [
        for (final q in c.questions)
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(q.label,
                style: ClCharte.texte(15, graisse: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final o in q.options)
                _Choix(
                  o,
                  choisi: _reponses[q.id] == o,
                  onTap: () => setState(() => _reponses[q.id] = o),
                ),
            ]),
          ]),
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Semantics(
            button: true,
            label: _photo == null ? 'Ajouter une photo (facultatif)' : 'Changer la photo',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: widget.choisirPhoto == null ? null : _ajouterPhoto,
              child: Container(
                width: 110,
                height: 74,
                color: ClCharte.ligne,
                child: Stack(fit: StackFit.expand, children: [
                  if (_photo != null)
                    Image.memory(_photo!, fit: BoxFit.cover)
                  else
                    Center(
                        child: Text('+',
                            style: ClCharte.texte(28, couleur: ClCharte.gris))),
                  Positioned(
                    left: 6,
                    top: 6,
                    child: Container(
                      color: ClCharte.blanc,
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Text('PHOTO',
                          style: ClCharte.texte(10, graisse: FontWeight.w700)),
                    ),
                  ),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: ClChamp(
              label: 'Adresse',
              controller: _adresse,
              hint: 'Numéro, rue, ville',
              keyboardType: TextInputType.streetAddress,
              onChanged: _adresseChangee,
            ),
          ),
        ]),
        if (texteDe(_prix?['adresse']).isNotEmpty &&
            texteDe(_prix?['adresse']) != _adresse.text.trim())
          Text('Adresse retenue : ${texteDe(_prix?['adresse'])}',
              style: ClCharte.texte(12, couleur: ClCharte.gris)),
        ClChamp(
          label: 'Étage, code, accès (facultatif)',
          controller: _complement,
          hint: '3e gauche · code 4521B',
        ),
        if (widget.telephone.isEmpty)
          ClChamp(
            label: 'Téléphone',
            controller: _telephone,
            keyboardType: TextInputType.phone,
            onChanged: (_) => setState(() {}),
          ),
        Text(
            'Votre adresse exacte, l\'accès et votre téléphone ne sont donnés '
            'à l\'artisan qu\'après votre confirmation ; avant, il ne voit que '
            'le quartier.',
            style: ClCharte.texte(12, couleur: ClCharte.gris, hauteur: 1.4)),
        if (prix.isNotEmpty)
          ClPrix(
            titre: 'Prix d\'intervention',
            montant: texteDe(prix['montant']),
            detail: [texteDe(prix['detail']), texteDe(prix['note'])]
                .where((t) => t.isNotEmpty)
                .join('. '),
          )
        else if (_erreurPrix.isNotEmpty)
          ClInfo(_erreurPrix)
        else if (_prix != null && disponibles == 0) ...[
          const ClInfo('Aucun artisan n\'est disponible près de chez vous pour '
              'cette urgence en ce moment.'),
          if (widget.onRendezVous != null)
            ClLien('Décrire mon besoin pour un rendez-vous',
                onTap: widget.onRendezVous!),
        ] else
          Text('Indiquez votre adresse pour voir le prix des artisans disponibles.',
              style: ClCharte.texte(12, couleur: ClCharte.gris)),
        if (_probleme.isNotEmpty) ClInfo(_probleme),
      ]),
      bas: ClBouton('Trouver un artisan',
          charge: _envoi, onPressed: possible ? _commander : null),
    );
  }
}

class _Choix extends StatelessWidget {
  const _Choix(this.label, {required this.choisi, required this.onTap});
  final String label;
  final bool choisi;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      selected: choisi,
      button: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: choisi ? ClCharte.marine : ClCharte.blanc,
            border: Border.all(
                color: choisi ? ClCharte.marine : const Color(0xFFD8D2C6)),
          ),
          child: Text(label,
              style: ClCharte.texte(13,
                  graisse: choisi ? FontWeight.w600 : FontWeight.w400,
                  couleur: choisi ? ClCharte.blanc : ClCharte.marine)),
        ),
      ),
    );
  }
}

// ── C et D · une urgence ───────────────────────────────────────────────────

class ClientUrgenceSuiviScreen extends ConsumerStatefulWidget {
  const ClientUrgenceSuiviScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<ClientUrgenceSuiviScreen> createState() =>
      _ClientUrgenceSuiviScreenState();
}

class _ClientUrgenceSuiviScreenState
    extends ConsumerState<ClientUrgenceSuiviScreen> {
  Map<String, dynamic>? _u;
  String _message = '';
  String _occupe = '';
  Timer? _minuterie;
  String _etat = '';

  UrgencesClientRepository get _repo =>
      ref.read(urgencesClientRepositoryProvider);

  @override
  void initState() {
    super.initState();
    if (_repo.connecte) _charger();
  }

  @override
  void dispose() {
    _minuterie?.cancel();
    super.dispose();
  }

  void _planifier(String etat) {
    if (etat == _etat && _minuterie != null) return;
    _etat = etat;
    _minuterie?.cancel();
    _minuterie = null;
    if (etatsFinis.contains(etat)) return;
    _minuterie = Timer.periodic(intervalleSuivi(etat), (_) => _charger());
  }

  Future<void> _charger() async {
    try {
      final u = await _repo.une(widget.id);
      if (!mounted) return;
      setState(() => _u = u);
      _planifier(texteDe(u['etat']));
    } catch (e) {
      if (mounted) setState(() => _message = _erreur(e));
    }
  }

  Future<void> _agir(String action) async {
    if (action == 'annuler') {
      final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Annuler cette urgence ?'),
          content: const Text('C\'est sans frais.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Non')),
            TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Annuler l\'urgence')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() {
      _occupe = action;
      _message = '';
    });
    try {
      final u = await _repo.agir({'action': action, 'id': widget.id});
      if (!mounted) return;
      setState(() => _u = u);
      _planifier(texteDe(u['etat']));
    } catch (e) {
      if (mounted) setState(() => _message = _erreur(e));
    } finally {
      if (mounted) setState(() => _occupe = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_repo.connecte) return _connexion(context);
    final u = _u;
    if (u == null) {
      return ClEcran(
        titre: 'Urgence',
        onRetour: () => _retour(context),
        corps: ClCorps(children: [
          _message.isEmpty
              ? const Center(
                  child: CircularProgressIndicator(color: ClCharte.marine))
              : Text(_message, style: ClCharte.texte(14)),
        ]),
      );
    }
    return UrgenceSuiviView(
      urgence: u,
      message: _message,
      occupe: _occupe,
      onRetour: () => _retour(context),
      onAgir: _agir,
      onLien: (uri) => launchUrl(uri),
      onFacture: (chemin, titre) async {
        try {
          await ref.read(clientOuvrirFichierProvider)(chemin, titre);
        } catch (e) {
          if (mounted) setState(() => _message = _erreur(e));
        }
      },
      onNouvelle: () => context.pushReplacement(clientUrgenceRoute),
      onRendezVous: () => context.push('/client/marketplace/new'),
    );
  }
}

class UrgenceSuiviView extends StatelessWidget {
  const UrgenceSuiviView({
    super.key,
    required this.urgence,
    required this.onAgir,
    this.onRetour,
    this.onLien,
    this.onFacture,
    this.onNouvelle,
    this.onRendezVous,
    this.message = '',
    this.occupe = '',
  });

  final Map<String, dynamic> urgence;
  final ValueChanged<String> onAgir;
  final VoidCallback? onRetour;
  final void Function(Uri lien)? onLien;
  final void Function(String chemin, String titre)? onFacture;
  final VoidCallback? onNouvelle;
  final VoidCallback? onRendezVous;
  final String message;
  final String occupe;

  @override
  Widget build(BuildContext context) {
    final u = urgence;
    final etat = texteDe(u['etat']);
    final a = mapDe(u['artisan']);
    final actions = mapDe(u['actions']);
    final suivi = mapDe(u['suivi']);
    final annuler = actions['annuler'] == true
        ? Center(
            child: ClLien('Annuler sans frais',
                taille: 14, onTap: () => onAgir('annuler')),
          )
        : null;
    final erreur = message.isEmpty ? null : ClInfo(message);

    // C · Un artisan a accepté
    if (etat == 'acceptee' && a.isNotEmpty) {
      final avis = mapDe(a['avis']);
      final n = (a['urgences'] as num?)?.toInt() ?? 0;
      final note = [
        if (avis.isNotEmpty) texteDe(avis['moyenne']),
        if (n > 0) '$n urgence${n > 1 ? 's' : ''}',
        if (avis.isEmpty && n == 0) 'nouveau sur Koji Urgences',
      ].join(' · ');
      return ClEcran(
        titre: 'Un artisan a accepté',
        sousTitre: 'confirmez pour qu\'il parte',
        onRetour: onRetour,
        corps: ClCorps(children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: ClCharte.blanc, border: Border.all(color: ClCharte.ligne)),
            child: Row(children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                    color: ClCharte.marine, shape: BoxShape.circle),
                child: Text(texteDe(a['initiales']),
                    style: ClCharte.texte(15,
                        graisse: FontWeight.w700, couleur: ClCharte.blanc)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(texteDe(a['nom']),
                          style: ClCharte.texte(16, graisse: FontWeight.w700)),
                      const SizedBox(height: 3),
                      Row(children: [
                        if (avis.isNotEmpty) ...[
                          _Etoiles(texteDe(avis['moyenne'])),
                          const SizedBox(width: 6),
                        ],
                        Flexible(
                          child: Text(note,
                              style: ClCharte.texte(12, couleur: ClCharte.gris)),
                        ),
                      ]),
                    ]),
              ),
            ]),
          ),
          if (a['verifie'] == true)
            Row(children: [
              const KojiIcon('M4 12l5 5L20 6',
                  size: 14, color: ClCharte.marine, strokeWidth: 3),
              const SizedBox(width: 8),
              Expanded(
                child: Text('Identité, SIREN et assurance vérifiés par Koji',
                    style: ClCharte.texte(13)),
              ),
            ]),
          ClLigne('Arrivée', texteDe(a['arrivee'])),
          ClLigne('Prix', texteDe(a['prix'])),
          ClLigne('Pièces', texteDe(a['pieces'])),
          ClInfo(texteDe(a['info'])),
          if (erreur != null) erreur,
        ]),
        bas: Column(mainAxisSize: MainAxisSize.min, children: [
          ClBouton('Confirmer',
              charge: occupe == 'confirmer',
              onPressed: occupe.isEmpty ? () => onAgir('confirmer') : null),
          if (annuler != null) ...[const SizedBox(height: 8), annuler],
        ]),
      );
    }

    // D · Suivre son arrivée
    if (suivi.isNotEmpty && a.isNotEmpty) {
      final tel = texteDe(a['telephone']).replaceAll(RegExp(r'[^\d+]'), '');
      final devis = mapDe(u['devis']);
      final facture = mapDe(u['facture']);
      final etapes = listeDe(suivi['etapes']);
      return ClEcran(
        titre: texteDe(u['titre']),
        sousTitre: texteDe(a['entreprise']),
        onRetour: onRetour,
        corps: ClCorps(children: [
          ClTitre(texteDe(suivi['titre'])),
          if (texteDe(suivi['sousTitre']).isNotEmpty)
            Text(texteDe(suivi['sousTitre']),
                style: ClCharte.texte(13, couleur: ClCharte.gris)),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
                color: ClCharte.blanc, border: Border.all(color: ClCharte.ligne)),
            child: Wrap(runSpacing: 8, children: [
              for (final e in etapes)
                FractionallySizedBox(
                  widthFactor: .5,
                  child: Row(children: [
                    Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: e['fait'] == true ? ClCharte.marine : null,
                        border: Border.all(color: ClCharte.marine, width: 1.5),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(texteDe(e['libelle']), style: ClCharte.texte(13)),
                  ]),
                ),
            ]),
          ),
          if (tel.isNotEmpty && onLien != null)
            Row(children: [
              Expanded(
                  child: _BoutonContour('Appeler', 'M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
                      () => onLien!(Uri.parse('tel:$tel')))),
              const SizedBox(width: 8),
              Expanded(
                  child: _BoutonContour('Message', 'M4 5h16v11H9l-5 4z',
                      () => onLien!(Uri.parse('sms:$tel')))),
            ]),
          if (texteDe(suivi['note']).isNotEmpty) ClInfo(texteDe(suivi['note'])),
          if (devis.isNotEmpty) ...[
            const ClSection('Devis avant travaux signé'),
            for (final l in listeDe(devis['lignes']))
              ClLigne(texteDe(l['label']), euros2(l['montant'] as num? ?? 0)),
            ClLigne('Total TTC', euros2(devis['total'] as num? ?? 0)),
          ],
          if (facture.isNotEmpty && onFacture != null)
            ClBouton(
              'Facture ${texteDe(facture['numero'])} · ${euros2(facture['montant'] as num? ?? 0)}${facture['payee'] == true ? ' · payée' : ''}',
              secondaire: true,
              onPressed: () => onFacture!(texteDe(facture['pdf']), 'Facture ${texteDe(facture['numero'])}'),
            ),
          ClLigne('Adresse', texteDe(u['adresse'])),
          ClLigne('Prix annoncé', texteDe(a['prix'])),
          if (erreur != null) erreur,
          if (annuler != null) annuler,
        ]),
      );
    }

    // Recherche, aucun artisan, délai dépassé, annulée, terminée
    final (titre, sousTitre) = titreEtat(etat);
    final prix = mapDe(u['prix']);
    return ClEcran(
      titre: titre,
      sousTitre: sousTitre,
      onRetour: onRetour,
      corps: ClCorps(children: [
        Text(texteDe(u['message']), style: ClCharte.texte(14, hauteur: 1.5)),
        if (etat == 'recherche')
          Row(children: [
            const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: ClCharte.marine)),
            const SizedBox(width: 10),
            Expanded(
              child: Text('Un artisan accepte en général en quelques minutes.',
                  style: ClCharte.texte(13, couleur: ClCharte.gris)),
            ),
          ]),
        ClLigne('Urgence', texteDe(u['titre'])),
        ClLigne('Adresse', texteDe(u['adresse'])),
        if (prix.isNotEmpty)
          ClPrix(
              titre: 'Prix d\'intervention',
              montant: texteDe(prix['montant']),
              detail: texteDe(prix['detail'])),
        if (erreur != null) erreur,
        if (etat == 'sans_artisan' && onRendezVous != null)
          ClLien('Décrire mon besoin pour un rendez-vous', onTap: onRendezVous!),
        if (annuler != null) annuler,
      ]),
      bas: actions['relancer'] == true
          ? ClBouton('Relancer la recherche',
              charge: occupe == 'relancer',
              onPressed: occupe.isEmpty ? () => onAgir('relancer') : null)
          : (etat == 'annulee' || etat == 'terminee') && onNouvelle != null
              ? ClBouton('Commander une autre urgence', onPressed: onNouvelle)
              : null,
    );
  }
}

class _Etoiles extends StatelessWidget {
  const _Etoiles(this.moyenne);
  final String moyenne;
  @override
  Widget build(BuildContext context) {
    final n = (double.tryParse(moyenne.replaceAll(',', '.')) ?? 0).round();
    const etoile =
        'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var k = 0; k < 5; k++)
        Padding(
          padding: const EdgeInsets.only(right: 2),
          child: k < n
              ? SizedBox(
                  width: 13,
                  height: 13,
                  child: CustomPaint(painter: _EtoilePleine()),
                )
              : const KojiIcon(etoile,
                  size: 13, color: ClCharte.marine, strokeWidth: 1.6),
        ),
    ]);
  }
}

/// Étoile pleine (`.av-st i.on`) : même tracé, rempli de marine.
class _EtoilePleine extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24;
    final p = Path()
      ..moveTo(12 * s, 3 * s)
      ..lineTo(14.7 * s, 8.6 * s)
      ..lineTo(20.8 * s, 9.5 * s)
      ..lineTo(16.4 * s, 13.8 * s)
      ..lineTo(17.4 * s, 19.9 * s)
      ..lineTo(12 * s, 17 * s)
      ..lineTo(6.6 * s, 19.9 * s)
      ..lineTo(7.6 * s, 13.8 * s)
      ..lineTo(3.2 * s, 9.5 * s)
      ..lineTo(9.3 * s, 8.6 * s)
      ..close();
    canvas.drawPath(p, Paint()..color = ClCharte.marine);
  }

  @override
  bool shouldRepaint(_EtoilePleine old) => false;
}

class _BoutonContour extends StatelessWidget {
  const _BoutonContour(this.label, this.icone, this.onTap);
  final String label;
  final String icone;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: 46,
          decoration: BoxDecoration(border: Border.all(color: ClCharte.marine)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            KojiIcon(icone, size: 16, color: ClCharte.marine),
            const SizedBox(width: 8),
            Text(label, style: ClCharte.texte(14, graisse: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}
