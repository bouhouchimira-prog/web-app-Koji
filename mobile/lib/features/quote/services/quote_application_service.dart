// Application service layer for the quote feature.
// This class handles multi-step business workflows that were previously mixed
// into QuoteRepository (which should only handle direct DB access).
//
// Responsibilities of QuoteApplicationService:
//   - Orchestrate "save quote THEN create project + tasks" in one workflow
//   - Own the business rules around what happens after a quote is saved
//   - Be independently testable without touching Supabase directly

import 'package:flutter/foundation.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:logger/logger.dart';

class QuoteApplicationService {
  final _logger = Logger();

  /// Save a quote and automatically create the associated project + tasks.
  ///
  /// Returns the final quote ID.
  Future<String> saveQuoteWithProject({
    required String userId,
    required Map<String, dynamic> quoteData,
    String? existingQuoteId,
  }) async {
    final supabase = SupabaseConfig.client;

    // ─── 1. Build and persist the quote ─────────────────────────────────────
    final client = quoteData['client'] as Map<String, dynamic>?;
    final totals = quoteData['totals'] as Map<String, dynamic>?;

    final metadata = {
      'quoteNumber': quoteData['quoteNumber'],
      'date': quoteData['date'],
      'validity': quoteData['validity'],
      'siteAddress': quoteData['siteAddress'],
      'company': quoteData['company'],
      'totals': totals,
    };

    final data = <String, dynamic>{
      'user_id': userId,
      'status': quoteData['status'] ?? 'en_cours',
      'created_at': quoteData['createdAt'] ?? DateTime.now().toIso8601String(),
      'client_name': client?['name'],
      'client_email': client?['email'],
      'client_phone': client?['phone'],
      'client_address': client?['address'],
      'rooms': quoteData['expenses'],
      'tasks': quoteData['tasks'],
      'notes': metadata,
      'total_amount': totals?['ttc'],
    };

    final clientEmail = client?['email'] as String? ?? '';

    String finalQuoteId;

    if (existingQuoteId != null) {
      // UPDATE — URL uses the known ID
      data['signature_url'] =
          'https://koji-signature.vercel.app/?quoteId=$existingQuoteId'
          '&email=${Uri.encodeComponent(clientEmail)}';
      await supabase.from('quotes').upsert(data);
      finalQuoteId = existingQuoteId;
    } else {
      // INSERT — ID is only known after the insert
      final response =
          await supabase.from('quotes').insert(data).select().single();
      finalQuoteId = response['id'] as String;
      final signatureUrl =
          'https://koji-signature.vercel.app/?quoteId=$finalQuoteId'
          '&email=${Uri.encodeComponent(clientEmail)}';
      await supabase
          .from('quotes')
          .update({'signature_url': signatureUrl}).eq('id', finalQuoteId);
    }

    // ─── 2. Auto-create project + tasks ─────────────────────────────────────
    // This is business orchestration and does NOT belong in QuoteRepository.
    // Failure here should not roll back the quote.
    try {
      await _createProjectAndTasks(
        supabase: supabase,
        userId: userId,
        finalQuoteId: finalQuoteId,
        client: client,
        quoteData: quoteData,
      );
    } catch (e, st) {
      // Log but do NOT rethrow — the quote was saved successfully.
      _logger.e('[QuoteApplicationService] Project/task auto-creation failed',
          error: e, stackTrace: st);
      debugPrint('[QuoteApplicationService] Auto-create failed: $e');
    }

    return finalQuoteId;
  }

  Future<void> _createProjectAndTasks({
    required dynamic supabase,
    required String userId,
    required String finalQuoteId,
    required Map<String, dynamic>? client,
    required Map<String, dynamic> quoteData,
  }) async {
    final projectData = {
      'user_id': userId,
      'client_name': client?['name'] ?? 'Client Inconnu',
      'address': quoteData['siteAddress'] ?? client?['address'],
      'status': 'En Cours',
    };

    final projectRes =
        await supabase.from('projects').insert(projectData).select().single();
    final projectId = projectRes['id'] as String;
    _logger.i('[QuoteApplicationService] Project created: $projectId');

    final tasks = _parseTasksFromQuote(
      userId: userId,
      projectId: projectId,
      quoteData: quoteData,
    );

    if (tasks.isNotEmpty) {
      await supabase.from('project_tasks').insert(tasks);
      _logger.i('[QuoteApplicationService] Inserted ${tasks.length} tasks');
    }
  }

  List<Map<String, dynamic>> _parseTasksFromQuote({
    required String userId,
    required String projectId,
    required Map<String, dynamic> quoteData,
  }) {
    final tasksMap = quoteData['tasks'] as Map<String, dynamic>? ?? {};
    final expensesMap = quoteData['expenses'] as Map<String, dynamic>? ?? {};
    final result = <Map<String, dynamic>>[];

    // Strategy 1: Parse from rich tasks map
    if (tasksMap.isNotEmpty) {
      tasksMap.forEach((roomId, roomTasksData) {
        if (roomTasksData is! Map) return;
        final roomTasks = roomTasksData as Map<String, dynamic>;
        roomTasks.forEach((taskId, taskData) {
          if (taskData is! Map) return;
          final tData = taskData as Map<String, dynamic>;
          result.add({
            'user_id': userId,
            'project_id': projectId,
            'task_name': tData['label'] ?? tData['taskId'] ?? 'Tâche',
            'room_name': roomId,
            'status': 'À Faire',
            'details': tData,
          });
        });
      });
    }

    // Strategy 2: Fallback to expenses map
    if (result.isEmpty && expensesMap.isNotEmpty) {
      expensesMap.forEach((roomId, roomData) {
        if (roomData is! Map) return;
        final rData = roomData as Map<String, dynamic>;
        final roomName = rData['name'] ?? roomId;
        final items = rData['tasks'] ?? rData['items'] ?? [];

        if (items is List) {
          for (final item in items) {
            if (item is! Map) continue;
            final itemData = item as Map<String, dynamic>;
            result.add({
              'user_id': userId,
              'project_id': projectId,
              'task_name': itemData['title'] ?? itemData['label'] ?? 'Tâche',
              'room_name': roomName,
              'status': 'À Faire',
              'details': itemData,
            });
          }
        } else if (items is Map) {
          items.forEach((_, taskData) {
            if (taskData is! Map) return;
            final tData = taskData as Map<String, dynamic>;
            result.add({
              'user_id': userId,
              'project_id': projectId,
              'task_name': tData['label'] ?? tData['title'] ?? 'Tâche',
              'room_name': roomName,
              'status': 'À Faire',
              'details': tData,
            });
          });
        }
      });
    }

    return result;
  }
}
