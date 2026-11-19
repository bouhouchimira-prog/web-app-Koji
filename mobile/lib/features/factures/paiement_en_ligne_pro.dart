import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';

/// État du paiement en ligne de l'entreprise (GET /api/paiement-en-ligne,
/// relu chez Stripe). `disponible` faux : interrupteur général éteint.
final paiementEnLigneProProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(kojiProApiProvider).get('/api/paiement-en-ligne');
});

/// Action sur le compte : « inscription » et « tableau » renvoient un lien
/// du prestataire, ouvert dans le navigateur ; « pause »/« reprendre »
/// renvoient la vue. Remplaçable dans les tests.
typedef ActionPaiementEnLigne = Future<Map<String, dynamic>> Function(
    String action);

final paiementEnLigneActionProvider = Provider<ActionPaiementEnLigne>((ref) {
  return (action) => ref
      .read(kojiProApiProvider)
      .post('/api/paiement-en-ligne', {'action': action, 'depuis': 'app'});
});

typedef OuvrirLienPrestataire = Future<bool> Function(Uri url);

final ouvrirLienPrestataireProvider = Provider<OuvrirLienPrestataire>(
    (ref) => (url) => launchUrl(url, mode: LaunchMode.externalApplication));

/// Carte « Paiement en ligne » des Encaissements (maquette PRO-06.3,
/// mêmes règles que components/PaiementEnLigne.jsx) : le commutateur n'est
/// allumé que lorsque Stripe a confirmé que le compte encaisse et verse sur
/// la banque de l'entreprise. Rien n'apparaît tant que le paiement en ligne
/// n'est pas ouvert.
class PaiementEnLigneCarte extends ConsumerStatefulWidget {
  const PaiementEnLigneCarte({super.key});

  @override
  ConsumerState<PaiementEnLigneCarte> createState() =>
      _PaiementEnLigneCarteState();
}

class _PaiementEnLigneCarteState extends ConsumerState<PaiementEnLigneCarte>
    with WidgetsBindingObserver {
  bool _occupe = false;
  bool _attendRetour = false;
  String _erreur = '';
  Map<String, dynamic>? _vue;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Retour du prestataire : l'état est relu chez Stripe.
    if (state == AppLifecycleState.resumed && _attendRetour) {
      _attendRetour = false;
      setState(() => _vue = null);
      ref.invalidate(paiementEnLigneProProvider);
    }
  }

  Future<void> _agir(String action) async {
    if (_occupe || action.isEmpty) return;
    setState(() {
      _occupe = true;
      _erreur = '';
    });
    try {
      final r = await ref.read(paiementEnLigneActionProvider)(action);
      final url = Uri.tryParse('${r['url'] ?? ''}');
      if (url != null && url.scheme == 'https') {
        _attendRetour = true;
        final ok = await ref.read(ouvrirLienPrestataireProvider)(url);
        if (!ok) _erreur = "Impossible d'ouvrir la page du prestataire.";
      } else {
        _vue = r;
      }
    } catch (err) {
      _erreur = err is KojiWebApiException
          ? err.message
          : 'Le prestataire de paiement ne répond pas.';
    } finally {
      if (mounted) setState(() => _occupe = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final vue = _vue ?? ref.watch(paiementEnLigneProProvider).valueOrNull;
    if (vue == null || vue['disponible'] != true) {
      return const SizedBox.shrink();
    }
    final p = context.koji;
    final actif = vue['actif'] == true;
    final action = vue['action'] is Map ? vue['action'] as Map : const {};
    final id = '${action['id'] ?? ''}';
    final lien = id.isNotEmpty && id != 'pause' && id != 'reprendre';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const KojiSectionTitle('Paiement en ligne'),
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Carte et virement instantané',
                      style: TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                          color: p.heading)),
                  const SizedBox(height: 2),
                  Text(
                      'par notre prestataire de paiement · reçu automatique au client · ${vue['detail'] ?? ''}',
                      style: TextStyle(
                          fontSize: 12.5, color: p.muted, height: 1.35)),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Switch(
              value: actif,
              onChanged: _occupe || id.isEmpty ? null : (_) => _agir(id),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text('Frais : par paiement, à fixer · Koji ne détient pas les fonds',
            style: TextStyle(fontSize: 12, color: p.faint)),
        if (lien) ...[
          const SizedBox(height: 10),
          KojiButton(
              label: '${action['libelle'] ?? ''}',
              expand: true,
              loading: _occupe,
              onPressed: _occupe ? null : () => _agir(id)),
        ],
        if (vue['tableau'] == true) ...[
          const SizedBox(height: 8),
          KojiButton(
              label: 'Tableau de bord du prestataire',
              variant: KojiButtonVariant.secondary,
              expand: true,
              onPressed: _occupe ? null : () => _agir('tableau')),
        ],
        if (_erreur.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(_erreur,
              style:
                  TextStyle(fontSize: 12.5, color: p.toneFg(KojiTone.coral))),
        ],
      ],
    );
  }
}
