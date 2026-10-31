import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:logger/logger.dart';

class SignatureRepository {
  final SupabaseClient _client = Supabase.instance.client;
  final Logger _logger = Logger();

  Future<void> saveSignature(
    String quoteId,
    String clientName,
    Uint8List signatureBytes, {
    String? lieu,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    try {
      final fileName = '${quoteId}_signature_${DateTime.now().millisecondsSinceEpoch}.png';
      final storagePath = '$userId/$fileName';

      _logger.i('Uploading signature $fileName to signatures bucket');

      // 1. Upload PNG to storage
      await _client.storage.from('signatures').uploadBinary(
        storagePath,
        signatureBytes,
        fileOptions: const FileOptions(contentType: 'image/png'),
      );

      // 2. Get public URL
      final fileUrl = _client.storage.from('signatures').getPublicUrl(storagePath);

      // 3. Insert record into `signatures` table
      await _client.from('signatures').insert({
        'user_id': userId,
        'quote_id': quoteId,
        'client_name': clientName,
        'signature_url': fileUrl,
        if (lieu != null && lieu.isNotEmpty) 'lieu': lieu,
      });

      // 4. Update the quote status to 'signed'. Persist the lieu/date into the
      // quote metadata so the signed devis PDF can render "Fait à …, le …".
      final updates = <String, dynamic>{
        'status': 'signed',
        'updated_at': DateTime.now().toIso8601String(),
      };
      if (lieu != null && lieu.isNotEmpty) {
        final existing = await _client
            .from('quotes')
            .select('metadata')
            .eq('id', quoteId)
            .maybeSingle();
        final metadata = (existing?['metadata'] as Map?)?.cast<String, dynamic>() ??
            <String, dynamic>{};
        metadata['signatureLieu'] = lieu;
        metadata['signatureDate'] = DateTime.now().toIso8601String();
        updates['metadata'] = metadata;
      }
      await _client.from('quotes').update(updates).eq('id', quoteId);

      _logger.i('Successfully saved signature and updated quote $quoteId');
    } catch (e) {
      _logger.e('Failed to save signature', error: e);
      rethrow;
    }
  }
}
