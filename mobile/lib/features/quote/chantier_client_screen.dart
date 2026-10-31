import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/quote/repositories/chantier_client_repository.dart';
import 'package:koji/features/quote/repositories/quote_message_repository.dart';
import 'package:koji/features/quote/services/devis_pdf_service.dart';

/// The in-app CLIENT space for ONE chantier, opened after the Espace
/// Particulier login (Identifiant + Mot de passe). No Supabase session — all
/// data loads by the quote id via the anon-granted RPCs.
///
/// Three tabs: Devis (view the generated PDF + sign), Suivi des travaux (the
/// prestations per pièce), and Messages (discussion with the artisan).
class ChantierClientScreen extends ConsumerStatefulWidget {
  final String quoteId;

  const ChantierClientScreen({super.key, required this.quoteId});

  @override
  ConsumerState<ChantierClientScreen> createState() =>
      _ChantierClientScreenState();
}

class _ChantierClientScreenState extends ConsumerState<ChantierClientScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late final ChantierClientRepository _repo;

  bool _loading = true;
  String? _error;

  /// Raw quote map from the RPC (metadata, quote_rooms, totals…).
  Map<String, dynamic>? _raw;

  /// Rebuilt `quoteData` ready for DevisPdfService + the Suivi list.
  Map<String, dynamic>? _quoteData;

  /// Grouped prestations for the Suivi tab: pièce name -> list of line titles.
  final Map<String, List<String>> _suivi = {};

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _repo = ChantierClientRepository(Supabase.instance.client);
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final raw = await _repo.getQuoteForClient(widget.quoteId);
      if (raw == null) {
        setState(() {
          _error = "Ce devis n'a pas pu être ouvert.";
          _loading = false;
        });
        return;
      }
      _raw = raw;
      _buildQuoteData(raw);
      setState(() => _loading = false);
    } catch (e) {
      setState(() {
        _error = 'Erreur de chargement : $e';
        _loading = false;
      });
    }
  }

  /// Rebuild the `quoteData` shape DevisPdfService expects from the RPC payload
  /// (metadata + quote_rooms[*].quote_tasks). Mirrors signature_screen's
  /// `_previewDevisPdf`, but sources rooms/tasks from the single RPC result.
  void _buildQuoteData(Map<String, dynamic> raw) {
    final metadata = (raw['metadata'] is Map)
        ? Map<String, dynamic>.from(raw['metadata'] as Map)
        : <String, dynamic>{};

    final rooms = (raw['quote_rooms'] as List?) ?? const [];
    final expenses = <String, List<Map<String, dynamic>>>{};
    final lotTotals = <String, double>{};
    _suivi.clear();

    for (final r in rooms) {
      final room = Map<String, dynamic>.from(r as Map);
      final roomName = (room['name'] as String?) ?? '';
      if (roomName.isEmpty) continue;
      final tasks = (room['quote_tasks'] as List?) ?? const [];
      final items = <Map<String, dynamic>>[];
      final titles = <String>[];
      double lotHT = 0;

      for (final tRaw in tasks) {
        final t = Map<String, dynamic>.from(tRaw as Map);
        final inputs = (t['inputs'] is Map)
            ? Map<String, dynamic>.from(t['inputs'] as Map)
            : <String, dynamic>{};
        final qty = (inputs['quantity'] as num?)?.toDouble() ?? 1.0;
        final materialQty =
            (inputs['fournituresQty'] as num?)?.toDouble() ?? qty;
        final hide = inputs['hideFournitures'] == true;
        final labor = (t['unit_price_ht'] as num?)?.toDouble() ?? 0.0;
        final material = (t['total_price_ht'] as num?)?.toDouble() ?? 0.0;
        final materialTotal = materialQty * material;
        final hiddenMaterialUnit = hide && qty > 0 ? materialTotal / qty : 0.0;
        final taskId = (t['task_id'] as String?) ?? '';
        final lineType = inputs['lineType']?.toString() ?? 'normal';
        final title = (t['label'] as String?) ?? 'Prestation';

        // Une note/commentaire n'est pas une prestation : elle est transmise au
        // PDF (rendue en italique) mais exclue de la liste des travaux à suivre
        // et du total HT.
        final isComment =
            taskId.startsWith('comment_') || inputs['isComment'] == true;

        items.add({
          'title': title,
          'quantity': qty,
          'materialQuantity': materialQty,
          'laborCost': hide ? labor + hiddenMaterialUnit : labor,
          'materialCost': hide ? 0.0 : material,
          'isFourniture': taskId.startsWith('fourniture_'),
          'isComment': isComment,
          'commentaire': inputs['commentaire']?.toString() ?? title,
          'lineType': lineType,
        });
        if (!isComment) titles.add(title);
        if (lineType == 'normal' && !isComment) {
          lotHT += qty * labor + materialQty * material;
        }
      }

      if (items.isNotEmpty) {
        expenses[roomName] = items;
        lotTotals[roomName] = lotHT;
        _suivi[roomName] = titles;
      }
    }

    // Récapitulatif from stored global % (recap), same as the contractor PDF.
    final recap = (metadata['recap'] is Map)
        ? Map<String, dynamic>.from(metadata['recap'] as Map)
        : <String, dynamic>{};
    double pct(String k, double dflt) => (recap[k] as num?)?.toDouble() ?? dflt;
    final subtotalLots = lotTotals.values.fold<double>(0, (s, v) => s + v);
    final coordPct = pct('coordPct', 10);
    final aleasPct = pct('aleasPct', 5);
    final decennalePct = pct('decennalePct', 8);
    final coordAmount = subtotalLots * coordPct / 100;
    final aleasAmount = subtotalLots * aleasPct / 100;
    final decennaleAmount = subtotalLots * decennalePct / 100;
    final generalHT =
        subtotalLots + coordAmount + aleasAmount + decennaleAmount;
    final tvaRate = (recap['tvaRate'] as num?)?.toInt() ??
        (raw['tva_rate'] as num?)?.toInt() ??
        20;
    final tva = generalHT * tvaRate / 100;

    _quoteData = <String, dynamic>{
      ...metadata,
      'id': raw['id'],
      'expenses': expenses,
      'lotTotals': lotTotals,
      'totals': {
        'subtotalLots': subtotalLots,
        'coordPct': coordPct,
        'coordAmount': coordAmount,
        'aleasPct': aleasPct,
        'aleasAmount': aleasAmount,
        'decennalePct': decennalePct,
        'decennaleAmount': decennaleAmount,
        'ht': generalHT,
        'tvaRate': tvaRate,
        'tva': tva,
        'ttc': generalHT + tva,
      },
    };
  }

  bool get _isSigned {
    final status = (_raw?['status'] as String?)?.toLowerCase() ?? '';
    return status.contains('sign') ||
        status.contains('accept') ||
        (_raw?['signature_data'] != null);
  }

  @override
  Widget build(BuildContext context) {
    final clientName =
        (_quoteData?['client'] is Map ? _quoteData!['client']['name'] : null)
                ?.toString() ??
            'Mon chantier';

    return Scaffold(
      backgroundColor: const Color(0xFFF6F4F0),
      appBar: AppBar(
        title: Text(clientName),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF16233F),
        elevation: 0.5,
        bottom: _loading || _error != null
            ? null
            : TabBar(
                controller: _tabController,
                labelColor: const Color(0xFF16233F),
                unselectedLabelColor: const Color(0xFF6B7280),
                // The app theme uses pill tabs; this one keeps an underline.
                indicator: const UnderlineTabIndicator(
                  borderSide: BorderSide(color: Color(0xFF16233F), width: 3),
                ),
                indicatorSize: TabBarIndicatorSize.label,
                tabs: const [
                  Tab(text: 'Devis'),
                  Tab(text: 'Suivi'),
                  Tab(text: 'Messages'),
                ],
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _DevisTab(
                      quoteData: _quoteData!,
                      quoteId: widget.quoteId,
                      isSigned: _isSigned,
                      repo: _repo,
                      onSigned: _load,
                    ),
                    _SuiviTab(suivi: _suivi),
                    _MessagesTab(quoteId: widget.quoteId),
                  ],
                ),
    );
  }
}

// ── Devis tab : generated PDF preview + sign ─────────────────────────────────
class _DevisTab extends StatefulWidget {
  final Map<String, dynamic> quoteData;
  final String quoteId;
  final bool isSigned;
  final ChantierClientRepository repo;
  final VoidCallback onSigned;

  const _DevisTab({
    required this.quoteData,
    required this.quoteId,
    required this.isSigned,
    required this.repo,
    required this.onSigned,
  });

  @override
  State<_DevisTab> createState() => _DevisTabState();
}

class _DevisTabState extends State<_DevisTab> {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: PdfPreview(
            build: (format) async {
              final pdf =
                  await DevisPdfService().generate(quoteData: widget.quoteData);
              return pdf.save();
            },
            canChangePageFormat: false,
            canChangeOrientation: false,
            canDebug: false,
            allowPrinting: true,
            allowSharing: true,
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: SizedBox(
              width: double.infinity,
              child: widget.isSigned
                  ? Container(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Text(
                          '✓ Devis déjà signé',
                          style: TextStyle(
                            color: Color(0xFF166534),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    )
                  : ElevatedButton(
                      onPressed: () => _openSignSheet(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF16233F),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      child: const Text('Signer le devis',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _openSignSheet(BuildContext context) async {
    final signed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _SignSheet(quoteId: widget.quoteId, repo: widget.repo),
    );
    if (signed == true) widget.onSigned();
  }
}

/// Draw-your-signature bottom sheet; submits via the sessionless RPC.
class _SignSheet extends StatefulWidget {
  final String quoteId;
  final ChantierClientRepository repo;

  const _SignSheet({required this.quoteId, required this.repo});

  @override
  State<_SignSheet> createState() => _SignSheetState();
}

class _SignSheetState extends State<_SignSheet> {
  final List<Offset?> _points = [];
  bool _saving = false;

  Future<void> _submit() async {
    if (_points.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez signer avant de confirmer.')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      // Render the strokes to a white-background PNG, then base64 data URL.
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder,
          Rect.fromPoints(const Offset(0, 0), const Offset(500, 300)));
      canvas.drawRect(
          const Rect.fromLTWH(0, 0, 500, 300), Paint()..color = Colors.white);
      _SigPainter(_points).paint(canvas, const Size(500, 300));
      final img = await recorder.endRecording().toImage(500, 300);
      final bytes = await img.toByteData(format: ui.ImageByteFormat.png);
      final dataUrl =
          'data:image/png;base64,${base64Encode(bytes!.buffer.asUint8List())}';

      final ok = await widget.repo
          .submitSignature(quoteId: widget.quoteId, signatureDataUrl: dataUrl);
      if (!mounted) return;
      if (ok) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Devis signé ✍️ Merci !'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('La signature a échoué, réessayez.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Signez ci-dessous',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('« Lu et approuvé, bon pour accord »',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
          const SizedBox(height: 12),
          Container(
            height: 200,
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFCBD5E1)),
              borderRadius: BorderRadius.circular(12),
              color: Colors.white,
            ),
            child: GestureDetector(
              onPanStart: (d) => setState(() => _points.add(d.localPosition)),
              onPanUpdate: (d) => setState(() => _points.add(d.localPosition)),
              onPanEnd: (_) => setState(() => _points.add(null)),
              child: CustomPaint(
                painter: _SigPainter(_points),
                size: Size.infinite,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              TextButton(
                onPressed: _saving ? null : () => setState(_points.clear),
                child: const Text('Effacer'),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: _saving ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF16233F),
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Confirmer',
                        style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SigPainter extends CustomPainter {
  final List<Offset?> points;
  _SigPainter(this.points);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF16233F)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3;
    for (var i = 0; i < points.length - 1; i++) {
      final a = points[i], b = points[i + 1];
      if (a != null && b != null) canvas.drawLine(a, b, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _SigPainter oldDelegate) => true;
}

// ── Suivi tab : prestations per pièce ────────────────────────────────────────
class _SuiviTab extends StatelessWidget {
  final Map<String, List<String>> suivi;
  const _SuiviTab({required this.suivi});

  @override
  Widget build(BuildContext context) {
    if (suivi.isEmpty) {
      return const _EmptyState(
        icon: Icons.assignment_outlined,
        title: 'Aucune tâche pour le moment',
        subtitle:
            "Le suivi de vos travaux apparaîtra ici dès que votre artisan l'aura démarré.",
      );
    }
    final entries = suivi.entries.toList();
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: entries.length,
      itemBuilder: (context, i) {
        final e = entries[i];
        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFEFF1F4)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(e.key,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                      color: Color(0xFF16233F))),
              const SizedBox(height: 8),
              ...e.value.map((t) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.circle,
                            size: 8, color: Color(0xFF16233F)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(t,
                              style: const TextStyle(
                                  fontSize: 14, color: Color(0xFF334155))),
                        ),
                      ],
                    ),
                  )),
            ],
          ),
        );
      },
    );
  }
}

// ── Messages tab : discussion with the artisan ───────────────────────────────
class _MessagesTab extends StatefulWidget {
  final String quoteId;
  const _MessagesTab({required this.quoteId});

  @override
  State<_MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<_MessagesTab> {
  late final QuoteMessageRepository _repo;
  final _controller = TextEditingController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _repo = QuoteMessageRepository(Supabase.instance.client);
    _loadMessages();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    try {
      final msgs = await _repo.getMessages(widget.quoteId);
      if (mounted) setState(() => _messages = msgs);
    } catch (_) {
      // messaging tables may be unavailable — keep an empty thread
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    setState(() => _sending = true);
    try {
      await _repo.sendMessage(
        quoteId: widget.quoteId,
        text: text,
        authorName: 'Client',
        authorEmail: '',
      );
      _controller.clear();
      await _loadMessages();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text("Échec de l'envoi : $e")));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  bool _isFromClient(Map<String, dynamic> m) {
    final email = (m['author_email'] as String?)?.trim() ?? '';
    // Client messages are sent with an empty author_email (see _send).
    return email.isEmpty;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : _messages.isEmpty
                  ? const _EmptyState(
                      icon: Icons.chat_bubble_outline,
                      title: 'Aucun message',
                      subtitle:
                          'Écrivez à votre artisan pour toute question sur ce devis.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length,
                      itemBuilder: (context, i) {
                        final m = _messages[i];
                        final mine = _isFromClient(m);
                        return Align(
                          alignment: mine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            constraints: BoxConstraints(
                                maxWidth:
                                    MediaQuery.of(context).size.width * 0.72),
                            decoration: BoxDecoration(
                              color: mine
                                  ? const Color(0xFF16233F)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: const Color(0xFFEFF1F4)),
                            ),
                            child: Text(
                              (m['text'] as String?) ?? '',
                              style: TextStyle(
                                color: mine
                                    ? Colors.white
                                    : const Color(0xFF334155),
                                fontSize: 14,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Écrire un message…',
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide:
                            const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide:
                            const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                CircleAvatar(
                  radius: 24,
                  backgroundColor: const Color(0xFF16233F),
                  child: _sending
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : IconButton(
                          icon: const Icon(Icons.send, color: Colors.white),
                          onPressed: _send,
                        ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ── Shared little widgets ────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _EmptyState(
      {required this.icon, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: const Color(0xFFCBD5E1)),
            const SizedBox(height: 14),
            Text(title,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF475569))),
            const SizedBox(height: 6),
            Text(subtitle,
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline,
                size: 56, color: Color(0xFFEF4444)),
            const SizedBox(height: 14),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF475569))),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Réessayer')),
          ],
        ),
      ),
    );
  }
}
