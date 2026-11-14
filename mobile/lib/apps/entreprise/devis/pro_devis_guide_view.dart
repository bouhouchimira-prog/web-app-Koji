import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:koji/apps/entreprise/devis/devis_guide.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/features/quote/model/devis_line.dart';

/// Devis guidé (maquette PRO-03.1, téléphone) : le chat avec Koji, le
/// bandeau du total en bas ; glisser vers le haut ouvre le devis ; toucher
/// une ligne ouvre la barre d'édition basse (quantité, temps, taux,
/// fournitures, note client, variante, suppression).
class ProDevisGuideView extends StatefulWidget {
  const ProDevisGuideView({
    super.key,
    required this.titre,
    required this.sousTitre,
    required this.conversation,
    required this.donnees,
    required this.totalHt,
    required this.totalTtc,
    required this.onRetour,
    required this.onEnvoyer,
    required this.onChange,
    required this.onAjouterOuvrage,
    required this.onAjouterFourniture,
    required this.onAjouterLot,
    required this.onSupprimer,
    required this.onEditionDetaillee,
    this.onApercu,
    this.choisirPhoto,
    this.feuilleOuverte = false,
    this.ligneOuverte,
  });

  final String titre;
  final String sousTitre;
  final DevisGuideConversation conversation;
  final DevisGuideDonnees donnees;
  final double totalHt;
  final double totalTtc;
  final VoidCallback onRetour;
  final VoidCallback onEnvoyer;

  /// Une ligne a changé : l'écran recalcule ses totaux.
  final VoidCallback onChange;
  final Future<void> Function(String roomId) onAjouterOuvrage;
  final Future<void> Function(String roomId, {String parentTaskId}) onAjouterFourniture;
  final Future<void> Function() onAjouterLot;
  final void Function(String roomId, DevisLine ligne) onSupprimer;
  final VoidCallback onEditionDetaillee;
  final VoidCallback? onApercu;

  /// Photo du chantier pour Koji (data URL JPEG), ou null.
  final Future<String?> Function()? choisirPhoto;

  /// États de départ (tests et retours sur l'écran).
  final bool feuilleOuverte;
  final String? ligneOuverte;

  @override
  State<ProDevisGuideView> createState() => _ProDevisGuideViewState();
}

class _ProDevisGuideViewState extends State<ProDevisGuideView> {
  final _saisie = TextEditingController();
  final _saisieFocus = FocusNode();
  final _recherche = TextEditingController();
  final _messages = ScrollController();
  late bool _feuille = widget.feuilleOuverte || widget.ligneOuverte != null;
  late String? _ligneId = widget.ligneOuverte;
  bool _chercher = false;
  String? _photo;
  String? _dernierLot;
  int _tours = 0;

  // Champs de la ligne ouverte.
  final _titre = TextEditingController();
  final _qte = TextEditingController();
  final _temps = TextEditingController();
  final _taux = TextEditingController();
  final _prix = TextEditingController();
  final _note = TextEditingController();

  DevisGuideConversation get _c => widget.conversation;
  DevisGuideDonnees get _d => widget.donnees;

  @override
  void initState() {
    super.initState();
    _c.addListener(_conversationChange);
    if (_ligneId != null) _remplirChamps();
  }

  @override
  void didUpdateWidget(covariant ProDevisGuideView old) {
    super.didUpdateWidget(old);
    if (old.conversation != widget.conversation) {
      old.conversation.removeListener(_conversationChange);
      widget.conversation.addListener(_conversationChange);
    }
  }

  @override
  void dispose() {
    _c.removeListener(_conversationChange);
    for (final c in [_saisie, _recherche, _titre, _qte, _temps, _taux, _prix, _note]) {
      c.dispose();
    }
    _saisieFocus.dispose();
    _messages.dispose();
    super.dispose();
  }

  void _conversationChange() {
    if (!mounted) return;
    setState(() {});
    if (_c.tours.length != _tours || _c.envoi) {
      _tours = _c.tours.length;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_messages.hasClients) {
          _messages.animateTo(_messages.position.maxScrollExtent,
              duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
        }
      });
    }
  }

  // ── Envoi ────────────────────────────────────────────────────────────────

  void _envoyer() {
    final texte = _saisie.text;
    if ((texte.trim().isEmpty && _photo == null) || _c.envoi) return;
    final photo = _photo;
    _saisie.clear();
    setState(() => _photo = null);
    _c.envoyer(texte, photo: photo);
  }

  Future<void> _prendrePhoto() async {
    final photo = await widget.choisirPhoto?.call();
    if (photo != null && mounted) setState(() => _photo = photo);
  }

  void _dicter() {
    _saisieFocus.requestFocus();
    ScaffoldMessenger.of(context)
      ..removeCurrentSnackBar()
      ..showSnackBar(const SnackBar(
          content: Text('Touche le micro du clavier pour dicter ton message.')));
  }

  // ── Devis ────────────────────────────────────────────────────────────────

  void _ouvrirFeuille() => setState(() => _feuille = true);

  void _fermerFeuille() => setState(() {
        _feuille = false;
        _ligneId = null;
        _chercher = false;
        _recherche.clear();
      });

  void _ouvrirLigne(String id) {
    setState(() => _ligneId = id);
    _remplirChamps();
  }

  void _fermerLigne() {
    FocusScope.of(context).unfocus();
    setState(() => _ligneId = null);
    widget.onChange();
  }

  (String, DevisLine)? get _ligne => _ligneId == null ? null : _d.ligne(_ligneId!);

  /// Sous-ouvrages et fournitures rattachés à une ligne : affichés dans sa
  /// barre d'édition, comptés dans son montant (« total ouvrage »).
  List<DevisLine> _enfants(String roomId, DevisLine l) => [
        for (final x in _d.linesByRoom[roomId] ?? const <DevisLine>[])
          if (x.parentTaskId == l.taskId && x.taskId != l.taskId) x,
      ];

  double _totalOuvrage(String roomId, DevisLine l) =>
      l.totalLigne + _enfants(roomId, l).fold<double>(0, (s, x) => s + x.totalLigne);

  String _nb(double v) {
    if (v == 0) return '';
    final r = (v * 1000).round() / 1000;
    final s = r == r.truncateToDouble() ? r.toInt().toString() : r.toString();
    return s.replaceAll('.', ',');
  }

  double _lu(String s) => double.tryParse(s.trim().replaceAll(' ', '').replaceAll(',', '.')) ?? 0;

  void _remplirChamps() {
    final trouvee = _ligne;
    if (trouvee == null) return;
    final l = trouvee.$2;
    _titre.text = l.label;
    _qte.text = _nb(l.qty);
    _temps.text = _nb(l.tempsHU);
    _taux.text = _nb(l.tauxHoraire);
    _prix.text = _nb(l.isFourniture ? l.fournituresUnitPrice : l.forfaitPrice);
    _note.text = l.commentaire;
  }

  // Les fournitures comptées au même nombre que l'ouvrage (par m², par
  // unité…) suivent sa quantité ; un nombre réglé à part ne bouge pas.
  void _quantite(DevisLine l, double v) {
    if (!l.isFourniture && (l.fournituresQty - l.qty).abs() < 1e-9) l.fournituresQty = v;
    l.qty = v;
  }

  void _modifier(void Function(DevisLine l) f) {
    final trouvee = _ligne;
    if (trouvee == null) return;
    setState(() => f(trouvee.$2));
    widget.onChange();
  }

  Future<String?> _choisirLot() async {
    if (_d.lotsVisibles.isEmpty) await widget.onAjouterLot();
    final lots = _d.lotsVisibles;
    if (lots.isEmpty) return null;
    if (lots.length == 1) return lots.first;
    if (!mounted) return null;
    final da = ProDa.of(context);
    return showModalBottomSheet<String>(
      context: context,
      backgroundColor: da.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: Text('Dans quel lot ?', style: da.text(17, weight: FontWeight.w700)),
            ),
            for (final r in lots)
              ListTile(
                title: Text('${_d.codeLot(r)} · ${_d.titreLot(r)}', style: da.text(15)),
                trailing: r == _dernierLot ? Icon(Icons.check, color: da.ink, size: 18) : null,
                onTap: () => Navigator.pop(ctx, r),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _ajouter(String quoi) async {
    if (quoi == 'lot') {
      await widget.onAjouterLot();
      widget.onChange();
      return;
    }
    final roomId = await _choisirLot();
    if (roomId == null || !mounted) return;
    _dernierLot = roomId;
    if (quoi == 'ouvrage') {
      await widget.onAjouterOuvrage(roomId);
    } else if (quoi == 'fourniture') {
      await widget.onAjouterFourniture(roomId);
    } else {
      // Ligne libre : une désignation et un prix HT, au forfait.
      final ligne = DevisLine(
        taskId: _d.nouvelId('libre'),
        label: 'Ligne libre',
        unite: 'forfait',
        tauxHoraire: _d.tauxHoraire(),
        forfaitEnabled: true,
      );
      _d.linesByRoom.putIfAbsent(roomId, () => []).add(ligne);
      if (!_d.roomOrder.contains(roomId)) _d.roomOrder.add(roomId);
      widget.onChange();
      _ouvrirLigne(ligne.taskId);
      return;
    }
    widget.onChange();
  }

  // ── Écran ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return PopScope(
      canPop: !_feuille,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_ligneId != null) {
          _fermerLigne();
        } else {
          _fermerFeuille();
        }
      },
      child: Scaffold(
        backgroundColor: da.page,
        appBar: _barre(da),
        body: LayoutBuilder(builder: (context, box) {
          final hauteurEdition = math.min(470.0, box.maxHeight - 80);
          return Stack(
            children: [
              Positioned.fill(
                bottom: 72,
                child: Column(
                  children: [
                    Expanded(child: _chat(da)),
                    if (_c.erreur.isNotEmpty || _c.notice.isNotEmpty) _note2(da),
                    if (_photo != null) _photoJointe(da),
                    _composer(da),
                  ],
                ),
              ),
              Positioned(left: 0, right: 0, bottom: 0, height: 72, child: _bandeau(da)),
              if (_feuille)
                Positioned.fill(
                  child: GestureDetector(
                    onTap: _ligneId != null ? _fermerLigne : _fermerFeuille,
                    child: ColoredBox(color: Colors.black.withValues(alpha: 0.18)),
                  ),
                ),
              AnimatedPositioned(
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                left: 0,
                right: 0,
                top: _feuille ? 16 : box.maxHeight,
                bottom: _feuille ? (_ligneId != null ? hauteurEdition : 64) : -box.maxHeight,
                child: _feuilleDevis(da),
              ),
              if (_feuille && _ligneId == null)
                Positioned(left: 0, right: 0, bottom: 0, height: 64, child: _barreAjouter(da)),
              if (_feuille && _ligne != null)
                Positioned(left: 0, right: 0, bottom: 0, height: hauteurEdition, child: _edition(da)),
            ],
          );
        }),
      ),
    );
  }

  PreferredSizeWidget _barre(ProDa da) => PreferredSize(
        preferredSize: const Size.fromHeight(56),
        child: Material(
          color: da.card,
          child: SafeArea(
            bottom: false,
            child: Container(
              height: 56,
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
              child: Row(
                children: [
                  IconButton(
                    onPressed: widget.onRetour,
                    tooltip: 'Retour',
                    icon: Icon(Icons.chevron_left, color: da.ink, size: 26),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.titre,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(15, weight: FontWeight.w700)),
                        Text(widget.sousTitre,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12, color: da.grey)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: widget.onEnvoyer,
                    style: TextButton.styleFrom(foregroundColor: da.ink),
                    child: Text('Envoyer', style: da.text(14, weight: FontWeight.w700)),
                  ),
                  IconButton(
                    onPressed: () => setState(() {
                      _feuille = true;
                      _ligneId = null;
                      _chercher = true;
                    }),
                    tooltip: 'Rechercher',
                    icon: Icon(Icons.search, color: da.ink, size: 22),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

  // Bulles du chat.
  Widget _bulle(ProDa da, Widget enfant, {bool moi = false}) => Align(
        alignment: moi ? Alignment.centerRight : Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.88),
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: moi ? da.fill : da.page,
              border: moi ? null : Border.all(color: da.line),
              borderRadius: BorderRadius.circular(8),
            ),
            child: enfant,
          ),
        ),
      );

  Widget _chat(ProDa da) {
    final enfants = <Widget>[];
    for (var i = 0; i < _c.tours.length; i++) {
      final t = _c.tours[i];
      if (t.hidden || t.chips) continue;
      if (t.role == 'user') {
        enfants.add(_bulle(
          da,
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (t.photo != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text('Photo envoyée à Koji', style: da.text(12, color: da.onFill.withValues(alpha: 0.7))),
                ),
              if (t.text.isNotEmpty) Text(t.text, style: da.text(14, color: da.onFill, height: 1.45)),
            ],
          ),
          moi: true,
        ));
        continue;
      }
      if (t.text.isNotEmpty) enfants.add(_bulle(da, Text(t.text, style: da.text(14, height: 1.45))));
      if (t.questions.isNotEmpty) enfants.add(_bulle(da, _questions(da, i, t)));
    }
    if (_c.enDirect.isNotEmpty) {
      enfants.add(_bulle(da, Text(_c.enDirect, style: da.text(14, height: 1.45))));
    } else if (_c.envoi && _c.travail != null) {
      enfants.add(_bulle(
        da,
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Think(couleur: da.grey),
            const SizedBox(width: 8),
            Flexible(child: Text(_c.travail!.phrase, style: da.text(14, color: da.grey, height: 1.45))),
          ],
        ),
      ));
    }
    return ListView(
      controller: _messages,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      children: enfants,
    );
  }

  Widget _questions(ProDa da, int index, GuideTour t) {
    final verrou = _c.verrouille(index);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var n = 0; n < t.questions.length; n++)
          Padding(
            padding: EdgeInsets.only(top: n == 0 ? 0 : 8),
            child: Row(
              children: [
                Expanded(child: Text(t.questions[n], style: da.text(14, height: 1.35))),
                const SizedBox(width: 12),
                for (final (libelle, valeur) in [('Oui', true), ('Non', false)]) ...[
                  _Puce(
                    libelle: libelle,
                    choisie: t.reponses[n] == valeur,
                    eteinte: verrou && t.reponses[n] != valeur,
                    onTap: verrou ? null : () => _c.repondre(index, n, valeur),
                  ),
                  if (valeur) const SizedBox(width: 6),
                ],
              ],
            ),
          ),
      ],
    );
  }

  Widget _note2(ProDa da) => Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: da.line))),
        child: Text(_c.erreur.isNotEmpty ? _c.erreur : _c.notice,
            style: da.text(13,
                color: _c.erreur.isNotEmpty ? da.ink : da.grey,
                weight: _c.erreur.isNotEmpty ? FontWeight.w600 : FontWeight.w400)),
      );

  Widget _photoJointe(ProDa da) => Container(
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
        decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.line))),
        child: Row(
          children: [
            Icon(Icons.photo_outlined, color: da.ink, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text('Photo jointe au prochain message', style: da.text(13, color: da.grey))),
            IconButton(
              onPressed: () => setState(() => _photo = null),
              tooltip: 'Retirer la photo',
              icon: Icon(Icons.close, color: da.ink, size: 18),
            ),
          ],
        ),
      );

  Widget _composer(ProDa da) {
    final peut = !_c.envoi && (_saisie.text.trim().isNotEmpty || _photo != null);
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 10, 12, 10),
      decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.line))),
      child: Row(
        children: [
          IconButton(
            onPressed: _c.envoi || widget.choisirPhoto == null ? null : _prendrePhoto,
            tooltip: 'Joindre une photo du chantier',
            icon: Icon(Icons.photo_camera_outlined, color: da.ink, size: 22),
          ),
          Expanded(
            child: SizedBox(
              height: 44,
              child: TextField(
                controller: _saisie,
                focusNode: _saisieFocus,
                enabled: !_c.envoi,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _envoyer(),
                textInputAction: TextInputAction.send,
                style: da.text(14),
                decoration: InputDecoration(
                  hintText: 'Dis-moi ce qui change…',
                  hintStyle: da.text(14, color: da.grey),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  filled: true,
                  fillColor: da.card,
                  enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4), borderSide: const BorderSide(color: Color(0xFF8A8F98))),
                  disabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.line)),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.ink, width: 1.5)),
                ),
              ),
            ),
          ),
          IconButton(
            onPressed: _c.envoi ? null : _dicter,
            tooltip: 'Dicter un message',
            icon: Icon(Icons.mic_none, color: da.ink, size: 22),
          ),
          const SizedBox(width: 2),
          Opacity(
            opacity: peut ? 1 : 0.45,
            child: Material(
              color: da.fill,
              borderRadius: BorderRadius.circular(4),
              child: InkWell(
                onTap: peut ? _envoyer : null,
                borderRadius: BorderRadius.circular(4),
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(Icons.send_outlined, color: da.onFill, size: 20, semanticLabel: 'Envoyer le message'),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _bandeau(ProDa da) {
    final live = _c.envoi && _c.travail != null;
    final ecart = _c.totalDebut == null ? '' : ecartTotal(_c.totalDebut!, widget.totalHt);
    final nb = _d.lotsVisibles.fold<int>(0, (n, r) => n + _d.linesByRoom[r]!.where((l) => !l.isComment).length);
    const lab = Color(0xFFA7ABB2);
    const style = TextStyle(
        fontFamily: ProDa.font, fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.6, color: lab);
    return Semantics(
      button: true,
      label: 'Ouvrir le devis',
      child: GestureDetector(
        onTap: _ouvrirFeuille,
        onVerticalDragEnd: (d) {
          if ((d.primaryVelocity ?? 0) < -100) _ouvrirFeuille();
        },
        child: Container(
          color: const Color(0xFF171B1E),
          padding: EdgeInsets.symmetric(horizontal: live ? 14 : 20),
          child: Row(
            children: [
              if (live) ...[const _Think(couleur: Colors.white), const SizedBox(width: 12)],
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text((live ? _c.travail!.lab : 'Le devis').toUpperCase(),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: style),
                    const SizedBox(height: 2),
                    Text(
                      live
                          ? (_c.travail!.texte.isEmpty ? '…' : _c.travail!.texte)
                          : nb == 0
                              ? "Aucune ligne pour l'instant"
                              : '$nb ligne${nb > 1 ? 's' : ''} · voir le devis',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: da.text(14, weight: FontWeight.w700, color: Colors.white),
                    ),
                  ],
                ),
              ),
              SizedBox(width: live ? 12 : 24),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text('TOTAL HT', style: style),
                  const SizedBox(height: 2),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(euros(widget.totalHt), style: da.text(17, weight: FontWeight.w700, color: Colors.white)),
                      if (ecart.isNotEmpty) ...[
                        const SizedBox(width: 6),
                        Text(ecart, style: da.text(11, weight: FontWeight.w700, color: ProDa.prim)),
                      ],
                    ],
                  ),
                ],
              ),
              const SizedBox(width: 12),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: lab, borderRadius: BorderRadius.circular(2)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _poignee(ProDa da) => Center(
        child: Container(
          width: 36,
          height: 4,
          margin: const EdgeInsets.only(top: 8, bottom: 10),
          decoration: BoxDecoration(color: const Color(0xFF8A8F98), borderRadius: BorderRadius.circular(2)),
        ),
      );

  Widget _feuilleDevis(ProDa da) {
    final q = _recherche.text.trim().toLowerCase();
    final enfants = <Widget>[];
    for (final r in _d.lotsVisibles) {
      final ids = {for (final l in _d.linesByRoom[r]!) l.taskId};
      final lignes = [
        for (final l in _d.linesByRoom[r]!)
          if (!l.isComment &&
              !(l.parentTaskId.isNotEmpty && l.parentTaskId != l.taskId && ids.contains(l.parentTaskId)) &&
              (q.isEmpty || l.label.toLowerCase().contains(q)))
            l,
      ];
      if (q.isNotEmpty && lignes.isEmpty) continue;
      final total = _d.linesByRoom[r]!.fold<double>(0, (s, l) => s + l.totalCompte);
      enfants.add(Container(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
        decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.ink))),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(_d.codeLot(r).toUpperCase(),
                style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(_d.titreLot(r),
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(15, weight: FontWeight.w700)),
            ),
            Text(euros(total), style: da.text(14, weight: FontWeight.w700)),
          ],
        ),
      ));
      for (final l in lignes) {
        final sel = l.taskId == _ligneId;
        enfants.add(InkWell(
          onTap: () => _ouvrirLigne(l.taskId),
          child: Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            decoration: BoxDecoration(
              color: sel ? da.soft : null,
              border: Border(
                bottom: BorderSide(color: da.rule),
                left: BorderSide(color: sel ? ProDa.prim : Colors.transparent, width: 3),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(text: l.label),
                      if (l.isVariante)
                        TextSpan(
                            text: '  Variante',
                            style: da.text(11, weight: FontWeight.w700, color: da.grey)),
                    ]),
                    style: da.text(13, height: 1.35),
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox(
                  width: 84,
                  child: Text(euros(_totalOuvrage(r, l)),
                      textAlign: TextAlign.right,
                      style: da.text(13,
                          weight: FontWeight.w700, color: l.isVariante ? da.grey : da.ink)),
                ),
              ],
            ),
          ),
        ));
      }
    }
    if (enfants.isEmpty) {
      enfants.add(Padding(
        padding: const EdgeInsets.all(24),
        child: Text(q.isNotEmpty ? 'Aucune ligne ne correspond.' : 'Aucune ligne pour l\'instant. Ajoute un lot ou un ouvrage, ou décris le chantier à Koji.',
            style: da.text(14, color: da.grey)),
      ));
    }
    return Material(
      color: da.card,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: da.ink),
      ),
      clipBehavior: Clip.antiAlias,
      child: Opacity(
        opacity: _ligneId != null ? 0.55 : 1,
        child: Column(
          children: [
            GestureDetector(
              onTap: _fermerFeuille,
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity ?? 0) > 100) _fermerFeuille();
              },
              behavior: HitTestBehavior.opaque,
              child: SizedBox(width: double.infinity, child: _poignee(da)),
            ),
            if (_chercher)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                child: TextField(
                  controller: _recherche,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  style: da.text(14),
                  decoration: InputDecoration(
                    hintText: 'Rechercher une ligne',
                    hintStyle: da.text(14, color: da.grey),
                    prefixIcon: Icon(Icons.search, color: da.grey, size: 20),
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(4)),
                  ),
                ),
              ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  ...enfants,
                  Container(
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    padding: const EdgeInsets.fromLTRB(14, 6, 14, 6),
                    decoration: BoxDecoration(border: Border.all(color: da.line)),
                    child: Column(
                      children: [
                        _totalLigne(da, 'Total HT', widget.totalHt),
                        Divider(height: 1, color: da.rule),
                        _totalLigne(da, 'Total TTC', widget.totalTtc, fort: true),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ProPill(label: 'Client, dates, provisions et mentions', onTap: widget.onEditionDetaillee),
                        if (widget.onApercu != null) ProPill(label: 'Aperçu PDF', onTap: widget.onApercu!),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _totalLigne(ProDa da, String libelle, double v, {bool fort = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Expanded(child: Text(libelle, style: da.text(fort ? 16 : 14, weight: fort ? FontWeight.w600 : FontWeight.w400))),
            Text(euros(v), style: da.text(fort ? 18 : 14, weight: FontWeight.w700)),
          ],
        ),
      );

  Widget _barreAjouter(ProDa da) => Container(
        decoration: BoxDecoration(color: da.card, border: Border(top: BorderSide(color: da.line))),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              Text('AJOUTER', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
              const SizedBox(width: 10),
              for (final (cle, libelle, plus) in const [
                ('ouvrage', 'Ouvrage', true),
                ('fourniture', 'Fourniture', true),
                ('lot', 'Lot', true),
                ('libre', 'Ligne libre', false),
              ]) ...[
                _PuceAjout(libelle: libelle, plus: plus, onTap: () => _ajouter(cle)),
                const SizedBox(width: 8),
              ],
            ],
          ),
        ),
      );

  Widget _champ(ProDa da, String libelle, TextEditingController c, String suffixe, void Function(double) onValeur) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(libelle.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
          const SizedBox(height: 4),
          SizedBox(
            height: 40,
            child: TextField(
              controller: c,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (s) => onValeur(_lu(s)),
              style: da.text(15),
              decoration: InputDecoration(
                isDense: true,
                suffixText: suffixe,
                suffixStyle: da.text(13, color: da.grey),
                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                filled: true,
                fillColor: da.card,
                enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.frame)),
                focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.ink, width: 1.5)),
              ),
            ),
          ),
        ],
      );

  Widget _edition(ProDa da) {
    final (roomId, l) = _ligne!;
    final unite = l.unite.isEmpty ? 'u' : l.unite;
    final totalOuvrage = _totalOuvrage(roomId, l);
    final pu = l.qty > 0 ? totalOuvrage / l.qty : totalOuvrage;
    final enfants = _enfants(roomId, l);
    final fournTotal = l.totalFournitures +
        enfants.where((x) => x.isFourniture).fold<double>(0, (s, x) => s + x.totalLigne);
    final fournParUnite = l.qty > 0 ? fournTotal / l.qty : fournTotal;
    final champs = l.forfaitEnabled
        ? [
            Expanded(child: _champ(da, 'Prix HT', _prix, '€', (v) => _modifier((l) => l.forfaitPrice = v))),
          ]
        : l.isFourniture
            ? [
                Expanded(child: _champ(da, 'Quantité', _qte, unite, (v) => _modifier((l) => _quantite(l, v)))),
                const SizedBox(width: 10),
                Expanded(child: _champ(da, 'Prix', _prix, '€/$unite', (v) => _modifier((l) => l.fournituresUnitPrice = v))),
              ]
            : [
                Expanded(child: _champ(da, 'Quantité', _qte, unite, (v) => _modifier((l) => _quantite(l, v)))),
                const SizedBox(width: 10),
                Expanded(child: _champ(da, 'Temps', _temps, 'h/$unite', (v) => _modifier((l) => l.tempsHU = v))),
                const SizedBox(width: 10),
                Expanded(child: _champ(da, 'Taux', _taux, '€/h', (v) => _modifier((l) => l.tauxHoraire = v))),
              ];
    return Material(
      color: da.soft,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: da.ink),
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            GestureDetector(
              onTap: _fermerLigne,
              onVerticalDragEnd: (d) {
                if ((d.primaryVelocity ?? 0) > 100) _fermerLigne();
              },
              behavior: HitTestBehavior.opaque,
              child: _poignee(da),
            ),
            TextField(
              controller: _titre,
              onChanged: (s) => _modifier((l) => l.label = s),
              style: da.text(14, weight: FontWeight.w700),
              maxLines: 2,
              minLines: 1,
              decoration: const InputDecoration(isDense: true, border: InputBorder.none, contentPadding: EdgeInsets.zero),
            ),
            const SizedBox(height: 2),
            Text(
              '${_d.codeLot(roomId)} · ${euros(pu)}/$unite · ${euros(totalOuvrage)} HT${l.isVariante ? ' · variante, hors total' : ''}',
              style: da.text(13, color: da.grey),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ListView(
                padding: EdgeInsets.zero,
                children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: champs),
                  if (!l.isFourniture && !l.forfaitEnabled) ...[
                    const SizedBox(height: 10),
                    Container(
                      decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text('FOURNITURES · ${euros(fournParUnite)}/$unite'.toUpperCase(),
                                      style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
                                ),
                                TextButton.icon(
                                  onPressed: () async {
                                    await widget.onAjouterFourniture(roomId, parentTaskId: l.taskId);
                                    widget.onChange();
                                  },
                                  style: TextButton.styleFrom(foregroundColor: da.ink),
                                  icon: const Icon(Icons.add, size: 16),
                                  label: Text('Ajouter', style: da.text(13, weight: FontWeight.w600)),
                                ),
                              ],
                            ),
                          ),
                          if (l.totalFournitures > 0)
                            _fourniture(da, l.fournisseurName.isEmpty ? 'Fournitures' : l.fournisseurName,
                                l.fournituresQty, unite, l.fournituresUnitPrice, l.totalFournitures),
                          for (final x in enfants.where((x) => x.isFourniture))
                            _fourniture(da, x.label, x.qty, x.unite, DevisGuideDonnees.prixUnitaire(x), x.totalLigne),
                          if (fournTotal == 0)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(12, 0, 12, 10),
                              child: Text('Aucune fourniture sur cette ligne.', style: da.text(12, color: da.grey)),
                            ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Text('NOTE CLIENT', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
                  const SizedBox(height: 4),
                  TextField(
                    controller: _note,
                    onChanged: (s) => _modifier((l) => l.commentaire = s),
                    style: da.text(14),
                    minLines: 1,
                    maxLines: 3,
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Ce que le client lira sous la ligne',
                      hintStyle: da.text(14, color: da.grey),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      filled: true,
                      fillColor: da.card,
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.frame)),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(4), borderSide: BorderSide(color: da.ink, width: 1.5)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _BoutonSec(
                  libelle: 'Variante',
                  actif: l.isVariante,
                  onTap: () => _modifier((l) => l.lineType = l.isVariante ? 'normal' : 'variante'),
                ),
                const SizedBox(width: 8),
                _BoutonSec(
                  libelle: 'Supprimer',
                  onTap: () {
                    widget.onSupprimer(roomId, l);
                    setState(() => _ligneId = null);
                    widget.onChange();
                  },
                ),
                const SizedBox(width: 8),
                Expanded(child: ProPrimaryButton(label: 'Valider', height: 44, expand: true, onPressed: _fermerLigne)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _fourniture(ProDa da, String nom, double q, String unite, double pu, double total) => Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: da.rule))),
        child: Row(
          children: [
            Expanded(child: Text(nom, maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(12))),
            SizedBox(width: 56, child: Text('${_nb(q).isEmpty ? '0' : _nb(q)} $unite', textAlign: TextAlign.right, style: da.text(12, color: da.grey))),
            SizedBox(width: 60, child: Text(euros(pu), textAlign: TextAlign.right, style: da.text(12, color: da.grey))),
            SizedBox(width: 66, child: Text(euros(total), textAlign: TextAlign.right, style: da.text(12, weight: FontWeight.w600))),
          ],
        ),
      );
}

class _Puce extends StatelessWidget {
  const _Puce({required this.libelle, required this.choisie, required this.eteinte, this.onTap});

  final String libelle;
  final bool choisie;
  final bool eteinte;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Opacity(
      opacity: eteinte ? 0.45 : 1,
      child: Material(
        color: choisie ? da.fill : da.card,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4),
          side: BorderSide(color: choisie ? da.fill : da.ink),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(4),
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            alignment: Alignment.center,
            child: Text(libelle,
                style: da.text(13, weight: FontWeight.w600, color: choisie ? da.onFill : da.ink)),
          ),
        ),
      ),
    );
  }
}

class _PuceAjout extends StatelessWidget {
  const _PuceAjout({required this.libelle, required this.plus, required this.onTap});

  final String libelle;
  final bool plus;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Material(
      color: da.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4), side: BorderSide(color: da.ink)),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (plus) ...[Icon(Icons.add, size: 14, color: da.ink), const SizedBox(width: 4)],
              Text(libelle, style: da.text(13, weight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _BoutonSec extends StatelessWidget {
  const _BoutonSec({required this.libelle, required this.onTap, this.actif = false});

  final String libelle;
  final VoidCallback onTap;
  final bool actif;

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    return Material(
      color: actif ? da.fill : da.card,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(4), side: BorderSide(color: actif ? da.fill : const Color(0xFF8A8F98))),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          child: Text(libelle,
              style: da.text(14, weight: FontWeight.w600, color: actif ? da.onFill : da.ink)),
        ),
      ),
    );
  }
}

/// « Koji travaille » : trois points qui s'allument tour à tour.
class _Think extends StatefulWidget {
  const _Think({required this.couleur});

  final Color couleur;

  @override
  State<_Think> createState() => _ThinkState();
}

class _ThinkState extends State<_Think> with SingleTickerProviderStateMixin {
  late final AnimationController _a =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Sans animation si le téléphone les coupe (et dans les tests).
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _a.stop();
    } else if (!_a.isAnimating) {
      _a.repeat();
    }
  }

  @override
  void dispose() {
    _a.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
        label: 'Koji travaille',
        child: AnimatedBuilder(
          animation: _a,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) const SizedBox(width: 3),
                Opacity(
                  opacity: _opacite(i),
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(color: widget.couleur, shape: BoxShape.circle),
                  ),
                ),
              ],
            ],
          ),
        ),
      );

  double _opacite(int i) {
    if (!_a.isAnimating) return 0.7;
    final t = (_a.value - i * 0.2 / 1.2) % 1.0;
    return t < 0.4 ? 0.35 + 0.65 * (1 - (t - 0.2).abs() / 0.2).clamp(0.0, 1.0) : 0.35;
  }
}
