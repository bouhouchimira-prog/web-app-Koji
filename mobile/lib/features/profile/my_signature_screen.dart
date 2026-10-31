import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/features/signature/signature_screen.dart'; // To reuse painters

class MySignatureScreen extends ConsumerStatefulWidget {
  const MySignatureScreen({super.key});

  @override
  ConsumerState<MySignatureScreen> createState() => _MySignatureScreenState();
}

class _MySignatureScreenState extends ConsumerState<MySignatureScreen> {
  List<Offset?> _points = [];
  bool _isSaving = false;
  String? _existingSignatureUrl;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadExistingSignature();
  }

  Future<void> _loadExistingSignature() async {
    final uid = SupabaseConfig.client.auth.currentUser?.id;
    if (uid == null) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }

    try {
      final res = await SupabaseConfig.client
          .from('users')
          .select('signature_url')
          .eq('id', uid)
          .maybeSingle();

      if (mounted) {
        setState(() {
          _existingSignatureUrl = res?['signature_url'] as String?;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading signature: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveSignature() async {
    if (_points.isEmpty && _existingSignatureUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Veuillez signer avant de sauvegarder.')),
      );
      return;
    }
    
    // If they didn't draw anything new, just ignore
    if (_points.isEmpty) {
       context.pop();
       return;
    }

    setState(() => _isSaving = true);

    try {
      final uid = SupabaseConfig.client.auth.currentUser?.id;
      if (uid == null) throw Exception('Utilisateur non connecté');

      // Export canvas to PNG
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder, Rect.fromPoints(const Offset(0.0, 0.0), const Offset(500.0, 300.0)));
      final painter = SignaturePainter(points: _points);
      
      // Transparent background so it blends well on documents
      // (Wait, actually white might be safer for PDFs if they have dark mode, but transparent is better. 
      // We will leave it transparent by NOT drawing a rect, but in the previous screen we used white.)
      canvas.drawRect(const Rect.fromLTWH(0, 0, 500, 300), Paint()..color = Colors.white);
      painter.paint(canvas, const Size(500, 300));
      
      final picture = recorder.endRecording();
      final img = await picture.toImage(500, 300);
      final ByteData? byteData = await img.toByteData(format: ui.ImageByteFormat.png);
      
      if (byteData == null) throw Exception('Erreur de génération de l\'image');

      final fileName = 'user_signature_$uid.png';
      
      // Upload to public storage 'signatures' bucket
      await SupabaseConfig.client.storage.from('signatures').uploadBinary(
        fileName,
        byteData.buffer.asUint8List(),
        fileOptions: const FileOptions(upsert: true, contentType: 'image/png'),
      );
      
      final publicUrl = SupabaseConfig.client.storage.from('signatures').getPublicUrl(fileName);
      
      // Update users table
      await SupabaseConfig.client.from('users').update({
        'signature_url': publicUrl
      }).eq('id', uid);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Signature enregistrée avec succès.')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  void _clearSignature() {
    setState(() {
      _points = [];
      _existingSignatureUrl = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Ma Signature',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F2648))),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new,
              color: Color(0xFF0F2648), size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator())
        : SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Configuration de la signature",
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E3A8A)),
            ),
            const SizedBox(height: 16),
            const Text(
              "Cette signature sera automatiquement apposée sur vos devis générés et les documents envoyés à vos clients.",
              style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF64748B),
                  height: 1.5),
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text("Dessinez votre signature",
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F2648))),
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
                      style: BorderStyle.none),
                  boxShadow: [
                    BoxShadow(
                        color: Theme.of(context).colorScheme.onSurface.withAlpha((0.02 * 255).round()),
                        blurRadius: 10,
                        offset: const Offset(0, 4)),
                  ]),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: CustomPaint(
                        painter: DashedRectPainter(
                            color: const Color(0xFFCBD5E1),
                            strokeWidth: 2,
                            gap: 5),
                      ),
                    ),
                    if (_existingSignatureUrl != null && _points.isEmpty)
                      Center(
                        child: Image.network(
                          _existingSignatureUrl!,
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Text("Erreur de chargement", style: TextStyle()),
                        ),
                      )
                    else if (_points.isEmpty)
                      const Center(
                          child: Text("Zone de signature tactile",
                              style: TextStyle(
                                  color: Color(0xFFCBD5E1),
                                  fontSize: 14))),
                    GestureDetector(
                      onPanUpdate: (details) {
                        setState(() {
                          // Clear existing image if they start drawing
                          if (_existingSignatureUrl != null) {
                            _existingSignatureUrl = null;
                          }
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
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _saveSignature,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F2648),
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
                      _isSaving ? "Enregistrement..." : "Sauvegarder",
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
}
