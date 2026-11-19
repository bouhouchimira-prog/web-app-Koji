import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_chantier_widgets.dart';
import 'package:koji/apps/client/client_dates.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

String _s(dynamic v) => v is String ? v.trim() : '';

/// Nom de la famille d'une notification, quand le site n'a pas mis de titre.
const _famille = {
  'radar.message': 'Nouveau message',
  'radar.positionnement': 'Entreprise positionnée',
  'radar.expertise_publiee': 'Demande publiée',
  // CLI-04 (lib/notifications-particulier.js du site).
  'devis.a_signer': 'Devis à signer',
  'devis.nouvelle_version': 'Nouvelle version',
  'visite.confirmee': 'Visite confirmée',
  'facture.emise': 'Facture à payer',
  'paiement.recu': 'Paiement reçu',
  'reserve.levee': 'Réserve levée',
};

String _icone(dynamic type) => switch (type) {
      'radar.message' => ClIcones.messages,
      'radar.positionnement' => ClIcones.lieu,
      'radar.rdv_confirme' || 'visite.confirmee' => ClIcones.calendrier,
      'radar.expertise_publiee' ||
      'devis.a_signer' ||
      'devis.nouvelle_version' =>
        ClIcones.devis,
      'facture.emise' || 'paiement.recu' => ClIcones.paiement,
      'reserve.levee' || 'task.pending_validation' => ClIcones.drapeau,
      _ => ClIcones.cloche,
    };

/// Route de l'app pour un lien de l'espace client du site : le fil
/// (`/client/messages?fil=…`, même adresse dans l'app) ou le devis et ses
/// onglets (`/client/chantier/{id}?onglet=…`). Nulle sinon.
String? _routeDuLien(dynamic lien) {
  final texte = _s(lien);
  if (texte.startsWith('/client/messages')) return texte;
  return texte.isEmpty ? null : routeAppDuLienSite(texte);
}

String _titre(Map<String, dynamic> n) {
  final titre = _s(n['title']);
  if (titre.isNotEmpty) return titre;
  return _famille[n['type']] ?? 'Notification';
}

/// L'action réelle d'une notification : ouvrir le fil, les propositions ou
/// la demande. Nulle quand rien ne s'ouvre.
(String, String)? _action(Map<String, dynamic> n) {
  final offerId = _s(n['offerId']);
  final entreprise = _s(n['entrepriseUserId']);
  // L'action enregistrée avec la notification (devis, facture, chantier).
  final route = _routeDuLien(n['actionUrl']);
  if (route != null) {
    final libelle = _s(n['actionLabel']);
    return (libelle.isEmpty ? 'Ouvrir' : libelle, route);
  }
  if (n['type'] == 'radar.message' && offerId.isNotEmpty && entreprise.isNotEmpty) {
    return ('Ouvrir la conversation', _lienFil(offerId, entreprise));
  }
  if (n['type'] == 'radar.positionnement' && offerId.isNotEmpty) {
    return ('Voir les propositions', '/client/projet/${Uri.encodeComponent(offerId)}');
  }
  if (offerId.isNotEmpty) {
    return ('Voir la demande', '/client/marketplace/${Uri.encodeComponent(offerId)}');
  }
  return null;
}

String _lienFil(String offerId, String entreprise) =>
    '/client/messages?fil=${Uri.encodeQueryComponent('$offerId:$entreprise')}';

/// « Notifications » (maquette CLI-04) : liste par jour, non lue en gras avec
/// un point marine, « Tout marquer lu » ; le détail donne le fait en serif,
/// une action marine (la vraie : fil, propositions, demande) et « Écrire à
/// l'entreprise » quand un fil existe. Données : /api/notifications.
class ClientNotificationsScreen extends ConsumerStatefulWidget {
  const ClientNotificationsScreen({super.key, this.maintenant});

  /// Horloge figée des tests.
  final DateTime? maintenant;

  @override
  ConsumerState<ClientNotificationsScreen> createState() =>
      _ClientNotificationsScreenState();
}

class _ClientNotificationsScreenState
    extends ConsumerState<ClientNotificationsScreen> {
  String? _ouverte;

  MarketplaceRepository get _repo => ref.read(marketplaceRepositoryProvider);

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/client-home');
    }
  }

  Future<void> _ouvrir(Map<String, dynamic> n) async {
    setState(() => _ouverte = _s(n['id']));
    if (n['read'] == true) return;
    try {
      await _repo.markNotificationRead(n['id'] as String);
      ref.invalidate(clientNotificationsProvider);
    } catch (_) {
      // Lire n'empêche rien : la notification reste non lue.
    }
  }

  Future<void> _toutLire() async {
    try {
      await _repo.markAllNotificationsRead();
    } catch (_) {
      // L'actualisation montre ce qui a pu être enregistré.
    }
    ref.invalidate(clientNotificationsProvider);
  }

  Future<void> _supprimer(Map<String, dynamic> n) async {
    try {
      await _repo.deleteNotification(n['id'] as String);
      if (mounted) setState(() => _ouverte = null);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : 'Impossible de supprimer la notification.'),
      ));
    }
    ref.invalidate(clientNotificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final connecte = ref.watch(kojiWebApiClientProvider).isLoggedIn;
    final AsyncValue<List<Map<String, dynamic>>> async = connecte
        ? ref.watch(clientNotificationsProvider)
        : const AsyncData(<Map<String, dynamic>>[]);
    final liste = [...(async.valueOrNull ?? const <Map<String, dynamic>>[])]
      ..sort((a, b) => _s(b['createdAt']).compareTo(_s(a['createdAt'])));
    Map<String, dynamic>? ouverte;
    for (final n in liste) {
      if (_s(n['id']) == _ouverte) ouverte = n;
    }
    final maintenant = widget.maintenant ?? DateTime.now();

    return PopScope(
      canPop: ouverte == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) setState(() => _ouverte = null);
      },
      child: ouverte == null
          ? _liste(async, liste, maintenant)
          : _detail(ouverte, maintenant),
    );
  }

  Widget _liste(AsyncValue<List<Map<String, dynamic>>> async,
      List<Map<String, dynamic>> liste, DateTime maintenant) {
    final nonLues = liste.where((n) => n['read'] != true).length;
    Future<void> actualiser() async =>
        ref.invalidate(clientNotificationsProvider);

    // Groupes dans l'ordre de la liste (la plus récente d'abord).
    final groupes = <String, List<Map<String, dynamic>>>{};
    for (final n in liste) {
      groupes
          .putIfAbsent(groupeDuJour(lireDate(n['createdAt']), maintenant),
              () => [])
          .add(n);
    }

    final Widget corps;
    if (liste.isEmpty && async.isLoading) {
      corps = const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
              strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    } else if (liste.isEmpty && async.hasError) {
      corps = ClCorps(children: [
        Text('Impossible de charger vos notifications.',
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        ClBouton('Réessayer', secondaire: true, onPressed: actualiser),
      ]);
    } else {
      corps = ClCorps(onRefresh: actualiser, children: [
        if (liste.isEmpty)
          Text('Aucune notification pour le moment.',
              style: ClCharte.texte(14, couleur: ClCharte.gris))
        else
          Row(
            children: [
              Expanded(
                child: Text(
                  switch (nonLues) {
                    0 => 'Tout est lu',
                    1 => '1 non lue',
                    _ => '$nonLues non lues',
                  },
                  style: ClCharte.texte(13, couleur: ClCharte.gris),
                ),
              ),
              if (nonLues > 0) ClLien('Tout marquer lu', onTap: _toutLire),
            ],
          ),
        for (final MapEntry(key: jour, value: notifs) in groupes.entries)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClJour(jour),
              for (final (i, n) in notifs.indexed)
                ClLigneNotification(
                  icone: _icone(n['type']),
                  titre: _titre(n),
                  detail: _s(n['message']),
                  heure: switch (lireDate(n['createdAt'])) {
                    final d? => dateDeListe(d, maintenant),
                    null => '',
                  },
                  nonLue: n['read'] != true,
                  premiere: i == 0,
                  onTap: () => _ouvrir(n),
                ),
            ],
          ),
        const ClInfo('Un devis à signer ou sa nouvelle version, une entreprise '
            'qui répond à votre demande, une visite confirmée, un message, '
            "une facture à payer ou un paiement reçu, l'avancement du "
            'chantier, une réserve levée. Jamais de publicité.'),
      ]);
    }

    return ClEcran(titre: 'Notifications', onRetour: _retour, corps: corps);
  }

  Widget _detail(Map<String, dynamic> n, DateTime maintenant) {
    final action = _action(n);
    final date = lireDate(n['createdAt']);
    final entreprise = _s(n['entrepriseName']);
    final offerId = _s(n['offerId']);
    final entrepriseUserId = _s(n['entrepriseUserId']);
    // Le détail enregistré avec la notification (CLI-04) : texte, objet
    // (devis ou facture et montant), écart de version, rappel.
    final texte = _s(n['texte']).isNotEmpty ? _s(n['texte']) : _s(n['message']);
    final objet = n['objet'] is Map ? n['objet'] as Map : const {};
    final ecart = n['ecart'] is Map ? n['ecart'] as Map : const {};
    final routeEcart = _routeDuLien(ecart['lien']);
    final rappel = _s(n['rappel']);

    // « Écrire à l'entreprise » seulement si un fil existe déjà avec elle.
    var filExiste = false;
    if (n['type'] != 'radar.message' &&
        offerId.isNotEmpty &&
        entrepriseUserId.isNotEmpty) {
      final fils = ref.watch(clientMessagesInboxProvider).valueOrNull ?? const [];
      filExiste = fils.any((f) =>
          f['offerId'] == offerId && f['entrepriseUserId'] == entrepriseUserId);
    }

    return ClEcran(
      titre: _famille[n['type']] ?? 'Notification',
      sousTitre: [
        if (entreprise.isNotEmpty) entreprise,
        if (date != null) horodatage(date, maintenant, aujourdhui: true),
      ].join(' · '),
      onRetour: () => setState(() => _ouverte = null),
      corps: ClCorps(children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClPicto(_icone(n['type']), grand: true),
            const SizedBox(height: 12),
            Text(_titre(n), style: ClCharte.titre(22)),
            if (texte.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(texte, style: ClCharte.texte(14, hauteur: 1.5)),
            ],
          ],
        ),
        if (_s(objet['titre']).isNotEmpty)
          ClRangee(titre: _s(objet['titre']), detail: _s(objet['detail'])),
        if (_s(ecart['titre']).isNotEmpty)
          ClRangee(
            titre: _s(ecart['titre']),
            detail: _s(ecart['detail']),
            onTap: routeEcart == null ? null : () => context.push(routeEcart),
          ),
        const SizedBox(height: 4),
        if (action != null)
          ClBouton(action.$1, onPressed: () {
            final (_, lien) = action;
            if (lien.startsWith('/client/messages')) {
              context.go(lien);
            } else {
              context.push(lien);
            }
          }),
        if (filExiste)
          ClBouton("Écrire à l'entreprise",
              secondaire: true,
              onPressed: () =>
                  context.go(_lienFil(offerId, entrepriseUserId))),
        if (rappel.isNotEmpty) ClNote(rappel),
        Align(
          alignment: Alignment.centerLeft,
          child: ClLien('Supprimer cette notification',
              taille: 12, onTap: () => _supprimer(n)),
        ),
      ]),
    );
  }
}
