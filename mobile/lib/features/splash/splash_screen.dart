import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_brand_marks.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/demarrage/demarrage_logic.dart';

/// Écran de démarrage de chaque app (maquettes PRO-00.1 et CLI-05) : pas de
/// porte d'entrée commune sur mobile, chaque application a la sienne.
/// - Koji Pro : mot-symbole blanc sur graphite, « Décrivez le chantier. Koji
///   le chiffre. », étoile jaune de Koji pendant le chargement.
/// - Koji : mot-symbole sable sur marine, « Votre projet, suivi simplement. »,
///   pas d'étoile (l'assistant n'est pas l'identité côté particulier).
/// Une seconde au plus, jamais de publicité ni de numéro de version.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

/// Couleurs de la charte v2 (mêmes valeurs que le site, SITE-00).
class SplashPalette {
  const SplashPalette({
    required this.fond,
    required this.motSymbole,
    required this.phrase,
    required this.chargement,
    required this.texte,
    required this.texteChargement,
    required this.etoile,
  });

  final Color fond;
  final Color motSymbole;
  final Color phrase;
  final Color chargement;
  final String texte;
  final String texteChargement;
  final bool etoile;

  static const pro = SplashPalette(
    fond: Color(0xFF171B1E),
    motSymbole: Color(0xFFFFFFFF),
    phrase: Color(0xFFC4C7CC),
    chargement: Color(0xFF8A8F98),
    texte: 'Décrivez le chantier. Koji le chiffre.',
    texteChargement: 'Chargement de vos chantiers…',
    etoile: true,
  );

  static const client = SplashPalette(
    fond: Color(0xFF101529),
    motSymbole: Color(0xFFE7D8C5),
    phrase: Color(0xFFC9CDE0),
    chargement: Color(0xFF8A90AA),
    texte: 'Votre projet, suivi simplement.',
    texteChargement: 'Chargement…',
    etoile: false,
  );

  static SplashPalette get courante => KojiAppConfig.isClient ? client : pro;
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _fondu = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 250),
  )..forward();

  bool _isAnimationDone = false;
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();
    // Le temps de lire la phrase ; la navigation part dès que la session est
    // connue (au plus une seconde d'écran au total).
    Future.delayed(const Duration(milliseconds: 700), () {
      if (!mounted) return;
      _isAnimationDone = true;
      _attemptNavigation();
    });
  }

  @override
  void dispose() {
    _fondu.dispose();
    super.dispose();
  }

  Future<void> _attemptNavigation() async {
    if (!_isAnimationDone || _hasNavigated) return;

    final authState = ref.read(authProvider);
    if (authState.isLoading) return; // Wait for auth to be determined

    _hasNavigated = true;
    final user = authState.value;

    if (user == null) {
      // Each app has its own connexion page — no account-type chooser.
      if (mounted) context.go('/login');
    } else if (KojiAppConfig.isClient) {
      // The client app only has the client space.
      if (mounted) context.go('/client-home');
    } else {
      // Has account - check user type and profile completion
      try {
        final userRepository = ref.read(userRepositoryProvider);
        var userData = await userRepository.getUser(user.id);
        // Post-signup race: the `users` row may not be written yet. Retry once.
        if (userData == null) {
          await Future.delayed(const Duration(milliseconds: 600));
          userData = await userRepository.getUser(user.id);
        }
        final isPro = userData?['is_pro'] as bool? ?? true;
        final isProfileComplete = userData?['is_profile_complete'] == true;
        final isBusinessInfoComplete =
            userData?['is_business_info_complete'] == true;
        final logoUrl = userData?['logo_url'] as String?;
        final hasBusinessLogo = logoUrl != null && logoUrl.isNotEmpty;

        // Recovery for accounts where the DB trigger wrote is_pro=false
        // even though the user actually went through the entreprise flow
        // (Google sign-in didn't propagate is_pro metadata). If any
        // entreprise-only artefact exists, self-heal the row so future
        // logins are correct. This is the entreprise app, so the account is
        // treated as an entreprise either way.
        final hasEntrepriseSignal =
            isProfileComplete || isBusinessInfoComplete || hasBusinessLogo;
        if (!isPro && hasEntrepriseSignal) {
          unawaited(userRepository.setIsPro(user.id, true));
        }

        // ENTREPRISE — démarrage guidé (maquette PRO-01.1) tant que
        // l'entreprise, les métiers et la zone, et les prix ne sont pas
        // renseignés, sauf si l'artisan a choisi « Plus tard ».
        if (!essentielsFaitsDepuisLigne(userData) && !await demarragePasse()) {
          if (mounted) context.go('/demarrage');
        } else {
          if (mounted) context.go('/home');
        }
      } catch (e) {
        // Profil illisible : le démarrage guidé sait réessayer ou passer.
        if (mounted) context.go('/demarrage');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authProvider, (previous, next) {
      if (!next.isLoading) {
        _attemptNavigation();
      }
    });

    return FadeTransition(
      opacity: _fondu,
      child: SplashView(palette: SplashPalette.courante),
    );
  }
}

/// Partie visuelle de l'écran de démarrage (testée seule, sans session).
class SplashView extends StatelessWidget {
  const SplashView({super.key, required this.palette});

  final SplashPalette palette;

  @override
  Widget build(BuildContext context) {
    final p = palette;
    TextStyle style(double size, Color color) => TextStyle(
          fontFamily: KojiTheme.proFontFamily, // DM Sans, charte v2
          fontSize: size,
          color: color,
          height: 1.3,
        );

    return Scaffold(
      backgroundColor: p.fond,
      body: Stack(
        children: [
          Align(
            alignment: const Alignment(0, -0.12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  KojiWordmark(height: 34, color: p.motSymbole),
                  const SizedBox(height: 14),
                  Text(p.texte,
                      textAlign: TextAlign.center, style: style(14, p.phrase)),
                ],
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 56 + MediaQuery.paddingOf(context).bottom,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (p.etoile) ...[
                  const _EtoileKoji(),
                  const SizedBox(height: 10),
                ],
                Text(p.texteChargement, style: style(12, p.chargement)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// L'étoile jaune de Koji, toujours sur du graphite (charte v2).
class _EtoileKoji extends StatelessWidget {
  const _EtoileKoji();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFF2A2F33),
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: CustomPaint(
        size: const Size(20, 20),
        painter: _EtoilePainter(),
      ),
    );
  }
}

class _EtoilePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Même tracé que l'icône de Koji sur le site (viewBox 24 × 24).
    final k = size.width / 24;
    final path = Path()
      ..moveTo(12 * k, 3 * k)
      ..lineTo(14.2 * k, 8.8 * k)
      ..lineTo(20 * k, 11 * k)
      ..lineTo(14.2 * k, 13.2 * k)
      ..lineTo(12 * k, 19 * k)
      ..lineTo(9.8 * k, 13.2 * k)
      ..lineTo(4 * k, 11 * k)
      ..lineTo(9.8 * k, 8.8 * k)
      ..close();
    canvas.drawPath(path, Paint()..color = const Color(0xFFFFC400));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
