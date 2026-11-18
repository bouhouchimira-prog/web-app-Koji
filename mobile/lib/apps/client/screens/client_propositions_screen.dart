import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

String _s(dynamic v) => v is String ? v.trim() : '';

/// « Propositions reçues » (maquette CLI-01) pour une demande : une carte par
/// entreprise, dans l'ordre donné par le site (/api/client/projets/{id}), et
/// en bas l'action de la carte choisie. Aucun prix n'est calculé ici : ils
/// s'affichent tels que le site les écrit.
class ClientPropositionsScreen extends ConsumerStatefulWidget {
  const ClientPropositionsScreen({super.key, required this.offerId});

  final String offerId;

  @override
  ConsumerState<ClientPropositionsScreen> createState() =>
      _ClientPropositionsScreenState();
}

class _ClientPropositionsScreenState
    extends ConsumerState<ClientPropositionsScreen> {
  /// La première proposition est choisie à l'ouverture.
  int _choisie = 0;

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/client-home');
    }
  }

  /// Action de la proposition choisie. Un lien `/client/chantier/{id}`
  /// (« Voir et signer », « Voir le chantier ») ouvre la page du devis dans
  /// l'app (CLI-02) ; un autre lien de signature, le navigateur ; « rdv » et
  /// « voir » mènent au détail de la demande (échanges, rendez-vous).
  Future<void> _ouvrir(Map<String, dynamic> proposition) async {
    final action = proposition['action'];
    final type = action is Map ? action['type'] : null;
    final lien = action is Map ? _s(action['lien']) : '';
    final route = routeAppDuLienSite(lien);
    if (route != null && route.startsWith('/client/devis/')) {
      context.push(route);
      return;
    }
    if (type == 'signer' && lien.isNotEmpty) {
      final uri = Uri.tryParse(
          lien.startsWith('/') ? '${KojiWebApiConfig.baseUrl}$lien' : lien);
      if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http')) {
        try {
          final ouvert =
              await launchUrl(uri, mode: LaunchMode.externalApplication);
          if (ouvert) return;
        } catch (_) {
          // Pas de navigateur : on retombe sur le détail de la demande.
        }
      }
    }
    if (!mounted) return;
    context.push('/client/marketplace/${Uri.encodeComponent(widget.offerId)}');
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
      // Ouvert sans session du site (lien direct) : la connexion d'abord.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go('/client/marketplace/login');
      });
      return const Scaffold(
        backgroundColor: ClCharte.riz,
        body: Center(
          child: CircularProgressIndicator(
              strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    }

    final provider = clientPropositionsProvider(widget.offerId);
    final async = ref.watch(provider);
    final donnees = async.valueOrNull;
    final projet = donnees?['projet'];
    final propositions = ((donnees?['propositions'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
    final choisie = propositions.isEmpty
        ? null
        : propositions[_choisie < propositions.length ? _choisie : 0];
    final titre = _s(donnees?['titre']);
    final note = _s(donnees?['note']);

    final Widget corps;
    if (donnees == null && async.hasError) {
      corps = ClCorps(children: [
        Text('Impossible de charger les propositions.',
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        ClBouton('Réessayer',
            secondaire: true, onPressed: () => ref.invalidate(provider)),
      ]);
    } else if (donnees == null) {
      corps = const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
              strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    } else if (propositions.isEmpty) {
      corps = ClCorps(
        onRefresh: () async => ref.invalidate(provider),
        children: [ClInfo(_s(donnees['vide']))],
      );
    } else {
      corps = ClCorps(
        onRefresh: () async => ref.invalidate(provider),
        children: [
          for (final (i, p) in propositions.indexed)
            ClCarteOffre(
              nom: _s(p['nom']),
              prix: _s(p['prix']),
              lignes: [
                if (_s(p['prixNote']).isNotEmpty) _s(p['prixNote']),
                for (final l in (p['resume'] as List?) ?? const [])
                  if (_s(l).isNotEmpty) _s(l),
              ],
              choisie: identical(p, choisie),
              onTap: () => setState(() => _choisie = i),
            ),
          if (note.isNotEmpty)
            Text(note, style: ClCharte.texte(12, couleur: ClCharte.gris)),
        ],
      );
    }

    return Scaffold(
      backgroundColor: ClCharte.riz,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClBarre(
            titre: titre.isEmpty ? 'Propositions reçues' : titre,
            sousTitre: projet is Map ? _s(projet['titre']) : '',
            onRetour: _retour,
          ),
          Expanded(
            child: MediaQuery.removePadding(
              context: context,
              removeTop: true,
              child: corps,
            ),
          ),
          if (choisie != null)
            SafeArea(
              top: false,
              minimum: const EdgeInsets.fromLTRB(16, 10, 16, 20),
              child: ClBouton(_libelle(choisie),
                  onPressed: () => _ouvrir(choisie)),
            ),
        ],
      ),
    );
  }

  /// Texte du bouton : celui du site, sinon le libellé de l'action.
  String _libelle(Map<String, dynamic> proposition) {
    final voir = _s(proposition['voir']);
    if (voir.isNotEmpty) return voir;
    final action = proposition['action'];
    final libelle = action is Map ? _s(action['libelle']) : '';
    return libelle.isEmpty ? 'Voir la proposition' : libelle;
  }
}
