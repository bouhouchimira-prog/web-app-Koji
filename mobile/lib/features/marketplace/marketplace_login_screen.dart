import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

/// Separate login for the Marketplace module specifically: it talks to
/// koji-web's own particulier accounts (identifiant/mot de passe), a
/// different identity system from this app's own Supabase-Auth session or
/// its per-chantier access-code login — a particulier already signed into
/// Koji is not automatically signed into the Marketplace. See
/// lib/app/koji_web_api_client.dart for why.
class MarketplaceLoginScreen extends ConsumerStatefulWidget {
  const MarketplaceLoginScreen({super.key});

  @override
  ConsumerState<MarketplaceLoginScreen> createState() =>
      _MarketplaceLoginScreenState();
}

class _MarketplaceLoginScreenState
    extends ConsumerState<MarketplaceLoginScreen> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    super.dispose();
  }

  bool get _formValid =>
      _identifier.text.trim().isNotEmpty && _password.text.isNotEmpty;

  Future<void> _submit() async {
    if (!_formValid || _loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(kojiWebApiClientProvider)
          .login(identifier: _identifier.text.trim(), password: _password.text);
      if (!mounted) return;
      context.go('/client/marketplace');
    } on KojiWebApiException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Connexion impossible, réessayez.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Connexion — Marketplace')),
      body: KojiPage(
        title: 'Publiez votre chantier',
        subtitle:
            'Connectez-vous avec votre compte Koji (particulier) pour accéder'
            ' au Radar des Chantiers.',
        main: [
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KojiField(
                  label: 'E-mail',
                  controller: _identifier,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                ),
                const SizedBox(height: 14),
                KojiField(
                  label: 'Mot de passe',
                  controller: _password,
                  obscure: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _submit(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 20),
                KojiButton(
                  label: 'Se connecter',
                  expand: true,
                  loading: _loading,
                  onPressed: _formValid ? _submit : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
