import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/core/responsive_helper.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  // Brand palette: cream wordmark on the navy of the koji design.
  static const _navy = KojiColors.navy;
  static const _cream = KojiColors.cream;

  // One controller drives the whole intro; each element reads its own slice of
  // the 0→1 timeline via Interval so the logo lands first, then "Kôji" rises in,
  // then the accent underline draws across.
  late final AnimationController _controller;

  late final Animation<double> _logoFade;
  late final Animation<double> _logoScale;
  late final Animation<double> _wordFade;
  late final Animation<double> _wordSlide; // px upward
  late final Animation<double> _wordSpacing; // letter-spacing settle
  late final Animation<double> _underline; // 0→1 width factor

  bool _isAnimationDone = false;
  bool _hasNavigated = false;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      duration: const Duration(milliseconds: 1700),
      vsync: this,
    );

    // ── Logo: fade + gentle scale-up, first third of the timeline ──
    _logoFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.0, 0.40, curve: Curves.easeOut),
    );
    _logoScale = Tween<double>(begin: 0.80, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutBack),
      ),
    );

    // ── "Kôji" wordmark: rises up + fades in, with letter-spacing settling
    //    from wide to tight for a polished reveal ──
    _wordFade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.40, 0.75, curve: Curves.easeOut),
    );
    _wordSlide = Tween<double>(begin: 18.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.40, 0.80, curve: Curves.easeOutCubic),
      ),
    );
    _wordSpacing = Tween<double>(begin: 10.0, end: 2.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.40, 0.85, curve: Curves.easeOut),
      ),
    );

    // ── Accent underline draws across last, tying it together ──
    _underline = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.70, 1.0, curve: Curves.easeInOut),
    );

    _controller.forward();

    // Hold the finished intro briefly before navigating away.
    Future.delayed(const Duration(milliseconds: 1900), () {
      if (mounted) {
        setState(() {
          _isAnimationDone = true;
        });
        _attemptNavigation();
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
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

        // ENTREPRISE — check onboarding completion. Either a real logo or
        // an explicit "skipped" flag is enough to bypass /business-info.
        if (!hasBusinessLogo && !isBusinessInfoComplete) {
          if (mounted) context.go('/business-info');
        } else if (!isProfileComplete) {
          if (mounted) context.go('/profession-selection');
        } else {
          if (mounted) context.go('/home');
        }
      } catch (e) {
        // Error fetching user data - go to business info to be safe
        if (mounted) context.go('/business-info');
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

    final responsive = context.responsive;
    // Sizes follow the phone width but stop growing on tablets / the web.
    final logoSize = responsive.width(34.0).clamp(0.0, 140.0);
    final wordSize = responsive.width(11).clamp(0.0, 46.0);

    return Scaffold(
      backgroundColor: _navy,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [KojiColors.navyDeep, KojiColors.navy, KojiColors.navySoft],
          ),
        ),
        child: Center(
          child: AnimatedBuilder(
            animation: _controller,
            builder: (context, _) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ── Logo ──
                  Opacity(
                    opacity: _logoFade.value,
                    child: Transform.scale(
                      scale: _logoScale.value,
                      child: SvgPicture.asset(
                        'assets/icons/LOGO.svg',
                        width: logoSize,
                        height: logoSize,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),

                  SizedBox(height: logoSize * 0.15),

                  // ── "Koji" wordmark: fade + rise + letter-spacing settle ──
                  Opacity(
                    opacity: _wordFade.value,
                    child: Transform.translate(
                      offset: Offset(0, _wordSlide.value),
                      child: Text(
                        KojiAppConfig.appName,
                        style: TextStyle(
                          fontFamily: KojiTheme.fontFamily,
                          color: Colors.white,
                          fontSize: wordSize,
                          fontWeight: FontWeight.w800,
                          letterSpacing: _wordSpacing.value - 2,
                          height: 1.0,
                        ),
                      ),
                    ),
                  ),

                  SizedBox(height: logoSize * 0.1),

                  // ── Accent underline that draws across under the wordmark ──
                  Opacity(
                    opacity: _underline.value.clamp(0.0, 1.0),
                    child: Container(
                      width: logoSize * 0.65 * _underline.value,
                      height: 2.5,
                      decoration: BoxDecoration(
                        color: KojiColors.gold,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // ── Which space this app opens ──
                  Opacity(
                    opacity: _underline.value.clamp(0.0, 1.0),
                    child: Text(
                      KojiAppConfig.espaceLabel.toUpperCase(),
                      style: const TextStyle(
                        fontFamily: KojiTheme.fontFamily,
                        color: _cream,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.8,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}
