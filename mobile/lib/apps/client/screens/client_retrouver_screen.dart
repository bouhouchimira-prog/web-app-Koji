import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/client/screens/client_profil_screen.dart'
    show masquerEmail;
import 'package:koji/design/koji_brand_marks.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

/// Texte affiché après chaque envoi, que l'adresse existe ou non.
const messageCodeEnvoye = "Si cette adresse correspond à un compte Koji, un "
    "code à 6 chiffres vient d'y être envoyé.";

const _pause = 60;
final _emailValide = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// Koji Client · « Retrouver mon projet » (maquette CLI-05) : l'adresse
/// e-mail, puis un code à 6 chiffres reçu par e-mail (pas de fournisseur
/// SMS), sans mot de passe. POST /api/auth/particulier-code puis
/// /api/auth/particulier-code/verifier, qui ouvre la même session que la
/// connexion par mot de passe (cookie `koji_portal_session`, gardé de la
/// même façon). Celle-ci reste accessible par un lien discret.
/// Gabarit web : components/RetrouverMonProjet.jsx.
class ClientRetrouverScreen extends ConsumerStatefulWidget {
  const ClientRetrouverScreen({super.key});

  @override
  ConsumerState<ClientRetrouverScreen> createState() =>
      _ClientRetrouverScreenState();
}

class _ClientRetrouverScreenState extends ConsumerState<ClientRetrouverScreen> {
  final _email = TextEditingController();
  final _code = TextEditingController();
  final _focusCode = FocusNode();
  bool _etapeCode = false;
  bool _envoi = false;
  String _erreur = '';
  String _info = '';
  int _attente = 0;
  Timer? _minuteur;

  @override
  void dispose() {
    _minuteur?.cancel();
    _email.dispose();
    _code.dispose();
    _focusCode.dispose();
    super.dispose();
  }

  void _compter() {
    _minuteur?.cancel();
    _attente = _pause;
    _minuteur = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _attente--);
      if (_attente <= 0) t.cancel();
    });
  }

  Future<void> _demander({bool renvoi = false}) async {
    final adresse = _email.text.trim();
    if (!_emailValide.hasMatch(adresse)) {
      setState(() => _erreur =
          "Saisissez l'adresse e-mail donnée en publiant votre demande.");
      return;
    }
    setState(() {
      _envoi = true;
      _erreur = '';
      _info = '';
    });
    try {
      await ref.read(kojiWebApiClientProvider).demanderCodeParticulier(adresse);
      if (!mounted) return;
      setState(() {
        _etapeCode = true;
        _code.clear();
        if (renvoi) {
          _info = 'Nouveau code envoyé. Le précédent ne fonctionne plus.';
        }
      });
      _compter();
      _focusCode.requestFocus();
    } catch (_) {
      if (mounted) {
        setState(() => _erreur =
            "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez.");
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _verifier() async {
    if (_code.text.length != 6 || _envoi) return;
    setState(() {
      _envoi = true;
      _erreur = '';
      _info = '';
    });
    try {
      await ref
          .read(kojiWebApiClientProvider)
          .connexionParCode(email: _email.text.trim(), code: _code.text);
      if (!mounted) return;
      ref.invalidate(clientProjetsProvider);
      ref.invalidate(clientNotificationsProvider);
      context.go('/client-home');
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _erreur = err is KojiWebApiException
            ? err.message
            : 'Code incorrect ou expiré.';
        _code.clear();
        _envoi = false;
      });
      _focusCode.requestFocus();
    }
  }

  void _changerAdresse() => setState(() {
        _etapeCode = false;
        _erreur = '';
        _info = '';
      });

  Future<void> _decrireProjet() async {
    try {
      await launchUrl(
        Uri.parse('${KojiWebApiConfig.baseUrl}'
            '/login?type=particulier&mode=inscription'),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("Impossible d'ouvrir le site Koji.")));
    }
  }

  void _motDePasse() => context.push('/client/connexion');

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_etapeCode,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _changerAdresse();
      },
      child: _etapeCode ? _ecranCode() : _ecranEmail(),
    );
  }

  /// Phrase grise (`.cl-s`) avec des liens soulignés dans le fil du texte :
  /// une chaîne est du texte, un couple (texte, action) un lien.
  Widget _phrase(List<Object> morceaux) {
    final gris = ClCharte.texte(12, couleur: ClCharte.gris, hauteur: 1.45);
    return Text.rich(
      TextSpan(children: [
        for (final m in morceaux)
          if (m is (String, VoidCallback))
            WidgetSpan(
              alignment: PlaceholderAlignment.baseline,
              baseline: TextBaseline.alphabetic,
              child: Semantics(
                link: true,
                child: GestureDetector(
                  onTap: m.$2,
                  behavior: HitTestBehavior.opaque,
                  child: Text(
                    m.$1,
                    style: ClCharte.texte(12, hauteur: 1.45).copyWith(
                      decoration: TextDecoration.underline,
                      decorationColor: ClCharte.marine,
                    ),
                  ),
                ),
              ),
            )
          else
            TextSpan(text: '$m'),
      ]),
      style: gris,
    );
  }

  Widget _erreurs() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_info.isNotEmpty) ClInfo(_info),
          if (_erreur.isNotEmpty)
            Semantics(
              liveRegion: true,
              child: Text(_erreur,
                  style: ClCharte.texte(13, graisse: FontWeight.w600)),
            ),
        ],
      );

  Widget _ecranEmail() {
    return Scaffold(
      backgroundColor: ClCharte.riz,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _Bandeau(),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: ClLargeur(
                child: ClCorps(children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Retrouver mon projet',
                        style: ClCharte.titre(22)),
                  ),
                  Text(
                      "L'adresse e-mail que vous avez donnée en publiant "
                      'votre demande. Vous recevez un code, pas de mot de '
                      'passe à retenir.',
                      style: ClCharte.texte(14, hauteur: 1.5)),
                  ClChamp(
                    label: 'Adresse e-mail',
                    controller: _email,
                    hint: 'vous@exemple.fr',
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.send,
                    onChanged: (_) => setState(() => _erreur = ''),
                    onSubmitted: (_) => _demander(),
                  ),
                  if (_erreur.isNotEmpty || _info.isNotEmpty) _erreurs(),
                  ClBouton('Recevoir un code',
                      charge: _envoi,
                      onPressed:
                          _email.text.trim().isEmpty ? null : _demander),
                  _phrase([
                    'Nouveau sur Koji ? ',
                    ('Décrire un projet', _decrireProjet),
                    ' : créez votre accès, puis décrivez vos travaux.',
                  ]),
                  // CLI-07 : le devis reçu par e-mail se signe dans l'app.
                  _phrase([
                    'Un devis à signer reçu par e-mail ? ',
                    (
                      "J'ai reçu un lien de signature",
                      () => context.push('/client/signature-lien')
                    ),
                    ' : il s\'ouvre ici, sans cette étape.',
                  ]),
                  _phrase([('Se connecter avec un mot de passe', _motDePasse)]),
                ]),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _ecranCode() {
    final adresse = _email.text.trim().toLowerCase();
    final masquee = masquerEmail(adresse);
    return ClEcran(
      titre: 'Code reçu',
      sousTitre: 'envoyé à ${masquee.isEmpty ? adresse : masquee}',
      onRetour: _changerAdresse,
      corps: ClCorps(children: [
        Text(messageCodeEnvoye, style: ClCharte.texte(14, hauteur: 1.5)),
        _CasesCode(
          controller: _code,
          focus: _focusCode,
          onChanged: (_) => setState(() => _erreur = ''),
          onComplet: _verifier,
        ),
        _phrase([
          'Valable 10 minutes · ',
          if (_attente > 0)
            'renvoyer dans $_attente s'
          else
            ('renvoyer', () => _demander(renvoi: true)),
          ' · ',
          ("changer d'adresse", _changerAdresse),
        ]),
        if (_erreur.isNotEmpty || _info.isNotEmpty) _erreurs(),
        ClBouton('Ouvrir mon projet',
            charge: _envoi,
            onPressed: _code.text.length == 6 ? _verifier : null),
        _phrase([
          'Rien reçu ? Regardez dans les indésirables, ou ',
          ('connectez-vous avec un mot de passe', _motDePasse),
          '.',
        ]),
      ]),
    );
  }
}

/// Bandeau du haut (`.cl-top`) : le mot-symbole sable, seul.
class _Bandeau extends StatelessWidget {
  const _Bandeau();

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Container(
        color: ClCharte.marine,
        padding: EdgeInsets.fromLTRB(
            16, MediaQuery.paddingOf(context).top + 18, 16, 18),
        alignment: Alignment.centerLeft,
        child: const KojiWordmark(height: 13, color: ClCharte.sable),
      ),
    );
  }
}

/// Six cases du code (`.g2-code`) : un seul champ, invisible, posé dessus ;
/// la case suivante à remplir est soulignée de marine.
class _CasesCode extends StatelessWidget {
  const _CasesCode({
    required this.controller,
    required this.focus,
    required this.onChanged,
    required this.onComplet,
  });

  final TextEditingController controller;
  final FocusNode focus;
  final ValueChanged<String> onChanged;
  final VoidCallback onComplet;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Listenable.merge([controller, focus]),
      builder: (context, _) {
        final code = controller.text;
        return SizedBox(
          height: 56,
          child: Stack(
            children: [
              Row(
                children: [
                  for (var i = 0; i < 6; i++) ...[
                    if (i > 0) const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: ClCharte.blanc,
                          border: Border.all(
                            color: i < code.length ||
                                    (focus.hasFocus && i == code.length)
                                ? ClCharte.marine
                                : ClCharte.ligne,
                            width: focus.hasFocus && i == code.length ? 2 : 1,
                          ),
                        ),
                        child: Text(i < code.length ? code[i] : '',
                            style: ClCharte.titre(24)),
                      ),
                    ),
                  ],
                ],
              ),
              Positioned.fill(
                child: Semantics(
                  label: 'Code à 6 chiffres',
                  child: TextField(
                    controller: controller,
                    focusNode: focus,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(6),
                    ],
                    showCursor: false,
                    enableInteractiveSelection: false,
                    style: const TextStyle(color: Colors.transparent),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: false,
                      counterText: '',
                    ),
                    onChanged: onChanged,
                    onSubmitted: (_) => onComplet(),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
