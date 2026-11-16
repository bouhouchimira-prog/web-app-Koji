import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/apps/entreprise/chantiers/planning_chantier.dart' show estOuvre, isoJour;
import 'package:koji/apps/entreprise/devis/devis_guide.dart' show euros;
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart' show proKojiWebProvider, ProKojiWebException;

// Avenants côté téléphone (maquettes PRO-05 et PRO-05.1) : liste par état ;
// avenant depuis le chantier, préparé par Koji à partir des notes (prix du
// devis ou de la bibliothèque, calculés par le site), signé en ligne par le
// client comme le devis.

String _s(dynamic v) => v == null ? '' : '$v';
double _n(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
String numeroCourt(String numero) {
  final m = RegExp(r'(\d+)\s*$').firstMatch(numero);
  return m == null ? numero : 'A${m.group(1)}';
}

/// Fin prévue décalée de n jours ouvrés (même calcul que le site).
String finDecalee(String fin, int jours) {
  final d0 = DateTime.tryParse(fin);
  if (d0 == null || jours == 0) return fin;
  var d = DateTime.utc(d0.year, d0.month, d0.day);
  var n = jours.abs();
  while (n > 0) {
    d = d.add(Duration(days: jours > 0 ? 1 : -1));
    if (estOuvre(isoJour(d))) n--;
  }
  return isoJour(d);
}

String _signe(double v) => '${v < 0 ? '−' : '+'} ${euros(v.abs())}';
double totalLigne(Map<String, dynamic> l) {
  final t = ((_n(l['quantity']) * _n(l['unitPriceHt'])) * 100).round() / 100;
  return l['type'] == 'suppression' ? -t.abs() : t;
}

String _qte(num q) {
  final s = q == q.roundToDouble() ? q.toInt().toString() : q.toStringAsFixed(3).replaceFirst(RegExp(r'0+$'), '');
  return s.replaceAll('.', ',');
}

/// « Lot 03 · 19,4 → 21,2 m² × 88,00 € · Retour de mur… » (même texte que le site).
String detailLigne(Map<String, dynamic> l, List<String> lots) {
  final i = lots.indexOf(_s(l['room']));
  final lot = i >= 0 ? 'Lot ${(i + 1).toString().padLeft(2, '0')}' : _s(l['room']);
  final qte = l['type'] == 'modification' && l['quantiteAvant'] != null
      ? '${_qte(_n(l['quantiteAvant']))} → ${_qte(_n(l['quantiteApres']))} ${l['unit']}'
      : '${_qte(_n(l['quantity']))} ${l['unit']}';
  final prix = l['aChiffrer'] == true && _n(l['unitPriceHt']) <= 0 ? '$qte · à chiffrer' : '$qte × ${euros(_n(l['unitPriceHt']))}';
  return [lot, prix, _s(l['note'])].where((x) => x.isNotEmpty).join(' · ');
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

Widget _tag(ProDa da, String statut) {
  final (label, plein) = switch (statut) {
    'Signe' => ('Signé', true),
    'Envoye' => ('À signer', false),
    'Refuse' => ('Refusé', false),
    _ => ('Brouillon', false),
  };
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
    decoration: BoxDecoration(color: plein ? da.fill : da.card, border: Border.all(color: plein ? da.fill : statut == 'Brouillon' || statut.isEmpty ? da.line : da.ink)),
    child: Text(label, style: da.text(11.5, weight: FontWeight.w700, color: plein ? da.onFill : da.ink)),
  );
}

// ── Liste (PRO-05.1) ────────────────────────────────────────────────────

class ProAvenantsView extends StatefulWidget {
  const ProAvenantsView({super.key, required this.avenants, this.onOuvrir});
  final List<Map<String, dynamic>> avenants;
  final ValueChanged<Map<String, dynamic>>? onOuvrir;

  @override
  State<ProAvenantsView> createState() => _ProAvenantsViewState();
}

class _ProAvenantsViewState extends State<ProAvenantsView> {
  String _onglet = 'tous';

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final tous = widget.avenants.where((a) => a['status'] != 'Archive').toList()
      ..sort((a, b) => _s(b['signedAt'] ?? b['sentAt'] ?? b['createdAt']).compareTo(_s(a['signedAt'] ?? a['sentAt'] ?? a['createdAt'])));
    final aSigner = tous.where((a) => a['status'] == 'Envoye').length;
    final visibles = tous.where((a) => _onglet == 'tous' || (_onglet == 'signer' ? a['status'] == 'Envoye' : a['status'] == 'Signe')).toList();
    String date(Map a) {
      final d = DateTime.tryParse(_s(a['status'] == 'Signe' ? a['signedAt'] : a['sentAt']));
      final j = d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d.toLocal());
      return a['status'] == 'Signe' ? 'signé le $j' : a['status'] == 'Envoye' ? 'envoyé le $j · en attente' : 'brouillon';
    }

    Widget onglet(String id, String label) => Padding(
          padding: const EdgeInsets.only(right: 6),
          child: ChoiceChip(
            label: Text(label, style: da.text(13, weight: FontWeight.w600, color: _onglet == id ? da.onFill : da.ink)),
            selected: _onglet == id,
            showCheckmark: false,
            selectedColor: da.fill,
            backgroundColor: da.card,
            side: BorderSide(color: _onglet == id ? da.fill : da.line),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
            onSelected: (_) => setState(() => _onglet = id),
          ),
        );
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(context, da, 'Avenants', '${tous.length}${aSigner > 0 ? ' · $aSigner à signer' : ''}'),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
        Row(children: [onglet('tous', 'Tous'), onglet('signer', aSigner > 0 ? 'À signer $aSigner' : 'À signer'), onglet('signes', 'Signés')]),
        const SizedBox(height: 8),
        for (final a in visibles)
          InkWell(
            onTap: widget.onOuvrir == null ? null : () => widget.onOuvrir!(a),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.rule))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  Expanded(
                    child: Text('${numeroCourt(_s(a['numero']))} · ${_s(a['chantier']).isNotEmpty ? a['chantier'] : _s(a['client'])}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: da.text(14, weight: FontWeight.w700)),
                  ),
                  _tag(da, _s(a['status'])),
                ]),
                const SizedBox(height: 2),
                Text(_s(a['motif']).isNotEmpty ? _s(a['motif']) : [for (final l in (a['lignes'] as List? ?? const [])) _s((l as Map)['label'])].take(2).join(', '),
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: da.text(13, color: da.grey)),
                Row(children: [
                  Expanded(child: Text(date(a), style: da.text(12, color: da.grey))),
                  Text(_signe(_n(a['totalTtcDelta'])), style: da.text(13.5, weight: FontWeight.w700)),
                ]),
              ]),
            ),
          ),
        if (visibles.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text('Aucun avenant dans cet onglet.', style: da.text(13, color: da.grey))),
        const SizedBox(height: 12),
        Text('Un avenant se crée depuis la fiche du chantier.', style: da.text(12.5, color: da.grey)),
      ]),
    );
  }
}

// ── Avenant depuis le chantier (PRO-05) ─────────────────────────────────

/// Ce que l'écran demande au site ; remplacé dans les tests.
class AvenantActions {
  const AvenantActions({required this.preparer, required this.enregistrer});

  /// Notes → { lignes, impactJours, message }.
  final Future<Map<String, dynamic>> Function(String notes) preparer;

  /// Crée l'avenant et l'envoie si demandé ; renvoie l'avenant.
  final Future<Map<String, dynamic>> Function(Map<String, dynamic> corps, {required bool envoyer, required bool email}) enregistrer;
}

class ProAvenantScreen extends StatefulWidget {
  const ProAvenantScreen({super.key, required this.devis, required this.actions, this.numero = 1, this.finPrevue = ''});
  final Map<String, dynamic> devis;
  final AvenantActions actions;
  final int numero;
  final String finPrevue;

  @override
  State<ProAvenantScreen> createState() => _ProAvenantScreenState();
}

class _ProAvenantScreenState extends State<ProAvenantScreen> {
  final _notes = TextEditingController();
  final _message = TextEditingController();
  List<Map<String, dynamic>> _lignes = [];
  int _impact = 0;
  bool _prepare = false;
  bool _prepa = false;
  String _envoi = '';
  String _erreur = '';
  late bool _email = _s(widget.devis['clientEmail']).isNotEmpty;
  Map<String, dynamic>? _fait;

  List<String> get _lots => [for (final i in (widget.devis['items'] as List? ?? const [])) _s((i as Map)['room'])].where((x) => x.isNotEmpty).toSet().toList();
  double get _devisHt => _n(widget.devis['totalHt']);
  double get _tva => widget.devis['vatRate'] is num ? (widget.devis['vatRate'] as num).toDouble() : 20;
  double get _avenantHt => ((_lignes.fold<double>(0, (s, l) => s + totalLigne(l))) * 100).round() / 100;
  bool get _aChiffrer => _lignes.any((l) => l['aChiffrer'] == true && _n(l['unitPriceHt']) <= 0);

  @override
  void dispose() {
    _notes.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _preparer() async {
    setState(() {
      _prepa = true;
      _erreur = '';
    });
    try {
      final r = await widget.actions.preparer(_notes.text.trim());
      setState(() {
        _lignes = [for (final l in (r['lignes'] as List? ?? const [])) Map<String, dynamic>.from(l as Map)];
        _impact = (r['impactJours'] as num?)?.toInt() ?? 0;
        _message.text = _s(r['message']);
        _prepare = true;
        _prepa = false;
      });
    } on ProKojiWebException catch (e) {
      setState(() {
        _prepa = false;
        _erreur = e.message;
      });
    } catch (_) {
      setState(() {
        _prepa = false;
        _erreur = "Koji n'a pas pu préparer l'avenant. Vérifiez la connexion.";
      });
    }
  }

  Future<void> _valider(bool envoyer) async {
    setState(() {
      _envoi = envoyer ? 'envoi' : 'brouillon';
      _erreur = '';
    });
    try {
      final a = await widget.actions.enregistrer({
        'quoteId': _s(widget.devis['id']),
        'lignes': _lignes,
        'impactJours': _impact,
        'message': _message.text.trim(),
        'notes': _notes.text.trim(),
        'motif': _lignes.map((l) => _s(l['label'])).take(3).join(', '),
        'motifCategory': 'imprevu_chantier',
      }, envoyer: envoyer, email: _email);
      setState(() {
        _envoi = '';
        _fait = a;
      });
    } on ProKojiWebException catch (e) {
      setState(() {
        _envoi = '';
        _erreur = e.message;
      });
    } catch (_) {
      setState(() {
        _envoi = '';
        _erreur = "L'avenant n'a pas pu être enregistré.";
      });
    }
  }

  Widget _koji(ProDa da, String titre, String detail) => Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: BoxDecoration(color: da.card, border: Border(left: BorderSide(color: da.ink, width: 3), top: BorderSide(color: da.line), right: BorderSide(color: da.line), bottom: BorderSide(color: da.line))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(titre, style: da.text(14, weight: FontWeight.w600)),
          if (detail.isNotEmpty) Text(detail, style: da.text(12, color: da.grey, height: 1.4)),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final numero = 'Avenant n° ${widget.numero}';
    final totalHt = _devisHt + _avenantHt;
    final fin = DateTime.tryParse(widget.finPrevue);
    Widget bas;
    List<Widget> corps;
    if (_fait != null) {
      final envoye = _fait!['status'] == 'Envoye';
      corps = [
        _koji(da, '${numeroCourt(_s(_fait!['numero']))} ${envoye ? 'envoyé pour signature' : 'enregistré en brouillon'}.',
            envoye ? '${_fait!['emailEnvoye'] == true ? 'E-mail parti avec le PDF. ' : ''}Le client signe en ligne ; vous êtes prévenu à la signature.' : 'Vous pourrez l\'envoyer depuis le site.'),
      ];
      bas = ProPrimaryButton(label: 'Terminé', expand: true, onPressed: () => Navigator.of(context).maybePop(true));
    } else if (!_prepare) {
      corps = [
        Text('CE QUI CHANGE SUR LE CHANTIER', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
        const SizedBox(height: 6),
        TextField(
          controller: _notes,
          maxLines: 5,
          minLines: 3,
          onChanged: (_) => setState(() {}),
          style: da.text(14, height: 1.45),
          decoration: InputDecoration(
            hintText: '« sol pas droit, vanne HS, la cliente veut la faïence sur le retour… »',
            helperText: 'Touchez le micro du clavier pour dicter. Koji n\'invente aucun prix.',
            filled: true,
            fillColor: da.card,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(2), borderSide: BorderSide(color: da.line)),
          ),
        ),
        if (_prepa) ...[const SizedBox(height: 12), _koji(da, 'Koji prépare l\'avenant…', '« ${_notes.text.trim()} »')],
      ];
      bas = ProPrimaryButton(label: _prepa ? 'Préparation…' : 'Préparer avec Koji', expand: true, onPressed: _prepa || _notes.text.trim().isEmpty ? null : _preparer);
    } else {
      corps = [
        if (_notes.text.trim().isNotEmpty) ...[_koji(da, 'Koji a préparé l\'avenant depuis tes notes de chantier.', '« ${_notes.text.trim()} »'), const SizedBox(height: 10)],
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(numero.toUpperCase(), style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
            Text('au devis ${widget.devis['quoteNumber'] ?? ''}', style: da.text(16, weight: FontWeight.w700)),
            Text([_s(widget.devis['project']), _s(widget.devis['client'])].where((x) => x.isNotEmpty).join(' · '), style: da.text(12.5, color: da.grey)),
            const SizedBox(height: 10),
            Text('IMPACT PLANNING', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
            Row(children: [
              IconButton(onPressed: () => setState(() => _impact--), icon: const Icon(Icons.remove, size: 18), tooltip: 'Un jour de moins'),
              Text(_impact == 0 ? 'aucun' : '${_impact > 0 ? '+' : '−'} ${_impact.abs()} jour${_impact.abs() > 1 ? 's' : ''}', style: da.text(16, weight: FontWeight.w700)),
              IconButton(onPressed: () => setState(() => _impact++), icon: const Icon(Icons.add, size: 18), tooltip: 'Un jour de plus'),
            ]),
            if (fin != null)
              Text(
                  _impact == 0
                      ? 'Fin prévue ${DateFormat('d MMM', 'fr_FR').format(fin)}'
                      : 'Fin prévue ${DateFormat('d MMM', 'fr_FR').format(DateTime.parse(finDecalee(widget.finPrevue, _impact)))} au lieu du ${DateFormat('d MMM', 'fr_FR').format(fin)}',
                  style: da.text(12, color: da.grey)),
          ]),
        ),
        const SizedBox(height: 12),
        Text('MODIFICATIONS', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
        for (final (i, l) in _lignes.indexed)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(border: Border(bottom: BorderSide(color: da.line))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: l['type'] == 'ajout' ? da.fill : da.card, border: Border.all(color: l['type'] == 'suppression' ? da.grey : da.ink)),
                child: Text(l['type'] == 'ajout' ? '+' : l['type'] == 'modification' ? '~' : '−', style: da.text(13, weight: FontWeight.w700, color: l['type'] == 'ajout' ? da.onFill : da.ink)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_s(l['label']), style: da.text(14, color: l['type'] == 'suppression' ? da.grey : da.ink).copyWith(decoration: l['type'] == 'suppression' ? TextDecoration.lineThrough : null)),
                  Text(detailLigne(l, _lots), style: da.text(12, color: da.grey, height: 1.35)),
                  if (l['aChiffrer'] == true && _n(l['unitPriceHt']) <= 0)
                    SizedBox(
                      width: 150,
                      child: TextField(
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(isDense: true, labelText: 'Prix unitaire HT €'),
                        onSubmitted: (v) => setState(() => _lignes[i] = {..._lignes[i], 'unitPriceHt': double.tryParse(v.replaceAll(',', '.')) ?? 0}),
                      ),
                    ),
                ]),
              ),
              const SizedBox(width: 8),
              Text(_signe(totalLigne(l)), style: da.text(13.5, weight: FontWeight.w600, color: l['type'] == 'suppression' ? da.grey : da.ink)),
              GestureDetector(onTap: () => setState(() => _lignes.removeAt(i)), child: Padding(padding: const EdgeInsets.only(left: 8), child: Icon(Icons.close, size: 16, color: da.grey))),
            ]),
          ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
          decoration: BoxDecoration(color: da.card, border: Border.all(color: da.line)),
          child: Column(children: [
            for (final (k, v) in [('Devis initial HT', euros(_devisHt)), ('$numero HT', _signe(_avenantHt))])
              Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [Expanded(child: Text(k, style: da.text(13, color: da.grey))), Text(v, style: da.text(13.5, weight: FontWeight.w600))])),
            Container(
              padding: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(border: Border(top: BorderSide(color: da.ink))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [Expanded(child: Text('Nouveau total du marché', style: da.text(13, color: da.grey))), Text('${euros(totalHt)} HT', style: da.text(17, weight: FontWeight.w700))]),
                Text('${euros(((totalHt * (1 + _tva / 100)) * 100).round() / 100)} TTC · TVA ${'$_tva'.replaceAll('.0', '').replaceAll('.', ',')} % · reste à facturer ajusté sur les situations', style: da.text(11.5, color: da.grey)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Text('MESSAGE AU CLIENT', style: da.text(11, weight: FontWeight.w700, color: da.grey, letterSpacing: 0.6)),
        const SizedBox(height: 6),
        TextField(
          controller: _message,
          maxLines: 4,
          minLines: 2,
          style: da.text(13.5, height: 1.45),
          decoration: InputDecoration(filled: true, fillColor: da.card, border: OutlineInputBorder(borderRadius: BorderRadius.circular(2), borderSide: BorderSide(color: da.line))),
        ),
        CheckboxListTile(
          value: _email,
          onChanged: _s(widget.devis['clientEmail']).isEmpty ? null : (v) => setState(() => _email = v ?? false),
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          activeColor: da.fill,
          title: Text('E-mail avec le PDF et le lien de signature', style: da.text(13.5)),
        ),
        if (_aChiffrer) Text('Une ligne est à chiffrer : donnez-lui un prix avant d\'envoyer.', style: da.text(12.5, color: da.grey)),
      ];
      bas = Row(children: [
        TextButton(
          onPressed: _envoi.isNotEmpty || _lignes.isEmpty ? null : () => _valider(false),
          style: TextButton.styleFrom(foregroundColor: da.ink),
          child: Text(_envoi == 'brouillon' ? 'Enregistrement…' : 'Enregistrer', style: da.text(14, weight: FontWeight.w600)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: ProPrimaryButton(
            label: _envoi == 'envoi' ? 'Envoi…' : 'Envoyer pour signature',
            expand: true,
            onPressed: _envoi.isNotEmpty || _lignes.isEmpty || _aChiffrer ? null : () => _valider(true),
          ),
        ),
      ]);
    }
    return Scaffold(
      backgroundColor: da.page,
      appBar: _barre(context, da, numero, ['Devis ${widget.devis['quoteNumber'] ?? ''}', _s(widget.devis['client'])].where((x) => x.trim().isNotEmpty).join(' · ')),
      body: Column(children: [
        Expanded(
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 16), children: [
            ...corps,
            if (_erreur.isNotEmpty) ...[const SizedBox(height: 10), Text(_erreur, style: da.text(13, color: const Color(0xFFC4452D)))],
          ]),
        ),
        SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 12), child: bas)),
      ]),
    );
  }
}

// ── Branchement ─────────────────────────────────────────────────────────

/// Avenant depuis la fiche du chantier (devis signé).
Future<void> ouvrirAvenant(BuildContext context, WidgetRef ref, Map<String, dynamic> devis, {String finPrevue = ''}) async {
  final api = ref.read(proKojiWebProvider);
  final existants = await api.avenants(_s(devis['id'])).catchError((_) => <Map<String, dynamic>>[]);
  if (!context.mounted) return;
  await Navigator.of(context).push(MaterialPageRoute(
    builder: (_) => ProAvenantScreen(
      devis: devis,
      numero: existants.length + 1,
      finPrevue: finPrevue,
      actions: AvenantActions(
        preparer: (notes) => api.preparerAvenant(_s(devis['id']), notes),
        enregistrer: (corps, {required envoyer, required email}) async {
          final a = await api.creerAvenant(corps);
          if (envoyer) return api.envoyerAvenant(_s(a['id']), email: email);
          return a;
        },
      ),
    ),
  ));
}

/// Avenants (entrée du menu).
class ProAvenantsScreen extends ConsumerWidget {
  const ProAvenantsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final da = ProDa.of(context);
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: ref.read(proKojiWebProvider).tousAvenants(),
      builder: (context, s) {
        if (!s.hasData) {
          return Scaffold(
            backgroundColor: da.page,
            appBar: _barre(context, da, 'Avenants', ''),
            body: Center(child: s.hasError ? Text('Avenants indisponibles pour le moment.', style: da.text(13, color: da.grey)) : const CircularProgressIndicator(strokeWidth: 2)),
          );
        }
        return ProAvenantsView(avenants: s.data!);
      },
    );
  }
}
