import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/devis/devis_suivi.dart' show heureDeParis;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart' show proKojiWebProvider, proRadarProvider, ProKojiWebException;
import 'package:koji/apps/entreprise/visite/pro_visite_screen.dart' show ouvrirVisite, visiteStoreProvider;

// Radar côté téléphone (maquette PRO-04) : fiche du chantier, « Me
// positionner » en plein écran, « Mes positions ». Les jetons sont réservés
// au positionnement, débités seulement si le client confirme un rendez-vous.
// L'app ne vend rien : la recharge de jetons se fait sur getkoji.io.

String _s(dynamic v) => v == null ? '' : '$v';
String _pluriel(int n, String un, String plusieurs) => '$n ${n > 1 ? plusieurs : un}';
String _jour(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? '' : DateFormat('EEE d MMM', 'fr_FR').format(heureDeParis(d));
}

String _heure(String iso) {
  final d = DateTime.tryParse(iso);
  if (d == null) return '';
  final p = heureDeParis(d);
  return '${p.hour} h${p.minute == 0 ? '' : ' ${p.minute.toString().padLeft(2, '0')}'}';
}

String _ville(String adresse) {
  final m = RegExp(r'\b\d{5}\s+(.+)$').firstMatch(adresse.trim());
  return m != null ? m.group(1)!.trim() : adresse.trim();
}

String titreRadar(String description) {
  var t = description.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (t.isEmpty) return 'Chantier';
  for (final sep in [',', '.', ';', ' : ', ' - ', ' pour ', ' avec ', ' et ']) {
    final i = t.indexOf(sep);
    if (i >= 15) t = t.substring(0, i);
  }
  if (t.length > 48) t = '${t.substring(0, 48).substring(0, t.substring(0, 48).lastIndexOf(' '))}…';
  return t[0].toUpperCase() + t.substring(1);
}

PreferredSizeWidget _barre(BuildContext context, ProDa da, String titre, String sousTitre) => PreferredSize(
      preferredSize: const Size.fromHeight(56),
      child: Material(
        color: da.card,
        child: SafeArea(
          bottom: false,
          child: Container(
            height: 56,
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
            child: Row(children: [
              IconButton(onPressed: () => Navigator.of(context).maybePop(), tooltip: 'Retour', icon: Icon(Icons.chevron_left, color: da.ink, size: 26)),
              Expanded(
                child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(titre, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(15, weight: FontWeight.w700)),
                  if (sousTitre.isNotEmpty) Text(sousTitre, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                ]),
              ),
              const SizedBox(width: 12),
            ]),
          ),
        ),
      ),
    );

Widget _tag(ProDa da, String t, {bool plein = false}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(color: plein ? da.fill : da.card, border: Border.all(color: plein ? da.fill : da.ink)),
      child: Text(t, style: da.text(11.5, weight: FontWeight.w700, color: plein ? da.onFill : da.ink)),
    );

Widget _jetonsCarte(ProDa da, String titre, String detail) => Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(color: da.soft, border: Border.all(color: da.line)),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.add_circle_outline, size: 20, color: da.ink),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(titre, style: da.text(14, weight: FontWeight.w700)),
            Text(detail, style: da.text(12, color: da.grey, height: 1.35)),
          ]),
        ),
      ]),
    );

Widget _points(ProDa da, int prises, int max) => Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 0; i < max; i++) ...[
        Container(width: 16, height: 7, color: i < prises ? da.ink : da.pill),
        const SizedBox(width: 3),
      ],
    ]);

// ── Fiche du chantier ─────────────────────────────────────────────────────

class ProRadarFicheView extends StatelessWidget {
  const ProRadarFicheView({
    super.key,
    required this.offre,
    required this.onPositionner,
    required this.onMesPositions,
    this.onRetirer,
    this.onPasInteresse,
    this.onPreparerVisite,
  });

  final Map<String, dynamic> offre;
  final VoidCallback onPositionner;
  final VoidCallback onMesPositions;
  final VoidCallback? onRetirer;
  final VoidCallback? onPasInteresse;
  final VoidCallback? onPreparerVisite;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final titre = titreRadar(_s(offre['description']));
    final ville = _ville(_s(offre['address']));
    final distance = offre['distanceKm'] is num ? '${'${offre['distanceKm']}'.replaceAll('.', ',')} km' : '';
    final publie = DateTime.tryParse(_s(offre['publieLe'] ?? offre['createdAt']));
    final postes = [for (final l in (offre['ouvrages'] as List? ?? const [])) if (l is Map) ...(l['postes'] as List? ?? const []).map((x) => '$x')];
    final places = offre['places'] is Map ? offre['places'] as Map : const {};
    final prises = (places['prises'] as num?)?.toInt() ?? 0;
    final max = (places['max'] as num?)?.toInt() ?? 3;
    final jetons = (offre['jetons'] as num?)?.toInt() ?? 0;
    final solde = ((offre['solde'] as Map?)?['solde'] as num?)?.toInt() ?? 0;
    final prix = (offre['prixRecommande'] as Map?)?['ttc'] as num?;
    final pos = offre['maPosition'] is Map ? offre['maPosition'] as Map : null;
    final etat = _s(pos?['etat']);
    final insuffisant = pos == null && solde < jetons;
    final complet = places['complet'] == true;
    final expire = offre['expiree'] == true || offre['retiree'] == true;
    final chips = [
      if (_s(offre['metierCorrespond']).isNotEmpty) 'Vos métiers' else if (_s(offre['metier']).isNotEmpty) _s(offre['metier']),
      if (offre['dansZone'] == true) 'Dans votre zone',
      if (offre['delaiEstimeJours'] is num) '${offre['delaiEstimeJours']} jours estimés',
    ];

    Widget bas;
    if (etat == 'rdv') {
      bas = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text('Visite confirmée · ${_jour(_s(pos!['rdvDate']))} ${_heure(_s(pos['rdvDate']))}', style: da.text(14, weight: FontWeight.w700)),
        Text('${_s((pos['jetons'] as Map?)?['texte'])} · coordonnées disponibles', style: da.text(12.5, color: da.grey)),
        const SizedBox(height: 10),
        ProPrimaryButton(label: 'Préparer la visite', expand: true, onPressed: onPreparerVisite),
      ]);
    } else if (etat == 'attente') {
      bas = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Expanded(child: Text('Proposition envoyée', style: da.text(14, weight: FontWeight.w700))), _tag(da, 'Envoyé')]),
        Text(_s((pos!['jetons'] as Map?)?['texte']), style: da.text(12.5, color: da.grey)),
        const SizedBox(height: 8),
        Row(children: [
          if (onRetirer != null) TextButton(onPressed: onRetirer, style: TextButton.styleFrom(foregroundColor: da.ink), child: Text('Retirer', style: da.text(13.5, weight: FontWeight.w600))),
          const Spacer(),
          OutlinedButton(onPressed: onMesPositions, style: OutlinedButton.styleFrom(foregroundColor: da.ink, side: const BorderSide(color: Color(0xFF8A8F98))), child: Text('Mes positions', style: da.text(13.5, weight: FontWeight.w600))),
        ]),
      ]);
    } else if (pos != null && pos['termine'] == true || expire) {
      bas = Text(pos != null ? '${pos['etape']} · ${_s((pos['jetons'] as Map?)?['texte'])}' : 'Ce chantier a quitté le Radar.', style: da.text(13, color: da.grey));
    } else if (complet) {
      bas = Text('Trois entreprises sont positionnées. Si l\'une se retire, la place se rouvre.', style: da.text(13, color: da.grey));
    } else {
      bas = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (insuffisant)
          _jetonsCarte(da, 'Il faut ${_pluriel(jetons, 'jeton', 'jetons')}, il vous en reste $solde', 'Les jetons se rechargent depuis votre compte Koji Pro sur getkoji.io.')
        else
          _jetonsCarte(da, _pluriel(jetons, 'jeton', 'jetons'), 'débités seulement si le client confirme un rendez-vous'),
        const SizedBox(height: 10),
        Row(children: [
          if (onPasInteresse != null)
            TextButton(onPressed: onPasInteresse, style: TextButton.styleFrom(foregroundColor: da.ink), child: Text('Pas intéressé', style: da.text(13, weight: FontWeight.w600))),
          const SizedBox(width: 8),
          Expanded(child: ProPrimaryButton(label: 'Me positionner', expand: true, onPressed: insuffisant ? null : onPositionner)),
        ]),
      ]);
    }

    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(context, da, titre, [ville, distance, if (publie != null) DateFormat('d MMM', 'fr_FR').format(publie)].where((x) => x.isNotEmpty).join(' · ')),
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), children: [
            if (chips.isNotEmpty)
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final (i, c) in chips.indexed)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(color: da.card, border: Border.all(color: i < 2 && c != _s(offre['metier']) ? da.ink : da.line)),
                    child: Text(c, style: da.text(12, weight: i < 2 ? FontWeight.w600 : FontWeight.w400)),
                  ),
              ]),
            const SizedBox(height: 12),
            Text('Projet du client', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
            const SizedBox(height: 4),
            Text(postes.isNotEmpty ? postes.join(' · ') : _s(offre['description']), style: da.text(14, height: 1.5)),
            if (postes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text('« ${_s(offre['description'])} »', style: da.text(13, color: da.grey, height: 1.45)),
            ],
            const SizedBox(height: 14),
            Container(
              decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
              child: IntrinsicHeight(
                child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Votre prix', style: da.text(11.5, color: da.grey)),
                        Text(prix == null ? 'À chiffrer' : euros(prix.round()).replaceAll(',00', ''), style: da.text(20, weight: FontWeight.w700)),
                        Text("d'après votre bibliothèque", style: da.text(11, color: da.grey)),
                      ]),
                    ),
                  ),
                  VerticalDivider(width: 1, color: da.line),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Positions', style: da.text(11.5, color: da.grey)),
                        Text('$prises / $max', style: da.text(20, weight: FontWeight.w700)),
                        _points(da, prises, max),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),
            if ((offre['aVerifier'] as List?)?.isNotEmpty == true) ...[
              const SizedBox(height: 14),
              Text('À vérifier pendant la visite · préparé par Koji', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.4)),
              const SizedBox(height: 4),
              for (final p in (offre['aVerifier'] as List)) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Text('· $p', style: da.text(13.5))),
            ],
            const SizedBox(height: 12),
            Text(
              offre['rdvConfirmed'] == true
                  ? [_s(offre['clientName']), _s(offre['address']), _s(offre['clientPhone'])].where((x) => x.isNotEmpty).join(' · ')
                  : "Adresse exacte, nom et téléphone du client visibles après la confirmation d'un rendez-vous.",
              style: da.text(12, color: da.grey),
            ),
          ]),
        ),
        Container(
          decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.line))),
          child: SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 12), child: bas)),
        ),
      ]),
    );
  }
}

// ── Me positionner (plein écran) ──────────────────────────────────────────

class ProMePositionnerScreen extends StatefulWidget {
  const ProMePositionnerScreen({super.key, required this.offre, required this.onEnvoyer});
  final Map<String, dynamic> offre;

  /// Renvoie une erreur à afficher, ou null.
  final Future<String?> Function(String message, List<String> creneaux, bool joindreDevis) onEnvoyer;

  @override
  State<ProMePositionnerScreen> createState() => _ProMePositionnerScreenState();
}

class _ProMePositionnerScreenState extends State<ProMePositionnerScreen> {
  late final _message = TextEditingController(text: _s(widget.offre['messagePropose']));
  late final List<String> _tous = [for (final c in (widget.offre['creneaux'] as List? ?? const [])) '$c'];
  late final Set<String> _choisis = _tous.take(2).toSet();
  bool _devis = true;
  bool _envoi = false;
  String _erreur = '';

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _envoyer() async {
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    final prix = (widget.offre['prixRecommande'] as Map?)?['ttc'];
    final erreur = await widget.onEnvoyer(_message.text.trim(), _tous.where(_choisis.contains).toList(), _devis && prix != null);
    if (!mounted) return;
    if (erreur == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() {
      _envoi = false;
      _erreur = erreur;
    });
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final jetons = (widget.offre['jetons'] as num?)?.toInt() ?? 0;
    final prix = (widget.offre['prixRecommande'] as Map?)?['ttc'] as num?;
    Widget lab(String t) => Text(t.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6));
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(context, da, 'Me positionner', [titreRadar(_s(widget.offre['description'])), _ville(_s(widget.offre['address']))].where((x) => x.isNotEmpty).join(' · ')),
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), children: [
            lab('Message'),
            const SizedBox(height: 6),
            TextField(
              controller: _message,
              maxLines: 6,
              minLines: 4,
              style: da.text(14, height: 1.45),
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                filled: true,
                fillColor: da.card,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(2), borderSide: BorderSide(color: da.line)),
              ),
            ),
            const SizedBox(height: 14),
            lab('Créneaux'),
            const SizedBox(height: 6),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 3.2,
              children: [
                for (final c in _tous)
                  Material(
                    color: da.card,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2), side: BorderSide(color: _choisis.contains(c) ? da.ink : da.line, width: _choisis.contains(c) ? 2 : 1)),
                    child: InkWell(
                      onTap: () => setState(() => _choisis.contains(c) ? _choisis.remove(c) : _choisis.add(c)),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(_jour(c), style: da.text(13, weight: FontWeight.w700)),
                          Text(_heure(c), style: da.text(12, color: da.grey)),
                        ]),
                      ),
                    ),
                  ),
              ],
            ),
            if (prix != null) ...[
              const SizedBox(height: 14),
              Material(
                color: da.card,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2), side: BorderSide(color: _devis ? da.ink : da.line)),
                child: InkWell(
                  onTap: () => setState(() => _devis = !_devis),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Icon(_devis ? Icons.check_box : Icons.check_box_outline_blank, color: da.ink, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Devis estimatif · ${euros(prix.round()).replaceAll(',00', '')} TTC', style: da.text(14, weight: FontWeight.w700)),
                          Text('à vos prix, à confirmer après visite', style: da.text(12, color: da.grey)),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            ],
            const SizedBox(height: 14),
            _jetonsCarte(da, _pluriel(jetons, 'jeton réservé', 'jetons réservés'), 'débités si visite confirmée, rendus après 7 jours sans réponse'),
            if (_erreur.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(_erreur, style: da.text(13, color: const Color(0xFFC4452D))),
            ],
          ]),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: Row(children: [
              TextButton(onPressed: _envoi ? null : () => Navigator.of(context).maybePop(), style: TextButton.styleFrom(foregroundColor: da.ink), child: Text('Annuler', style: da.text(14, weight: FontWeight.w600))),
              const SizedBox(width: 8),
              Expanded(
                child: ProPrimaryButton(
                  label: _envoi ? 'Envoi…' : 'Envoyer',
                  expand: true,
                  onPressed: _envoi || _message.text.trim().isEmpty || _choisis.isEmpty ? null : _envoyer,
                ),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

// ── Mes positions ─────────────────────────────────────────────────────────

class ProMesPositionsView extends StatelessWidget {
  const ProMesPositionsView({super.key, required this.donnees, required this.onOuvrir, required this.onPreparerVisite});
  final Map<String, dynamic> donnees;
  final ValueChanged<String> onOuvrir;
  final ValueChanged<Map<String, dynamic>> onPreparerVisite;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final positions = [for (final p in (donnees['positions'] as List? ?? const [])) if (p is Map) Map<String, dynamic>.from(p)];
    final solde = ((donnees['jetons'] as Map?)?['solde'] as num?)?.toInt() ?? 0;
    final v = donnees['visiteConfirmee'] is Map ? Map<String, dynamic>.from(donnees['visiteConfirmee'] as Map) : null;
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(context, da, 'Mes positions', _pluriel(solde, 'jeton disponible', 'jetons disponibles')),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 24), children: [
        if (v != null) ...[
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: BoxDecoration(color: da.card, border: Border(left: BorderSide(color: da.ink, width: 4), top: BorderSide(color: da.ink), right: BorderSide(color: da.ink), bottom: BorderSide(color: da.ink))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Visite confirmée · ${_jour(_s(v['rdvDate']))} ${_heure(_s(v['rdvDate']))}', style: da.text(15, weight: FontWeight.w700)),
              Text([
                [_s(v['titre']), _s(v['ville'])].where((x) => x.isNotEmpty).join(', '),
                _s((v['jetons'] as Map?)?['texte']),
                'coordonnées disponibles',
              ].where((x) => x.isNotEmpty).join(' · '), style: da.text(12.5, color: da.grey, height: 1.35)),
              const SizedBox(height: 10),
              ProPrimaryButton(label: 'Préparer la visite', expand: true, height: 44, onPressed: () => onPreparerVisite(v)),
            ]),
          ),
          const SizedBox(height: 14),
        ],
        if (positions.isEmpty)
          Text("Aucune position pour l'instant. Les jetons ne sont débités que si le client confirme un rendez-vous.", style: da.text(13, color: da.grey)),
        for (final p in positions)
          InkWell(
            onTap: () => onOuvrir(_s(p['offerId'])),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_s(p['titre']), style: da.text(14, weight: FontWeight.w700, color: p['termine'] == true ? da.grey : da.ink)),
                    Text(_s(p['etape']), style: da.text(12.5, color: da.grey)),
                    Text(_s((p['jetons'] as Map?)?['texte']), style: da.text(12, color: da.grey)),
                  ]),
                ),
                const SizedBox(width: 8),
                _tag(da, _s(p['libelle']), plein: p['etat'] == 'rdv'),
              ]),
            ),
          ),
        const SizedBox(height: 12),
        Text('Jetons réservés au positionnement, débités à la confirmation d\'un rendez-vous, rendus sinon.', style: da.text(12, color: da.grey)),
      ]),
    );
  }
}

// ── Branchement (données du site) ─────────────────────────────────────────

/// Ouvre la fiche d'un chantier du Radar.
Future<void> ouvrirFicheRadar(BuildContext context, String offreId) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => _FicheChargee(offreId: offreId)));

Future<void> ouvrirMesPositions(BuildContext context) =>
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => const _PositionsChargees()));

class _FicheChargee extends ConsumerStatefulWidget {
  const _FicheChargee({required this.offreId});
  final String offreId;

  @override
  ConsumerState<_FicheChargee> createState() => _FicheChargeeState();
}

class _FicheChargeeState extends ConsumerState<_FicheChargee> {
  late Future<Map<String, dynamic>> _offre = ref.read(proKojiWebProvider).offreDetail(widget.offreId);

  void _recharger() => setState(() => _offre = ref.read(proKojiWebProvider).offreDetail(widget.offreId));

  Future<void> _pasInteresse(Map<String, dynamic> offre) async {
    final raisons = [for (final r in (offre['raisonsPasInteresse'] as List? ?? const [])) '$r'];
    final raison = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) {
        final da = ProDa.of(ctx);
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Pourquoi ce chantier ne vous intéresse pas ?', style: da.text(15, weight: FontWeight.w700)),
              Text('Facultatif. Le client n\'est jamais informé.', style: da.text(12, color: da.grey)),
              const SizedBox(height: 10),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final r in raisons) ActionChip(label: Text(r), onPressed: () => Navigator.pop(ctx, r)),
              ]),
              TextButton(onPressed: () => Navigator.pop(ctx, ''), child: const Text('Retirer sans raison')),
            ]),
          ),
        );
      },
    );
    if (raison == null) return;
    await ref.read(proKojiWebProvider).masquerOffre(widget.offreId, raison).catchError((_) {});
    ref.invalidate(proRadarProvider);
    if (mounted) Navigator.of(context).maybePop();
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return FutureBuilder<Map<String, dynamic>>(
      future: _offre,
      builder: (context, s) {
        if (s.hasError) {
          return Scaffold(backgroundColor: da.page, appBar: _barre(context, da, 'Chantier', ''), body: Padding(padding: const EdgeInsets.all(16), child: Text('Chantier indisponible pour le moment.', style: da.text(13, color: da.grey))));
        }
        if (!s.hasData) return Scaffold(backgroundColor: da.page, body: const Center(child: CircularProgressIndicator(strokeWidth: 2)));
        final offre = s.data!;
        return ProRadarFicheView(
          offre: offre,
          onMesPositions: () => ouvrirMesPositions(context),
          onPasInteresse: () => _pasInteresse(offre),
          onRetirer: () async {
            await ref.read(proKojiWebProvider).retirerPosition(widget.offreId).catchError((_) {});
            ref.invalidate(proRadarProvider);
            _recharger();
          },
          onPreparerVisite: () => preparerVisiteRadar(context, ref, offre, _s((offre['maPosition'] as Map?)?['rdvDate'])),
          onPositionner: () async {
            final envoye = await Navigator.of(context).push<bool>(MaterialPageRoute(
              builder: (_) => ProMePositionnerScreen(
                offre: offre,
                onEnvoyer: (message, creneaux, devis) async {
                  try {
                    await ref.read(proKojiWebProvider).positionnerAvec(widget.offreId, message: message, creneaux: creneaux, joindreDevis: devis);
                    return null;
                  } on ProKojiWebException catch (e) {
                    return e.message;
                  } catch (_) {
                    return "La proposition n'est pas partie. Vérifiez la connexion.";
                  }
                },
              ),
            ));
            if (envoye == true) {
              ref.invalidate(proRadarProvider);
              _recharger();
            }
          },
        );
      },
    );
  }
}

class _PositionsChargees extends ConsumerStatefulWidget {
  const _PositionsChargees();

  @override
  ConsumerState<_PositionsChargees> createState() => _PositionsChargeesState();
}

class _PositionsChargeesState extends ConsumerState<_PositionsChargees> {
  late final Future<Map<String, dynamic>> _donnees = ref.read(proKojiWebProvider).mesPositions();

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return FutureBuilder<Map<String, dynamic>>(
      future: _donnees,
      builder: (context, s) {
        if (!s.hasData) {
          return Scaffold(
            backgroundColor: da.page,
            appBar: _barre(context, da, 'Mes positions', ''),
            body: Center(child: s.hasError ? Text('Positions indisponibles pour le moment.', style: da.text(13, color: da.grey)) : const CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        return ProMesPositionsView(
          donnees: s.data!,
          onOuvrir: (id) => ouvrirFicheRadar(context, id),
          onPreparerVisite: (v) async {
            final offre = await ref.read(proKojiWebProvider).offreDetail(_s(v['offerId'])).catchError((_) => <String, dynamic>{});
            if (!context.mounted) return;
            await preparerVisiteRadar(context, ref, {...offre, 'id': v['offerId']}, _s(v['rdvDate']));
          },
        );
      },
    );
  }
}

/// « Préparer la visite » (rendez-vous confirmé) : ouvre le Mode visite
/// (PRO-03.8) prérempli avec le client, l'adresse et le projet ; la même
/// visite est rouverte si elle existe déjà.
Future<void> preparerVisiteRadar(BuildContext context, WidgetRef ref, Map<String, dynamic> offre, String rdvLe) async {
  final store = ref.read(visiteStoreProvider);
  final offreId = _s(offre['id']);
  final existante = store.visites.where((v) => v['offreId'] == offreId && offreId.isNotEmpty).firstOrNull;
  final postes = [for (final l in (offre['ouvrages'] as List? ?? const [])) if (l is Map) ...(l['postes'] as List? ?? const []).map((x) => '$x')];
  final v = existante ??
      await store.creer(
        client: _s(offre['clientName']).isEmpty ? 'Client du Radar' : _s(offre['clientName']),
        email: _s(offre['clientEmail']),
        adresse: _s(offre['address']),
        demande: [_s(offre['description']), if (postes.isNotEmpty) 'Projet : ${postes.join(', ')}.'].where((x) => x.isNotEmpty).join(' '),
        rdvLe: rdvLe,
        offreId: offreId,
      );
  if (context.mounted) ouvrirVisite(context, '${v['id']}');
}
