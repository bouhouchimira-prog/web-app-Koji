import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/features/quote/providers/document_provider.dart';
import 'package:url_launcher/url_launcher.dart';

class ChantierDocumentsScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const ChantierDocumentsScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierDocumentsScreen> createState() =>
      _ChantierDocumentsScreenState();
}

class _ChantierDocumentsScreenState extends ConsumerState<ChantierDocumentsScreen> {
  static const _kDark = Color(0xFF0F172A);
  static const _kBg = Color(0xFFF5F0EB);

  bool _isUploading = false;
  
  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 16),
              child: GestureDetector(
                onTap: _showAddOptions,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  decoration: BoxDecoration(
                    color: _kDark,
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: _kDark.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Ajouter un document',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.surface,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: _buildBody(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: _kBg,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  context.pop();
                } else {
                  context.go('/home');
                }
              },
              child: const Icon(Icons.chevron_left_rounded,
                  color: _kDark, size: 30),
            ),
          ),
          const Text(
            'Ajouter Documents',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 38),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Center(
          child: Text(
            'Aucune Document',
            style: TextStyle(
              fontSize: 15,
              color: Color(0xFF94A3B8),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) return const Center(child: Text("Erreur: Aucun ID de chantier disponible."));

    final docsAsync = ref.watch(chantierDocumentsProvider(chantierId));

    return Stack(
      children: [
        docsAsync.when(
          data: (docs) {
            if (docs.isEmpty) return _buildEmpty();
            return _buildList(docs);
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(child: Text("Erreur: $err")),
        ),
        if (_isUploading)
          Container(
            color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
            child: const Center(
              child: CircularProgressIndicator(color: _kDark),
            ),
          )
      ],
    );
  }

  Widget _buildList(List<Map<String, dynamic>> docs) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
      itemCount: docs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _buildDocTile(docs[i], i),
    );
  }

  Widget _buildDocTile(Map<String, dynamic> doc, int index) {
    final String name = doc['name'] as String? ?? 'Document';
    
    // Format timestamp
    String date = '—';
    if (doc['created_at'] != null) {
      final dt = DateTime.parse(doc['created_at']);
      date = '${dt.day}/${dt.month}/${dt.year}';
    }
    
    final int sizeBytes = doc['file_size'] as int? ?? 0;
    final String size = sizeBytes > 0 ? '${(sizeBytes / (1024 * 1024)).toStringAsFixed(1)} MB' : '—';
    
    final String type = doc['file_type'] as String? ?? '';
    final bool isImage = type.startsWith('image');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // File type icon
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              isImage
                  ? Icons.image_outlined
                  : Icons.description_outlined,
              color: _kDark,
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          // Name + meta
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _kDark,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$date  $size',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          // Three-dot menu
          GestureDetector(
            onTap: () => _showDocMenu(context, doc),
            child: const Padding(
              padding: EdgeInsets.all(4),
              child: Icon(Icons.more_vert_rounded,
                  color: Color(0xFF64748B), size: 22),
            ),
          ),
        ],
      ),
    );
  }

  void _showDocMenu(BuildContext context, Map<String, dynamic> doc) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            const SizedBox(height: 20),
            _menuOption(
              icon: Icons.open_in_new_rounded,
              label: 'Ouvrir',
              onTap: () async {
                Navigator.pop(context);
                final url = doc['file_url'] as String?;
                if (url == null || url.isEmpty) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Fichier introuvable')),
                    );
                  }
                  return;
                }
                final uri = Uri.tryParse(url);
                if (uri == null ||
                    !await launchUrl(uri,
                        mode: LaunchMode.externalApplication)) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("Impossible d'ouvrir le fichier"),
                      ),
                    );
                  }
                }
              },
            ),
            const SizedBox(height: 12),
            _menuOption(
              icon: Icons.download_outlined,
              label: 'Télécharger',
              onTap: () => Navigator.pop(context),
            ),
            const SizedBox(height: 12),
            _menuOption(
              icon: Icons.share_outlined,
              label: 'Partager',
              onTap: () => Navigator.pop(context),
            ),
            const SizedBox(height: 12),
            _menuOption(
              icon: Icons.delete_outline_rounded,
              label: 'Supprimer',
              color: const Color(0xFFEF4444),
              onTap: () async {
                Navigator.pop(context);
                try {
                  final repo = ref.read(documentRepositoryProvider);
                  await repo.deleteDocument(doc['id'], doc['file_url']);
                } catch (e) {
                  debugPrint('Failed to delete document: $e');
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erreur suppression: $e'))
                    );
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuOption({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color color = const Color(0xFF0F172A),
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        decoration: BoxDecoration(
          color: const Color(0xFFF8F9FB),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 14),
            Text(
              label,
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  final ImagePicker _picker = ImagePicker();

  void _showAddOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 30),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            const SizedBox(height: 20),
            _menuOption(
              icon: Icons.camera_alt_outlined,
              label: 'Prendre une photo',
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            const SizedBox(height: 12),
            _menuOption(
              icon: Icons.photo_library_outlined,
              label: 'Ajouter une image',
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
            const SizedBox(height: 12),
            _menuOption(
              icon: Icons.description_outlined,
              label: 'Ajouter un fichier',
              onTap: () {
                Navigator.pop(context);
                _pickDocument();
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Erreur: Aucun ID de chantier disponible.')));
      }
      return;
    }

    try {
      final XFile? image = await _picker.pickImage(source: source);
      if (image != null && mounted) {
        setState(() => _isUploading = true);
        
        final length = await image.length();
        final file = File(image.path);
        
        final String name = image.name.isNotEmpty
            ? image.name
            : 'Photo_${DateTime.now().millisecondsSinceEpoch}.jpg';
            
        // Basic type inference
        final String type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        
        final repo = ref.read(documentRepositoryProvider);
        await repo.uploadDocument(chantierId, file, name, type, length);
      }
    } catch (e) {
      debugPrint('Error picking/uploading image: $e');
       if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Erreur: $e')));
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _pickDocument() async {
    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur: Aucun ID de chantier disponible.')),
        );
      }
      return;
    }

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'],
      );

      if (result != null && result.files.single.path != null && mounted) {
        setState(() => _isUploading = true);

        final pickedFile = result.files.single;
        final file = File(pickedFile.path!);
        final name = pickedFile.name;
        final size = pickedFile.size;

        // Infer MIME type from extension
        String type = 'application/octet-stream';
        final ext = name.split('.').last.toLowerCase();
        if (ext == 'pdf') type = 'application/pdf';
        else if (ext == 'doc' || ext == 'docx') type = 'application/msword';
        else if (ext == 'xls' || ext == 'xlsx') type = 'application/vnd.ms-excel';
        else if (ext == 'txt') type = 'text/plain';
        else if (ext == 'csv') type = 'text/csv';

        final repo = ref.read(documentRepositoryProvider);
        await repo.uploadDocument(chantierId, file, name, type, size);
      }
    } catch (e) {
      debugPrint('Error picking/uploading document: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }
}
