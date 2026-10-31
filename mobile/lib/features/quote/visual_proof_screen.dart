import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/core/responsive_helper.dart';

class VisualProofScreen extends StatefulWidget {
  const VisualProofScreen({super.key});

  @override
  State<VisualProofScreen> createState() => _VisualProofScreenState();
}

class _VisualProofScreenState extends State<VisualProofScreen> {
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source);
      if (image != null && mounted) {
        // Navigate to preview screen allowing user to see the image
        // For now, we'll pass the path as a query parameter
        context.push(
            '/quote/photo-preview?imagePath=${Uri.encodeComponent(image.path)}');
      }
    } catch (e) {
      // Handle error
      debugPrint('Error picking image: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final responsive = context.responsive;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back,
                color: AppTheme.darkNavy, size: 20),
            onPressed: () => context.pop(),
          ),
        ),
        centerTitle: true,
        title: Column(
          children: [
            Text(
              'Créer votre chantier',
              style: AppTheme.headingStyle(context).copyWith(fontSize: 18),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(responsive.width(6.4)),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),

              // Icon Circle
              Center(
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: const BoxDecoration(
                    color: AppTheme.darkNavy,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.add_photo_alternate_outlined,
                    color: Theme.of(context).colorScheme.surface,
                    size: 56,
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Title
              Text(
                'Prise de Photo',
                style: AppTheme.headingStyle(context).copyWith(fontSize: 24),
                textAlign: TextAlign.center,
              ),

              const SizedBox(height: 16),

              // Description
              Text(
                'Ajoutez une nouvelle photo en utilisant votre appareil ou en sélectionnant une image existante dans votre galerie.',
                style: TextStyle(
                  fontSize: 16,
                  color: AppTheme.textLight,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),

              const Spacer(),

              // Camera Button
              ElevatedButton.icon(
                onPressed: () => _pickImage(ImageSource.camera),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.darkNavy,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: const Icon(Icons.camera_alt_outlined, size: 24),
                label: Text(
                  'Prendre une photo',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Gallery Button
              OutlinedButton.icon(
                onPressed: () => _pickImage(ImageSource.gallery),
                style: OutlinedButton.styleFrom(
                  backgroundColor:
                      const Color(0xFFE5E7EB).withValues(alpha: 0.5),
                  foregroundColor: AppTheme.darkNavy,
                  side: BorderSide.none,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: const BorderSide(
                        color: Colors
                            .transparent), // Removing border as per visual design suggestion of light grey button
                  ),
                ),
                icon: const Icon(Icons.add_photo_alternate_outlined, size: 24),
                label: Text(
                  'Choisir depuis la galerie',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Skip Button - Navigate to visual evidence grid without photos
              Center(
                child: TextButton(
                  onPressed: () {
                    context
                        .push('/quote/visual-evidence-grid', extra: <String>[]);
                  },
                  child: Text(
                    'Passer',
                    style: TextStyle(
                      fontSize: 16,
                      color: AppTheme.darkNavy,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
