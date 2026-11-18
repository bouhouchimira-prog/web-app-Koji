import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';

String _s(dynamic v) => v is String ? v.trim() : '';

/// « Vos projets » (maquette CLI-01), l'accueil du téléphone : les chantiers
/// suivis dans l'app, puis les demandes et les brouillons lus sur le site
/// (/api/client/projets). Une seule action : « Nouveau projet ».
class ClientAccueilScreen extends ConsumerWidget {
  const ClientAccueilScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Le site n'est interrogé qu'avec une session ouverte ; sans elle, seuls
    // les chantiers de l'app s'affichent.
    final connecte = ref.watch(kojiWebApiClientProvider).isLoggedIn;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final tasksAsync = ref.watch(clientTasksProvider);
    final AsyncValue<Map<String, dynamic>> projetsAsync = connecte
        ? ref.watch(clientProjetsProvider)
        : const AsyncData(<String, dynamic>{});
    final nonLues = !connecte
        ? 0
        : ref
                .watch(clientNotificationsProvider)
                .valueOrNull
                ?.where((n) => n['read'] != true)
                .length ??
            0;

    final chantiers = ClientChantier.group(tasksAsync.valueOrNull ?? const []);
    final donnees = projetsAsync.valueOrNull ?? const <String, dynamic>{};
    // Les chantiers viennent déjà de l'app : du site, on ne garde que les
    // demandes et les brouillons, pour ne rien afficher en double.
    final projets = ((donnees['projets'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .where((p) => p['type'] == 'offre' || p['type'] == 'brouillon')
        .toList();

    final bonjour = _s(donnees['bonjour']);
    final nom = bonjour.isNotEmpty ? bonjour : _s(account?.firstName);

    final chargement = (tasksAsync.isLoading && !tasksAsync.hasValue) ||
        (projetsAsync.isLoading && !projetsAsync.hasValue);
    final erreur = tasksAsync.hasError || projetsAsync.hasError;
    final vide = chantiers.isEmpty && projets.isEmpty;

    void recharger() {
      ref.invalidate(clientTasksProvider);
      if (!connecte) return;
      ref.invalidate(clientProjetsProvider);
      ref.invalidate(clientNotificationsProvider);
    }

    final blocs = <Widget>[
      const ClTitre('Vos projets'),
      for (final c in chantiers) _carteChantier(context, c),
      for (final p in projets) _carteProjet(context, p),
      if (chargement)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: ClCharte.marine),
            ),
          ),
        )
      else if (erreur) ...[
        Text('Impossible de charger vos projets.',
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        ClBouton('Réessayer', secondaire: true, onPressed: recharger),
      ] else if (vide)
        Text("Vous n'avez pas encore de projet.",
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
      ClBouton('Nouveau projet',
          onPressed: () => ouvrirNouveauProjet(context, ref)),
      const ClInfo(
          "Décrivez vos travaux avec l'assistant Koji : il pose les bonnes "
          'questions et prépare votre demande pour les entreprises.'),
    ];

    Future<void> actualiser() async => recharger();

    // Grand écran : la coquille a déjà son bandeau, sa cloche et son menu ;
    // on y pose le même contenu, en colonne.
    if (context.findAncestorWidgetOfExactType<KojiContentArea>() != null) {
      return Scaffold(
        backgroundColor: ClCharte.riz,
        body: Align(
          alignment: Alignment.topLeft,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: ClCorps(
              padding: const EdgeInsets.fromLTRB(32, 28, 32, 32),
              onRefresh: actualiser,
              children: blocs,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: ClCharte.riz,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClBandeau(
            nom: nom,
            nonLues: nonLues,
            onNotifications: () => context.push('/client/notifications'),
          ),
          Expanded(child: ClCorps(onRefresh: actualiser, children: blocs)),
        ],
      ),
    );
  }

  /// Chantier suivi dans l'app : avancement des tâches et état.
  Widget _carteChantier(BuildContext context, ClientChantier c) {
    final (etat, _) = c.status;
    return ClCarteProjet(
      titre: c.reference,
      detail: '${c.done} / ${c.total} tâches · $etat',
      etiquette: etat,
      onTap: () => context.push(
        '/client/chantier/${Uri.encodeComponent(c.id ?? c.reference)}',
        extra: c,
      ),
    );
  }

  /// Demande ou brouillon du site : titre, détail et étiquette tels quels.
  Widget _carteProjet(BuildContext context, Map<String, dynamic> p) {
    final id = _s(p['id']);
    final brouillon = p['type'] == 'brouillon';
    return ClCarteProjet(
      titre: _s(p['titre']),
      detail: _s(p['detail']),
      etiquette: _s(p['etiquette']),
      etiquettePleine: p['etiquettePleine'] != false,
      attenue: p['attenue'] == true,
      onTap: id.isEmpty
          ? null
          : () => context.push(brouillon
              // Le brouillon se reprend dans l'assistant, avec son identifiant.
              ? '/client/marketplace/new?draftId=${Uri.encodeQueryComponent(id)}'
              : '/client/projet/${Uri.encodeComponent(id)}'),
    );
  }
}
