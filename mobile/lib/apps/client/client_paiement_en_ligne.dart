import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/design/koji_client_charte.dart';

/// Ouvre le paiement en ligne d'une facture : le site crée la session
/// Stripe Checkout (POST /api/client/factures/{id}/paiement, retour « app »,
/// montant = reste dû calculé par le serveur), puis le navigateur s'ouvre.
/// Après le paiement, la page /paiement-retour du site renvoie vers
/// com.koji.client://paiement : l'app revient au premier plan.
typedef PayerEnLigne = Future<void> Function(String factureId);

final clientPayerEnLigneProvider = Provider<PayerEnLigne>((ref) {
  return (factureId) async {
    final api = ref.read(kojiWebApiClientProvider);
    final reponse = await api.postJson(
        '/api/client/factures/${Uri.encodeComponent(factureId)}/paiement',
        {'retour': 'app'});
    final url = Uri.tryParse(reponse is Map ? '${reponse['url'] ?? ''}' : '');
    if (url == null || url.scheme != 'https') {
      throw KojiWebApiException(502, "Le paiement n'a pas pu démarrer.");
    }
    final ouvert = await launchUrl(url, mode: LaunchMode.externalApplication);
    if (!ouvert) {
      throw KojiWebApiException(0, "Impossible d'ouvrir la page de paiement.");
    }
  };
});

/// « Payer 2 515,00 € » et, dessous, « Paiement par carte ou virement,
/// sécurisé par notre prestataire. » (maquette CLI-02, téléphone). N'existe
/// que si le site l'a proposé (`aPayer.payer` : le compte de l'entreprise
/// peut encaisser). [onRetour] recharge les paiements quand l'app revient
/// au premier plan après la page de paiement.
class ClPayer extends ConsumerStatefulWidget {
  const ClPayer({super.key, required this.aPayer, this.onRetour});

  final Map<String, dynamic> aPayer;
  final VoidCallback? onRetour;

  @override
  ConsumerState<ClPayer> createState() => _ClPayerState();
}

class _ClPayerState extends ConsumerState<ClPayer> with WidgetsBindingObserver {
  bool _envoi = false;
  bool _attendRetour = false;
  String _erreur = '';

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
    if (state == AppLifecycleState.resumed && _attendRetour) {
      _attendRetour = false;
      widget.onRetour?.call();
    }
  }

  Future<void> _payer() async {
    final id = texteSite(widget.aPayer['factureId']);
    if (_envoi || id.isEmpty) return;
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      await ref.read(clientPayerEnLigneProvider)(id);
      _attendRetour = true;
    } catch (err) {
      if (mounted) {
        setState(() => _erreur = err is KojiWebApiException
            ? err.message
            : "Le paiement n'a pas pu démarrer.");
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final payer = mapSite(widget.aPayer['payer']);
    if (payer.isEmpty) return const SizedBox.shrink();
    final mention = texteSite(payer['mention']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ClBouton(texteSite(payer['libelle']),
            charge: _envoi, onPressed: _payer),
        if (mention.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(mention,
                textAlign: TextAlign.center,
                style: ClCharte.texte(12, couleur: ClCharte.gris)),
          ),
        if (_erreur.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: ClInfo(_erreur),
          ),
      ],
    );
  }
}
