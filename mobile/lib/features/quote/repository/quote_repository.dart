import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final quoteRepositoryProvider = Provider<QuoteRepository>((ref) {
  return QuoteRepository(SupabaseConfig.client);
});

class QuoteRepository {
  final SupabaseClient _supabase;
  final Logger _logger = Logger();

  QuoteRepository(this._supabase);

  /// True when a devis line is a commentaire/note or a standalone fourniture
  /// rather than an executable ouvrage. Such lines exist for pricing/PDF only
  /// and must NOT be turned into project_tasks (otherwise a note shows up "as a
  /// task" in the devis/chantier). [rawId] is the line's task id (map key,
  /// `taskId` or `id`); [data] is the line map, which may carry explicit flags.
  bool _isNonTaskLine(dynamic rawId, Map data) {
    final id =
        (rawId ?? data['taskId'] ?? data['id'] ?? '').toString().toLowerCase();
    if (id.startsWith('comment_') || id.startsWith('fourniture_')) return true;
    if (data['isComment'] == true || data['isFourniture'] == true) return true;
    final inputs = data['inputs'];
    if (inputs is Map &&
        (inputs['isComment'] == true || inputs['isFourniture'] == true)) {
      return true;
    }
    return false;
  }

  // Characters used for the per-chantier access code / password. We exclude
  // visually ambiguous glyphs (0/O, 1/I/L) so a client reading them off an SMS
  // can type them without confusion.
  static const _codeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  String _randomToken(int length) {
    final rng = Random.secure();
    return List.generate(
        length, (_) => _codeAlphabet[rng.nextInt(_codeAlphabet.length)]).join();
  }

  /// Per-chantier login identifier, e.g. "KOJI-7F3A2B".
  String _generateAccessCode() => 'KOJI-${_randomToken(6)}';

  /// Per-chantier password, e.g. "K7M2P9Q4" (8 chars).
  String _generateAccessPassword() => _randomToken(8);

  /// Generate the next sequential devis number for a company, scoped per year.
  /// Format: DEVIS-YYYY-NNNN (e.g. DEVIS-2026-0001).
  ///
  /// Derives the sequence by counting the user's existing quotes whose
  /// reference matches the current year's prefix, then takes the highest
  /// trailing number + 1. This avoids needing a separate counter table while
  /// still guaranteeing no in-year duplicates per user.
  Future<String> generateNextQuoteNumber(String userId) async {
    // Format: "YYYY-NNNN" (e.g. 2026-0001). Per-year sequential, padded to 4.
    final year = DateTime.now().year;
    final prefix = '$year-';
    try {
      final rows = await _supabase
          .from('quotes')
          .select('reference')
          .eq('user_id', userId)
          .like('reference', '$prefix%');

      int maxSeq = 0;
      for (final r in rows) {
        final ref = (r['reference'] as String?) ?? '';
        final tail = ref.substring(ref.lastIndexOf('-') + 1);
        final n = int.tryParse(tail) ?? 0;
        if (n > maxSeq) maxSeq = n;
      }
      final next = (maxSeq + 1).toString().padLeft(4, '0');
      return '$prefix$next';
    } catch (e) {
      _logger.e('Failed to generate quote number, falling back', error: e);
      return '${prefix}0001';
    }
  }

  Future<String> saveQuote(String userId, Map<String, dynamic> quoteData,
      {String? quoteId}) async {
    _logger.i(
        '💾 [QuoteRepository] Saving quote for user: $userId (Update: ${quoteId != null})');
    try {
      final client = quoteData['client'] as Map<String, dynamic>?;
      final company = quoteData['company'] as Map<String, dynamic>?;
      final totals = quoteData['totals'] as Map<String, dynamic>?;
      
      // Build metadata to persist Snapshot of Client/Company at time of quoting
      final metadata = {
        'quoteNumber': quoteData['quoteNumber'],
        'date': quoteData['date'],
        'validity': quoteData['validity'],
        'siteAddress': quoteData['siteAddress'],
        'travauxStart': quoteData['travauxStart'],
        'travauxDuration': quoteData['travauxDuration'],
        'mentions': quoteData['mentions'],
        'company': company,
        'client': client, // We store the whole client snapshot too just in case
        // Professional "LOT" devis: global provisions + TVA rate + per-lot labels.
        'recap': quoteData['recap'],
        'lots': quoteData['lots'],
      };

      // Explicit TVA rate chosen on the devis (10 % rénovation or 20 %).
      final int tvaRate = (totals?['tvaRate'] as num?)?.toInt() ?? 20;

      // 1. Insert or Update QUOTE
      final quoteDbData = {
        'user_id': userId,
        'chantier_id': quoteData['chantier_id'], // Requires passing chantier_id in quoteData
        'status': quoteData['status'] ?? 'Draft',
        'reference': quoteData['quoteNumber'] ?? 'REF-${DateTime.now().millisecondsSinceEpoch}',
        // total_ht is the TOTAL GÉNÉRAL HT (lots + provisions), so dashboards
        // and the devis show the same figure.
        'total_ht': totals?['ht'] ?? 0,
        'total_ttc': totals?['ttc'] ?? 0,
        'tva_rate': tvaRate,
        'metadata': metadata,
        'updated_at': DateTime.now().toIso8601String(),
      };

      String finalQuoteId = quoteId ?? '';

      if (quoteId != null && quoteId.isNotEmpty) {
        quoteDbData['id'] = quoteId;
        await _supabase.from('quotes').upsert(quoteDbData);
        finalQuoteId = quoteId;
      } else {
        // If chantier_id is not provided but we need it for Foreign Key, we must create a Chantier first or use a dummy
        if (quoteDbData['chantier_id'] == null) {
          final chantierData = {
            'user_id': userId,
            'reference': quoteDbData['reference'] ?? 'CH-${DateTime.now().millisecondsSinceEpoch}',
            'status': 'En Cours',
          };
          try {
            _logger.i('=> Inserting chantier data: $chantierData');
            final chantierRes = await _supabase.from('chantiers').insert(chantierData).select().single();
            quoteDbData['chantier_id'] = chantierRes['id'];
          } catch(e) {
            _logger.e('Failed on chantiers insert: $e');
            rethrow;
          }
        }

        try {
           final response = await _supabase.from('quotes').insert(quoteDbData).select().single();
           finalQuoteId = response['id'] as String;
        } catch(e) {
           _logger.e('Failed on quotes insert: $e');
           rethrow;
        }
      }

      // Signature link points to the login page: the client opens the devis by
      // entering the per-chantier Identifiant + Mot de passe (sent alongside).
      // The bare link alone grants no access.
      const signatureUrl = 'https://koji-signature.vercel.app/auth/login';

      // Per-chantier access credentials (Identifiant + Mot de passe) the client
      // uses to log in and sign. Generated ONCE per quote: if this quote was
      // already saved with credentials, reuse them so the client's login keeps
      // working across edits/re-saves.
      String accessCode = (quoteData['accessCode'] as String?)?.trim() ?? '';
      String accessPassword =
          (quoteData['accessPassword'] as String?)?.trim() ?? '';
      if (accessCode.isEmpty || accessPassword.isEmpty) {
        try {
          final existing = await _supabase
              .from('quotes')
              .select('access_code, access_password')
              .eq('id', finalQuoteId)
              .maybeSingle();
          accessCode = (existing?['access_code'] as String?)?.trim() ?? '';
          accessPassword =
              (existing?['access_password'] as String?)?.trim() ?? '';
        } catch (e) {
          _logger.w('Could not read existing access credentials: $e');
        }
      }
      if (accessCode.isEmpty) accessCode = _generateAccessCode();
      if (accessPassword.isEmpty) accessPassword = _generateAccessPassword();

      // Surface the credentials back to the caller (the success screen reads
      // these to build the "Envoyer le Lien" message).
      quoteData['accessCode'] = accessCode;
      quoteData['accessPassword'] = accessPassword;
      metadata['accessCode'] = accessCode;

      // We'll trigger an update for the metadata's signature link + credentials.
      metadata['signature_url'] = signatureUrl;
      await _supabase.from('quotes').update({
        'metadata': metadata,
        'access_code': accessCode,
        'access_password': accessPassword,
      }).eq('id', finalQuoteId);

      // 2. Insert QUOTE ROOMS & Tasks
      // First, delete old rooms/tasks if updating
      if (quoteId != null) {
         await _supabase.from('quote_rooms').delete().eq('quote_id', finalQuoteId);
      }

      final expensesMap = quoteData['expenses'] as Map<String, dynamic>? ?? {};
      final tasksMap = quoteData['tasks'] as Map<String, dynamic>? ?? {};

      int roomOrder = 0;
      for (var entry in expensesMap.entries) {
        final roomId = entry.key;
        final roomItems = entry.value as List<dynamic>;

        // Insert Room
        final roomDbData = {
          'quote_id': finalQuoteId,
          'name': roomId,
          'room_order': roomOrder++,
        };
        final roomRes = await _supabase.from('quote_rooms').insert(roomDbData).select().single();
        final insertedRoomId = roomRes['id'] as String;

        // Insert Tasks for this Room
        // We will combine data from expenses array and tasksMap
        final roomTaskDetailsMap = (tasksMap[roomId] as Map<String, dynamic>?) ?? {};

        for (var item in roomItems) {
           final expenseItem = item as Map<String, dynamic>;
           final taskId = expenseItem['id'];
           final detail = roomTaskDetailsMap[taskId] as Map<String, dynamic>? ?? {};

           // The quote_tasks schema has no dedicated column for fournitures,
           // hours, or recap fields (code/famille/unite). Embedding them in
           // inputs lets the edit-flow rehydrate the full task on reopen
           // without a schema migration.
           final mergedInputs = <String, dynamic>{
             ...((detail['inputs'] as Map?)?.cast<String, dynamic>() ?? const {}),
             if (detail['selectedFournitures'] != null)
               'selectedFournitures': detail['selectedFournitures'],
             if (detail['hours'] != null) 'hours': detail['hours'],
             if (detail['quantity'] != null) 'quantity': detail['quantity'],
             if (detail['tauxHoraire'] != null) 'tauxHoraire': detail['tauxHoraire'],
             if (detail['conditionCoeff'] != null) 'conditionCoeff': detail['conditionCoeff'],
             if (detail['unite'] != null) 'unite': detail['unite'],
             if (detail['code'] != null) 'code': detail['code'],
             if (detail['famille'] != null) 'famille': detail['famille'],
             if (detail['hideFournitures'] != null)
               'hideFournitures': detail['hideFournitures'],
           };

           final taskDbData = {
             'room_id': insertedRoomId,
             'task_id': taskId,
             'label': expenseItem['title'],
             'inputs': mergedInputs,
             'selected_products': detail['selectedProducts'] ?? {},
             'note': detail['note'] ?? expenseItem['subtitle'] ?? '',
             'photo_paths': detail['photoPaths'] ?? [],
             'unit_price_ht': expenseItem['laborCost'],
             'total_price_ht': expenseItem['materialCost'], // We'll store both in the record
             'is_custom': false,
           };
           await _supabase.from('quote_tasks').insert(taskDbData);
        }
      }

      // ---------------------------------------------------------
      // AUTO-CREATE PROJECT & TASKS from Quote
      // ---------------------------------------------------------
      try {
        _logger.i(
            '🏗️ [QuoteRepository] Starting auto-creation of project & tasks...');

        // 1. Create/Update Project
        // `projects.title` is NOT NULL — without it the insert failed with
        // 23502 and the whole auto-creation was silently skipped. Build a
        // sensible title from the client name (falling back to the reference).
        final clientName = (client?['name'] as String?)?.trim();
        final projectTitle = (clientName != null && clientName.isNotEmpty)
            ? 'Chantier $clientName'
            : (quoteData['reference']?.toString().trim().isNotEmpty == true
                ? 'Chantier ${quoteData['reference']}'
                : 'Chantier');
        final projectData = {
          'user_id': userId, // Explicitly set owner
          'title': projectTitle,
          'client_name': client?['name'] ?? 'Client Inconnu',
          'address': quoteData['siteAddress'] ?? client?['address'],
          'status': 'En Cours',
        };

        _logger.i(
            '📋 [QuoteRepository] Creating project: ${projectData['client_name']}');
        final projectRes = await _supabase
            .from('projects')
            .insert(projectData)
            .select()
            .single();
        final projectId = projectRes['id'] as String;
        _logger.i('✅ [QuoteRepository] Project created with ID: $projectId');

        // 2. Insert Tasks (Project Tasks)
        // Parse the expenses structure to extract tasks
        final expensesMap =
            quoteData['expenses'] as Map<String, dynamic>? ?? {};
        final tasksMap = quoteData['tasks'] as Map<String, dynamic>? ?? {};

        _logger.i('📊 [QuoteRepository] Data structure analysis:');
        _logger.i('   - Expenses rooms: ${expensesMap.keys.length}');
        _logger.i('   - Tasks map keys: ${tasksMap.keys.length}');

        List<Map<String, dynamic>> projectTasksToInsert = [];

        // Strategy 1: Try to parse from 'tasks' map (rich task data with products)
        if (tasksMap.isNotEmpty) {
          _logger.i('🔍 [QuoteRepository] Parsing tasks from tasksMap...');
          tasksMap.forEach((roomId, roomTasksData) {
            if (roomTasksData is! Map) {
              _logger.w(
                  '   ⚠️ Room $roomId has invalid task data type: ${roomTasksData.runtimeType}');
              return;
            }

            final roomTasks = roomTasksData as Map<String, dynamic>;
            final roomName =
                roomId; // expensesMap entries are Lists, so we can't look up 'name' inside them. Use Key.

            _logger.i('   📁 Room: $roomName (${roomTasks.length} tasks)');

            roomTasks.forEach((taskId, taskData) {
              if (taskData is! Map) {
                _logger.w('      ⚠️ Task $taskId has invalid data type');
                return;
              }

              final tData = taskData as Map<String, dynamic>;
              // Skip commentaire / standalone fourniture lines: they are devis
              // billing/PDF lines, not executable work, and must NOT become
              // project tasks (otherwise notes show up "as tasks").
              if (_isNonTaskLine(taskId, tData)) {
                _logger.i('      ⤷ Skipped non-task line: $taskId');
                return;
              }

              final taskName = tData['label'] ?? tData['taskId'] ?? 'Tâche';

              projectTasksToInsert.add({
                'user_id': userId,
                'project_id': projectId,
                'task_name': taskName,
                'room_name': roomName,
                'status': 'À Faire',
                'details': tData,
              });

              _logger.i('      ✓ Added task: $taskName');
            });
          });
        }

        // Strategy 2: Fallback to parsing from 'expenses' if no tasks found
        if (projectTasksToInsert.isEmpty && expensesMap.isNotEmpty) {
          _logger.i(
              '🔍 [QuoteRepository] No tasks in tasksMap, parsing from expenses...');
          expensesMap.forEach((roomId, roomData) {
            if (roomData is! Map) {
              _logger.w('   ⚠️ Room $roomId has invalid data type');
              return;
            }

            final rData = roomData as Map<String, dynamic>;
            final roomName = rData['name'] ?? roomId;

            // Check if room has tasks or items
            final items = rData['tasks'] ?? rData['items'] ?? [];

            if (items is List && items.isNotEmpty) {
              _logger.i('   📁 Room: $roomName (${items.length} items)');

              for (var item in items) {
                if (item is! Map) continue;
                final itemData = item as Map<String, dynamic>;
                if (_isNonTaskLine(itemData['id'], itemData)) continue;
                final taskName =
                    itemData['title'] ?? itemData['label'] ?? 'Tâche';

                projectTasksToInsert.add({
                  'user_id': userId,
                  'project_id': projectId,
                  'task_name': taskName,
                  'room_name': roomName,
                  'status': 'À Faire',
                  'details': itemData,
                });

                _logger.i('      ✓ Added task: $taskName');
              }
            } else if (items is Map) {
              _logger.i('   📁 Room: $roomName (${items.length} tasks)');

              items.forEach((taskId, taskData) {
                if (taskData is! Map) return;
                final tData = taskData as Map<String, dynamic>;
                if (_isNonTaskLine(taskId, tData)) return;
                final taskName = tData['label'] ?? tData['title'] ?? 'Tâche';

                projectTasksToInsert.add({
                  'user_id': userId,
                  'project_id': projectId,
                  'task_name': taskName,
                  'room_name': roomName,
                  'status': 'À Faire',
                  'details': tData,
                });

                _logger.i('      ✓ Added task: $taskName');
              });
            }
          });
        }

        if (projectTasksToInsert.isNotEmpty) {
          _logger.i(
              '📝 [QuoteRepository] Inserting ${projectTasksToInsert.length} tasks into project_tasks...');
          await _supabase.from('project_tasks').insert(projectTasksToInsert);
          _logger.i(
              '✅ [QuoteRepository] Successfully inserted ${projectTasksToInsert.length} tasks');
        } else {
          _logger.w(
              '⚠️ [QuoteRepository] No tasks found to insert for project $projectId');
          _logger.w(
              '   Debug info - expensesMap structure: ${expensesMap.toString().substring(0, 200)}...');
          _logger.w(
              '   Debug info - tasksMap structure: ${tasksMap.toString().substring(0, 200)}...');
        }

        _logger.i(
            '✅ [QuoteRepository] Project & Tasks creation completed for Quote: $finalQuoteId');
      } catch (projError, stackTrace) {
        _logger.e(
            '❌ [QuoteRepository] Failed to auto-create project/tasks: $projError');
        _logger.e('Stack trace: $stackTrace');
        // Don't fail the quote save just because project auto-creation failed, but log it.
      }

      return finalQuoteId;
    } catch (e) {
      _logger.e('❌ [QuoteRepository] Failed to save quote', error: e);
      rethrow;
    }
  }

  // Transform a flat `quotes` row back to the UI expected format. Shared by
  // the realtime stream and the one-shot REST fallback so both emit the same
  // shape.
  Map<String, dynamic> _mapQuoteListRow(Map<String, dynamic> quote) {
    // Helper function to safely convert JSONB fields
    Map<String, dynamic> safeMapConvert(dynamic field) {
      if (field == null) return {};
      if (field is Map<String, dynamic>) return field;
      if (field is Map) return Map<String, dynamic>.from(field);
      return {};
    }

    final metadata = safeMapConvert(quote['metadata']);
    final client = safeMapConvert(metadata['client']);

    return {
      'id': quote['id'],
      'status': quote['status'] ?? 'Draft',
      // Signature fields written by the client signature web app.
      // Exposing them here lets the UI show signed quotes and lets the
      // home screen detect a newly-signed devis to raise a notification.
      'signed_at': quote['signed_at'],
      'signature_data': quote['signature_data'],
      'client': client,
      'quoteNumber': metadata['quoteNumber'] ?? quote['reference'] ?? 'N/A',
      'date': metadata['date'] ?? '',
      'validity': metadata['validity'] ?? '',
      'siteAddress': metadata['siteAddress'] ?? '',
      'travauxStart': metadata['travauxStart'] ?? '',
      'travauxDuration': metadata['travauxDuration'] ?? '',
      // Place/date captured at signing → rendered on the signed devis PDF.
      'signatureLieu': metadata['signatureLieu'] ?? '',
      'signatureDate': metadata['signatureDate'] ?? '',
      // Editable custom notes/mentions (conditions, délais, réserves…).
      'mentions': metadata['mentions'] ?? '',
      'company': metadata['company'] ?? {},
      // Professional "LOT" devis config so the recap reopens identically
      // and the client signature PDF can rebuild the same layout.
      'recap': metadata['recap'] ?? {},
      'lots': metadata['lots'] ?? {},
      'totals': {
        'ht': quote['total_ht'] ?? 0,
        'tvaRate': quote['tva_rate'] ?? 20,
        'tva': ((quote['total_ht'] ?? 0) * (quote['tva_rate'] ?? 20) / 100),
        'ttc': quote['total_ttc'] ?? 0
      },
      // Since rooms/tasks are fetched later, keep them empty here for the list view
      'expenses': {},
      'tasks': {},
    };
  }

  Stream<List<Map<String, dynamic>>> getUserQuotes(String userId) {
    return _supabase
        .from('quotes')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .map((data) => data.map(_mapQuoteListRow).toList());
  }

  /// One-shot REST fetch of the user's quotes — same shape as [getUserQuotes].
  /// Used as a fallback when the realtime channel fails to join (e.g.
  /// RealtimeSubscribeException timedOut on flaky networks).
  Future<List<Map<String, dynamic>>> getUserQuotesOnce(String userId) async {
    final data = await _supabase
        .from('quotes')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(data)
        .map(_mapQuoteListRow)
        .toList();
  }

  /// Update Quote Status
  Future<void> updateQuoteStatus(String quoteId, String status) async {
    await _supabase.from('quotes').update({'status': status}).eq('id', quoteId);
  }

  /// Permanently delete a quote and its child rows.
  ///
  /// Deletes `quote_rooms` first (which cascades to `quote_tasks`, same as the
  /// update flow above) so the final `quotes` delete doesn't hit a foreign-key
  /// violation if the DB lacks ON DELETE CASCADE on those tables.
  Future<void> deleteQuote(String quoteId) async {
    await _supabase.from('quote_rooms').delete().eq('quote_id', quoteId);
    await _supabase.from('quotes').delete().eq('id', quoteId);
  }
}
