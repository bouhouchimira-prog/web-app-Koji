import 'dart:convert';
import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';

class ChantierRepository {
  final SupabaseClient _client = Supabase.instance.client;

  /// Normalizes a json/jsonb RPC result into a `List<Map<String, dynamic>>`.
  ///
  /// RPCs that `RETURNS json` can come back as: a real List, a JSON-encoded
  /// String, or a List whose elements are `Map<dynamic, dynamic>` (or even
  /// JSON strings). A blunt `result.cast<Map<String, dynamic>>()` then throws
  /// "type 'String' is not a subtype of type 'Map<String, dynamic>'". This
  /// decodes/deep-converts defensively so callers always get clean maps.
  static List<Map<String, dynamic>> _asMapList(dynamic result) {
    var value = result;
    if (value is String) {
      if (value.trim().isEmpty) return const [];
      try {
        value = jsonDecode(value);
      } catch (_) {
        return const [];
      }
    }
    if (value is! List) return const [];
    final out = <Map<String, dynamic>>[];
    for (var item in value) {
      if (item is String) {
        try {
          item = jsonDecode(item);
        } catch (_) {
          continue; // skip non-decodable string elements
        }
      }
      if (item is Map) out.add(Map<String, dynamic>.from(item));
    }
    return out;
  }

  // ────────────────────────────────────────────────────────
  // Expenses (Main d'œuvre / Fourniture / Divers)
  // ────────────────────────────────────────────────────────

  /// Insert an expense row tied to a chantier.
  /// [category] must be one of: 'main_oeuvre', 'fourniture', 'divers'.
  Future<Map<String, dynamic>> addExpense({
    required String chantierId,
    required String category,
    required String description,
    required double amount,
    double? quantity,
    double? unitPrice,
    String? attachmentUrl,
    String? attachmentType,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final inserted = await _client.from('chantier_expenses').insert({
      'chantier_id': chantierId,
      'user_id': userId,
      'category': category,
      'description': description,
      'amount': amount,
      if (quantity != null) 'quantity': quantity,
      if (unitPrice != null) 'unit_price': unitPrice,
      if (attachmentUrl != null) 'attachment_url': attachmentUrl,
      if (attachmentType != null) 'attachment_type': attachmentType,
    }).select().single();

    return Map<String, dynamic>.from(inserted as Map);
  }

  /// Upload a file to the chantier-attachments bucket.
  /// Path layout: <userId>/<chantierId>/<timestamp>_<filename>
  /// Returns the public URL.
  Future<String> uploadAttachment({
    required String chantierId,
    required File file,
    required String filename,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final ts = DateTime.now().millisecondsSinceEpoch;
    final safeName = filename.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
    final path = '$userId/$chantierId/${ts}_$safeName';

    await _client.storage.from('chantier-attachments').upload(path, file);
    return _client.storage.from('chantier-attachments').getPublicUrl(path);
  }

  // ────────────────────────────────────────────────────────
  // 1. Chantiers
  // ────────────────────────────────────────────────────────

  /// Create a new chantier and its initial budget row
  Future<String> createChantier(Map<String, dynamic> data) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    // Canonicalise the client email (trim + lowercase) before storing it. The
    // client logs in with their own email and is matched to this chantier; the
    // signature web app also validates the link's email param against it. Saving
    // a canonical form keeps all three (stored value, JWT email, link param)
    // in agreement and avoids "profil client introuvable" from a casing/space
    // mismatch.
    final rawEmail = (data['clientEmail'] as String?)?.trim().toLowerCase();
    final clientEmail = (rawEmail != null && rawEmail.isNotEmpty) ? rawEmail : null;

    // 1. Insert the Chantier
    final chantierResponse = await _client
        .from('chantiers')
        .insert({
          'user_id': userId,
          'reference': data['reference'],
          'street': data['street'],
          'postal_code': data['postalCode'],
          'city': data['city'],
          'property_type': data['propertyType'],
          'client_email': clientEmail,
          'status': 'En attente',
        })
        .select('id')
        .single();

    final chantierId = chantierResponse['id'] as String;

    // 2. Insert the empty Budget row for this chantier
    await _client.from('chantier_budgets').insert({
      'chantier_id': chantierId,
      'main_oeuvre_real': 0,
      'main_oeuvre_estimated': 0,
      'fourniture_real': 0,
      'fourniture_estimated': 0,
    });

    return chantierId;
  }

  /// Get all chantiers for the current user
  Future<List<Map<String, dynamic>>> getChantiers() async {
    final response = await _client
        .from('chantiers')
        .select()
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// One-shot REST fetch — same rows as [streamChantiers]. Fallback for when
  /// the realtime channel fails to join (RealtimeSubscribeException timedOut).
  Future<List<Map<String, dynamic>>> getChantiersOnce(String userId) async {
    final response = await _client
        .from('chantiers')
        .select()
        .eq('user_id', userId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Stream all chantiers for the current user (real-time)
  Stream<List<Map<String, dynamic>>> streamChantiers(String userId) {
    return _client
        .from('chantiers')
        .stream(primaryKey: ['id'])
        .eq('user_id', userId)
        .order('created_at', ascending: false)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  // ────────────────────────────────────────────────────────
  // 2. Tasks (À faire)
  // ────────────────────────────────────────────────────────

  /// Fetch tasks for a specific chantier
  Future<List<Map<String, dynamic>>> getTasks(String chantierId) async {
    final response = await _client
        .from('chantier_tasks')
        .select()
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: true);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Stream tasks for a specific chantier (real-time)
  Stream<List<Map<String, dynamic>>> streamTasks(String chantierId) {
    return _client
        .from('chantier_tasks')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: true)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  /// Add a new task (À faire)
  Future<void> addTask(String chantierId, String label) async {
    // .select() forces a round-trip and surfaces RLS / constraint errors.
    // Without it, a rejected insert can fail silently with no exception.
    await _client.from('chantier_tasks').insert({
      'chantier_id': chantierId,
      'label': label,
      'is_done': false,
    }).select().single();
  }

  /// Toggle a task\'s done status
  Future<void> updateTaskStatus(String taskId, bool isDone) async {
    await _client
        .from('chantier_tasks')
        .update({'is_done': isDone}).eq('id', taskId);
  }

  // ────────────────────────────────────────────────────────
  // 3. Budgets
  // ────────────────────────────────────────────────────────

  /// Fetch budget for a chantier
  Future<Map<String, dynamic>?> getBudget(String chantierId) async {
    final response = await _client
        .from('chantier_budgets')
        .select()
        .eq('chantier_id', chantierId)
        .maybeSingle();
    return response;
  }

  /// Stream budget for a chantier (real-time)
  Stream<Map<String, dynamic>?> streamBudget(String chantierId) {
    return _client
        .from('chantier_budgets')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .map((data) => data.isNotEmpty ? data.first : null);
  }

  /// Update budget fields
  Future<void> updateBudget(
      String chantierId, Map<String, dynamic> updates) async {
    updates['updated_at'] = DateTime.now().toIso8601String();
    await _client
        .from('chantier_budgets')
        .update(updates)
        .eq('chantier_id', chantierId);
  }

  /// Update Chantier Status
  Future<void> updateChantierStatus(String chantierId, String status) async {
    await _client.from('chantiers').update({'status': status}).eq('id', chantierId);
  }

  /// Permanently delete a chantier.
  Future<void> deleteChantier(String chantierId) async {
    await _client.from('chantiers').delete().eq('id', chantierId);
  }

  // ────────────────────────────────────────────────────────
  // 3b. Budget lines (itemized) + history
  //   category ∈ {'main_oeuvre', 'fourniture', 'divers'}
  //   The category "real" total = SUM(amount) of its lines.
  // ────────────────────────────────────────────────────────

  /// Maps a UI label to the DB category key.
  static String categoryKey(String label) {
    if (label == "Main d'œuvre") return 'main_oeuvre';
    if (label == 'Divers') return 'divers';
    return 'fourniture';
  }

  /// All budget lines for a chantier (every category), newest first.
  Future<List<Map<String, dynamic>>> getBudgetLines(String chantierId) async {
    final response = await _client
        .from('chantier_budget_lines')
        .select()
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Stream budget lines for a chantier (real-time).
  Stream<List<Map<String, dynamic>>> streamBudgetLines(String chantierId) {
    return _client
        .from('chantier_budget_lines')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  /// Sum of all line amounts for one category.
  Future<double> categoryRealTotal(String chantierId, String category) async {
    final rows = await _client
        .from('chantier_budget_lines')
        .select('amount')
        .eq('chantier_id', chantierId)
        .eq('category', category);
    double sum = 0;
    for (final r in rows) {
      sum += num.tryParse(r['amount']?.toString() ?? '0')?.toDouble() ?? 0;
    }
    return sum;
  }

  /// Add a budget line, sync the matching `*_real` column on the budget row,
  /// and append a history entry. Returns the inserted line.
  Future<Map<String, dynamic>> addBudgetLine({
    required String chantierId,
    required String category,
    required String label,
    required double amount,
    double quantity = 1,
    double unitPrice = 0,
    String? attachmentUrl,
    String? attachmentType,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final inserted = await _client.from('chantier_budget_lines').insert({
      'chantier_id': chantierId,
      'user_id': userId,
      'category': category,
      'label': label,
      'quantity': quantity,
      'unit_price': unitPrice,
      'amount': amount,
      if (attachmentUrl != null) 'attachment_url': attachmentUrl,
      if (attachmentType != null) 'attachment_type': attachmentType,
    }).select().single();

    final newTotal = await categoryRealTotal(chantierId, category);
    await _syncCategoryRealColumn(chantierId, category, newTotal);
    await _addHistory(
      chantierId: chantierId,
      userId: userId,
      category: category,
      action: 'add_line',
      label: label,
      amountDelta: amount,
      totalAfter: newTotal,
    );

    return Map<String, dynamic>.from(inserted as Map);
  }

  /// Delete a budget line, re-sync the category total, log the history.
  Future<void> deleteBudgetLine(Map<String, dynamic> line) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final chantierId = line['chantier_id'] as String;
    final category = line['category'] as String;
    final label = line['label'] as String? ?? '';
    final amount =
        num.tryParse(line['amount']?.toString() ?? '0')?.toDouble() ?? 0;

    await _client.from('chantier_budget_lines').delete().eq('id', line['id']);

    final newTotal = await categoryRealTotal(chantierId, category);
    await _syncCategoryRealColumn(chantierId, category, newTotal);
    await _addHistory(
      chantierId: chantierId,
      userId: userId,
      category: category,
      action: 'delete_line',
      label: label,
      amountDelta: -amount,
      totalAfter: newTotal,
    );
  }

  /// Update an estimated target for a category and log it to history.
  Future<void> updateEstimated({
    required String chantierId,
    required String category,
    required double estimated,
  }) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('User not authenticated');

    final column = '${category}_estimated';
    await updateBudget(chantierId, {column: estimated});

    final realTotal = await categoryRealTotal(chantierId, category);
    await _addHistory(
      chantierId: chantierId,
      userId: userId,
      category: category,
      action: 'edit_estimated',
      label: 'Budget estimé → ${estimated.toStringAsFixed(0)} €',
      amountDelta: 0,
      totalAfter: realTotal,
    );
  }

  /// Writes the recomputed real total back to the `chantier_budgets` row so
  /// the dashboard / budget summary stay consistent without recomputation.
  Future<void> _syncCategoryRealColumn(
      String chantierId, String category, double realTotal) async {
    await updateBudget(chantierId, {'${category}_real': realTotal});
  }

  Future<void> _addHistory({
    required String chantierId,
    required String userId,
    required String category,
    required String action,
    required String label,
    required double amountDelta,
    required double totalAfter,
  }) async {
    await _client.from('chantier_budget_history').insert({
      'chantier_id': chantierId,
      'user_id': userId,
      'category': category,
      'action': action,
      'label': label,
      'amount_delta': amountDelta,
      'total_after': totalAfter,
    });
  }

  /// Budget history for a chantier (all categories), newest first.
  Future<List<Map<String, dynamic>>> getBudgetHistory(String chantierId) async {
    final response = await _client
        .from('chantier_budget_history')
        .select()
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false);
    return List<Map<String, dynamic>>.from(response);
  }

  /// Stream budget history for a chantier (real-time).
  Stream<List<Map<String, dynamic>>> streamBudgetHistory(String chantierId) {
    return _client
        .from('chantier_budget_history')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false)
        .map((data) => List<Map<String, dynamic>>.from(data));
  }

  /// Stream all quotes for a specific chantier (real-time)
  Stream<List<Map<String, dynamic>>> streamChantierQuotes(String chantierId) {
    return _client
        .from('quotes')
        .stream(primaryKey: ['id'])
        .eq('chantier_id', chantierId)
        .order('created_at', ascending: false)
        .map((data) => data.map((q) {
              final metadata = (q['metadata'] as Map?)?.cast<String, dynamic>() ?? {};
              return {
                'id': q['id'],
                'status': q['status'] ?? 'Draft',
                'reference': metadata['quoteNumber'] ?? q['reference'] ?? 'N/A',
                'total_ht': q['total_ht'] ?? 0,
                'total_ttc': q['total_ttc'] ?? 0,
                'date': metadata['date'] ?? '',
                'client': (metadata['client'] as Map?)?.cast<String, dynamic>() ?? {},
              };
            }).toList());
  }

  /// Link "orphan" quotes (chantier_id = null) to [chantierId] when they clearly
  /// belong to it. A devis created standalone — or before the chantier link was
  /// set — never shows in the chantier's Devis/À faire because those read
  /// `chantier_id = chantierId`. We match on hard signals only: the chantier's
  /// reference equals the quote's stored client name, OR the chantier address
  /// equals the quote's siteAddress. Returns the number of quotes linked.
  ///
  /// Mirrors the matching used by QuoteTaskRepository.getDevisTasksForChantier
  /// so the dashboard count, the À faire list and the planner all agree.
  Future<int> linkOrphanQuotesToChantier(String chantierId) async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) return 0;

    final chantier = await _client
        .from('chantiers')
        .select('reference, street, city')
        .eq('id', chantierId)
        .maybeSingle();
    if (chantier == null) return 0;

    final wantRef = (chantier['reference'] as String? ?? '').trim().toLowerCase();
    final street = (chantier['street'] as String? ?? '').trim();
    final city = (chantier['city'] as String? ?? '').trim();
    final wantAddr =
        [street, city].where((s) => s.isNotEmpty).join(', ').toLowerCase();
    if (wantRef.isEmpty && wantAddr.isEmpty) return 0;

    final orphans = await _client
        .from('quotes')
        .select('id, metadata, chantier_id')
        .eq('user_id', userId);

    var linked = 0;
    for (final q in (orphans as List)) {
      if (q['chantier_id'] != null) continue; // never steal a linked devis
      final meta = (q['metadata'] as Map?)?.cast<String, dynamic>() ?? {};
      final client = (meta['client'] as Map?)?.cast<String, dynamic>() ?? {};
      final clientName =
          (client['name'] as String? ?? '').toLowerCase().trim();
      final siteAddr =
          (meta['siteAddress'] as String? ?? '').toLowerCase().trim();
      final refHit = wantRef.isNotEmpty && clientName == wantRef;
      final addrHit = wantAddr.isNotEmpty && siteAddr == wantAddr;
      if (!refHit && !addrHit) continue;
      try {
        await _client
            .from('quotes')
            .update({'chantier_id': chantierId}).eq('id', q['id']);
        linked++;
      } catch (_) {/* best-effort */}
    }
    return linked;
  }

  /// Get all open tasks across all chantiers for the current user
  Future<List<Map<String, dynamic>>> getOpenTasksForUser(String userId) async {
    // 1. Get user's chantiers
    final chantiers = await _client
        .from('chantiers')
        .select('id')
        .eq('user_id', userId);
        
    if (chantiers.isEmpty) return [];
    
    final chantierIds = chantiers.map((c) => c['id']).toList();
    
    // 2. Fetch tasks
    final tasksResponse = await _client
        .from('chantier_tasks')
        .select()
        .inFilter('chantier_id', chantierIds)
        .eq('is_done', false)
        .order('created_at', ascending: false);
        
    return List<Map<String, dynamic>>.from(tasksResponse);
  }

  // ────────────────────────────────────────────────────────
  // Worker activity (entreprise side) — see supabase/worker_activity.sql
  // ────────────────────────────────────────────────────────

  /// Worker activity for one chantier: every ouvrage with its assigned
  /// worker(s), pointages, photos, documents and reports. Returns [] when the
  /// caller doesn't own the chantier.
  Future<List<Map<String, dynamic>>> getChantierWorkerActivity(
      String chantierId) async {
    final result = await _client.rpc('get_chantier_worker_activity',
        params: {'p_chantier_id': chantierId});
    return _asMapList(result);
  }

  /// Worker reports (réclamation/retard/blocage/dépassement/commentaire) across
  /// all the current user's chantiers, newest first. [since] filters to reports
  /// after a timestamp (drives the notifications poll).
  Future<List<Map<String, dynamic>>> getCompanyWorkerReports(
      {DateTime? since}) async {
    final result = await _client.rpc('get_company_worker_reports',
        params: {'p_since': since?.toUtc().toIso8601String()});
    return _asMapList(result);
  }

  /// Public URL for an object stored in the worker-uploads bucket.
  String workerUploadUrl(String storagePath) =>
      _client.storage.from('worker-uploads').getPublicUrl(storagePath);
}
