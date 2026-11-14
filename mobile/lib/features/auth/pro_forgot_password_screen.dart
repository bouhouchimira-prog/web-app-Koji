import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:http/http.dart' as http;

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/features/auth/pro_auth_widgets.dart';

/// Envoie la demande de lien. Lève une exception si le serveur ne répond pas.
typedef ProResetLinkSender = Future<void> Function(String email);

/// Corps de la demande. `app` dit d'où elle vient : la page du lien finit
/// par « Retournez dans l'app Koji / Koji Pro », aux couleurs de cette app,
/// au lieu de connecter au site Pro (lib/reset-app.js côté site).
Map<String, String> demandeLienReinitialisation(String email,
        {required bool isClient}) =>
    {
      'email': email,
      'accountType': 'entreprise',
      'app': isClient ? 'koji' : 'pro',
    };

/// Demande envoyée à getkoji.io, comme sur le site : le lien reçu ouvre
/// /set-password (maquette PRO-00.1) et vaut 30 minutes. La réponse est la
/// même qu'un compte existe ou non. Sert aux deux apps.
Future<void> envoyerLienKojiPro(String email) async {
  final response = await http
      .post(
        Uri.parse('${KojiWebApiConfig.baseUrl}/api/auth/forgot-password'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode(demandeLienReinitialisation(email,
            isClient: KojiAppConfig.isClient)),
      )
      .timeout(const Duration(seconds: 12));
  if (response.statusCode >= 500) {
    throw Exception('HTTP ${response.statusCode}');
  }
}

/// « bilal@exemple.fr » → « bil•••@exemple.fr » (lib/password-rules.js).
String masquerEmail(String email) {
  final parts = email.trim().split('@');
  if (parts.length != 2 || parts[0].isEmpty || parts[1].isEmpty) return '';
  final local = parts[0];
  return '${local.substring(0, local.length < 3 ? local.length : 3)}•••@${parts[1]}';
}

final _emailRe = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

// Tracés de la maquette (retour, coche), dessinés au trait.
Widget _trait(String path, Color color, double size, {double width = 2}) {
  final hex =
      '#${(color.toARGB32() & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
  return SvgPicture.string(
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
    '<path d="$path" fill="none" stroke="$hex" stroke-width="$width" '
    'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    width: size,
    height: size,
  );
}

/// Koji Pro, « Mot de passe oublié » (maquette PRO-00, cadre téléphone) :
/// barre graphite avec retour, un champ, la règle des 30 minutes, le bouton
/// jaune en bas. Pas de téléphone ni de code SMS : aucun fournisseur SMS.
class ProForgotPasswordScreen extends StatefulWidget {
  const ProForgotPasswordScreen({super.key, this.initialEmail = '', this.send});

  final String initialEmail;
  final ProResetLinkSender? send;

  @override
  State<ProForgotPasswordScreen> createState() =>
      _ProForgotPasswordScreenState();
}

class _ProForgotPasswordScreenState extends State<ProForgotPasswordScreen> {
  static const _fond = Color(0xFFF5F5F2);
  static const _sec = Color(0xFFA7ABB2);
  static const _vert = Color(0xFF2F6B3A);

  late final _email = TextEditingController(text: widget.initialEmail);
  bool _sending = false;
  String _sentTo = '';
  String _error = '';

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _envoyer() async {
    final email = _email.text.trim().toLowerCase();
    if (!_emailRe.hasMatch(email)) {
      setState(() => _error = 'Entrez une adresse e-mail valide.');
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _sending = true;
      _error = '';
    });
    try {
      await (widget.send ?? envoyerLienKojiPro)(email);
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentTo = email;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = 'Envoi impossible pour le moment. Vérifiez la connexion '
            'puis réessayez.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return Scaffold(
      backgroundColor: _fond,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            color: ProAuth.graphite,
            padding: EdgeInsets.fromLTRB(6, top + 6, 18, 6),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  tooltip: 'Retour à la connexion',
                  icon: _trait('M15 5l-7 7 7 7', const Color(0xFFF5F5F2), 20),
                ),
                const SizedBox(width: 2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Mot de passe oublié',
                          style: ProAuth.text(15,
                              weight: FontWeight.w700,
                              color: const Color(0xFFF5F5F2))),
                      Text('on vous envoie un lien',
                          style: ProAuth.text(12, color: _sec)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: SafeArea(
              top: false,
              child: LayoutBuilder(
                builder: (context, c) => SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: c.maxHeight - 38),
                    child: IntrinsicHeight(child: _corps()),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _corps() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ProAuthField(
          label: 'E-mail',
          controller: _email,
          hint: 'vous@exemple.fr',
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          textInputAction: TextInputAction.send,
          onChanged: (_) {
            if (_error.isNotEmpty || _sentTo.isNotEmpty) {
              setState(() {
                _error = '';
                _sentTo = '';
              });
            }
          },
          onSubmitted: (_) => _envoyer(),
        ),
        const SizedBox(height: 10),
        Text('Si un compte existe, vous recevez un lien valable 30 minutes.',
            style: ProAuth.text(12, color: ProAuth.grey, height: 1.4)),
        if (_error.isNotEmpty) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: const BoxDecoration(
              color: Color(0xFFFBEAE9),
              border:
                  Border(left: BorderSide(color: Color(0xFFB3261E), width: 3)),
            ),
            child: Text(_error,
                style: ProAuth.text(14, color: const Color(0xFF8C1D18))),
          ),
        ],
        if (_sentTo.isNotEmpty) ...[
          const SizedBox(height: 10),
          Semantics(
            liveRegion: true,
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFAFAF7),
                border: Border.all(color: ProAuth.graphite),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: _trait('M4 12l5 5L20 6', _vert, 18, width: 2.5),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Lien envoyé à ${masquerEmail(_sentTo)}',
                            style: ProAuth.text(14, weight: FontWeight.w700)),
                        const SizedBox(height: 3),
                        Text(
                            'Rien reçu ? Vérifiez vos indésirables, puis '
                            'réessayez dans quelques minutes.',
                            style: ProAuth.text(12,
                                color: ProAuth.grey, height: 1.4)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        const Spacer(),
        const SizedBox(height: 16),
        ProAuthPrimaryButton(
          label: 'Envoyer le lien',
          loading: _sending,
          onPressed: _envoyer,
        ),
      ],
    );
  }
}
