import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/auth/pro_auth_widgets.dart';
import 'package:koji/features/auth/pro_forgot_password_screen.dart';
import 'package:koji/features/demarrage/demarrage_logic.dart';
import 'package:koji/features/quote/chantier_client_screen.dart';
import 'package:koji/features/worker/worker_shell.dart';

enum KojiAuthTab { login, signup }

enum _LoginMode { email, code }

/// Connexion / création de compte, from the "Connexion — particulier" and
/// "Connexion — entreprise (koji Pro)" pages of the design. The same screen
/// serves both apps; [KojiAppConfig] decides the copy, the colours and the
/// second login mode:
///   • client app      → "Identifiant chantier" (code sent by the artisan)
///   • entreprise app  → "Ouvrier" (worker code created by the entreprise)
class KojiAuthScreen extends ConsumerStatefulWidget {
  const KojiAuthScreen({super.key, this.initialTab = KojiAuthTab.login});

  final KojiAuthTab initialTab;

  @override
  ConsumerState<KojiAuthScreen> createState() => _KojiAuthScreenState();
}

class _KojiAuthScreenState extends ConsumerState<KojiAuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _codePassword = TextEditingController();
  // Koji Pro (maquette PRO-00) : SIREN facultatif et case des conditions.
  final _siren = TextEditingController();
  bool _acceptedTerms = false;

  late KojiAuthTab _tab = widget.initialTab;
  _LoginMode _mode = _LoginMode.email;
  bool _obscure = true;
  bool _codeLoading = false;

  /// True once the user submitted from this screen; auth events that happen
  /// before (e.g. session restore) must not trigger navigation.
  bool _authAttempted = false;
  bool _navigating = false;
  bool _awaitingEmailConfirmation = false;

  bool get _isClient => KojiAppConfig.isClient;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    _codePassword.dispose();
    _siren.dispose();
    super.dispose();
  }

  bool get _emailFormValid =>
      _email.text.trim().isNotEmpty && _password.text.isNotEmpty;

  bool get _codeFormValid =>
      _code.text.trim().isNotEmpty && _codePassword.text.isNotEmpty;

  // ── Actions ────────────────────────────────────────────────────────────

  Future<void> _login() async {
    if (!_emailFormValid) return;
    setState(() => _authAttempted = true);
    await ref
        .read(authProvider.notifier)
        .signInWithEmailAndPassword(_email.text.trim(), _password.text);
  }

  Future<void> _google() async {
    setState(() => _authAttempted = true);
    await ref
        .read(authProvider.notifier)
        .signInWithGoogle(isPro: KojiAppConfig.isPro);
  }

  Future<void> _signup() async {
    if (!_emailFormValid) return;
    // Koji Pro : mêmes règles que le site (8 caractères, SIREN de 9 chiffres
    // s'il est donné, conditions acceptées).
    final minLength = _isClient ? 6 : 8;
    if (_password.text.length < minLength) {
      _snack('Le mot de passe doit contenir au moins $minLength caractères.');
      return;
    }
    final siren = _siren.text.replaceAll(RegExp(r'[\s.]'), '');
    if (!_isClient && siren.isNotEmpty && !RegExp(r'^\d{9}$').hasMatch(siren)) {
      _snack('Le SIREN fait 9 chiffres. Vous pouvez aussi le laisser vide.');
      return;
    }
    if (!_isClient && !_acceptedTerms) {
      _snack("Cochez la case pour accepter les conditions d'utilisation.");
      return;
    }
    // Block the auth listener while the sign-up resolves: with e-mail
    // confirmation there is no session yet, and we show a dialog instead.
    setState(() {
      _awaitingEmailConfirmation = true;
      _authAttempted = true;
    });
    final needsConfirmation = await ref
        .read(authProvider.notifier)
        .signUpWithEmailAndPassword(_email.text.trim(), _password.text,
            isPro: KojiAppConfig.isPro);
    if (!mounted) return;

    if (needsConfirmation) {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          title: const Text('Vérifiez votre e-mail'),
          content: Text(
            'Un e-mail de confirmation a été envoyé à ${_email.text.trim()}. '
            'Cliquez sur le lien pour activer votre compte, puis connectez-vous.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("J'ai compris"),
            ),
          ],
        ),
      );
      if (!mounted) return;
      setState(() {
        _awaitingEmailConfirmation = false;
        _authAttempted = false;
        _tab = KojiAuthTab.login;
      });
      return;
    }

    setState(() => _awaitingEmailConfirmation = false);
    final user = ref.read(authProvider).valueOrNull;
    if (!_isClient && user != null) await _enregistrerFicheEntreprise(siren);
    if (!mounted) return;
    if (user != null) {
      context.go(_isClient ? '/client-home' : '/demarrage');
    }
  }

  /// Koji Pro : enregistre l'acceptation des conditions et, si un SIREN est
  /// donné, la fiche entreprise remplie depuis l'annuaire (même règle que
  /// l'inscription web, app/api/entreprise/fiche-siren). Ne bloque jamais
  /// l'inscription : en cas d'échec, la fiche se complète ensuite.
  Future<void> _enregistrerFicheEntreprise(String siren) async {
    final token = Supabase.instance.client.auth.currentSession?.accessToken;
    if (token == null) return;
    try {
      await http
          .post(
            Uri.parse('${KojiWebApiConfig.baseUrl}/api/entreprise/fiche-siren'),
            headers: {
              'Authorization': 'Bearer $token',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'siren': siren, 'acceptedTerms': true}),
          )
          .timeout(const Duration(seconds: 8));
    } catch (_) {
      // Réseau indisponible : la fiche se remplit au démarrage guidé.
    }
  }

  /// Sessionless login with the Identifiant + Mot de passe handed out by the
  /// entreprise: a chantier code in the client app, a worker code in Koji Pro.
  Future<void> _codeLogin() async {
    if (!_codeFormValid || _codeLoading) return;
    setState(() => _codeLoading = true);
    final repo = ref.read(authRepositoryProvider);
    try {
      if (_isClient) {
        final quoteId = await repo.loginWithAccessCode(
            code: _code.text, password: _codePassword.text);
        if (!mounted) return;
        if (quoteId != null) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => ChantierClientScreen(quoteId: quoteId),
          ));
          return;
        }
      } else {
        final workerId = await repo.loginWorkerWithCode(
            code: _code.text, password: _codePassword.text);
        if (!mounted) return;
        if (workerId != null) {
          Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => WorkerShell(workerId: workerId),
          ));
          return;
        }
      }
      _snack('Identifiant ou mot de passe incorrect.');
    } catch (e) {
      if (mounted) _snack(authErrorMessage(e));
    } finally {
      if (mounted) setState(() => _codeLoading = false);
    }
  }

  Future<void> _routeAfterAuth(User user) async {
    if (_navigating || !mounted) return;
    _navigating = true;
    try {
      if (_isClient) {
        context.go('/client-home');
        return;
      }
      final data = await ref.read(userRepositoryProvider).getUser(user.id);
      final passe = await demarragePasse();
      if (!mounted) return;
      // Démarrage guidé (PRO-01.1) tant que les étapes 1 à 3 manquent.
      context.go(
          essentielsFaitsDepuisLigne(data) || passe ? '/home' : '/demarrage');
    } catch (_) {
      if (mounted) context.go('/demarrage');
    } finally {
      _navigating = false;
    }
  }

  void _forgotPassword() {
    // Les deux apps passent par getkoji.io (lien qui ouvre /set-password,
    // valable 30 minutes). L'ancien lien Supabase visait
    // koji://reset-password, adresse que l'app ne sait pas ouvrir : le lien
    // reçu ne menait nulle part. Koji Pro a l'écran de la maquette ; Koji
    // garde sa boîte de dialogue jusqu'à CLI-05.
    if (!_isClient) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) =>
            ProForgotPasswordScreen(initialEmail: _email.text.trim()),
      ));
      return;
    }
    final emailCtrl = TextEditingController(text: _email.text.trim());
    var sending = false;
    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDs) => AlertDialog(
          title: const Text('Mot de passe oublié'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Saisissez votre adresse e-mail. Vous recevrez un lien pour '
                'réinitialiser votre mot de passe.',
              ),
              const SizedBox(height: 16),
              KojiField(
                label: 'Adresse e-mail',
                controller: emailCtrl,
                hint: 'vous@exemple.fr',
                icon: KojiIcons.mail,
                keyboardType: TextInputType.emailAddress,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler'),
            ),
            KojiButton(
              label: 'Envoyer',
              loading: sending,
              height: 40,
              onPressed: () async {
                final email = emailCtrl.text.trim().toLowerCase();
                if (email.isEmpty) return;
                setDs(() => sending = true);
                try {
                  await envoyerLienKojiPro(email);
                  if (ctx.mounted) Navigator.pop(ctx);
                  _snack('Si un compte existe pour cette adresse, un lien '
                      'valable 30 minutes vient de vous être envoyé.');
                } catch (_) {
                  setDs(() => sending = false);
                  _snack('Envoi impossible pour le moment. Vérifiez la '
                      'connexion puis réessayez.');
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  void _snack(String message) {
    if (!mounted) return;
    // Le nouveau message remplace le précédent au lieu d'attendre derrière.
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  // ── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    ref.listen(authProvider, (previous, next) {
      next.whenOrNull(
        data: (user) {
          if (user != null && _authAttempted && !_awaitingEmailConfirmation) {
            _routeAfterAuth(user);
          }
        },
        error: (error, _) {
          if (_authAttempted) _snack(authErrorMessage(error));
        },
      );
    });

    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth >= KojiBreakpoints.wide && c.maxHeight >= 640;
      if (!_isClient) return _proLayout(context, wide);
      return wide ? _wideLayout(context) : _narrowLayout(context);
    });
  }

  // ── Koji Pro : maquette PRO-00 ───────────────────────────────────────────
  // Téléphone : bandeau graphite puis formulaire sur fond blanc. Tablette :
  // panneau graphite à gauche, formulaire à droite. Connexion par e-mail et
  // mot de passe, Google (Android), accès ouvrier par identifiant. Pas encore
  // dans l'app : code par SMS, Apple, Microsoft.

  Widget _proLayout(BuildContext context, bool wide) {
    final form = SingleChildScrollView(
      padding: wide
          ? const EdgeInsets.fromLTRB(64, 72, 64, 40)
          : const EdgeInsets.fromLTRB(20, 24, 20, 40),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: _proForm(context),
        ),
      ),
    );
    if (wide) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Row(
          children: [
            const Expanded(child: ProAuthPanel()),
            Expanded(child: SafeArea(child: form)),
          ],
        ),
      );
    }
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [const ProAuthBand(), Expanded(child: form)],
      ),
    );
  }

  Widget _proForm(BuildContext context) {
    final loading = ref.watch(authProvider).isLoading && _authAttempted;
    final isLogin = _tab == KojiAuthTab.login;
    final isCode = isLogin && _mode == _LoginMode.code;
    const gap = SizedBox(height: 14);

    Widget eye() => IconButton(
          tooltip: _obscure ? 'Afficher' : 'Masquer',
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: KojiIcon(_obscure ? KojiIcons.eye : KojiIcons.eyeOff,
              size: 19, color: ProAuth.grey),
        );

    final showGoogle = !kIsWeb && defaultTargetPlatform != TargetPlatform.iOS;
    final providers = <Widget>[
      if (showGoogle) ...[
        const ProAuthOr(),
        gap,
        ProAuthProviderButton(
          logo: SvgPicture.string(_GoogleButton._logo, width: 18, height: 18),
          label: 'Continuer avec Google',
          onTap: loading ? null : _google,
        ),
        gap,
      ],
    ];

    final children = <Widget>[
      ProAuthTabs(
        login: isLogin,
        onChanged: (login) => setState(() {
          _tab = login ? KojiAuthTab.login : KojiAuthTab.signup;
          _mode = _LoginMode.email;
        }),
      ),
      const SizedBox(height: 20),
    ];

    if (isCode) {
      children.addAll([
        Text('Espace ouvrier',
            style: ProAuth.text(20, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text("L'identifiant et le mot de passe fournis par votre entreprise.",
            style: ProAuth.text(14, color: ProAuth.grey, height: 1.45)),
        gap,
        ProAuthField(
          label: 'Identifiant',
          controller: _code,
          hint: 'Ex. OUV-123456',
          textInputAction: TextInputAction.next,
          onChanged: (_) => setState(() {}),
        ),
        gap,
        ProAuthField(
          label: 'Mot de passe',
          controller: _codePassword,
          obscure: _obscure,
          suffix: eye(),
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _codeLogin(),
        ),
        const SizedBox(height: 18),
        ProAuthPrimaryButton(
          label: 'Accéder à mon espace ouvrier',
          loading: _codeLoading,
          onPressed: _codeFormValid ? _codeLogin : null,
        ),
        gap,
        ProAuthPill(
          label: 'Retour à la connexion entreprise',
          onTap: () => setState(() => _mode = _LoginMode.email),
        ),
      ]);
    } else if (isLogin) {
      children.addAll([
        ProAuthField(
          label: 'E-mail',
          controller: _email,
          hint: 'vous@exemple.fr',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          onChanged: (_) => setState(() {}),
        ),
        gap,
        ProAuthField(
          label: 'Mot de passe',
          controller: _password,
          obscure: _obscure,
          suffix: eye(),
          autofillHints: const [AutofillHints.password],
          onChanged: (_) => setState(() {}),
          onSubmitted: (_) => _login(),
        ),
        gap,
        ProAuthPill(label: 'Mot de passe oublié ?', onTap: _forgotPassword),
        const SizedBox(height: 18),
        ProAuthPrimaryButton(
          label: 'Se connecter',
          loading: loading,
          onPressed: _emailFormValid ? _login : null,
        ),
        gap,
        ...providers,
        GestureDetector(
          onTap: () => setState(() => _mode = _LoginMode.code),
          child: Text.rich(
            TextSpan(children: [
              const TextSpan(text: 'Compagnon ou ouvrier ? '),
              TextSpan(
                text: 'Entrer avec mon identifiant',
                style: ProAuth.text(13,
                    weight: FontWeight.w600, color: ProAuth.graphite),
              ),
            ]),
            style: ProAuth.text(13, color: ProAuth.grey, height: 1.45),
          ),
        ),
      ]);
    } else {
      children.addAll([
        Text('Compte entreprise, gratuit',
            style: ProAuth.text(20, weight: FontWeight.w700)),
        gap,
        ProAuthField(
          label: 'E-mail',
          controller: _email,
          hint: 'vous@exemple.fr',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          autofillHints: const [AutofillHints.email],
          onChanged: (_) => setState(() {}),
        ),
        gap,
        ProAuthField(
          label: 'Mot de passe',
          controller: _password,
          hint: '8 caractères minimum',
          obscure: _obscure,
          suffix: eye(),
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: TextInputAction.next,
          onChanged: (_) => setState(() {}),
        ),
        gap,
        ProAuthField(
          label: 'SIREN · facultatif maintenant',
          controller: _siren,
          hint: 'Koji remplit votre fiche entreprise',
          keyboardType: TextInputType.number,
          maxLength: 14,
        ),
        gap,
        ProAuthCheck(
          value: _acceptedTerms,
          onChanged: (v) => setState(() => _acceptedTerms = v),
          title: GestureDetector(
            onTap: () => _openUrl('${KojiWebApiConfig.baseUrl}/legal'),
            child: Text.rich(
                TextSpan(children: [
                  const TextSpan(text: "J'accepte les "),
                  TextSpan(
                    text: "conditions d'utilisation",
                    style: ProAuth.text(14, weight: FontWeight.w700)
                        .copyWith(decoration: TextDecoration.underline),
                  ),
                ]),
                style: ProAuth.text(14, weight: FontWeight.w700)),
          ),
          detail: Text(
            "et j'ai lu la politique de confidentialité. Vos données servent "
            'à votre compte Koji ; ABL Expert Renov, éditeur de Koji, en est '
            'responsable.',
            style: ProAuth.text(12, color: ProAuth.grey, height: 1.4),
          ),
        ),
        const SizedBox(height: 18),
        ProAuthPrimaryButton(
          label: 'Créer mon compte',
          loading: loading,
          onPressed: _emailFormValid ? _signup : null,
        ),
        gap,
        ...providers,
        Text('Ensuite : démarrage guidé, 10 minutes.',
            style: ProAuth.text(13, color: ProAuth.grey)),
      ]);
    }

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }

  Widget _wideLayout(BuildContext context) {
    final form = Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(56, 36, 56, 28),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 470),
          child: _form(context),
        ),
      ),
    );

    if (_isClient) {
      return Scaffold(
        body: DecoratedBox(
          decoration: const BoxDecoration(gradient: _clientBackground),
          child: Row(
            children: [
              const Expanded(child: _ClientHero()),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(0, 32, 40, 32),
                  child: Container(
                    decoration: BoxDecoration(
                      color: context.koji.surface,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.4),
                          blurRadius: 80,
                          offset: const Offset(0, 30),
                        ),
                      ],
                    ),
                    child: form,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final p = context.koji;
    return Scaffold(
      backgroundColor: p.surface,
      body: Row(
        children: [
          const Expanded(child: _EntrepriseHero()),
          Expanded(
            child: DecoratedBox(
              decoration: BoxDecoration(
                border: Border(left: BorderSide(color: p.line)),
              ),
              child: form,
            ),
          ),
        ],
      ),
    );
  }

  Widget _narrowLayout(BuildContext context) {
    final p = context.koji;
    final form = Padding(
      padding: const EdgeInsets.fromLTRB(22, 26, 22, 28),
      child: _form(context),
    );

    if (_isClient) {
      return Scaffold(
        backgroundColor: KojiColors.navyDeep,
        body: DecoratedBox(
          decoration: const BoxDecoration(gradient: _clientBackground),
          child: SafeArea(
            bottom: false,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _MobileHeader(dark: true),
                  Container(
                    constraints: BoxConstraints(
                      minHeight: MediaQuery.sizeOf(context).height * 0.6,
                    ),
                    decoration: BoxDecoration(
                      color: p.surface,
                      borderRadius:
                          const BorderRadius.vertical(top: Radius.circular(28)),
                    ),
                    child: form,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: p.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [const _MobileHeader(dark: false), form],
          ),
        ),
      ),
    );
  }

  Widget _form(BuildContext context) {
    final p = context.koji;
    final authLoading = ref.watch(authProvider).isLoading && _authAttempted;
    final isLogin = _tab == KojiAuthTab.login;
    final isCode = isLogin && _mode == _LoginMode.code;

    final String subtitle;
    if (!isLogin) {
      subtitle = _isClient
          ? 'Créez votre espace pour suivre vos devis et vos travaux.'
          : 'Créez votre compte et vos premiers devis.';
    } else if (isCode) {
      subtitle = _isClient
          ? "Saisissez l'identifiant et le mot de passe reçus de votre artisan."
          : "Saisissez l'identifiant et le mot de passe fournis par votre entreprise.";
    } else {
      subtitle = _isClient
          ? 'Retrouvez vos devis, le suivi de vos travaux et vos messages.'
          : 'Accédez à vos devis, vos chantiers, votre équipe et votre facturation.';
    }

    return AutofillGroup(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          KojiSegmented<KojiAuthTab>(
            options: const {
              KojiAuthTab.login: 'Connexion',
              KojiAuthTab.signup: 'Créer un compte',
            },
            value: _tab,
            onChanged: (t) => setState(() => _tab = t),
          ),
          const SizedBox(height: 22),
          Align(
            alignment: Alignment.centerLeft,
            child: KojiPill(
              _isClient ? 'Espace particulier' : 'Espace entreprise · Koji Pro',
              tone: _isClient ? KojiTone.amber : KojiTone.info,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            isLogin ? 'Connexion' : 'Créer un compte',
            style: TextStyle(
              fontSize: MediaQuery.sizeOf(context).width < 400 ? 30 : 36,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              height: 1.1,
              color: p.heading,
            ),
          ),
          const SizedBox(height: 10),
          Text(subtitle,
              style: TextStyle(fontSize: 15.5, height: 1.5, color: p.muted)),
          const SizedBox(height: 22),
          if (isLogin) ...[
            KojiSegmented<_LoginMode>(
              compact: true,
              options: {
                _LoginMode.email: _isClient ? 'E-mail' : 'Entreprise',
                _LoginMode.code: _isClient ? 'Identifiant chantier' : 'Ouvrier',
              },
              value: _mode,
              onChanged: (m) => setState(() => _mode = m),
            ),
            const SizedBox(height: 22),
          ],
          if (isCode)
            ..._codeFields(context)
          else
            ..._emailFields(context, authLoading),
          const SizedBox(height: 22),
          _otherAppCard(context),
          const SizedBox(height: 22),
          Center(
            child: Wrap(
              alignment: WrapAlignment.center,
              children: [
                Text("Besoin d'aide ? ",
                    style: TextStyle(fontSize: 13.5, color: p.muted)),
                InkWell(
                  onTap: () => _openUrl('mailto:${KojiAppConfig.supportEmail}'),
                  child: Text(
                    KojiAppConfig.supportEmail,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: p.isDark ? KojiColors.cream : KojiColors.info,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _emailFields(BuildContext context, bool loading) {
    final p = context.koji;
    final isLogin = _tab == KojiAuthTab.login;
    return [
      // google_sign_in needs a web client id on the web, which this project
      // doesn't configure yet, so the button is mobile-only for now.
      // Hidden on iOS too: App Store guideline 4.8 requires "Sign in with
      // Apple" next to any third-party login, which isn't set up yet.
      if (!kIsWeb && defaultTargetPlatform != TargetPlatform.iOS) ...[
        _GoogleButton(
          label: isLogin ? 'Continuer avec Google' : "S'inscrire avec Google",
          onTap: loading ? null : _google,
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(child: Divider(color: p.line)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Text(
                'ou avec votre e-mail',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: p.faint,
                ),
              ),
            ),
            Expanded(child: Divider(color: p.line)),
          ],
        ),
        const SizedBox(height: 22),
      ],
      KojiField(
        label: 'Adresse e-mail',
        controller: _email,
        hint: 'vous@exemple.fr',
        icon: KojiIcons.mail,
        keyboardType: TextInputType.emailAddress,
        textInputAction: TextInputAction.next,
        autofillHints: const [AutofillHints.email],
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 16),
      KojiField(
        label: 'Mot de passe',
        controller: _password,
        hint: '••••••••••',
        icon: KojiIcons.lock,
        obscure: _obscure,
        autofillHints: [
          isLogin ? AutofillHints.password : AutofillHints.newPassword,
        ],
        helper: isLogin ? null : '6 caractères minimum.',
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => isLogin ? _login() : _signup(),
        suffix: IconButton(
          tooltip: _obscure ? 'Afficher' : 'Masquer',
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: KojiIcon(_obscure ? KojiIcons.eye : KojiIcons.eyeOff,
              size: 19, color: p.faint),
        ),
      ),
      if (isLogin) ...[
        const SizedBox(height: 14),
        Align(
          alignment: Alignment.centerRight,
          child: InkWell(
            onTap: _forgotPassword,
            borderRadius: BorderRadius.circular(6),
            child: Padding(
              padding: const EdgeInsets.all(2),
              child: Text(
                'Mot de passe oublié ?',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: p.isDark ? KojiColors.gold : KojiColors.goldText,
                ),
              ),
            ),
          ),
        ),
      ] else ...[
        const SizedBox(height: 14),
        Text(
          "En créant un compte, vous acceptez les conditions d'utilisation de Koji.",
          style: TextStyle(fontSize: 13, color: p.muted, height: 1.4),
        ),
      ],
      const SizedBox(height: 22),
      KojiButton(
        label: isLogin ? 'Se connecter' : 'Créer mon compte',
        trailingIcon: KojiIcons.arrowRight,
        height: 56,
        expand: true,
        loading: loading,
        onPressed: _emailFormValid ? (isLogin ? _login : _signup) : null,
      ),
    ];
  }

  List<Widget> _codeFields(BuildContext context) {
    final p = context.koji;
    return [
      KojiField(
        label: 'Identifiant',
        controller: _code,
        hint: _isClient ? 'Ex. Koji-CH8594' : 'Ex. OUV-123456',
        icon: KojiIcons.user,
        textInputAction: TextInputAction.next,
        onChanged: (_) => setState(() {}),
      ),
      const SizedBox(height: 16),
      KojiField(
        label: 'Mot de passe',
        controller: _codePassword,
        hint: '••••••••',
        icon: KojiIcons.key,
        obscure: _obscure,
        onChanged: (_) => setState(() {}),
        onSubmitted: (_) => _codeLogin(),
        suffix: IconButton(
          tooltip: _obscure ? 'Afficher' : 'Masquer',
          onPressed: () => setState(() => _obscure = !_obscure),
          icon: KojiIcon(_obscure ? KojiIcons.eye : KojiIcons.eyeOff,
              size: 19, color: p.faint),
        ),
      ),
      const SizedBox(height: 22),
      KojiButton(
        label: _isClient
            ? 'Accéder à mon chantier'
            : 'Accéder à mon espace ouvrier',
        trailingIcon: KojiIcons.arrowRight,
        height: 56,
        expand: true,
        loading: _codeLoading,
        onPressed: _codeFormValid ? _codeLogin : null,
      ),
    ];
  }

  Widget _otherAppCard(BuildContext context) {
    final p = context.koji;
    final url = KojiAppConfig.otherAppUrl;
    final question =
        _isClient ? 'Vous êtes une entreprise ?' : 'Vous êtes un particulier ?';
    final cta = _isClient ? 'Utilisez Koji Pro' : "Utilisez l'app Koji";
    return Material(
      color: p.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: p.isDark ? p.line : KojiColors.warmLine),
      ),
      child: InkWell(
        onTap: url.isEmpty ? null : () => _openUrl(url),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  question,
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: p.inkSoft,
                  ),
                ),
              ),
              Text(
                cta,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: p.heading,
                ),
              ),
              if (url.isNotEmpty) ...[
                const SizedBox(width: 8),
                KojiIcon(KojiIcons.arrowRight,
                    size: 16, color: p.heading, strokeWidth: 2.4),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

const _clientBackground = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [KojiColors.navyDeep, KojiColors.navy, KojiColors.navySoft],
  stops: [0, 0.55, 1],
);

class _GoogleButton extends StatelessWidget {
  const _GoogleButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback? onTap;

  static const _logo =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">'
      '<path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>'
      '<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>'
      '<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>'
      '<path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>'
      '</svg>';

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Material(
      color: p.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(13),
        side: BorderSide(
            color: p.isDark ? p.lineStrong : const Color(0xFFDAD5CC)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(13),
        child: SizedBox(
          height: 54,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SvgPicture.string(_logo, width: 20, height: 20),
              const SizedBox(width: 11),
              Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: p.heading,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Compact brand header shown above the form on phones.
class _MobileHeader extends StatelessWidget {
  const _MobileHeader({required this.dark});

  final bool dark;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final client = KojiAppConfig.isClient;
    return Padding(
      padding: EdgeInsets.fromLTRB(22, 18, 22, dark ? 28 : 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KojiLogo(
            size: 34,
            markColor: dark ? KojiColors.cream : KojiColors.navy,
            wordColor: dark ? Colors.white : p.heading,
            wordSize: 21,
            subtitle: KojiAppConfig.espaceLabel,
            subtitleColor: dark ? KojiColors.onNavyMuted : p.muted,
          ),
          if (dark) ...[
            const SizedBox(height: 26),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                      text:
                          client ? 'Suivez vos travaux ' : 'Créez vos devis, '),
                  TextSpan(
                    text: client
                        ? 'en toute sérénité.'
                        : 'pilotez vos chantiers.',
                    style: const TextStyle(
                      fontStyle: FontStyle.italic,
                      color: KojiColors.gold,
                    ),
                  ),
                ],
              ),
              style: const TextStyle(
                fontSize: 28,
                height: 1.12,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                color: Colors.white,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Hero panels (wide layout) ────────────────────────────────────────────────

class _HeroScaffold extends StatelessWidget {
  const _HeroScaffold({
    required this.dark,
    required this.domainLabel,
    required this.eyebrow,
    required this.headline,
    required this.highlight,
    required this.illustration,
    required this.features,
  });

  final bool dark;
  final String domainLabel;
  final String eyebrow;
  final String headline;
  final String highlight;
  final Widget illustration;
  final List<(String, String)> features;

  @override
  Widget build(BuildContext context) {
    final fg = dark ? Colors.white : KojiColors.navy;
    return Padding(
      padding: const EdgeInsets.fromLTRB(64, 48, 48, 48),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              KojiLogo(
                size: 38,
                markColor: dark ? KojiColors.cream : KojiColors.navy,
                wordColor: fg,
                wordSize: 22,
              ),
              const Spacer(),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: dark
                      ? Colors.white.withValues(alpha: 0.1)
                      : const Color(0xFFF4F5FB),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  domainLabel,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            eyebrow.toUpperCase(),
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.9,
              color: dark ? KojiColors.cream : const Color(0xFF2B3A5C),
            ),
          ),
          const SizedBox(height: 18),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '$headline '),
                TextSpan(
                  text: highlight,
                  style: TextStyle(
                    fontStyle: FontStyle.italic,
                    color: dark ? KojiColors.gold : KojiColors.goldText,
                  ),
                ),
              ],
            ),
            style: TextStyle(
              fontSize: 44,
              height: 1.08,
              fontWeight: FontWeight.w800,
              letterSpacing: -1.1,
              color: fg,
            ),
          ),
          const SizedBox(height: 28),
          Flexible(
            flex: 6,
            child: Align(
              alignment: Alignment.centerLeft,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: illustration,
              ),
            ),
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final f in features)
                Container(
                  height: 42,
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  decoration: BoxDecoration(
                    color: dark
                        ? Colors.white.withValues(alpha: 0.08)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(13),
                    border: Border.all(
                      color: dark
                          ? Colors.white.withValues(alpha: 0.2)
                          : const Color(0xFFE9E2D6),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      KojiIcon(f.$1,
                          size: 17,
                          color: dark
                              ? const Color(0xFFD9A93E)
                              : KojiColors.goldText,
                          strokeWidth: 2),
                      const SizedBox(width: 9),
                      Text(
                        f.$2,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: fg,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const Spacer(),
        ],
      ),
    );
  }
}

class _ClientHero extends StatelessWidget {
  const _ClientHero();

  @override
  Widget build(BuildContext context) {
    return const _HeroScaffold(
      dark: true,
      domainLabel: 'Espace particulier',
      eyebrow: 'Espace particulier',
      headline: 'Suivez vos travaux',
      highlight: 'en toute sérénité.',
      features: [
        (KojiIcons.signature, 'Devis signés en ligne'),
        (KojiIcons.chantiers, 'Suivi des travaux'),
        (KojiIcons.messages, "Messagerie avec l'artisan"),
      ],
      illustration: SizedBox(
        width: 600,
        height: 430,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(left: 0, top: 18, child: _ChatCard()),
            Positioned(left: 330, top: 226, child: _QuoteToSignCard()),
            Positioned(
              left: 330,
              top: -6,
              child: _Toast(text: 'Devis signé'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EntrepriseHero extends StatelessWidget {
  const _EntrepriseHero();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: RadialGradient(
          center: Alignment(0.7, -0.6),
          radius: 0.9,
          colors: [Color(0xFFEEF1FC), Colors.white],
        ),
      ),
      child: _HeroScaffold(
        dark: false,
        domainLabel: 'Koji Pro',
        eyebrow: 'Espace entreprise · Koji Pro',
        headline: 'Créez vos devis,',
        highlight: 'pilotez vos chantiers.',
        features: [
          (KojiIcons.devis, 'Devis en quelques minutes'),
          (KojiIcons.signature, 'Signature électronique'),
          (KojiIcons.contacts, 'Équipe & planning'),
        ],
        illustration: SizedBox(
          width: 600,
          height: 470,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: -30,
                top: -24,
                child: SizedBox(
                  width: 300,
                  height: 300,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: KojiColors.navyDeep,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
              Positioned(left: 0, top: 0, child: _ChantiersMiniCard()),
              Positioned(left: 290, top: 150, child: _DevisMiniCard()),
              Positioned(
                  left: 0,
                  top: 400,
                  child: _Toast(text: 'Devis signé · 4 850 €')),
            ],
          ),
        ),
      ),
    );
  }
}

BoxDecoration _floatingCard({Color color = Colors.white, double radius = 22}) =>
    BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(radius),
      border: color == Colors.white
          ? Border.all(color: const Color(0xFFE6E8F2))
          : null,
      boxShadow: [
        BoxShadow(
          color: KojiColors.navy
              .withValues(alpha: color == Colors.white ? 0.14 : 0.28),
          blurRadius: 50,
          offset: const Offset(0, 22),
        ),
      ],
    );

const _illusText = TextStyle(color: KojiColors.navy);

class _Toast extends StatelessWidget {
  const _Toast({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: _floatingCard(radius: 16).copyWith(
        border: const Border(
          left: BorderSide(color: KojiColors.green, width: 4),
          top: BorderSide(color: KojiColors.warmLine),
          right: BorderSide(color: KojiColors.warmLine),
          bottom: BorderSide(color: KojiColors.warmLine),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const KojiIcon(KojiIcons.check,
              size: 16, color: KojiColors.green, strokeWidth: 2.8),
          const SizedBox(width: 10),
          Text(text,
              style: _illusText.copyWith(
                  fontSize: 14.5, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _ChatCard extends StatelessWidget {
  const _ChatCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 460,
      padding: const EdgeInsets.all(22),
      decoration: _floatingCard(radius: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                    color: KojiColors.green, shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Text('Votre artisan',
                  style: _illusText.copyWith(
                      fontSize: 14.5, fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: KojiColors.navy,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: const KojiIcon(KojiIcons.sparkle,
                    size: 15, color: KojiColors.cream, strokeWidth: 2),
              ),
              const SizedBox(width: 10),
              Flexible(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: const BoxDecoration(
                    color: Color(0xFFF4F1EB),
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(4),
                      topRight: Radius.circular(14),
                      bottomLeft: Radius.circular(14),
                      bottomRight: Radius.circular(14),
                    ),
                  ),
                  child: Text(
                    'Bonjour, voici le devis pour votre salle de bain.',
                    style: _illusText.copyWith(
                        fontSize: 13, height: 1.5, fontWeight: FontWeight.w500),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: const BoxDecoration(
                color: KojiColors.navy,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(14),
                  topRight: Radius.circular(4),
                  bottomLeft: Radius.circular(14),
                  bottomRight: Radius.circular(14),
                ),
              ),
              child: const Text(
                'Merci, je le regarde ce soir !',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    height: 1.5,
                    fontWeight: FontWeight.w500),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const Padding(
            padding: EdgeInsets.only(left: 40),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _IllusChip('Devis reçu', checked: true),
                _IllusChip('Planning', checked: true),
                _IllusChip('Photos du chantier'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _IllusChip extends StatelessWidget {
  const _IllusChip(this.label, {this.checked = false});

  final String label;
  final bool checked;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.symmetric(horizontal: 13),
      decoration: BoxDecoration(
        color: checked ? KojiColors.navy : Colors.white,
        borderRadius: BorderRadius.circular(17),
        border: checked ? null : Border.all(color: const Color(0xFFDAD5CC)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (checked) ...[
            const KojiIcon(KojiIcons.check,
                size: 13, color: Color(0xFFD9A93E), strokeWidth: 2.8),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: checked ? FontWeight.w700 : FontWeight.w600,
              color: checked ? Colors.white : KojiColors.navy,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuoteToSignCard extends StatelessWidget {
  const _QuoteToSignCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      padding: const EdgeInsets.all(20),
      decoration: _floatingCard(color: KojiColors.navySoft),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'VOTRE DEVIS',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.1,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Salle de bain · 5 m²',
            style: TextStyle(
                fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          const SizedBox(height: 6),
          Text(
            '4 850 € TTC · valable 30 jours',
            style: TextStyle(
                fontSize: 13, color: Colors.white.withValues(alpha: 0.7)),
          ),
          const SizedBox(height: 14),
          const KojiButton(
            label: 'Signer le devis',
            trailingIcon: KojiIcons.arrowRight,
            variant: KojiButtonVariant.gold,
            onPressed: null,
            dimWhenDisabled: false,
            expand: true,
          ),
        ],
      ),
    );
  }
}

class _ChantiersMiniCard extends StatelessWidget {
  const _ChantiersMiniCard();

  @override
  Widget build(BuildContext context) {
    Widget row(String title, String place, double pct) => Container(
          margin: const EdgeInsets.only(top: 9),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: KojiColors.warmLine),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: _illusText.copyWith(
                      fontSize: 13.5, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(place,
                  style:
                      const TextStyle(fontSize: 12, color: KojiColors.muted)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: KojiProgressBar(
                      value: pct,
                      height: 6,
                      color: KojiColors.navy,
                      track: KojiColors.navActive,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text('${(pct * 100).round()} %',
                      style: _illusText.copyWith(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        );

    return Container(
      width: 340,
      padding: const EdgeInsets.all(16),
      decoration: _floatingCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Chantiers en cours',
                    style: _illusText.copyWith(
                        fontSize: 14.5, fontWeight: FontWeight.w800)),
              ),
              const _StaticPill(
                  '3 actifs', KojiColors.green, KojiColors.greenBg),
            ],
          ),
          row('Salle de bain complète', 'Montreuil · Mme Haddad', 0.6),
          row('Cuisine + électricité', 'Paris 15e · Mme Roche', 0.35),
        ],
      ),
    );
  }
}

class _DevisMiniCard extends StatelessWidget {
  const _DevisMiniCard();

  @override
  Widget build(BuildContext context) {
    Widget line(String label, {bool done = true}) => Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFF1EDE6))),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(label,
                    style: _illusText.copyWith(
                        fontSize: 12.5, fontWeight: FontWeight.w700)),
              ),
              if (done)
                Container(
                  width: 20,
                  height: 20,
                  decoration: const BoxDecoration(
                      color: KojiColors.greenBg, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: const KojiIcon(KojiIcons.check,
                      size: 11, color: KojiColors.green, strokeWidth: 3),
                )
              else
                const _StaticPill(
                    'À chiffrer', KojiColors.amber, KojiColors.amberBg),
            ],
          ),
        );

    return Container(
      width: 300,
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
      decoration: _floatingCard(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Nouveau devis',
                    style: _illusText.copyWith(
                        fontSize: 14.5, fontWeight: FontWeight.w800)),
              ),
              const _StaticPill(
                  'Brouillon', KojiColors.info, KojiColors.infoBg),
            ],
          ),
          const SizedBox(height: 4),
          line('Dépose existant'),
          line('Étanchéité douche'),
          line('Carrelage'),
          line('Chauffe-eau', done: false),
          const SizedBox(height: 12),
          const KojiButton(
            label: 'Envoyer le devis',
            variant: KojiButtonVariant.gold,
            onPressed: null,
            dimWhenDisabled: false,
            expand: true,
          ),
        ],
      ),
    );
  }
}

/// Fixed-colour pill for the light illustrations (independent of dark mode).
class _StaticPill extends StatelessWidget {
  const _StaticPill(this.label, this.fg, this.bg);

  final String label;
  final Color fg;
  final Color bg;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label,
          style:
              TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}
