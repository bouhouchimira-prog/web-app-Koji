import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:logger/logger.dart';

class DocumentRepository {
  final SupabaseClient _client = Supabase.instance.client;
  final Logger _logger = Logger();

  /// Uploads a document to Supabase Storage and creates a record in `chantier_documents` table
  Future<void> uploadDocument(
    String chantierId,
    File file,
    String name,
    String type,
    int sizeBytes,
  ) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    try {
      final fileName = '${DateTime.now().millisecondsSinceEpoch}_${name.replaceAll(' ', '_')}';
      final storagePath = '$chantierId/$fileName';

      _logger.i('Uploading document $fileName to $storagePath');

      // 1. Upload to storage
      await _client.storage.from('chantier_documents').upload(storagePath, file);

      // 2. Get public URL
      final fileUrl =
          _client.storage.from('chantier_documents').getPublicUrl(storagePath);

      // 3. Insert record in database
      await _client.from('chantier_documents').insert({
        'user_id': userId,
        'chantier_id': chantierId,
        'name': name,
        'file_url': fileUrl,
        'file_type': type,
        'file_size': sizeBytes,
      });

      _logger.i('Successfully uploaded and logged document: $fileName');
    } catch (e) {
      _logger.e('Failed to upload document', error: e);
      rethrow;
    }
  }

  /// Real-time stream of documents for a specific chantier
  Stream<List<Map<String, dynamic>>> streamChantierDocuments(String chantierId) {
    return _client
        .from('chantier_documents')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  /// Deletes a document from both database and storage
  Future<void> deleteDocument(String documentId, String fileUrl) async {
    try {
      // 1. Delete from DB
      await _client.from('chantier_documents').delete().eq('id', documentId);

      // 2. Parse URL and delete from Storage
      final uri = Uri.parse(fileUrl);
      final segments = uri.pathSegments;
      final bucketIndex = segments.indexOf('chantier_documents');

      if (bucketIndex != -1 && bucketIndex < segments.length - 1) {
        final pathSegments = segments.sublist(bucketIndex + 1);
        final storagePath = pathSegments.join('/');
        await _client.storage.from('chantier_documents').remove([storagePath]);
        _logger.i('Successfully deleted document from storage: $storagePath');
      }
    } catch (e) {
      _logger.e('Failed to delete document', error: e);
      rethrow;
    }
  }
}
