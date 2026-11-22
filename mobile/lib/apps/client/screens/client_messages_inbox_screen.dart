import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_dates.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';
import 'package:koji/features/moderation/moderation.dart';

String _s(dynamic v) => v is String ? v.trim() : '';

/// Clé de blocage et de signalement d'un fil, même forme que le site
/// (« radar:<demande>:<entreprise> », lib/moderation.js).
String cleModeration(Map<String, dynamic> fil) =>
    'radar:${fil['offerId']}:${fil['entrepriseUserId']}';

/// Clé d'un fil : une demande et une entreprise.
String _cle(Map<String, dynamic> fil) =>
    '${fil['offerId']}:${fil['entrepriseUserId']}';

String _nom(Map<String, dynamic> fil) {
  final snapshot = fil['entrepriseSnapshot'];
  final nom = snapshot is Map ? _s(snapshot['raisonSociale']) : '';
  return nom.isEmpty ? 'Entreprise' : nom;
}

List<Map<String, dynamic>> _messages(Map<String, dynamic> fil) =>
    ((fil['messages'] as List?) ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

String _demande(Map<String, dynamic> fil) {
  final offre = fil['offre'];
  return offre is Map ? _s(offre['description']) : '';
}

/// « Messages » (maquette CLI-03) : un fil par entreprise et par demande
/// (Radar des Chantiers, /api/client/messages), puis le fil ouvert avec ses
/// bulles et « Écrire un message… ». Un message traduit par l'entreprise
/// porte `traduction` : « traduit du portugais · voir l'original ». Le nom de
/// la personne n'apparaît que s'il est enregistré avec le message.
/// Rendez-vous et photos se règlent dans le fil ; le reste
/// (proposer une visite, carte de l'entreprise, paiements) sur la demande.
class ClientMessagesInboxScreen extends ConsumerStatefulWidget {
  const ClientMessagesInboxScreen({super.key, this.fil, this.maintenant});

  /// Fil à ouvrir d'emblée (« demande:entreprise »), depuis une notification.
  final String? fil;

  /// Horloge figée des tests.
  final DateTime? maintenant;

  @override
  ConsumerState<ClientMessagesInboxScreen> createState() =>
      _ClientMessagesInboxScreenState();
}

class _ClientMessagesInboxScreenState
    extends ConsumerState<ClientMessagesInboxScreen> {
  String? _ouvert;
  final _brouillon = TextEditingController();
  final _marques = <String>{};
  // Messages traduits dont l'original est affiché.
  final _originaux = <String>{};
  bool _envoi = false;
  String? _erreur;

  @override
  void initState() {
    super.initState();
    _ouvert = widget.fil;
  }

  @override
  void didUpdateWidget(covariant ClientMessagesInboxScreen old) {
    super.didUpdateWidget(old);
    if (widget.fil != null && widget.fil != old.fil) _ouvert = widget.fil;
  }

  @override
  void dispose() {
    _brouillon.dispose();
    super.dispose();
  }

  MarketplaceRepository get _repo => ref.read(marketplaceRepositoryProvider);

  void _ouvrir(Map<String, dynamic> fil) => setState(() {
        _ouvert = _cle(fil);
        _erreur = null;
      });

  void _fermer() => setState(() {
        _ouvert = null;
        _erreur = null;
      });

  /// Ouvrir un fil le lit : ses notifications « radar.message » passent en
  /// lues, comme sur le site. Jamais bloquant.
  Future<void> _marquerLu(Map<String, dynamic> fil) async {
    if (!_marques.add(_cle(fil))) return;
    try {
      final notifications = await _repo.getNotifications();
      final aMarquer = notifications.where((n) =>
          n['type'] == 'radar.message' &&
          n['read'] != true &&
          n['offerId'] == fil['offerId'] &&
          n['entrepriseUserId'] == fil['entrepriseUserId']);
      for (final n in aMarquer) {
        await _repo.markNotificationRead(n['id'] as String);
      }
      ref.invalidate(clientMessagesInboxProvider);
      ref.invalidate(clientNotificationsProvider);
    } catch (_) {
      // Comme sur le site : la lecture n'empêche rien.
    }
  }

  /// Envoi d'un message, d'une réponse à un rendez-vous ou de l'accès aux
  /// photos : même route, même gestion d'erreur.
  Future<void> _poster(Future<void> Function() envoi) async {
    if (_envoi) return;
    setState(() {
      _envoi = true;
      _erreur = null;
    });
    try {
      await envoi();
      ref.invalidate(clientMessagesInboxProvider);
    } catch (err) {
      if (mounted) {
        setState(() => _erreur = err is KojiWebApiException
            ? err.message
            : "Erreur lors de l'envoi.");
      }
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  void _envoyer(Map<String, dynamic> fil) {
    final texte = _brouillon.text.trim();
    if (texte.isEmpty) return;
    _poster(() async {
      await _repo.sendMessage(
        fil['offerId'] as String,
        entrepriseUserId: fil['entrepriseUserId'] as String,
        message: texte,
      );
      _brouillon.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.watch(kojiWebApiClientProvider);
    if (!api.isLoggedIn) {
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

    final async = ref.watch(clientMessagesInboxProvider);
    // La liste montre « Entreprise bloquée » dès qu'un fil est bloqué.
    ref.watch(moderationProvider.select((m) => m.blockedThreads));
    final fils = (async.valueOrNull ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();
    Map<String, dynamic>? ouvert;
    for (final f in fils) {
      if (_cle(f) == _ouvert) ouvert = f;
    }
    if (ouvert != null && ouvert['unread'] == true) {
      final fil = ouvert;
      WidgetsBinding.instance.addPostFrameCallback((_) => _marquerLu(fil));
    }
    final maintenant = widget.maintenant ?? DateTime.now();

    return PopScope(
      canPop: ouvert == null,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _fermer();
      },
      child: ouvert == null
          ? _liste(async, fils, maintenant)
          : _fil(ouvert, maintenant),
    );
  }

  Widget _liste(AsyncValue<List<Map<String, dynamic>>> async,
      List<Map<String, dynamic>> fils, DateTime maintenant) {
    final nonLus = fils.where((f) => f['unread'] == true).length;
    Future<void> actualiser() async =>
        ref.invalidate(clientMessagesInboxProvider);

    final Widget corps;
    if (fils.isEmpty && async.isLoading) {
      corps = const Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
              strokeWidth: 2, color: ClCharte.marine),
        ),
      );
    } else if (fils.isEmpty && async.hasError) {
      corps = ClCorps(children: [
        Text('Impossible de charger vos messages.',
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        ClBouton('Réessayer', secondaire: true, onPressed: actualiser),
      ]);
    } else if (fils.isEmpty) {
      corps = ClCorps(onRefresh: actualiser, children: [
        Text("Aucun message pour l'instant.",
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        const ClInfo('Les entreprises qui vous écrivent au sujet de vos '
            'demandes apparaîtront ici, un fil par entreprise.'),
      ]);
    } else {
      corps = ClCorps(onRefresh: actualiser, children: [
        DecoratedBox(
          decoration: BoxDecoration(
            color: ClCharte.blanc,
            border: Border.all(color: ClCharte.ligne),
          ),
          child: Column(
            children: [
              for (final (i, f) in fils.indexed)
                _LigneFil(
                  nom: _nom(f),
                  apercu: _apercu(f),
                  date: _derniereDate(f, maintenant),
                  nonLu: f['unread'] == true,
                  separee: i > 0,
                  onTap: () => _ouvrir(f),
                ),
            ],
          ),
        ),
      ]);
    }

    return ClEcran(
      titre: 'Messages',
      sousTitre: switch (nonLus) {
        0 => '',
        1 => '1 fil non lu',
        _ => '$nonLus fils non lus',
      },
      corps: corps,
    );
  }

  String _apercu(Map<String, dynamic> fil) {
    if (ref.read(moderationProvider).blockedThreads.contains(cleModeration(fil))) {
      return 'Entreprise bloquée';
    }
    final messages = _messages(fil);
    if (messages.isEmpty) return _demande(fil);
    final dernier = messages.last;
    final texte = _s(dernier['message']);
    return dernier['senderType'] == 'particulier' ? 'Vous · $texte' : texte;
  }

  String _derniereDate(Map<String, dynamic> fil, DateTime maintenant) {
    final messages = _messages(fil);
    final d = messages.isEmpty ? null : lireDate(messages.last['createdAt']);
    return d == null ? '' : dateDeListe(d, maintenant);
  }

  /// Ce qui est signalé : le fil avec cette entreprise, et un extrait de ses
  /// derniers messages pour l'équipe Koji.
  ReportTarget _cible(Map<String, dynamic> fil) {
    final recus = _messages(fil)
        .where((m) => m['senderType'] == 'entreprise')
        .map((m) => _s(m['message']))
        .where((t) => t.isNotEmpty)
        .toList();
    final demande = _demande(fil);
    final court =
        demande.length > 40 ? '${demande.substring(0, 40)}…' : demande;
    return ReportTarget(
      kind: 'conversation',
      id: cleModeration(fil),
      label:
          'Conversation avec ${_nom(fil)}${court.isEmpty ? '' : ' · $court'}',
      excerpt: recus.reversed.take(5).toList().reversed.join(' / '),
    );
  }

  Future<void> _moderer(String action, Map<String, dynamic> fil) async {
    final moderation = ref.read(moderationProvider.notifier);
    final cle = cleModeration(fil);
    switch (action) {
      case 'signaler':
        await showReportDialog(context, ref, _cible(fil), depuisKoji: true);
      case 'bloquer':
        await confirmBlock(
          context,
          ref,
          target: _cible(fil),
          depuisKoji: true,
          title: 'Bloquer ${_nom(fil)} ?',
          explanation: 'Ses messages seront masqués et vous ne pourrez plus '
              "lui écrire. L'équipe Koji est prévenue. Vous pourrez la "
              'débloquer depuis cet écran.',
          apply: () => moderation.setThreadBlocked(cle, true),
        );
      case 'debloquer':
        await moderation.setThreadBlocked(cle, false);
    }
  }

  Widget _menu(Map<String, dynamic> fil, bool bloque) =>
      PopupMenuButton<String>(
        tooltip: 'Signaler ou bloquer',
        icon: const Icon(Icons.more_vert, color: ClCharte.blanc),
        onSelected: (a) => _moderer(a, fil),
        itemBuilder: (_) => [
          const PopupMenuItem(
              value: 'signaler', child: Text('Signaler la conversation')),
          bloque
              ? const PopupMenuItem(
                  value: 'debloquer', child: Text('Débloquer cette entreprise'))
              : const PopupMenuItem(
                  value: 'bloquer', child: Text('Bloquer cette entreprise')),
        ],
      );

  Widget _fil(Map<String, dynamic> fil, DateTime maintenant) {
    final nom = _nom(fil);
    final bloque = ref.watch(moderationProvider
        .select((m) => m.blockedThreads.contains(cleModeration(fil))));
    // Bloquée : les messages de l'entreprise sont masqués, la réponse fermée.
    final messages = _messages(fil)
        .where((m) => !bloque || m['senderType'] != 'entreprise')
        .toList();
    final offerId = _s(fil['offerId']);
    final entrepriseUserId = _s(fil['entrepriseUserId']);
    final repondus = messages
        .map((m) => m['respondsToId'])
        .whereType<String>()
        .toSet();
    final photosDemandees = messages.any((m) => m['kind'] == 'photo_request');
    final photosMontrees = messages.any((m) => m['kind'] == 'photo_grant');

    Widget bulle(Map<String, dynamic> m) {
      final date = lireDate(m['createdAt']);
      final aRepondre = m['kind'] == 'rdv_proposal' &&
          m['senderType'] == 'entreprise' &&
          !repondus.contains(m['id']);
      void repondre(bool accepte) => _poster(() => _repo.respondRdv(
            offerId,
            entrepriseUserId: entrepriseUserId,
            respondsToId: m['id'] as String,
            accepted: accepte,
          ));
      // Traduit par l'entreprise avant l'envoi (CLI-03) : « traduit du
      // portugais · voir l'original » ; un appui montre l'original.
      final traduction =
          m['traduction'] is Map ? m['traduction'] as Map : const {};
      final original = _s(traduction['original']);
      final id = _s(m['id']);
      final voir = _originaux.contains(id);
      final envoyee = m['senderType'] == 'particulier';
      final traduite = original.isEmpty
          ? null
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (voir)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Text('Original : $original',
                        textDirection: traduction['sens'] == 'rtl'
                            ? TextDirection.rtl
                            : null,
                        style: ClCharte.texte(13,
                            couleur: envoyee ? ClCharte.clair : ClCharte.gris,
                            hauteur: 1.45)),
                  ),
                Semantics(
                  button: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => setState(() =>
                        voir ? _originaux.remove(id) : _originaux.add(id)),
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(
                            text: 'traduit du ${_s(traduction['langue'])} · '),
                        TextSpan(
                          text: voir ? "masquer l'original" : "voir l'original",
                          style: const TextStyle(
                              decoration: TextDecoration.underline),
                        ),
                      ]),
                      style: ClCharte.texte(11,
                          couleur: envoyee ? ClCharte.clair : ClCharte.gris),
                    ),
                  ),
                ),
              ],
            );
      return ClBulle(
        texte: _s(m['message']),
        envoyee: envoyee,
        // Nom de la personne seulement s'il est enregistré avec le message.
        auteur: _s(m['auteur']),
        note: date == null ? '' : horodatage(date, maintenant),
        actions: traduite != null && !aRepondre
            ? traduite
            : aRepondre
            ? Row(
                children: [
                  Expanded(
                    child: ClBouton('Accepter',
                        compact: true,
                        onPressed: _envoi ? null : () => repondre(true)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClBouton('Refuser',
                        secondaire: true,
                        compact: true,
                        onPressed: _envoi ? null : () => repondre(false)),
                  ),
                ],
              )
            : null,
      );
    }

    // Du plus récent au plus ancien : la liste part du bas, comme un fil.
    final blocs = <Widget>[
      if (_erreur != null)
        Text(_erreur!, style: ClCharte.texte(13, couleur: ClCharte.gris)),
      if (bloque)
        ClInfo('Vous avez bloqué $nom : ses messages sont masqués. '
            'Débloquez-la avec le menu ⋮ pour lui écrire de nouveau.'),
      if (!bloque && photosDemandees && !photosMontrees)
        ClBouton('Montrer mes photos à $nom',
            secondaire: true,
            onPressed: _envoi
                ? null
                : () => _poster(() => _repo.grantPhotos(offerId,
                    entrepriseUserId: entrepriseUserId))),
      for (final m in messages.reversed) bulle(m),
      Align(
        alignment: Alignment.centerLeft,
        child: ClLien('Voir la demande : visite, photos, paiements',
            taille: 12,
            onTap: () =>
                context.push('/client/marketplace/${Uri.encodeComponent(offerId)}')),
      ),
    ];

    return ClEcran(
      titre: nom,
      sousTitre: _demande(fil),
      onRetour: _fermer,
      action: _menu(fil, bloque),
      // Court, le fil reste en haut (maquette) ; long, il s'ouvre en bas.
      corps: Align(
        alignment: Alignment.topCenter,
        child: ListView(
          reverse: true,
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          children: [
            for (final (i, b) in blocs.indexed) ...[
              if (i > 0) const SizedBox(height: ClCharte.ecart),
              b,
            ],
          ],
        ),
      ),
      bas: bloque
          ? null
          : ClSaisie(
              controller: _brouillon,
              envoi: _envoi,
              onEnvoyer: () => _envoyer(fil),
            ),
    );
  }
}

/// Un fil de la liste (`.cw-mt`) : entreprise, dernier message, date ; non
/// lu, un point marine.
class _LigneFil extends StatelessWidget {
  const _LigneFil({
    required this.nom,
    required this.apercu,
    required this.date,
    required this.nonLu,
    required this.separee,
    required this.onTap,
  });

  final String nom;
  final String apercu;
  final String date;
  final bool nonLu;
  final bool separee;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: nonLu ? 'Non lu' : null,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            border: separee
                ? const Border(top: BorderSide(color: Color(0xFFEFEBE3)))
                : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(nom,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ClCharte.texte(14, graisse: FontWeight.w700)),
                    const SizedBox(height: 3),
                    Text(apercu,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: ClCharte.texte(12,
                            couleur: nonLu ? ClCharte.marine : ClCharte.gris)),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(date, style: ClCharte.texte(11, couleur: ClCharte.gris)),
                  if (nonLu) ...[
                    const SizedBox(height: 6),
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: ClCharte.marine,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
