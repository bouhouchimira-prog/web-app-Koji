import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing/printing.dart';

import 'package:koji/apps/entreprise/chantiers/pro_reserves_screen.dart' show PrisePhoto, prendrePhotoAppareil;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/features/fournitures/pro/fournitures_logic.dart';
import 'package:koji/features/fournitures/pro/fournitures_pro_screen.dart';
import 'package:koji/features/fournitures/pro/fournitures_repository.dart';

// Bons de commande (PRO-07.6), réception de livraison (PRO-07.5), stock
// (PRO-07.4) et partenaires Koji (PRO-07.3), téléphone.

KojiTone _ton(String etat) => switch (etat) { 'livre' => KojiTone.green, 'partiel' || 'envoye' => KojiTone.amber, _ => KojiTone.grey };

Widget _ligne(BuildContext context, {required String titre, String sous = '', String droite = '', Widget? pill, VoidCallback? onTap}) {
  final p = context.koji;
  return InkWell(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 8, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              Text(titre, style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading)),
              if (pill != null) pill,
            ]),
            if (sous.isNotEmpty) ...[const SizedBox(height: 3), Text(sous, style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.35))],
          ]),
        ),
        if (droite.isNotEmpty) ...[const SizedBox(width: 10), Text(droite, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: p.heading))],
      ]),
    ),
  );
}

// --- Bons de commande -------------------------------------------------

class BonsListe extends ConsumerWidget {
  const BonsListe({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(bonsProvider).when(
          loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Bons indisponibles', subtitle: errorText(e)),
          data: (d) {
            final bons = (d['bons'] as List? ?? const []).whereType<Map>().map((b) => Map<String, dynamic>.from(b)).toList();
            final c = Map<String, dynamic>.from(d['chiffres'] as Map? ?? const {});
            if (bons.isEmpty) {
              return const KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Aucun bon de commande', subtitle: 'Ouvrez les fournitures d\'un chantier puis « Préparer les commandes ».');
            }
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('${num2(c['envoyes']).round()} ce mois · ${euroHt(num2(c['envoyesHt']))}', style: TextStyle(fontSize: 12.5, color: context.koji.muted)),
              for (final b in bons)
                _ligne(
                  context,
                  titre: '${b['numero']}',
                  pill: KojiPill(etatsBon['${b['etat']}'] ?? '${b['etat']}', tone: _ton('${b['etat']}')),
                  sous: [b['supplierName'], [b['projectTitle'], b['lot']].where((x) => '${x ?? ''}'.isNotEmpty).join(' · '), if ('${b['envoyeLe'] ?? ''}'.isNotEmpty) shortDay(b['envoyeLe'])].where((x) => '${x ?? ''}'.isNotEmpty).join(' · '),
                  droite: euroHt(totauxBon(lignesDe(b)).ht),
                  onTap: () => context.push(bonRoute('${b['id']}')),
                ),
            ]);
          },
        );
  }
}

class BonScreen extends ConsumerWidget {
  const BonScreen({super.key, required this.bonId});
  final String bonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(bonsProvider).when(
          loading: () => const KojiPage(title: 'Bon de commande', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
          error: (e, _) => KojiPage(title: 'Bon de commande', appBarOnPhone: true, main: [KojiEmptyState(title: 'Bon indisponible', subtitle: errorText(e), icon: KojiIcons.fournitures)]),
          data: (d) {
            final bon = (d['bons'] as List? ?? const []).whereType<Map>().map((b) => Map<String, dynamic>.from(b)).where((b) => b['id'] == bonId).firstOrNull;
            if (bon == null) return const KojiPage(title: 'Bon de commande', appBarOnPhone: true, main: [KojiEmptyState(title: 'Bon introuvable', icon: KojiIcons.fournitures)]);
            return _BonDetail(bon: bon);
          },
        );
  }
}

class _BonDetail extends ConsumerStatefulWidget {
  const _BonDetail({required this.bon});
  final Json bon;
  @override
  ConsumerState<_BonDetail> createState() => _BonDetailState();
}

class _BonDetailState extends ConsumerState<_BonDetail> {
  bool _busy = false;

  Future<void> _action(String action, String ok) async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(fournituresProRepositoryProvider).actionBon('${widget.bon['id']}', action);
      ref.invalidate(bonsProvider);
      if (!mounted) return;
      showFacturesMessage(context, r['bon'] != null && action != 'annuler' ? '$ok ${(r['bon'] as Map)['numero']}.' : ok);
      if (action == 'annuler' && r['supprime'] == true) context.pop();
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _pdf() async {
    try {
      final bytes = await ref.read(fournituresProRepositoryProvider).pdfBon('${widget.bon['id']}');
      await Printing.sharePdf(bytes: bytes, filename: 'Bon_de_commande_${widget.bon['numero']}.pdf');
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final b = widget.bon;
    final lignes = lignesDe(b);
    final t = totauxBon(lignes);
    final etat = '${b['etat']}';
    final reste = lignes.where((l) => num2(l['livre']) < num2(l['quantite']) - 1e-9).length;
    final facture = b['facture'] is Map ? Map<String, dynamic>.from(b['facture'] as Map) : null;
    return KojiPage(
      title: '${b['numeroKoji'] ?? b['numero']}',
      subtitle: '${b['supplierName']}${'${b['envoyeLe'] ?? ''}'.isNotEmpty ? ' · envoyé le ${shortDay(b['envoyeLe'])}' : ' · brouillon'}',
      appBarOnPhone: true,
      main: [
        Row(children: [KojiPill(etatsBon[etat] ?? etat, tone: _ton(etat))]),
        if ('${b['projectTitle'] ?? ''}'.isNotEmpty) FactureKv('Chantier', [b['projectTitle'], b['lot']].where((x) => '${x ?? ''}'.isNotEmpty).join(' · ')),
        if ('${b['livraisonLe'] ?? ''}'.isNotEmpty) FactureKv('Livraison', '${shortDay(b['livraisonLe'])}${'${b['livraisonHeure'] ?? ''}'.isNotEmpty ? ' avant ${b['livraisonHeure']}' : ''}'),
        const SizedBox(height: 6),
        for (final l in lignes)
          _ligne(
            context,
            titre: '${l['name']}',
            sous: '${quantiteBon(l)} × ${euro(num2(l['prixHt']))}${etat == 'brouillon' ? '' : num2(l['livre']) >= num2(l['quantite']) - 1e-9 ? ' · livré' : num2(l['livre']) > 0 ? ' · ${nb(num2(l['livre']))} reçu(s)' : ' · reste'}',
            droite: euro(r2(num2(l['quantite']) * num2(l['prixHt']))),
          ),
        FactureKv('Total HT', euro(t.ht), strong: true),
        FactureKv('TVA 20 %', euro(t.tva)),
        FactureKv('Total TTC', euro(t.ttc)),
        if (etat != 'brouillon' && reste > 0) Text('Reste à livrer : $reste ligne${reste > 1 ? 's' : ''}${b['resteRenvoye'] != null ? ' · relancé (${b['resteRenvoye']})' : ''}', style: TextStyle(fontSize: 12.5, color: p.muted)),
        if (facture != null) FactureKv('Facture ${facture['numero'] ?? ''}', '${euroHt(num2(facture['montantHt']))}${num2(facture['ecartHt']).abs() >= 0.01 ? ' · écart ${euro(num2(facture['ecartHt']))}' : ''}'),
        const SizedBox(height: 12),
        if (etat == 'brouillon') KojiButton(label: 'Envoyer le bon', expand: true, onPressed: () => showEnvoiBonSheet(context, ref, b)),
        if (etat == 'envoye' || etat == 'partiel') KojiButton(label: 'Livraison reçue', expand: true, onPressed: () => context.push(livraisonRoute('${b['id']}'))),
        const SizedBox(height: 8),
        KojiButton(label: 'PDF', variant: KojiButtonVariant.secondary, expand: true, onPressed: _pdf),
        const SizedBox(height: 8),
        KojiButton(label: 'Dupliquer', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _action('dupliquer', 'Copie créée en brouillon :')),
        if (etat == 'partiel' && b['resteRenvoye'] == null) ...[
          const SizedBox(height: 8),
          KojiButton(label: 'Renvoyer le reste', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _action('reste', 'Reste en brouillon :')),
        ],
        if (etat == 'brouillon' || etat == 'envoye')
          TextButton(onPressed: _busy ? null : () => _action('annuler', etat == 'brouillon' ? 'Brouillon supprimé.' : 'Bon annulé.'), child: Text(etat == 'brouillon' ? 'Supprimer le brouillon' : 'Annuler le bon', style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600))),
      ],
    );
  }
}

/// Envoi d'un bon : le montant est dit avant d'envoyer (jamais d'envoi
/// silencieux) ; l'envoi est la seule action principale.
Future<void> showEnvoiBonSheet(BuildContext context, WidgetRef ref, Json bon) => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      builder: (_) => _EnvoiSheet(bon: bon),
    );

class _EnvoiSheet extends ConsumerStatefulWidget {
  const _EnvoiSheet({required this.bon});
  final Json bon;
  @override
  ConsumerState<_EnvoiSheet> createState() => _EnvoiSheetState();
}

class _EnvoiSheetState extends ConsumerState<_EnvoiSheet> {
  late final _to = TextEditingController(text: '${widget.bon['supplierEmail'] ?? ''}');
  late String _canal = '${widget.bon['supplierEmail'] ?? ''}'.isEmpty ? 'manuel' : 'email';
  bool _busy = false;
  String _erreur = '';

  @override
  void dispose() {
    _to.dispose();
    super.dispose();
  }

  Future<void> _envoyer() async {
    setState(() {
      _busy = true;
      _erreur = '';
    });
    try {
      await ref.read(fournituresProRepositoryProvider).actionBon('${widget.bon['id']}', 'envoyer', {'canal': _canal, 'to': _to.text.trim(), 'confirme': true});
      ref.invalidate(bonsProvider);
      if (!mounted) return;
      Navigator.of(context).pop();
      showFacturesMessage(context, _canal == 'email' ? 'Bon ${widget.bon['numero']} envoyé à ${_to.text.trim()}.' : 'Bon ${widget.bon['numero']} noté comme passé.');
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _erreur = errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final total = totauxBon(lignesDe(widget.bon)).ht;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
          Text('Envoyer le bon · ${widget.bon['numero']}', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading)),
          const SizedBox(height: 12),
          KojiSegmented<String>(compact: true, options: const {'email': 'Par e-mail', 'manuel': 'Déjà passée'}, value: _canal, onChanged: (v) => setState(() => _canal = v)),
          if (_canal == 'email') ...[const SizedBox(height: 12), KojiField(label: 'E-mail du fournisseur', controller: _to, keyboardType: TextInputType.emailAddress)],
          const SizedBox(height: 12),
          KojiAlertBox(title: 'Vous commandez pour ${euroHt(total)}', message: 'Un bon de commande engage l\'entreprise ; les conditions de vente du fournisseur s\'appliquent.', tone: KojiTone.amber),
          if (_erreur.isNotEmpty) ...[const SizedBox(height: 10), Text(_erreur, style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600))],
          const SizedBox(height: 16),
          KojiButton(label: _canal == 'email' ? 'Envoyer le bon' : 'Noter comme passée', expand: true, loading: _busy, onPressed: _busy || (_canal == 'email' && _to.text.trim().isEmpty) ? null : _envoyer),
        ]),
      ),
    );
  }
}

// --- Réception d'une livraison ----------------------------------------

class LivraisonScreen extends ConsumerStatefulWidget {
  const LivraisonScreen({super.key, required this.bonId, this.prisePhoto});
  final String bonId;
  final PrisePhoto? prisePhoto;
  @override
  ConsumerState<LivraisonScreen> createState() => _LivraisonScreenState();
}

class _LivraisonScreenState extends ConsumerState<LivraisonScreen> {
  String _photo = '';
  Json? _lecture;
  List<Json> _ecarts = [];
  final List<String> _defauts = [];
  bool _busy = false;
  String _erreur = '';

  Future<String?> _prendre() async {
    final bytes = await (widget.prisePhoto ?? prendrePhotoAppareil)();
    return bytes == null ? null : 'data:image/jpeg;base64,${base64Encode(bytes)}';
  }

  Future<void> _lire() async {
    final photo = await _prendre();
    if (photo == null) return;
    setState(() {
      _photo = photo;
      _busy = true;
      _erreur = '';
    });
    try {
      final r = await ref.read(fournituresProRepositoryProvider).lireLivraison(widget.bonId, photo);
      setState(() {
        _lecture = r;
        _ecarts = (r['ecarts'] as List? ?? const []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      });
    } catch (e) {
      setState(() => _erreur = errorText(e));
    }
    setState(() => _busy = false);
  }

  Future<void> _valider(bool reclamer) async {
    setState(() => _busy = true);
    try {
      final r = await ref.read(fournituresProRepositoryProvider).validerLivraison({
        'bonId': widget.bonId,
        'numeroBl': _lecture?['numeroBl'] ?? '',
        'date': _lecture?['date'] ?? '',
        'ecarts': _ecarts,
        'photoBl': _photo.length < 900000 ? _photo : '',
        'photosDefaut': _defauts,
        'reclamer': reclamer,
      });
      ref.invalidate(bonsProvider);
      if (!mounted) return;
      showFacturesMessage(context, '${r['message'] ?? 'Livraison enregistrée.'}');
      context.pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _erreur = errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final problemes = _ecarts.where((e) => ['manquant', 'partiel', 'casse'].contains(e['etat'])).toList();
    return KojiPage(
      title: 'Livraison reçue',
      subtitle: _lecture == null ? 'Une photo du bon suffit' : 'Bon ${_lecture!['numeroBl'] ?? ''} · lu par Koji',
      appBarOnPhone: true,
      main: [
        if (_lecture == null) ...[
          Text('Koji lit le bon de livraison, le compare au bon de commande et signale manquants et casse.', style: TextStyle(fontSize: 13, color: p.muted, height: 1.4)),
          KojiButton(label: _busy ? 'Lecture du bon…' : 'Photo du bon de livraison', expand: true, loading: _busy, onPressed: _busy ? null : _lire),
        ] else ...[
          Text('Koji a lu ${_ecarts.length} ligne${_ecarts.length > 1 ? 's' : ''} · ${problemes.isEmpty ? 'aucun écart' : '${problemes.length} écart${problemes.length > 1 ? 's' : ''}'}', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
          for (var i = 0; i < _ecarts.length; i++)
            _ligne(
              context,
              titre: '${_ecarts[i]['name']}',
              sous: 'commandé ${nb(num2(_ecarts[i]['commande']))} · livré ${nb(num2(_ecarts[i]['livre']))}${'${_ecarts[i]['defaut'] ?? ''}'.isNotEmpty ? ' · ${_ecarts[i]['defaut']}' : ''}',
              pill: KojiPill(etatsLivraison['${_ecarts[i]['etat']}'] ?? '', tone: _ecarts[i]['etat'] == 'conforme' ? KojiTone.green : _ecarts[i]['etat'] == 'en_plus' ? KojiTone.grey : KojiTone.coral),
              onTap: () => _changerEtat(i),
            ),
          if (_ecarts.any((e) => e['etat'] == 'casse')) ...[
            const SizedBox(height: 8),
            KojiButton(
              label: _defauts.isEmpty ? 'Photo du défaut' : 'Photo du défaut · ${_defauts.length} jointe${_defauts.length > 1 ? 's' : ''}',
              variant: KojiButtonVariant.secondary,
              expand: true,
              onPressed: () async {
                final ph = await _prendre();
                if (ph != null) setState(() => _defauts.add(ph));
              },
            ),
          ],
          if (_erreur.isNotEmpty) Text(_erreur, style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (problemes.isNotEmpty) ...[
            KojiButton(label: 'Signaler au fournisseur', expand: true, loading: _busy, onPressed: _busy ? null : () => _valider(true)),
            const SizedBox(height: 8),
            KojiButton(label: 'Enregistrer sans réclamer', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _valider(false)),
            Text('Le chantier est prévenu : pose décalée si besoin.', style: TextStyle(fontSize: 12, color: p.faint)),
          ] else
            KojiButton(label: 'Livraison conforme · enregistrer', expand: true, loading: _busy, onPressed: _busy ? null : () => _valider(false)),
        ],
        if (_erreur.isNotEmpty && _lecture == null) Text(_erreur, style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
      ],
    );
  }

  /// Toucher une ligne fait défiler son état : conforme → manquant → cassé.
  void _changerEtat(int i) {
    const ordre = ['conforme', 'partiel', 'manquant', 'casse'];
    final e = _ecarts[i];
    if (e['etat'] == 'en_plus') return;
    final suivant = ordre[(ordre.indexOf('${e['etat']}') + 1) % ordre.length];
    setState(() => _ecarts[i] = {
          ...e,
          'etat': suivant,
          if (suivant == 'manquant') 'livre': 0,
          if (suivant == 'conforme') 'livre': e['commande'],
          if (suivant == 'casse' && '${e['defaut'] ?? ''}'.isEmpty) 'defaut': 'un défaut',
        });
  }
}

// --- Stock (Business) -------------------------------------------------

class StockListe extends ConsumerWidget {
  const StockListe({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(stockProvider).when(
          loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Stock indisponible', subtitle: errorText(e)),
          data: (d) {
            if (d['business'] != true) {
              return const KojiAlertBox(title: 'Stock · Business', message: 'Reliquats de chantier et stock manuel, proposés avant chaque commande. Inclus dans l\'offre Business.', tone: KojiTone.navy);
            }
            final c = Map<String, dynamic>.from(d['chiffres'] as Map? ?? const {});
            final lignes = (d['lignes'] as List? ?? const []).whereType<Map>().map((l) => Map<String, dynamic>.from(l)).toList();
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              KojiKpiRow(children: [
                KojiKpi(label: 'En stock', value: '${num2(c['articles']).round()}', sub: '${num2(c['lieux']).round()} lieu${num2(c['lieux']) > 1 ? 'x' : ''}'),
                KojiKpi(label: 'Valeur', value: euro(num2(c['valeur'])), sub: 'au dernier prix d\'achat'),
              ]),
              if (lignes.isEmpty)
                const KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Stock vide', subtitle: 'Il se remplit à la clôture d\'un chantier ou à la main, depuis le site.')
              else
                for (final l in lignes)
                  _ligne(
                    context,
                    titre: '${l['name']}',
                    sous: '${l['lieu']} · ${l['origineLabel'] ?? ''}${num2(l['moisSansUsage']) >= 7 ? ' · non utilisé depuis ${num2(l['moisSansUsage']).round()} mois' : ''}',
                    droite: qte(num2(l['quantite']), '${l['unit'] ?? ''}'),
                  ),
            ]);
          },
        );
  }
}

/// Clôture d'un chantier : ce qui reste (Business). Rien n'entre en stock
/// sans validation ; la casse est décochée.
class ClotureResteScreen extends ConsumerStatefulWidget {
  const ClotureResteScreen({super.key, required this.projectId});
  final String projectId;
  @override
  ConsumerState<ClotureResteScreen> createState() => _ClotureResteScreenState();
}

class _ClotureResteScreenState extends ConsumerState<ClotureResteScreen> {
  Json? _data;
  List<Json> _restes = [];
  String _erreur = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    ref.read(fournituresProRepositoryProvider).cloture(widget.projectId).then((d) {
      if (!mounted) return;
      setState(() {
        _data = d;
        _restes = (d['restes'] as List? ?? const []).whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList();
      });
    }).catchError((Object e) {
      if (mounted) setState(() => _erreur = errorText(e));
    });
  }

  Future<void> _valider(bool rien) async {
    setState(() => _busy = true);
    final lieu = ((_data?['lieux'] as List?) ?? const ['Dépôt']).first;
    try {
      await ref.read(fournituresProRepositoryProvider).actionStock({
        'action': 'cloture',
        'rien': rien,
        'projectTitle': (_data?['chantier'] as Map?)?['title'] ?? '',
        'lignes': rien ? [] : _restes.where((r) => r['coche'] == true).map((r) => {'articleId': r['articleId'], 'name': r['name'], 'unit': r['unit'], 'quantite': r['reste'], 'lieu': lieu, 'prixHt': r['prixHt']}).toList(),
      });
      ref.invalidate(stockProvider);
      if (!mounted) return;
      showFacturesMessage(context, rien ? 'Rien mis en stock.' : 'Mis en stock.');
      context.pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          _busy = false;
          _erreur = errorText(e);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final cochees = _restes.where((r) => r['coche'] == true).length;
    return KojiPage(
      title: 'Ce qui reste',
      subtitle: 'Clôture · ${(_data?['chantier'] as Map?)?['title'] ?? ''}',
      appBarOnPhone: true,
      main: [
        if (_erreur.isNotEmpty) Text(_erreur, style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
        if (_data == null && _erreur.isEmpty) const Center(child: CircularProgressIndicator()),
        if (_data != null && _data!['business'] != true) const KojiAlertBox(title: 'Stock · Business', message: 'Inclus dans l\'offre Business.', tone: KojiTone.navy),
        if (_data != null && _data!['business'] == true) ...[
          Text('Restes probables calculés par Koji. Coche ce qui reste vraiment.', style: TextStyle(fontSize: 13, color: p.muted)),
          for (var i = 0; i < _restes.length; i++)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: _restes[i]['coche'] == true,
              onChanged: (v) => setState(() => _restes[i] = {..._restes[i], 'coche': v == true}),
              title: Text('${_restes[i]['name']}', style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
              subtitle: Text('${qte(num2(_restes[i]['reste']), '${_restes[i]['unit'] ?? ''}')} · ${((_data!['lieux'] as List?) ?? const ['Dépôt']).first}'),
            ),
          if (_restes.isEmpty) Text('Aucun reste calculé sur les bons livrés.', style: TextStyle(color: p.faint)),
          KojiButton(label: 'Mettre $cochees article${cochees > 1 ? 's' : ''} en stock', expand: true, loading: _busy, onPressed: _busy || cochees == 0 ? null : () => _valider(false)),
          const SizedBox(height: 8),
          KojiButton(label: 'Rien à garder', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _valider(true)),
        ],
      ],
    );
  }
}

// --- Partenaires Koji -------------------------------------------------

class PartenairesListe extends ConsumerWidget {
  const PartenairesListe({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ref.watch(partenairesProvider).when(
          loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
          error: (e, _) => KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Partenaires indisponibles', subtitle: errorText(e)),
          data: (d) {
            final liste = (d['partenaires'] as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
            if (liste.isEmpty) {
              return const KojiEmptyState(compact: true, icon: KojiIcons.fournitures, title: 'Pas encore de partenaire Koji', subtitle: 'Les premiers fournisseurs rejoignent Koji ; recommandez-en un depuis le site.');
            }
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final x in liste)
                _ligne(
                  context,
                  titre: '${x['nom']}',
                  pill: const KojiPill('Partenaire Koji', tone: KojiTone.navy),
                  sous: [x['metiers'], x['zone'], '${num2(x['articles']).round()} articles', x['prixAJour'] == true ? 'prix valables jusqu\'au ${shortDay(x['validite'])}' : 'prix à mettre à jour'].where((s) => '${s ?? ''}'.isNotEmpty).join(' · '),
                  onTap: () => context.push(partenaireRoute('${x['id']}')),
                ),
            ]);
          },
        );
  }
}

class PartenaireScreen extends ConsumerWidget {
  const PartenaireScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    return ref.watch(partenaireProvider(id)).when(
          loading: () => const KojiPage(title: 'Partenaire Koji', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]),
          error: (e, _) => KojiPage(title: 'Partenaire Koji', appBarOnPhone: true, main: [KojiEmptyState(title: 'Partenaire indisponible', subtitle: errorText(e), icon: KojiIcons.fournitures)]),
          data: (d) {
            final x = Map<String, dynamic>.from(d['partenaire'] as Map);
            final articles = (d['articles'] as List? ?? const []).whereType<Map>().map((a) => Map<String, dynamic>.from(a)).toList();
            final ecart = x['ecart'];
            return KojiPage(
              title: '${x['nom']}',
              subtitle: 'Partenaire Koji · ${x['zone'] ?? ''}',
              appBarOnPhone: true,
              top: [
                KojiKpiRow(children: [
                  KojiKpi(label: 'Articles', value: '${num2(x['articles']).round()}'),
                  KojiKpi(label: 'Écart', value: ecart == null ? '—' : '${num2(ecart) > 0 ? '+' : '−'} ${num2(ecart).abs().round()} %'),
                  KojiKpi(label: 'Livraison', value: '${x['livraison'] ?? '—'}'),
                ]),
              ],
              main: [
                Text('Prix réservés aux utilisateurs Koji. Koji est rémunéré par le fournisseur.', style: TextStyle(fontSize: 12.5, color: p.muted)),
                for (final a in articles)
                  _ligne(
                    context,
                    titre: '${a['designation']}',
                    sous: '${a['conditionnement'] ?? ''} · public ${num2(a['prixPublic']) > 0 ? euro(num2(a['prixPublic'])) : '—'}${a['dansCatalogue'] == true ? ' · dans mon catalogue' : ''}',
                    droite: euro(num2(a['prixKoji'])),
                    onTap: a['dansCatalogue'] == true || x['prixAJour'] != true
                        ? null
                        : () async {
                            try {
                              await ref.read(fournituresProRepositoryProvider).ajouterPartenaire(id, '${a['ref']}');
                              ref.invalidate(partenaireProvider(id));
                              ref.invalidate(catalogueProvider);
                              if (context.mounted) showFacturesMessage(context, '« ${a['designation']} » ajouté à votre catalogue.');
                            } catch (e) {
                              if (context.mounted) showFacturesMessage(context, errorText(e));
                            }
                          },
                  ),
                Text('Touchez un article pour l\'ajouter à votre catalogue (prix Koji en achat, vente au prix public).', style: TextStyle(fontSize: 12, color: p.faint)),
              ],
            );
          },
        );
  }
}
