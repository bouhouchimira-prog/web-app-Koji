import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/entreprise/entreprise_actions.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/apps/entreprise/entreprise_search.dart';
import 'package:koji/apps/entreprise/pro_home/chiffres_du_mois.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/apps/entreprise/pro_home/radar_carte.dart';
import 'package:koji/design/koji_widgets.dart' show kojiEuro;
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/home/notifications/providers/notification_provider.dart';
import 'package:koji/features/moderation/moderation.dart';
import 'package:koji/features/quote/models/quote_status.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart'
    show userQuotesProvider;
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';

/// Koji Pro home in the new DA (mockups PRO-01 and PRO-01.2). Real data only:
/// the Radar shows the recommended price computed by koji-web with the pro's
/// own library and rate (never invented, never shown to the client); the
/// month figures come from the site's invoices. Phone: the Radar map fills
/// the screen and the home sits in a sheet over it (mockup « mapview »,
/// three heights); each chantier sits at the centre of its ~2 km cell, never
/// at its address. Not built yet: jetons and the per-offer position count
/// (nothing server-side).
class ProHome extends ConsumerStatefulWidget {
  const ProHome({
    super.key,
    this.onMenu,
    this.onNotifications,
    this.bottomPadding = 32,
  });

  /// Phone header (menu + notifications). Without it — wide layout — the
  /// entreprise shell already provides the top band and side menu.
  final VoidCallback? onMenu;
  final VoidCallback? onNotifications;

  /// Room left under the content (the phone bottom bar overlaps the page).
  final double bottomPadding;

  @override
  ConsumerState<ProHome> createState() => _ProHomeState();
}

const _premier = '__premier__';
const _leadsVisibles = 4;
const _aTraiterVisibles = 5;
const _relanceJours = 7;
const _nouveauHeures = 48;
const _maxPositions = 5; // même limite que l'API positionner

const _urgentLabels = {
  'degat': 'Dégât',
  'fuite': 'Fuite',
  'urgence': 'Urgence',
  'incendie': 'Incendie',
  'autre': 'Alerte',
};

String _pluriel(int n, String mot, [String? motPluriel]) =>
    '$n ${n > 1 ? motPluriel ?? '${mot}s' : mot}';

String _majuscule(String s) =>
    s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

/// The API returns « code postal + ville » (masked address): keep the town.
String _villeSeule(String adresse) {
  final text = adresse.trim();
  final match = RegExp(r'\b\d{5}\s+(.+)$').firstMatch(text);
  if (match != null) return match.group(1)!.trim();
  final parts =
      text.split(',').map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
  final last = parts.isEmpty ? text : parts.last;
  return last.replaceFirst(RegExp(r'^\d{5}\s*'), '');
}

const _coupures = [
  ',',
  '.',
  ';',
  ' : ',
  ' - ',
  ' qui ',
  ' car ',
  ' dans ',
  ' pour ',
  ' avec ',
  ' depuis ',
  ' et ',
];

/// Short title from the client's description (offers have no title field).
String _titreCourt(String description) {
  var text = description.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (text.isEmpty) return 'Chantier';
  for (final sep in _coupures) {
    final index = text.indexOf(sep);
    if (index >= 15) text = text.substring(0, index);
  }
  if (text.length > 48) {
    final cut = text.substring(0, 48);
    final space = cut.lastIndexOf(' ');
    text = '${space > 0 ? cut.substring(0, space) : cut}…';
  }
  return _majuscule(text);
}

bool _estNouveau(DateTime? publieeLe) =>
    publieeLe != null &&
    DateTime.now().difference(publieeLe).inHours < _nouveauHeures;

String _publication(DateTime? publieeLe) {
  if (publieeLe == null) return '';
  final heures = DateTime.now().difference(publieeLe).inHours;
  if (heures < 1) return "publié à l'instant";
  if (heures < 24) return 'publié il y a $heures h';
  return 'publié le ${DateFormat('d MMM', 'fr_FR').format(publieeLe)}';
}

String _ilYa(dynamic value) {
  final date = DateTime.tryParse('${value ?? ''}')?.toLocal();
  if (date == null) return '';
  final minutes = DateTime.now().difference(date).inMinutes;
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return 'il y a $minutes min';
  if (minutes < 1440) return 'il y a ${minutes ~/ 60} h';
  return DateFormat('d MMM', 'fr_FR').format(date);
}

String _libelleSuivi(RadarSuivi? suivi) {
  String quand() => suivi?.visiteLe == null
      ? ''
      : ', ${DateFormat('EEE d MMM HH:mm', 'fr_FR').format(suivi!.visiteLe!)}';
  if (suivi?.clientARepondu == true) return 'Le client vous a répondu';
  return switch (suivi?.visite) {
    'confirmee' => 'Visite confirmée${quand()}',
    'proposee' => 'Visite proposée${quand()}',
    'refusee' => 'Visite refusée, proposez une autre date',
    _ => 'En attente du client',
  };
}

DateTime? _date(dynamic v) =>
    v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

String _numeroDevis(Map<String, dynamic> q) =>
    (q['quoteNumber'] ?? q['reference'] ?? '').toString();

String _clientDevis(Map<String, dynamic> q) {
  final client = q['client'];
  final name = client is Map ? (client['name'] as String?)?.trim() ?? '' : '';
  return name.isNotEmpty ? name : 'Client';
}

bool _estBrouillon(Map<String, dynamic> q) =>
    (q['status'] ?? '').toString().toLowerCase() == 'draft';

/// One quote per devis number (the list is newest first).
List<Map<String, dynamic>> _devisUniques(List<Map<String, dynamic>> quotes) {
  final seen = <String>{};
  return quotes.where((q) {
    final key =
        (q['quoteNumber'] ?? q['reference'] ?? q['id'] ?? '').toString();
    return key.isEmpty || seen.add(key);
  }).toList();
}

class _ATraiter {
  const _ATraiter({
    required this.rang,
    required this.titre,
    required this.meta,
    required this.tag,
    required this.ton,
    required this.icon,
    this.onTap,
    this.tri = '',
  });

  final int rang;
  final String titre;
  final String meta;
  final String tag;
  final ProTagTone ton;
  final IconData icon;
  final VoidCallback? onTap;
  final String tri;
}

class _ProHomeState extends ConsumerState<ProHome> {
  String _filtre = 'tous';
  final _periodes = periodesDisponibles(DateTime.now());
  late String _periodeCle = _periodes[1].cle;
  String? _ouvert = _premier;
  bool _toutRadar = false;
  bool _toutTraiter = false;
  final _feuille = DraggableScrollableController();

  @override
  void dispose() {
    _feuille.dispose();
    super.dispose();
  }

  /// Position being sent ('') or its error message, per offer id.
  final Map<String, String> _envoi = {};
  final Set<String> _prisesLocales = {};

  bool _prise(RadarOffre o) => o.prise || _prisesLocales.contains(o.id);

  void _ongletAccueil(int tab) =>
      ref.read(entrepriseHomeTabProvider.notifier).state = tab;

  void _devisGuide() => guardEntrepriseAccess(
        context,
        ref,
        () => context.push('/quote/room-selection', extra: <String>[]),
      );

  /// The Radar conversation and offer detail live on the website for now.
  Future<void> _ouvrirSurLeSite(String offreId) => launchUrl(
        Uri.parse('${KojiWebApiConfig.baseUrl}/marketplace/$offreId'),
        mode: LaunchMode.externalApplication,
      );

  Future<void> _positionner(String offreId) async {
    setState(() => _envoi[offreId] = '');
    try {
      await ref.read(proKojiWebProvider).positionner(offreId);
      if (!mounted) return;
      setState(() {
        _envoi.remove(offreId);
        _prisesLocales.add(offreId);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Positionnement envoyé au client')),
      );
      ref.invalidate(proRadarProvider);
    } catch (e) {
      if (!mounted) return;
      setState(() => _envoi[offreId] = e is ProKojiWebException
          ? e.message
          : "Le positionnement n'a pas pu être envoyé.");
    }
  }

  /// Radar list for the current filter, recommended price first.
  List<RadarOffre> _radarListe(List<RadarOffre> offres, List<RadarOffre> prises,
          List<RadarOffre> nouveaux) =>
      [
        ...switch (_filtre) {
          'nouveaux' => nouveaux,
          'prises' => prises,
          _ => offres,
        }
      ]..sort(comparerPrix);

  String? _idOuvert(List<RadarOffre> liste) =>
      _ouvert == _premier ? (liste.isEmpty ? null : liste.first.id) : _ouvert;

  List<RadarPoint> _points(List<RadarOffre> liste) => [
        for (final o in liste)
          if (o.position != null)
            RadarPoint(
              id: o.id,
              lat: o.position!.lat,
              lon: o.position!.lon,
              label: prixCourt(o),
              taken: _prise(o),
            ),
      ];

  /// « Paris et 15 km autour · 4 chantiers · 1 sans lieu précis ».
  String _legende(RadarZone? zone, int surCarte, int total) => [
        if (zone != null)
          '${zone.ville.isEmpty ? 'Votre zone' : zone.ville} et '
              '${zone.radiusKm.round()} km autour',
        _pluriel(surCarte, 'chantier'),
        if (total > surCarte) '${total - surCarte} sans lieu précis',
      ].join(' · ');

  /// Touching a price on the map opens that chantier in the list; on the
  /// phone the sheet rises to half height so the open row shows.
  void _choisirSurCarte(String id) {
    setState(() => _ouvert = id);
    if (_feuille.isAttached && _feuille.size < 0.5) {
      _feuille.animateTo(0.55,
          duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    }
  }

  List<_ATraiter> _aTraiter({
    required List<Map<String, dynamic>> alertes,
    required List<RadarOffre> prises,
    required List<ScheduledTask> taches,
    required List<Map<String, dynamic>> factures,
    required List<Map<String, dynamic>> aSigner,
    required List<Map<String, dynamic>> chantiers,
  }) {
    final items = <_ATraiter>[];
    final now = DateTime.now();

    for (final alerte in alertes) {
      final qui = alerte['source'] == 'client' ? 'Client' : 'Ouvrier';
      Map<String, dynamic>? chantier;
      for (final c in chantiers) {
        if ('${c['id']}' == '${alerte['projectId']}') chantier = c;
      }
      items.add(_ATraiter(
        rang: 0,
        titre:
            '${_urgentLabels[alerte['type']] ?? 'Alerte'}, ${alerte['projectTitle'] ?? 'chantier'}',
        meta: [
          '$qui ${alerte['senderName'] ?? ''}'.trim(),
          _ilYa(alerte['createdAt'])
        ].where((s) => s.isNotEmpty).join(' · '),
        tag: 'Bloquant',
        ton: ProTagTone.solid,
        icon: Icons.warning_amber_rounded,
        onTap: chantier == null ? null : () => openChantier(context, chantier!),
        tri: '${alerte['createdAt'] ?? ''}',
      ));
    }

    // No subscription item in « À traiter »: nothing is sold in the app
    // (App Store 3.1.3(f)); the plan is taken and managed on getkoji.io.

    for (final offre in prises) {
      if (offre.suivi?.clientARepondu != true) continue;
      items.add(_ATraiter(
        rang: 1,
        titre: 'Réponse client, ${_titreCourt(offre.description)}',
        meta: [offre.metier, _villeSeule(offre.adresse)]
            .where((s) => s.isNotEmpty)
            .join(' · '),
        tag: 'À répondre',
        ton: ProTagTone.ink,
        icon: Icons.chat_bubble_outline,
        onTap: () => _ouvrirSurLeSite(offre.id),
        tri: offre.publieeLe?.toIso8601String() ?? '',
      ));
    }

    final debutJour = DateTime(now.year, now.month, now.day);
    final finJour = debutJour.add(const Duration(days: 1));
    for (final tache in taches) {
      if (tache.isStarted || !tache.startDateTime.isBefore(finJour)) continue;
      final enRetard = tache.startDateTime.isBefore(debutJour);
      items.add(_ATraiter(
        rang: 1,
        titre: tache.title.isEmpty ? 'Tâche' : tache.title,
        meta: [
          enRetard
              ? 'Prévue le ${DateFormat('d MMM', 'fr_FR').format(tache.scheduledDate)}'
              : "Aujourd'hui, ${tache.startTime}",
          tache.chantierReference ?? tache.chantierCity ?? '',
        ].where((s) => s.isNotEmpty).join(' · '),
        tag: enRetard ? 'En retard' : "Aujourd'hui",
        ton: ProTagTone.ink,
        icon: Icons.event_outlined,
        onTap: () => context.push('/planning'),
        tri: tache.startDateTime.toIso8601String(),
      ));
    }

    for (final facture in factures) {
      final reste = (facture['amountTtc'] as num?)?.toDouble() ?? 0;
      final echeance = _date(facture['dueDate']);
      final numero = '${facture['invoiceNumber'] ?? ''}'.trim();
      items.add(_ATraiter(
        rang: 2,
        titre:
            '${numero.isEmpty ? 'Facture' : 'Facture $numero'}, ${facture['client'] ?? facture['projectTitle'] ?? 'client'}',
        meta: [
          '${kojiEuro(reste)} en attente de règlement',
          if (echeance != null)
            'échue le ${DateFormat('d MMM', 'fr_FR').format(echeance)}',
        ].join(' · '),
        tag: 'À relancer',
        ton: ProTagTone.grey,
        icon: Icons.receipt_long_outlined,
        onTap: () => context.push('/facturation'),
        tri: echeance?.toIso8601String() ?? '',
      ));
    }

    for (final devis in aSigner) {
      final cree = _date(devis['created_at']);
      if (cree == null || now.difference(cree).inDays < _relanceJours) continue;
      items.add(_ATraiter(
        rang: 2,
        titre: 'Relance devis ${_numeroDevis(devis)}'.trim(),
        meta: '${_clientDevis(devis)} · en attente de signature',
        tag: 'À relancer',
        ton: ProTagTone.grey,
        icon: Icons.description_outlined,
        onTap: () => openSavedQuote(context, ref, devis),
        tri: cree.toIso8601String(),
      ));
    }

    items.sort((a, b) {
      final rang = a.rang.compareTo(b.rang);
      return rang != 0 ? rang : a.tri.compareTo(b.tri);
    });
    return items;
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final user = ref.watch(authRepositoryProvider).currentUser;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final quotes = _devisUniques(user == null
        ? const []
        : ref.watch(userQuotesProvider(user.id)).valueOrNull ?? const []);
    final chantiers = user == null
        ? const <Map<String, dynamic>>[]
        : ref.watch(userChantiersProvider(user.id)).valueOrNull ?? const [];
    final radarAsync = ref.watch(proRadarProvider);
    final taches = ref.watch(allScheduledTasksProvider).valueOrNull ?? const [];
    final alertes = ref.watch(proUrgentAlertsProvider).valueOrNull ?? const [];
    final factures =
        ref.watch(proOverdueInvoicesProvider).valueOrNull ?? const [];

    final aSigner = quotes
        .where((q) => QuoteStatus.isInProgress(q) && !_estBrouillon(q))
        .toList();
    final brouillons = quotes.where(_estBrouillon).toList();
    final chantiersActifs = chantiers.where(isChantierActive).length;

    // Offers the pro blocked are dropped everywhere (lists, counts, to-do).
    final masquees =
        ref.watch(moderationProvider.select((s) => s.hiddenOffers));
    final offres = (radarAsync.valueOrNull ?? const <RadarOffre>[])
        .where((o) => !masquees.contains(o.id))
        .toList();
    final prises = offres.where(_prise).toList();
    final disponibles = offres.where((o) => !_prise(o)).toList();
    final nouveaux =
        disponibles.where((o) => _estNouveau(o.publieeLe)).toList();

    final prenom = account == null
        ? null
        : (account.fullName.isNotEmpty
            ? account.firstName
            : account.displayName);
    final eyebrow = [
      _majuscule(DateFormat('EEEE d MMMM', 'fr_FR').format(DateTime.now())),
      if (aSigner.isNotEmpty)
        '${_pluriel(aSigner.length, 'devis', 'devis')} à signer',
      if (brouillons.isNotEmpty) _pluriel(brouillons.length, 'brouillon'),
    ].join(' · ');

    final aTraiter = _aTraiter(
      alertes: alertes,
      prises: prises,
      taches: taches,
      factures: factures,
      aSigner: aSigner,
      chantiers: chantiers,
    );

    final source = ref.watch(proChiffresSourceProvider).valueOrNull;
    final periode = _periodes.firstWhere((p) => p.cle == _periodeCle,
        orElse: () => _periodes[1]);
    final chiffres = source == null
        ? null
        : chiffresDuMois(
            invoices: source.invoices,
            quotes: source.quotes,
            projects: source.projects,
            expenses: source.expenses,
            periode: periode,
            aujourdhui: DateTime.now(),
          );

    final zone = ref.watch(proRadarZoneProvider);
    final liste = _radarListe(offres, prises, nouveaux);
    final points = _points(liste);
    final idOuvert = _idOuvert(liste);
    Widget carte({bool plein = false, EdgeInsets? marges}) => RadarCarte(
          points: points,
          selectedId: idOuvert,
          onSelect: _choisirSurCarte,
          zone: zone,
          caption: _legende(zone, points.length, liste.length),
          nouveaux: nouveaux.length,
          prises: prises.length,
          plein: plein,
          marges: marges ?? const EdgeInsets.fromLTRB(44, 92, 64, 60),
        );
    final avecFeuille = widget.onMenu != null;
    final radar = _radarCard(da, radarAsync, offres, prises, nouveaux,
        carte: avecFeuille || offres.isEmpty
            ? null
            : SizedBox(height: 300, child: carte()));
    final traiter = _traiterCard(da, aTraiter);
    final salut =
        prenom == null || prenom.isEmpty ? 'Bonjour.' : 'Bonjour, $prenom.';
    final brouillon = brouillons.isEmpty ? null : brouillons.first;

    return ColoredBox(
      color: da.page,
      child: LayoutBuilder(builder: (context, c) {
        final wide = c.maxWidth >= 1000;
        if (wide) {
          return ListView(
            padding: EdgeInsets.fromLTRB(32, 28, 32, widget.bottomPadding),
            children: [
              Text(eyebrow, style: da.text(13, color: da.grey)),
              const SizedBox(height: 8),
              Text(salut,
                  style: da.text(34, weight: FontWeight.w700, height: 1.15)),
              const SizedBox(height: 24),
              _hero(da, brouillon),
              const SizedBox(height: 24),
              _kpis(da, aSigner.length, chantiersActifs, disponibles.length,
                  disponibles.where((o) => o.prixTtc != null).length),
              const SizedBox(height: 24),
              _chiffresCard(da, periode, chiffres),
              const SizedBox(height: 24),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 160, child: radar),
                  const SizedBox(width: 28),
                  Expanded(flex: 100, child: traiter),
                ],
              ),
            ],
          );
        }

        if (avecFeuille) {
          return _accueilCarte(
            da,
            c,
            carte: carte,
            salut: salut,
            eyebrow: eyebrow,
            brouillon: brouillon,
            chiffres: chiffres,
            radar: radar,
            traiter: traiter,
          );
        }

        // Tablette étroite, sans menu propre : la carte dans la carte Radar.
        return ListView(
          padding: EdgeInsets.fromLTRB(16, 20, 16, widget.bottomPadding),
          children: [
            Text(eyebrow, style: da.text(12, color: da.grey)),
            const SizedBox(height: 4),
            Text(salut,
                style: da.text(26, weight: FontWeight.w700, height: 1.2)),
            const SizedBox(height: 14),
            _chiffresBande(da, chiffres, onTap: _ouvrirChiffres),
            const SizedBox(height: 14),
            ProPrimaryButton(
              label: 'Démarrer un devis guidé',
              icon: Icons.add,
              expand: true,
              onPressed: _devisGuide,
            ),
            if (brouillon != null) ...[
              const SizedBox(height: 10),
              _lienBrouillon(da, brouillon),
            ],
            const SizedBox(height: 18),
            radar,
            const SizedBox(height: 10),
            traiter,
          ],
        );
      }),
    );
  }

  /// Téléphone (maquette PRO-01 « Téléphone · tous les états ») : la carte
  /// du Radar plein écran, recherche et menu flottants, et l'accueil dans une
  /// feuille à trois hauteurs (ouverture, mi-hauteur, liste et à traiter).
  Widget _accueilCarte(
    ProDa da,
    BoxConstraints c, {
    required Widget Function({bool plein, EdgeInsets? marges}) carte,
    required String salut,
    required String eyebrow,
    required Map<String, dynamic>? brouillon,
    required ChiffresDuMois? chiffres,
    required Widget radar,
    required Widget traiter,
  }) {
    final hauteur = c.maxHeight;
    final haut = MediaQuery.paddingOf(context).top + 14;
    final bas = widget.bottomPadding;
    // Ouverture : 176 px de feuille au-dessus de la barre du bas.
    final ouverture = ((176 + bas) / hauteur).clamp(0.15, 0.6).toDouble();
    // Ouverte en grand : sous les boutons flottants.
    final grand =
        ((hauteur - haut - 54) / hauteur).clamp(ouverture, 1.0).toDouble();
    final milieu = 0.55.clamp(ouverture, grand).toDouble();
    return Stack(
      children: [
        Positioned.fill(
          child: carte(
            plein: true,
            marges: EdgeInsets.fromLTRB(36, haut + 44 + 48, 36, 176 + bas + 16),
          ),
        ),
        Positioned(top: haut, left: 14, right: 14, child: _boutonsCarte(da)),
        DraggableScrollableSheet(
          controller: _feuille,
          initialChildSize: ouverture,
          minChildSize: ouverture,
          maxChildSize: grand,
          snap: true,
          snapSizes: [if (milieu > ouverture && milieu < grand) milieu],
          builder: (context, scroll) => DecoratedBox(
            decoration: BoxDecoration(
              color: da.page,
              border: const Border(top: BorderSide(color: Color(0xFFCFCFC9))),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(16)),
              child: ListView(
                controller: scroll,
                padding: EdgeInsets.fromLTRB(14, 8, 14, bas),
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF8A8F98),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Text(salut,
                      style: da.text(20, weight: FontWeight.w700, height: 1.2)),
                  const SizedBox(height: 4),
                  Text(eyebrow, style: da.text(12, color: da.grey)),
                  const SizedBox(height: 10),
                  ProPrimaryButton(
                    label: 'Démarrer un devis guidé',
                    icon: Icons.add,
                    height: 46,
                    expand: true,
                    onPressed: _devisGuide,
                  ),
                  if (brouillon != null) ...[
                    const SizedBox(height: 10),
                    _lienBrouillon(da, brouillon),
                  ],
                  const SizedBox(height: 12),
                  _chiffresBande(da, chiffres, onTap: _ouvrirChiffres),
                  const SizedBox(height: 10),
                  radar,
                  const SizedBox(height: 10),
                  traiter,
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// Boutons flottants sur la carte (maquette « mtop ») : recherche, menu,
  /// et les notifications à droite.
  Widget _boutonsCarte(ProDa da) {
    final unread = ref.watch(unreadNotificationsCountProvider);
    Widget bouton(IconData icon, String label, VoidCallback? onTap) =>
        Semantics(
          button: true,
          label: label,
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              side: const BorderSide(color: Color(0xFFD9D9D4)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 44,
                height: 44,
                child: Icon(icon, size: 20, color: const Color(0xFF171B1E)),
              ),
            ),
          ),
        );
    return Row(
      children: [
        bouton(Icons.search, 'Rechercher',
            () => showEntrepriseSearch(context, ref)),
        const SizedBox(width: 8),
        bouton(Icons.menu, 'Menu', widget.onMenu),
        const Spacer(),
        Stack(
          clipBehavior: Clip.none,
          children: [
            bouton(Icons.notifications_none, 'Notifications',
                widget.onNotifications),
            if (unread > 0)
              Positioned(
                top: -6,
                right: -6,
                child: Container(
                  constraints: const BoxConstraints(minWidth: 18),
                  height: 18,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  alignment: Alignment.center,
                  color: da.fill,
                  child: Text(unread > 9 ? '9+' : '$unread',
                      style: da.text(10,
                          weight: FontWeight.w700, color: da.onFill)),
                ),
              ),
          ],
        ),
      ],
    );
  }

  Widget _lienBrouillon(ProDa da, Map<String, dynamic> brouillon) {
    return Align(
      alignment: Alignment.centerLeft,
      child: GestureDetector(
        onTap: () => openSavedQuote(context, ref, brouillon),
        child: Text(
          'Brouillon ${_numeroDevis(brouillon)} à reprendre'
              .replaceAll('  ', ' '),
          style: da.text(13, weight: FontWeight.w500).copyWith(
                decoration: TextDecoration.underline,
                decorationColor: da.ink,
              ),
        ),
      ),
    );
  }

  Widget _hero(ProDa da, Map<String, dynamic>? brouillon) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: da.card,
        border: Border.all(color: da.line),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('DEVIS GUIDÉ',
                    style: da.text(12,
                        weight: FontWeight.w600,
                        color: da.grey,
                        letterSpacing: 0.7)),
                const SizedBox(height: 4),
                Text('Décris le chantier. Koji le chiffre.',
                    style: da.text(20, weight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text('Questions oubliées posées, validation ligne par ligne.',
                    style: da.text(13, color: da.grey)),
                if (brouillon != null) ...[
                  const SizedBox(height: 6),
                  _lienBrouillon(da, brouillon),
                ],
              ],
            ),
          ),
          const SizedBox(width: 24),
          ProPrimaryButton(
            label: 'Démarrer un devis guidé',
            icon: Icons.add,
            onPressed: _devisGuide,
          ),
        ],
      ),
    );
  }

  // ---- PRO-01.2 : chiffres du mois ------------------------------------

  /// Ordinateur / tablette : même bloc que le site (période, trois chiffres,
  /// ligne « depuis janvier », lien vers les factures).
  Widget _chiffresCard(ProDa da, Periode periode, ChiffresDuMois? c) {
    Widget cellule(String label, double? montant, String detail) => Expanded(
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            decoration: BoxDecoration(
              color: da.soft,
              border: Border.all(color: da.rule),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: da.text(12, color: da.grey)),
                const SizedBox(height: 2),
                Text(montant == null ? '—' : kojiEuro(montant),
                    style: da.text(30, weight: FontWeight.w600, height: 1.2)),
                const SizedBox(height: 2),
                Text(detail, style: da.text(12, color: da.grey)),
              ],
            ),
          ),
        );
    final marge = c?.marge;
    final reglees = c == null
        ? ''
        : c.paiements == 0
            ? 'aucun règlement'
            : _pluriel(c.paiements, 'facture réglée', 'factures réglées');
    return ProCard(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProCardHeader(
            title: periode.titre,
            action: ProSegmented<String>(
              options: [for (final p in _periodes) (p.cle, p.label, -1)],
              value: periode.cle,
              onChanged: (cle) => setState(() => _periodeCle = cle),
            ),
          ),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                cellule('Facturé', c?.facture.total,
                    c == null ? 'HT' : 'HT · ${resumeFacture(c.facture)}'),
                const SizedBox(width: 16),
                cellule('Encaissé', c?.encaisse,
                    c == null ? 'TTC' : 'TTC · $reglees'),
                const SizedBox(width: 16),
                cellule(
                    'Reste à encaisser',
                    c?.reste.total,
                    c == null
                        ? 'TTC'
                        : 'TTC à ce jour · ${resumeReste(c.reste)}'),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  c == null
                      ? 'Chargement des factures…'
                      : 'Depuis janvier : ${kojiEuro(c.depuisJanvier)} HT facturés'
                          '${marge == null ? '' : ' · marge moyenne ${(marge.taux * 100).round()} % (Coût des chantiers)'}',
                  style: da.text(13),
                ),
              ),
              const SizedBox(width: 12),
              ProPill(
                label: 'Voir les factures',
                onTap: () => context.push('/facturation'),
              ),
            ],
          ),
          if ((c?.facture.htEstimes ?? 0) > 0) ...[
            const SizedBox(height: 8),
            Text(
              'HT estimé avec une TVA à 20 % pour '
              '${_pluriel(c!.facture.htEstimes, 'facture')} sans devis rattaché.',
              style: da.text(12, color: da.grey),
            ),
          ],
        ],
      ),
    );
  }

  /// Téléphone : la bande des trois chiffres du mois en cours ; un toucher
  /// ouvre le détail du mois.
  Widget _chiffresBande(ProDa da, ChiffresDuMois? c, {VoidCallback? onTap}) =>
      Semantics(
        button: true,
        label: 'Chiffres du mois',
        child: InkWell(onTap: onTap, child: _ChiffresBande(c: c)),
      );

  void _ouvrirChiffres() {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => _ChiffresMoisScreen(periode: _periodes[1]),
    ));
  }

  Widget _kpis(ProDa da, int aSigner, int actifs, int zone, int chiffres) {
    Widget kpi(String label, int value, String sub, VoidCallback? onTap) =>
        Expanded(
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label.toUpperCase(),
                      style: da.text(12,
                          weight: FontWeight.w500,
                          color: da.grey,
                          letterSpacing: 0.5)),
                  const SizedBox(height: 8),
                  Text('$value',
                      style: da.text(28, weight: FontWeight.w600, height: 1.1)),
                  const SizedBox(height: 4),
                  Text(sub, style: da.text(13, color: da.grey)),
                ],
              ),
            ),
          ),
        );
    return Container(
      decoration: BoxDecoration(
        color: da.card,
        border: Border(
          top: BorderSide(color: da.ink, width: 2),
          left: BorderSide(color: da.frame),
          right: BorderSide(color: da.frame),
          bottom: BorderSide(color: da.frame),
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            kpi('À signer', aSigner, 'devis en attente de signature',
                () => _ongletAccueil(1)),
            VerticalDivider(width: 1, color: da.line),
            kpi('Chantiers en cours', actifs, 'en cours ou à venir',
                () => _ongletAccueil(2)),
            VerticalDivider(width: 1, color: da.line),
            kpi(
              'Koji dans la zone',
              zone,
              chiffres == zone
                  ? 'chiffrés, prêts à être pris'
                  : '$chiffres chiffrés, prêts à être pris',
              null,
            ),
          ],
        ),
      ),
    );
  }

  Widget _radarCard(
    ProDa da,
    AsyncValue<List<RadarOffre>> radarAsync,
    List<RadarOffre> offres,
    List<RadarOffre> prises,
    List<RadarOffre> nouveaux, {
    Widget? carte,
  }) {
    // Prix recommandé, du plus haut (maquette PRO-01).
    final liste = _radarListe(offres, prises, nouveaux);
    final idOuvert = _idOuvert(liste);
    final visibles = _toutRadar ? liste : liste.take(_leadsVisibles).toList();
    // Un chantier choisi sur la carte au-delà des premières lignes reste
    // visible dans la liste.
    for (final o in liste.skip(_leadsVisibles)) {
      if (!_toutRadar && o.id == idOuvert) visibles.add(o);
    }
    final limiteAtteinte = prises.length >= _maxPositions;

    Widget message(String titre, [String? detail]) => Padding(
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(titre, style: da.text(14, weight: FontWeight.w600)),
              if (detail != null) ...[
                const SizedBox(height: 4),
                Text(detail, style: da.text(13, color: da.grey)),
              ],
            ],
          ),
        );

    final List<Widget> contenu;
    if (radarAsync.isLoading && offres.isEmpty) {
      contenu = [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Center(
            child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2)),
          ),
        ),
      ];
    } else if (radarAsync.hasError && offres.isEmpty) {
      contenu = [
        message('Radar indisponible pour le moment', '${radarAsync.error}'),
        Align(
          alignment: Alignment.centerLeft,
          child: ProPill(
            label: 'Réessayer',
            onTap: () => ref.invalidate(proRadarProvider),
          ),
        ),
        const SizedBox(height: 12),
      ];
    } else if (offres.isEmpty) {
      contenu = [
        message('Aucun chantier dans votre zone pour le moment',
            'Les chantiers publiés dans votre métier et votre zone apparaîtront ici.'),
      ];
    } else if (visibles.isEmpty) {
      contenu = [message('Aucun chantier dans ce filtre.')];
    } else {
      contenu = [
        for (final (i, offre) in visibles.indexed)
          offre.id == idOuvert
              ? _leadOuvert(da, offre, i + 1, limiteAtteinte)
              : _leadCompact(da, offre, i + 1),
      ];
    }

    return ProCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProCardHeader(
            title: 'Radar des chantiers',
            count: offres.length,
            action: liste.length > _leadsVisibles
                ? ProPill(
                    label: _toutRadar ? 'Réduire' : 'Tout voir',
                    onTap: () => setState(() => _toutRadar = !_toutRadar),
                  )
                : null,
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: ProSegmented<String>(
              options: [
                ('tous', 'Tous', offres.length),
                ('nouveaux', 'Nouveaux', nouveaux.length),
                ('prises', 'Positions prises', prises.length),
              ],
              value: _filtre,
              onChanged: (value) => setState(() {
                _filtre = value;
                _ouvert = _premier;
              }),
            ),
          ),
          if (carte != null) ...[
            const SizedBox(height: 12),
            carte,
          ],
          const SizedBox(height: 8),
          ...contenu,
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _leadCompact(ProDa da, RadarOffre offre, int n) {
    final prise = _prise(offre);
    return InkWell(
      onTap: () => setState(() => _ouvert = offre.id),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: da.line)),
        ),
        child: Row(
          children: [
            ProNumber(n, done: prise),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_titreCourt(offre.description),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: da.text(14, weight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    [_villeSeule(offre.adresse), offre.metier]
                        .where((s) => s.isNotEmpty)
                        .join(' · '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: da.text(12, color: da.grey),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(prixCourt(offre),
                    style: da.text(14, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  prise
                      ? 'Position prise'
                      : offre.prixPartiel
                          ? 'Partiel, ${offre.prixManquants} sans prix'
                          : _estNouveau(offre.publieeLe)
                              ? 'Nouveau'
                              : _publication(offre.publieeLe),
                  style: da.text(12, color: da.grey),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _leadOuvert(ProDa da, RadarOffre offre, int n, bool limiteAtteinte) {
    final prise = _prise(offre);
    final etat = _envoi[offre.id];
    final envoi = etat != null && etat.isEmpty;
    final erreur = etat != null && etat.isNotEmpty ? etat : null;

    Widget kv(String label, String value) => Text.rich(
          TextSpan(children: [
            TextSpan(text: '$label '),
            TextSpan(
              text: value,
              style: da.text(12, weight: FontWeight.w700),
            ),
          ]),
          style: da.text(12, color: da.grey),
        );

    return Container(
      color: da.soft,
      padding: const EdgeInsets.fromLTRB(10, 12, 10, 12),
      margin: const EdgeInsets.only(bottom: 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _ouvert = null),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ProNumber(n, done: prise),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_titreCourt(offre.description),
                          style: da.text(15,
                              weight: FontWeight.w700, height: 1.3)),
                      const SizedBox(height: 2),
                      Text(
                        [
                          _villeSeule(offre.adresse),
                          _publication(offre.publieeLe)
                        ].where((s) => s.isNotEmpty).join(' · '),
                        style: da.text(12, color: da.grey),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Text(prixCourt(offre),
                    style: da.text(15, weight: FontWeight.w700)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              kv('Prix recommandé',
                  '${prixCourt(offre)}${offre.prixPartiel ? ', partiel' : ''}'),
              kv('Métier', offre.metier.isEmpty ? 'Non précisé' : offre.metier),
              if (offre.delaiJours != null)
                kv('Délai estimé', _pluriel(offre.delaiJours!, 'jour')),
              kv('Photos', '${offre.photos}'),
              if (prise) kv('Suivi', _libelleSuivi(offre.suivi)),
            ],
          ),
          if (notePrix(offre).isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notePrix(offre), style: da.text(12, color: da.grey)),
          ],
          const SizedBox(height: 12),
          if (prise)
            Row(
              children: [
                Icon(Icons.check, size: 14, color: da.ink),
                const SizedBox(width: 6),
                Text('Position prise',
                    style: da.text(12, weight: FontWeight.w700)),
              ],
            )
          else
            ProPrimaryButton(
              label: envoi ? 'Envoi…' : 'Me positionner',
              icon: Icons.my_location,
              height: 44,
              expand: true,
              onPressed:
                  envoi || limiteAtteinte ? null : () => _positionner(offre.id),
            ),
          if (!prise && limiteAtteinte) ...[
            const SizedBox(height: 8),
            Text(
              'Vous avez $_maxPositions positions ouvertes, le maximum. '
              "Retirez-vous d'un chantier pour vous positionner ici.",
              style: da.text(12, color: da.grey),
            ),
          ],
          if (erreur != null) ...[
            const SizedBox(height: 8),
            Text(erreur, style: da.text(12, weight: FontWeight.w600)),
          ],
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () =>
                    showReportDialog(context, ref, _cibleOffre(offre)),
                icon: Icon(Icons.flag_outlined, size: 16, color: da.grey),
                label: Text('Signaler',
                    style:
                        da.text(12, weight: FontWeight.w600, color: da.grey)),
              ),
              TextButton.icon(
                onPressed: () => _bloquerOffre(offre),
                icon: Icon(Icons.block, size: 16, color: da.grey),
                label: Text('Bloquer',
                    style:
                        da.text(12, weight: FontWeight.w600, color: da.grey)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  ReportTarget _cibleOffre(RadarOffre offre) => ReportTarget(
        kind: 'offre_radar',
        id: offre.id,
        label: 'Annonce du Radar « ${_titreCourt(offre.description)} »'
            '${offre.adresse.isEmpty ? '' : ' (${_villeSeule(offre.adresse)})'}',
        excerpt: offre.description,
      );

  Future<void> _bloquerOffre(RadarOffre offre) async {
    final moderation = ref.read(moderationProvider.notifier);
    final bloquee = await confirmBlock(
      context,
      ref,
      target: _cibleOffre(offre),
      title: 'Bloquer cette annonce ?',
      explanation:
          'Elle disparaîtra de votre Radar et l\'équipe Koji sera prévenue '
          'pour examiner son auteur.',
      apply: () => moderation.setOfferHidden(offre.id, true),
    );
    if (bloquee && mounted) setState(() => _ouvert = _premier);
  }

  Widget _traiterCard(ProDa da, List<_ATraiter> items) {
    final visibles =
        _toutTraiter ? items : items.take(_aTraiterVisibles).toList();
    return ProCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ProCardHeader(
            title: 'À traiter',
            count: items.length,
            action: items.length > _aTraiterVisibles
                ? ProPill(
                    label: _toutTraiter ? 'Réduire' : 'Tout voir',
                    onTap: () => setState(() => _toutTraiter = !_toutTraiter),
                  )
                : null,
          ),
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(0, 6, 0, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Rien à traiter',
                      style: da.text(14, weight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text("Tout est à jour pour aujourd'hui.",
                      style: da.text(13, color: da.grey)),
                ],
              ),
            )
          else
            for (final (i, item) in visibles.indexed)
              InkWell(
                onTap: item.onTap,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: i == 0
                      ? null
                      : BoxDecoration(
                          border: Border(top: BorderSide(color: da.line)),
                        ),
                  child: Row(
                    children: [
                      Icon(item.icon, size: 20, color: da.ink),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(item.titre,
                                style: da.text(14, weight: FontWeight.w500)),
                            if (item.meta.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(item.meta,
                                  style: da.text(12, color: da.grey)),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      ProTag(item.tag, tone: item.ton),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

/// Bande des trois chiffres du mois (maquette PRO-01.2, téléphone).
class _ChiffresBande extends StatelessWidget {
  const _ChiffresBande({required this.c});
  final ChiffresDuMois? c;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    Widget cellule(String label, double? montant) => Expanded(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: da.text(11, color: da.grey)),
                const SizedBox(height: 2),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(montant == null ? '—' : kojiEuro(montant),
                      style: da.text(18, weight: FontWeight.w700)),
                ),
              ],
            ),
          ),
        );
    return Container(
      decoration: BoxDecoration(
        color: da.card,
        border: Border(
          top: BorderSide(color: da.ink, width: 2),
          left: BorderSide(color: da.frame),
          right: BorderSide(color: da.frame),
          bottom: BorderSide(color: da.frame),
        ),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            cellule('Facturé HT', c?.facture.total),
            VerticalDivider(width: 1, color: da.line),
            cellule('Encaissé', c?.encaisse),
            VerticalDivider(width: 1, color: da.line),
            cellule('À encaisser', c?.reste.total),
          ],
        ),
      ),
    );
  }
}

/// Détail téléphone du mois en cours (maquette « Chiffres du mois, depuis
/// l'accueil ») : la bande, puis « Ce mois » (factures émises, facture échue
/// la plus ancienne, marge moyenne depuis janvier).
class _ChiffresMoisScreen extends ConsumerWidget {
  const _ChiffresMoisScreen({required this.periode});

  final Periode periode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final da = ProDa.of(context);
    final async = ref.watch(proChiffresSourceProvider);
    final source = async.valueOrNull;
    final c = source == null
        ? null
        : chiffresDuMois(
            invoices: source.invoices,
            quotes: source.quotes,
            projects: source.projects,
            expenses: source.expenses,
            periode: periode,
            aujourdhui: DateTime.now(),
          );

    Widget ligne(String titre, String detail,
            {Widget? fin, VoidCallback? onTap}) =>
        InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: da.rule)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(titre, style: da.text(14, weight: FontWeight.w700)),
                      if (detail.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(detail, style: da.text(12, color: da.grey)),
                      ],
                    ],
                  ),
                ),
                fin ??
                    (onTap == null
                        ? const SizedBox.shrink()
                        : Icon(Icons.chevron_right, size: 18, color: da.ink)),
              ],
            ),
          ),
        );

    final echue = c?.reste.premiereEchue;
    final marge = c?.marge;
    final estimes = c?.facture.htEstimes ?? 0;
    return Scaffold(
      backgroundColor: da.page,
      appBar: AppBar(
        backgroundColor: da.card,
        foregroundColor: da.ink,
        elevation: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Accueil', style: da.text(16, weight: FontWeight.w700)),
            Text(periode.titre, style: da.text(12, color: da.grey)),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          _ChiffresBande(c: c),
          const SizedBox(height: 14),
          if (async.hasError && c == null)
            Text('Factures indisponibles pour le moment.',
                style: da.text(13, color: da.grey))
          else
            ProCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('Ce mois',
                        style: da.text(15, weight: FontWeight.w700)),
                  ),
                  ligne(
                    c == null
                        ? 'Chargement…'
                        : _majuscule(resumeFacture(c.facture)),
                    c == null ? '' : '${kojiEuro(c.facture.total)} HT facturés',
                    onTap: () => context.push('/facturation'),
                  ),
                  if (c != null && echue != null)
                    ligne(
                      c.reste.echues == 1
                          ? '1 facture échue'
                          : '${c.reste.echues} factures échues',
                      [
                        '${echue['client'] ?? echue['projectTitle'] ?? 'Client'}',
                        _pluriel((echue['retard'] as int?) ?? 0, 'jour'),
                      ].join(' · '),
                      fin: const ProTag('À relancer', tone: ProTagTone.grey),
                      onTap: () => context.push('/facturation'),
                    ),
                  if (marge != null)
                    ligne('Marge moyenne',
                        '${(marge.taux * 100).round()} % depuis janvier'),
                  if (c != null)
                    ligne('Depuis janvier',
                        '${kojiEuro(c.depuisJanvier)} HT facturés'),
                  if (estimes > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: Text(
                        'HT estimé avec une TVA à 20 % pour '
                        '${_pluriel(estimes, 'facture')} sans devis rattaché.',
                        style: da.text(12, color: da.grey),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
