import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:koji/core/responsive_helper.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';

class PhotoPreviewScreen extends ConsumerStatefulWidget {
  final String? imagePath;

  const PhotoPreviewScreen({super.key, this.imagePath});

  @override
  ConsumerState<PhotoPreviewScreen> createState() => _PhotoPreviewScreenState();
}

class _PhotoPreviewScreenState extends ConsumerState<PhotoPreviewScreen> {
  final ImagePicker _picker = ImagePicker();
  final List<String> _images = [];
  late PageController _pageController;
  int _currentIndex = 0;
  final Map<String, int> _rotations = {};

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    if (widget.imagePath != null) {
      _images.add(widget.imagePath!);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? image = await _picker.pickImage(source: source);
      if (image != null) {
        setState(() {
          _images.add(image.path);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_pageController.hasClients) {
              _pageController.animateToPage(
                _images.length - 1,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            }
          });
        });
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  Future<void> _cropImage() async {
    if (_images.isEmpty) return;
    String currentPath = _images[_currentIndex];

    try {
      final croppedFile = await ImageCropper().cropImage(
        sourcePath: currentPath,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Recadrer',
            toolbarColor: AppTheme.darkNavy,
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.original,
            lockAspectRatio: false,
          ),
          IOSUiSettings(
            title: 'Recadrer',
          ),
        ],
      );

      if (croppedFile != null) {
        setState(() {
          _images[_currentIndex] = croppedFile.path;
          _rotations.remove(currentPath);
        });
      }
    } catch (e) {
      debugPrint('Error cropping image: $e');
    }
  }

  void _rotateImage() {
    if (_images.isEmpty) return;
    setState(() {
      String path = _images[_currentIndex];
      _rotations[path] = (_rotations[path] ?? 0) + 1;
    });
  }

  void _deleteImage() {
    if (_images.isEmpty) return;

    setState(() {
      _images.removeAt(_currentIndex);
      _rotations
          .remove(_images.length > _currentIndex ? _images[_currentIndex] : "");

      if (_images.isEmpty) {
      } else if (_currentIndex >= _images.length) {
        _currentIndex = _images.length - 1;
      }
    });
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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 24),
            Padding(
              padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
              child: Text(
                'Aperçue de la photo',
                style: AppTheme.headingStyle(context).copyWith(fontSize: 24),
                textAlign: TextAlign.center,
              ),
            ),
            if (_images.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8.0),
                child: Text(
                  '${_currentIndex + 1}/${_images.length}',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.textLight,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            Padding(
              padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
              child: TextButton(
                onPressed: () {
                  ref
                      .read(quoteCreationProvider.notifier)
                      .setVisualEvidence(_images);
                  context.push('/quote/visual-evidence-grid', extra: _images);
                },
                child: Text(
                  'Passer',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.darkNavy,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: _images.isEmpty
                  ? Center(
                      child: Text("Aucune image",
                          style: TextStyle( color: AppTheme.textLight)))
                  : PageView.builder(
                      controller: _pageController,
                      itemCount: _images.length,
                      onPageChanged: (index) {
                        setState(() {
                          _currentIndex = index;
                        });
                      },
                      itemBuilder: (context, index) {
                        final path = _images[index];
                        return Padding(
                          padding: responsive.paddingSymmetric(
                              horizontalPercent: 6.4),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: RotatedBox(
                              quarterTurns: _rotations[path] ?? 0,
                              child: Image.file(
                                File(path),
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 32),
            Padding(
              padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildActionButton(
                    icon: Icons.add,
                    onPressed: () => _pickImage(ImageSource.camera),
                  ),
                  _buildActionButton(
                    icon: Icons.rotate_right,
                    onPressed: _rotateImage,
                  ),
                  _buildActionButton(
                    icon: Icons.crop,
                    onPressed: _cropImage,
                  ),
                  _buildActionButton(
                    icon: Icons.delete_outline,
                    onPressed: _deleteImage,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Padding(
              padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
              child: ElevatedButton(
                onPressed: () {
                  ref
                      .read(quoteCreationProvider.notifier)
                      .setVisualEvidence(_images);
                  context.push('/quote/visual-evidence-grid', extra: _images);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE5E7EB),
                  foregroundColor: AppTheme.darkNavy,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Suivant',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward, size: 20),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (_images.isNotEmpty)
              Center(
                child: TextButton.icon(
                  onPressed: () async {
                    final XFile? image =
                        await _picker.pickImage(source: ImageSource.camera);
                    if (image != null) {
                      setState(() {
                        _images[_currentIndex] = image.path;
                        _rotations.remove(image.path);
                      });
                    }
                  },
                  icon: const Icon(Icons.camera_alt_outlined,
                      size: 18, color: AppTheme.textLight),
                  label: Text(
                    'Reprendre la photo',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.textLight,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton(
      {required IconData icon, required VoidCallback onPressed}) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, color: AppTheme.darkNavy),
        onPressed: onPressed,
      ),
    );
  }
}
