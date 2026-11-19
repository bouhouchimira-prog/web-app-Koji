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

    final donnees = projetsAsync.valueOrNull ?? const <String, dynamic>{};
    // Un chantier signé sur le site est aussi suivi dans l'app (même
    // identifiant de chantier) : on garde la carte du site, plus complète.
    final duSite = ((donnees['projets'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .map((p) => _s(p['projectId']))
        .where((id) => id.isNotEmpty)
        .toSet();
    final chantiers = ClientChantier.group(tasksAsync.valueOrNull ?? const [])
        .where((c) => c.id == null || !duSite.contains(c.id))
        .toList();
    // Deux sources distinctes : les chantiers suivis dans l'app (tables
    // chantiers de Koji Pro, écran /client/chantier/:key) et ce que le site
    // connaît du compte (devis à signer et chantiers signés, demandes,
    // brouillons). Les devis du site s'ouvrent sur /client/devis/:quoteId.
    final projets = ((donnees['projets'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .where((p) => const {'chantier', 'offre', 'brouillon'}
            .contains(p['type']))
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
      // Urgences (maquette PRO-17, Koji Client › Urgence).
      ClRangee(
        titre: 'Une urgence ?',
        detail: 'Fuite, panne, serrure, vitre : un artisan chez vous '
            'rapidement',
        onTap: () => context.push('/client/urgence'),
      ),
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

  /// Devis, demande ou brouillon du site : titre, détail et étiquette tels
  /// quels.
  Widget _carteProjet(BuildContext context, Map<String, dynamic> p) {
    final id = _s(p['id']);
    final route = switch (p['type']) {
      // Le brouillon se reprend dans l'assistant, avec son identifiant.
      'brouillon' =>
        '/client/marketplace/new?draftId=${Uri.encodeQueryComponent(id)}',
      // Devis à signer ou chantier du site : la page CLI-02.
      'chantier' => '/client/devis/${Uri.encodeComponent(id)}',
      _ => '/client/projet/${Uri.encodeComponent(id)}',
    };
    return ClCarteProjet(
      titre: _s(p['titre']),
      detail: _s(p['detail']),
      etiquette: _s(p['etiquette']),
      etiquettePleine: p['etiquettePleine'] != false,
      attenue: p['attenue'] == true,
      onTap: id.isEmpty ? null : () => context.push(route),
    );
  }
}
