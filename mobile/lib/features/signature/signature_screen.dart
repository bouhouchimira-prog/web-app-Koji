import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/signature/providers/signature_provider.dart';
import 'package:koji/features/signature/client_devis_pdf.dart';

class SignatureScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> quote;

  const SignatureScreen({super.key, required this.quote});

  @override
  ConsumerState<SignatureScreen> createState() => _SignatureScreenState();
}

class _SignatureScreenState extends ConsumerState<SignatureScreen> {
  // Signature Drawing State
  List<Offset?> _points = [];
  bool _isSaving = false;

  // Lieu de signature ("Fait à …, le …"). Pre-filled from the quote's site
  // address / city when available; editable by the signer.
  final TextEditingController _lieuController = TextEditingController();
  bool _lieuPrefilled = false;

  @override
  void dispose() {
    _lieuController.dispose();
    super.dispose();
  }

  void _saveSignature() async {
    if (_points.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Veuillez signer avant de confirmer.')));
      return;
    }

    setState(() => _isSaving = true);

    try {
      // 1. Export canvas to PNG
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder,
          Rect.fromPoints(const Offset(0.0, 0.0), const Offset(500.0, 300.0)));
      final painter = SignaturePainter(points: _points);

      // We give it a white background so it's not transparent with black ink
      canvas.drawRect(
          const Rect.fromLTWH(0, 0, 500, 300), Paint()..color = Colors.white);
      painter.paint(canvas, const Size(500, 300));

      final picture = recorder.endRecording();
      final img = await picture.toImage(500, 300);
      final ByteData? byteData =
          await img.toByteData(format: ui.ImageByteFormat.png);

      if (byteData != null) {
        final quoteId = widget.quote['id'] as String;
        final clientName =
            widget.quote['client']?['name']?.toString() ?? 'Client';

        final repo = ref.read(signatureRepositoryProvider);
        await repo.saveSignature(
          quoteId,
          clientName,
          byteData.buffer.asUint8List(),
          lieu: _lieuController.text.trim(),
        );
      }

      if (!mounted) return;
      context.pushReplacement('/signature/success');
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Erreur: $e')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _clearSignature() {
    setState(() {
      _points = [];
    });
  }

  bool _loadingPreview = false;

  /// Renders the SAME devis PDF the client received by message, so the document
  /// reviewed before signing is identical to the one sent (design harmonized).
  /// The signature-list quote carries only summary fields, so we load the rooms
  /// & tasks here to rebuild the full `expenses` map the PDF needs.
  Future<void> _previewDevisPdf() async {
    final quoteId = widget.quote['id'] as String?;
    if (quoteId == null || quoteId.isEmpty) return;

    setState(() => _loadingPreview = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await previewClientDevis(widget.quote);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erreur aperçu : $e')));
    } finally {
      if (mounted) setState(() => _loadingPreview = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final quote = widget.quote;
    final quoteNumber = quote['quoteNumber'] ?? '??';
    final title = quote['title'] ??
        (quote['company']?['name'] != null
            ? "Rénovation ${quote['client']?['name']?.split(' ').first}"
            : "Projet");
    final clientName = quote['client']?['name'] ?? 'Client';
    final date = quote['date'] ?? '';
    final address = quote['siteAddress'] ?? '';
    final totalTTC = quote['totals']?['ttc'] ?? 0.0;

    // Prefill the "lieu" once from the site address / client city if present.
    if (!_lieuPrefilled) {
      _lieuPrefilled = true;
      final addrStr = address.toString().trim();
      if (addrStr.isNotEmpty) {
        // Use the last comma-separated segment (usually the city) as a sensible
        // default for "Fait à …".
        final city = addrStr.split(',').last.trim();
        _lieuController.text = city.isNotEmpty ? city : addrStr;
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Signer un devis',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF0F2648))),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Color(0xFF0F2648), size: 20),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/client-home');
            }
          },
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "#$quoteNumber",
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E3A8A)),
            ),
            const SizedBox(height: 16),

            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withAlpha((0.02 * 255).round()),
                      blurRadius: 10)
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(8)),
                        child: Text("Devis N° #$quoteNumber",
                            style: const TextStyle(
                                fontSize: 12,
                                color: Color(0xFF1E3A8A),
                                fontWeight: FontWeight.bold)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                            color: const Color(0xFFEFF6FF),
                            borderRadius: BorderRadius.circular(8)),
                        child: const Text("En Cours",
                            style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF1D74FF),
                                fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(title,
                      style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F2648))),
                  const SizedBox(height: 12),
                  _buildInfoRow(Icons.calendar_today, "Crée le $date"),
                  const SizedBox(height: 6),
                  _buildInfoRow(Icons.person, clientName),
                  const SizedBox(height: 6),
                  _buildInfoRow(Icons.location_on, address),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("Total TTC",
                          style: TextStyle(
                              color: Color(0xFF94A3B8), fontSize: 12)),
                      Text(
                          "${(totalTTC as num).toDouble().toStringAsFixed(2)} €",
                          style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF0F2648))),
                    ],
                  )
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Full devis preview — identical to the PDF sent by message.
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _loadingPreview ? null : _previewDevisPdf,
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF1D74FF),
                  side: const BorderSide(color: Color(0xFF1D74FF)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                icon: _loadingPreview
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Color(0xFF1D74FF)),
                      )
                    : const Icon(Icons.picture_as_pdf_outlined, size: 20),
                label: Text(
                  _loadingPreview
                      ? "Chargement…"
                      : "Aperçu du devis complet (PDF)",
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Lieu de signature — appears on the signed devis as "Fait à …, le …"
            const Text("Lieu de signature",
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: Color(0xFF0F2648))),
            const SizedBox(height: 8),
            TextField(
              controller: _lieuController,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: "Ex : Paris",
                prefixIcon: const Icon(Icons.location_city,
                    color: Color(0xFF94A3B8), size: 20),
                filled: true,
                fillColor: Theme.of(context).colorScheme.surface,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFF1D74FF)),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Builder(builder: (context) {
              final lieu = _lieuController.text.trim();
              final today =
                  "${DateTime.now().day.toString().padLeft(2, '0')}/${DateTime.now().month.toString().padLeft(2, '0')}/${DateTime.now().year}";
              return Text(
                lieu.isEmpty ? "Fait le $today" : "Fait à $lieu, le $today",
                style: const TextStyle(
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF64748B)),
              );
            }),

            const SizedBox(height: 24),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("Signez dans le cadre ci-dessous",
                    style: TextStyle(
                        fontWeight: FontWeight.bold, color: Color(0xFF0F2648))),
                IconButton(
                  icon: const Icon(Icons.delete_outline,
                      color: Color(0xFF1D74FF)),
                  onPressed: _clearSignature,
                  tooltip: "Effacer",
                )
              ],
            ),

            const SizedBox(height: 12),

            // Signature Canvas
            Container(
              height: 300,
              width: double.infinity,
              decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: const Color(0xFFE2E8F0),
                      style: BorderStyle
                          .none), // Dashed implied by design, using solid for MVP
                  boxShadow: [
                    BoxShadow(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withAlpha((0.02 * 255).round()),
                        blurRadius: 10,
                        offset: const Offset(0, 4)),
                  ]),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  children: [
                    // Dashed Border Simulator (Optional)
                    Positioned.fill(
                      child: CustomPaint(
                        painter: DashedRectPainter(
                            color: const Color(0xFFCBD5E1),
                            strokeWidth: 2,
                            gap: 5),
                      ),
                    ),

                    // Placeholder Text
                    if (_points.isEmpty)
                      const Center(
                          child: Text("Zone de signature tactile",
                              style: TextStyle(
                                  color: Color(0xFFCBD5E1), fontSize: 14))),

                    // Drawing Area
                    GestureDetector(
                      onPanUpdate: (details) {
                        setState(() {
                          // Find reference relative to this widget
                          _points.add(details.localPosition);
                        });
                      },
                      onPanEnd: (details) {
                        _points.add(null);
                      },
                      child: CustomPaint(
                        painter: SignaturePainter(points: _points),
                        size: Size.infinite,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.info_outline,
                      color: Color(0xFF1D74FF), size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      "En signant ce document, vous acceptez les conditions générales de vente et reconnaissez la valeur juridique de cette signature électronique, conformément à l'article 1367 du Code Civil. Ce document sera archivé de manière sécurisée",
                      style: TextStyle(
                          fontSize: 11,
                          color: const Color(0xFF1D74FF)
                              .withAlpha((0.8 * 255).round()),
                          height: 1.4),
                    ),
                  )
                ],
              ),
            ),

            const SizedBox(height: 32),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _saveSignature,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF475E84), // Greyish Blue
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    if (_isSaving)
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Theme.of(context).colorScheme.surface,
                          strokeWidth: 2,
                        ),
                      )
                    else
                      const Icon(Icons.check_circle, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      _isSaving ? "Enregistrement..." : "Confirmer et signer",
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 8),
        Expanded(
            child: Text(text,
                style: const TextStyle(color: Color(0xFF64748B), fontSize: 13),
                overflow: TextOverflow.ellipsis)),
      ],
    );
  }
}

// Painters

class SignaturePainter extends CustomPainter {
  final List<Offset?> points;
  SignaturePainter({required this.points});

  @override
  void paint(Canvas canvas, Size size) {
    Paint paint = Paint()
      ..color = const Color(0xFF0F2648)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;

    for (int i = 0; i < points.length - 1; i++) {
      if (points[i] != null && points[i + 1] != null) {
        canvas.drawLine(points[i]!, points[i + 1]!, paint);
      }
    }
  }

  @override
  bool shouldRepaint(SignaturePainter oldDelegate) =>
      oldDelegate.points != points;
}

class DashedRectPainter extends CustomPainter {
  final double strokeWidth;
  final Color color;
  final double gap;

  DashedRectPainter(
      {this.strokeWidth = 2.0, this.color = Colors.black, this.gap = 5.0});

  @override
  void paint(Canvas canvas, Size size) {
    Paint dashedPaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    double x = size.width;
    double y = size.height;

    Path topPath =
        getDashedPath(a: const Offset(0, 0), b: Offset(x, 0), gap: gap);
    Path rightPath = getDashedPath(a: Offset(x, 0), b: Offset(x, y), gap: gap);
    Path bottomPath = getDashedPath(a: Offset(0, y), b: Offset(x, y), gap: gap);
    Path leftPath =
        getDashedPath(a: const Offset(0, 0), b: Offset(0, y), gap: gap);

    canvas.drawPath(topPath, dashedPaint);
    canvas.drawPath(rightPath, dashedPaint);
    canvas.drawPath(bottomPath, dashedPaint);
    canvas.drawPath(leftPath, dashedPaint);
  }

  Path getDashedPath(
      {required Offset a, required Offset b, required double gap}) {
    Path path = Path();
    path.moveTo(a.dx, a.dy);
    bool shouldDraw = true;

    // Simplified implementation for rectangle
    if (a.dy == b.dy) {
      // Horizontal
      double currentX = a.dx;
      while (currentX < b.dx) {
        if (shouldDraw) {
          path.lineTo(headersMin(currentX + gap, b.dx), a.dy);
        } else {
          path.moveTo(headersMin(currentX + gap, b.dx), a.dy);
        }
        currentX += gap;
        shouldDraw = !shouldDraw;
      }
    } else {
      // Vertical
      double currentY = a.dy;
      while (currentY < b.dy) {
        if (shouldDraw) {
          path.lineTo(a.dx, headersMin(currentY + gap, b.dy));
        } else {
          path.moveTo(a.dx, headersMin(currentY + gap, b.dy));
        }
        currentY += gap;
        shouldDraw = !shouldDraw;
      }
    }

    return path;
  }

  double headersMin(double a, double b) => a < b ? a : b;

  @override
  bool shouldRepaint(CustomPainter oldDelegate) => false;
}
