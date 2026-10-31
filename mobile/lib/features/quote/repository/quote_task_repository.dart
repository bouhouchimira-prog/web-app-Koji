import 'package:supabase_flutter/supabase_flutter.dart';

class QuoteTaskRepository {
  final SupabaseClient _client = Supabase.instance.client;

  // ────────────────────────────────────────────────────────
  // 1. Quotes
  // ────────────────────────────────────────────────────────

  /// Fetch a complete quote by its chantier_id
  Future<Map<String, dynamic>?> getQuoteByChantierId(String chantierId) async {
    final response = await _client
        .from('quotes')
        .select()
        .eq('chantier_id', chantierId)
        .maybeSingle();
    return response;
  }

  /// Create or update a root quote
  Future<String> upsertQuote(Map<String, dynamic> data) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final payload = {
      'user_id': userId,
      'chantier_id': data['chantier_id'],
      'status': data['status'] ?? 'Draft',
      'total_ht': data['total_ht'] ?? 0,
      'total_ttc': data['total_ttc'] ?? 0,
      'tva_rate': data['tva_rate'] ?? 20.0,
      'updated_at': DateTime.now().toIso8601String(),
    };

    if (data['id'] != null) {
      // Update
      payload['id'] = data['id'];
      await _client.from('quotes').upsert(payload);
      return data['id'] as String;
    } else {
      // Insert
      final res = await _client.from('quotes').insert(payload).select('id').single();
      return res['id'] as String;
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. Quote Rooms
  // ────────────────────────────────────────────────────────

  /// Fetch rooms for a quote
  Future<List<Map<String, dynamic>>> getQuoteRooms(String quoteId) async {
    final response = await _client
        .from('quote_rooms')
        .select()
        .eq('quote_id', quoteId)
        .order('room_order', ascending: true);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Save or update a room context
  Future<String> upsertQuoteRoom(Map<String, dynamic> data) async {
    final payload = {
      'quote_id': data['quote_id'],
      'name': data['name'],
      'surface': data['surface'] ?? 0,
      'access_factor': data['access_factor'] ?? 1.0,
      'condition_factor': data['condition_factor'] ?? 1.0,
      'room_order': data['room_order'] ?? 0,
    };

    if (data['id'] != null) {
      payload['id'] = data['id'];
    }

    final res = await _client.from('quote_rooms').upsert(payload, onConflict: 'id').select('id').single();
    return res['id'] as String;
  }

  // ────────────────────────────────────────────────────────
  // 3. Quote Tasks
  // ────────────────────────────────────────────────────────

  /// Fetch tasks for a specific room
  Future<List<Map<String, dynamic>>> getQuoteTasks(String roomId) async {
    final response = await _client
        .from('quote_tasks')
        .select()
        .eq('room_id', roomId)
        .order('created_at', ascending: true);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Create or update a task selection within a room
  Future<String> upsertQuoteTask(Map<String, dynamic> data) async {
    final payload = {
      'room_id': data['room_id'],
      'task_id': data['task_id'],
      'label': data['label'],
      'inputs': data['inputs'] ?? {},
      'selected_products': data['selected_products'] ?? {},
      'note': data['note'] ?? '',
      'photo_paths': data['photo_paths'] ?? [],
      'unit_price_ht': data['unit_price_ht'] ?? 0,
      'total_price_ht': data['total_price_ht'] ?? 0,
      'is_custom': data['is_custom'] ?? false,
    };

    if (data['id'] != null) {
      payload['id'] = data['id'];
    }

    final res = await _client.from('quote_tasks').upsert(payload, onConflict: 'id').select('id').single();
    return res['id'] as String;
  }

  /// Delete a task from a room
  Future<void> deleteQuoteTask(String id) async {
    await _client.from('quote_tasks').delete().eq('id', id);
  }

  /// All devis tasks for a chantier, flattened across its quote's rooms, with
  /// the room name attached. Returns a list of maps:
  ///   { 'id', 'label', 'room_name' }
  /// Used by the planning screen so the user plans the SAME tasks that appear
  /// in the devis (quote → rooms → quote_tasks), not the separate
  /// chantier_tasks checklist.
  Future<List<Map<String, dynamic>>> getDevisTasksForChantier(
      String chantierId) async {
    // 1. Quotes directly linked by chantier_id (the normal case). A chantier
    //    can have several quote rows (each re-save inserts a new one), so we must
    //    NOT use .maybeSingle() — it errors on multiple rows.
    var quoteIds = await _quoteIdsForChantier(chantierId);

    // Read the chantier's reference + address once; used by the fallbacks below.
    // When a devis is created from a chantier (chantier_devis_screen._createDevis)
    // the chantier's `reference` is stored as the quote's client name, and the
    // chantier address as the quote's siteAddress. So an orphan devis can be
    // matched back to its chantier on EITHER of those, exactly.
    String chantierRef = '';
    String chantierAddr = '';
    {
      final chantier = await _client
          .from('chantiers')
          .select('reference, street, city')
          .eq('id', chantierId)
          .maybeSingle();
      chantierRef = (chantier?['reference'] as String? ?? '').trim();
      final street = (chantier?['street'] as String? ?? '').trim();
      final city = (chantier?['city'] as String? ?? '').trim();
      chantierAddr =
          [street, city].where((s) => s.isNotEmpty).join(', ').toLowerCase();
    }

    // 2. Fallback: match by reference (saveQuote auto-creates a chantier named
    //    after the devis reference when chantier_id is missing).
    if (quoteIds.isEmpty && chantierRef.isNotEmpty) {
      final byRef = await _client
          .from('quotes')
          .select('id, created_at')
          .eq('reference', chantierRef)
          .order('created_at', ascending: false);
      quoteIds = (byRef as List).map((q) => q['id'] as String).toList();
    }

    // 3. Fallback for legacy orphan devis: those quotes hang off an auto-created
    //    chantier whose id and reference both differ from the one picked here.
    //    Match ONLY on a hard signal — the chantier's reference equals the quote's
    //    stored client name, or the chantier address equals the quote siteAddress.
    //    NO blind "most recent" guess: without a signal we show nothing, so each
    //    chantier only ever displays ITS OWN devis (re-saving the devis from the
    //    chantier makes step 1 link it permanently).
    if (quoteIds.isEmpty) {
      final userId = _client.auth.currentUser?.id;
      final wantRef = chantierRef.toLowerCase();
      if (userId != null && (wantRef.isNotEmpty || chantierAddr.isNotEmpty)) {
        // NOTE: do NOT use .neq('chantier_id', chantierId) here — in Postgres
        // a NULL chantier_id is excluded by `neq`, and orphan devis are exactly
        // the ones with chantier_id = null. We fetch all the user's quotes and
        // match on the hard signals below instead.
        final orphanQuotes = await _client
            .from('quotes')
            .select('id, created_at, metadata, chantier_id')
            .eq('user_id', userId)
            .order('created_at', ascending: false);

        final matches = <String>[];
        for (final q in (orphanQuotes as List)) {
          // Only adopt true orphans (no chantier link). Never steal a devis
          // already tied to another real chantier.
          if (q['chantier_id'] != null) continue;
          final meta = (q['metadata'] as Map?)?.cast<String, dynamic>() ?? {};
          final client = (meta['client'] as Map?)?.cast<String, dynamic>() ?? {};
          final clientName =
              (client['name'] as String? ?? '').toLowerCase().trim();
          final siteAddr =
              (meta['siteAddress'] as String? ?? '').toLowerCase().trim();
          final refHit = wantRef.isNotEmpty && clientName == wantRef;
          final addrHit = chantierAddr.isNotEmpty && siteAddr == chantierAddr;
          if (refHit || addrHit) matches.add(q['id'] as String);
        }
        quoteIds = matches;

        // Permanent repair: stamp the chantier_id onto the matched orphan devis
        // so future loads hit step 1 directly and the diagnostic disappears.
        for (final id in matches) {
          try {
            await _client
                .from('quotes')
                .update({'chantier_id': chantierId}).eq('id', id);
          } catch (_) {/* best-effort; matching still works without it */}
        }
      }
    }

    // ignore: avoid_print
    print('[DEVIS] chantier=$chantierId candidate quotes=${quoteIds.length}');

    for (final quoteId in quoteIds) {
      final rooms = await _client
          .from('quote_rooms')
          .select('id, name, room_order')
          .eq('quote_id', quoteId)
          .order('room_order', ascending: true);
      // ignore: avoid_print
      print('[DEVIS]   quote=$quoteId rooms=${(rooms as List).length}');

      final result = <Map<String, dynamic>>[];
      for (final room in (rooms as List)) {
        final tasks = await _client
            .from('quote_tasks')
            .select('id, label, task_id, inputs')
            .eq('room_id', room['id'])
            .order('created_at', ascending: true);
        for (final t in (tasks as List)) {
          // Skip lines that are NOT actual work for the worker: commentaires /
          // notes (comment_…) and standalone fournitures (fourniture_…) added
          // from the devis recap. They live in quote_tasks for pricing/PDF but
          // are not tasks to execute, so they must not leak into the À faire /
          // worker task lists.
          if (_isNonTaskLine(t)) continue;
          result.add({
            'id': t['id'],
            'label': t['label'] ?? 'Tâche',
            'room_name': room['name'] ?? '',
          });
        }
      }
      // First quote (newest) that actually has tasks wins.
      if (result.isNotEmpty) return result;
    }
    return [];
  }

  /// True when a quote_tasks row is a commentaire/note or a standalone
  /// fourniture rather than an executable ouvrage — these are billing/PDF lines
  /// from the devis recap and must be excluded from the worker / À faire lists.
  bool _isNonTaskLine(Map<dynamic, dynamic> t) {
    final taskId = (t['task_id'] as String? ?? '').toLowerCase();
    if (taskId.startsWith('comment_') || taskId.startsWith('fourniture_')) {
      return true;
    }
    final inputs = (t['inputs'] as Map?)?.cast<String, dynamic>() ?? const {};
    if (inputs['isComment'] == true || inputs['isFourniture'] == true) {
      return true;
    }
    return false;
  }

  Future<List<String>> _quoteIdsForChantier(String chantierId) async {
    final quotes = await _client
        .from('quotes')
        .select('id, created_at')
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false);
    return (quotes as List).map((q) => q['id'] as String).toList();
  }
}
