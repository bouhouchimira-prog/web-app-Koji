import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/chantiers/nouveau_chantier.dart';
import 'package:koji/apps/entreprise/chantiers/pro_chantiers_screen.dart'
    show proChantiersProvider;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/core/message_erreur.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart'
    show userChantiersProvider;

/// Koji Pro, « Nouveau chantier » (retours du build 64, sprint 2) : l'ancien
/// formulaire (formes arrondies, bouton bleu) refait dans la nouvelle
/// direction artistique. Il sert à suivre dans Koji un chantier trouvé
/// ailleurs ; un devis signé crée son chantier tout seul.
///
/// Par rapport à l'ancien : le nom et le téléphone du client, des adresses
/// proposées pendant la saisie, l'erreur sous le champ concerné, et une
/// création par l'API du site (le client entre dans le carnet de contacts).
class ProNouveauChantierScreen extends ConsumerStatefulWidget {
  const ProNouveauChantierScreen({super.key, this.suggerer});

  /// Recherche d'adresses ; la Base Adresse Nationale par défaut.
  final SuggererAdresses? suggerer;

  @override
  ConsumerState<ProNouveauChantierScreen> createState() =>
      _ProNouveauChantierScreenState();
}

class _ProNouveauChantierScreenState
    extends ConsumerState<ProNouveauChantierScreen> {
  static const _rouge = Color(0xFFB3261E);

  final _reference = TextEditingController();
  final _rue = TextEditingController();
  final _codePostal = TextEditingController();
  final _ville = TextEditingController();
  final _clientNom = TextEditingController();
  final _clientTel = TextEditingController();
  final _clientEmail = TextEditingController();

  String _type = 'Maison';
  Map<String, String> _erreurs = const {};
  List<AdresseSuggeree> _adresses = const [];
  Timer? _attente;
  int _recherche = 0;
  bool _envoi = false;

  @override
  void dispose() {
    _attente?.cancel();
    for (final c in [
      _reference,
      _rue,
      _codePostal,
      _ville,
      _clientNom,
      _clientTel,
      _clientEmail
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  // Les propositions arrivent un court instant après la dernière frappe ;
  // une réponse plus ancienne que la saisie en cours est ignorée.
  void _chercherAdresse(String saisie) {
    _attente?.cancel();
    if (saisie.trim().length < 3) {
      if (_adresses.isNotEmpty) setState(() => _adresses = const []);
      return;
    }
    _attente = Timer(const Duration(milliseconds: 350), () async {
      final numero = ++_recherche;
      final trouvees =
          await (widget.suggerer ?? suggererAdressesBan).call(saisie);
      if (!mounted || numero != _recherche) return;
      setState(() => _adresses = trouvees);
    });
  }

  void _choisirAdresse(AdresseSuggeree a) {
    _attente?.cancel();
    _recherche++;
    setState(() {
      _rue.text = a.rue.isNotEmpty ? a.rue : a.libelle;
      if (a.codePostal.isNotEmpty) _codePostal.text = a.codePostal;
      if (a.ville.isNotEmpty) _ville.text = a.ville;
      _adresses = const [];
    });
    FocusManager.instance.primaryFocus?.unfocus();
  }

  Future<void> _creer() async {
    if (_envoi) return;
    final erreurs = erreursNouveauChantier(
      reference: _reference.text,
      email: _clientEmail.text,
      telephone: _clientTel.text,
    );
    setState(() => _erreurs = erreurs);
    if (erreurs.isNotEmpty) return;

    setState(() => _envoi = true);
    try {
      final projet = await ref.read(proKojiWebProvider).creerChantier(
            corpsNouveauChantier(
              reference: _reference.text,
              rue: _rue.text,
              codePostal: _codePostal.text,
              ville: _ville.text,
              typeDeBien: _type,
              clientNom: _clientNom.text,
              clientTelephone: _clientTel.text,
              clientEmail: _clientEmail.text,
            ),
          );
      if (!mounted) return;
      // La liste et la recherche voient le nouveau chantier tout de suite.
      ref.invalidate(proChantiersProvider);
      ref.invalidate(userChantiersProvider);
      // La fiche remplace le formulaire : le retour mène à la liste.
      context.pushReplacement('/chantier/dashboard', extra: {
        'id': '${projet['id'] ?? ''}',
        'titre': _reference.text.trim(),
        'client': _clientNom.text.trim(),
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _envoi = false;
        _erreurs = {
          'envoi': messageErreur(e,
              defaut:
                  "Le chantier n'a pas pu être créé. Vérifiez la connexion et réessayez."),
        };
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Bandeau sombre : l'heure et la batterie en clair.
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: da.page,
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _barre(da),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                children: [
                  Text(
                      'Pour suivre dans Koji un chantier trouvé ailleurs. Quand un client signe votre devis, son chantier se crée tout seul.',
                      style: da.text(13, color: da.grey)),
                  const SizedBox(height: 16),
                  _champ(da,
                      cle: 'reference',
                      label: 'Référence du chantier',
                      controle: _reference,
                      exemple: 'Loft Durand, cuisine',
                      majuscules: TextCapitalization.sentences),
                  _titre(da, 'Adresse du chantier'),
                  _champ(da,
                      cle: 'rue',
                      label: 'Numéro et rue',
                      controle: _rue,
                      exemple: '12 rue de Paris',
                      clavier: TextInputType.streetAddress,
                      surSaisie: _chercherAdresse),
                  if (_adresses.isNotEmpty) _propositions(da),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: 120,
                        child: _champ(da,
                            cle: 'codePostal',
                            label: 'Code postal',
                            controle: _codePostal,
                            exemple: '93100',
                            clavier: TextInputType.number),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _champ(da,
                            cle: 'ville',
                            label: 'Ville',
                            controle: _ville,
                            exemple: 'Montreuil',
                            majuscules: TextCapitalization.words),
                      ),
                    ],
                  ),
                  _titre(da, 'Client'),
                  _champ(da,
                      cle: 'clientNom',
                      label: 'Nom du client',
                      controle: _clientNom,
                      exemple: 'Marie Lefèvre',
                      majuscules: TextCapitalization.words),
                  _champ(da,
                      cle: 'telephone',
                      label: 'Téléphone',
                      controle: _clientTel,
                      exemple: '06 12 34 56 78',
                      clavier: TextInputType.phone),
                  _champ(da,
                      cle: 'email',
                      label: 'Adresse e-mail',
                      controle: _clientEmail,
                      exemple: 'client@exemple.fr',
                      clavier: TextInputType.emailAddress,
                      aide:
                          "C'est avec cette adresse que le client ouvrira et signera ses devis."),
                  _titre(da, 'Type de bien'),
                  _types(da),
                ],
              ),
            ),
            _pied(da),
          ],
        ),
      ),
    );
  }

  Widget _barre(ProDa da) => Container(
        color: const Color(0xFF171B1E),
        padding:
            EdgeInsets.fromLTRB(6, MediaQuery.paddingOf(context).top + 6, 16, 8),
        child: Row(
          children: [
            IconButton(
              tooltip: 'Retour',
              onPressed: () => context.canPop() ? context.pop() : context.go('/home'),
              icon: const Icon(Icons.chevron_left, color: Colors.white),
            ),
            Expanded(
              child: Text('Nouveau chantier',
                  style: da.text(15,
                      weight: FontWeight.w700,
                      color: const Color(0xFFF5F5F2))),
            ),
          ],
        ),
      );

  Widget _titre(ProDa da, String texte) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 10),
        child: Text(texte.toUpperCase(),
            style: da
                .text(11.5, weight: FontWeight.w600, color: da.grey)
                .copyWith(letterSpacing: 0.8)),
      );

  Widget _champ(
    ProDa da, {
    required String cle,
    required String label,
    required TextEditingController controle,
    String exemple = '',
    String aide = '',
    TextInputType? clavier,
    TextCapitalization majuscules = TextCapitalization.none,
    ValueChanged<String>? surSaisie,
  }) {
    final erreur = _erreurs[cle];
    OutlineInputBorder bord(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: c, width: w));
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: da.text(13, weight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: controle,
            keyboardType: clavier,
            textCapitalization: majuscules,
            autocorrect: clavier == null,
            style: da.text(15),
            onChanged: (v) {
              // L'erreur disparaît dès que l'artisan corrige le champ.
              if (erreur != null) {
                setState(() => _erreurs = {..._erreurs}..remove(cle));
              }
              surSaisie?.call(v);
            },
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: da.card,
              hintText: exemple,
              hintStyle: da.text(15, color: da.grey),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
              enabledBorder: bord(erreur == null ? da.frame : _rouge),
              focusedBorder: bord(erreur == null ? da.ink : _rouge, 2),
            ),
          ),
          if (erreur != null) ...[
            const SizedBox(height: 5),
            Text(erreur, style: da.text(12.5, color: _rouge)),
          ] else if (aide.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(aide, style: da.text(12, color: da.grey)),
          ],
        ],
      ),
    );
  }

  /// Adresses proposées sous « Numéro et rue ».
  Widget _propositions(ProDa da) => Container(
        margin: const EdgeInsets.only(bottom: 14),
        decoration: BoxDecoration(
          color: da.card,
          border: Border.all(color: da.frame),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final (i, a) in _adresses.indexed)
              InkWell(
                onTap: () => _choisirAdresse(a),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                  decoration: BoxDecoration(
                    border: i == 0
                        ? null
                        : Border(top: BorderSide(color: da.line)),
                  ),
                  child: Text(a.libelle, style: da.text(14)),
                ),
              ),
          ],
        ),
      );

  Widget _types(ProDa da) => Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final t in typesDeBien)
            Semantics(
              button: true,
              selected: t == _type,
              child: GestureDetector(
                onTap: () => setState(() => _type = t),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: t == _type ? da.ink : da.card,
                    border: Border.all(color: t == _type ? da.ink : da.frame),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Text(t,
                      style: da.text(14,
                          weight: FontWeight.w600,
                          color: t == _type ? da.card : da.ink)),
                ),
              ),
            ),
        ],
      );

  Widget _pied(ProDa da) => Container(
        decoration: BoxDecoration(
          color: da.card,
          border: Border(top: BorderSide(color: da.line)),
        ),
        padding: EdgeInsets.fromLTRB(
            16, 12, 16, 12 + MediaQuery.paddingOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_erreurs['envoi'] != null) ...[
              Text(_erreurs['envoi']!, style: da.text(13, color: _rouge)),
              const SizedBox(height: 8),
            ],
            ProPrimaryButton(
              label: _envoi ? 'Création…' : 'Créer le chantier',
              expand: true,
              onPressed: _envoi ? null : _creer,
            ),
          ],
        ),
      );
}
