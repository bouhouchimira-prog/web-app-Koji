import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/models/task_note.dart';
import 'package:koji/features/quote/providers/task_note_provider.dart';
import 'package:koji/features/quote/repositories/task_note_repository.dart';

/// Compact audience-targeted notes thread for a single chantier task,
/// embedded in the entreprise's per-ouvrage "fiche" (chantier_worker_activity_screen).
/// Distinct from quote_messages: scoped per task, supports targeting a note
/// to client/workers/both, and supports reply threading.
class TaskNotesThread extends ConsumerStatefulWidget {
  final String taskId;
  final String? projectId;

  const TaskNotesThread({super.key, required this.taskId, this.projectId});

  @override
  ConsumerState<TaskNotesThread> createState() => _TaskNotesThreadState();
}

class _TaskNotesThreadState extends ConsumerState<TaskNotesThread> {
  static const _navy = Color(0xFF0F172A);
  static const _slate = Color(0xFF64748B);

  final _controller = TextEditingController();
  String _audience = TaskNoteAudience.both;
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _sending = true);
    try {
      final companyName =
          ref.read(authRepositoryProvider).currentUser?.email ?? 'Entreprise';
      await ref.read(taskNoteRepositoryProvider).sendNote(
            taskId: widget.taskId,
            projectId: widget.projectId,
            senderName: companyName,
            audience: _audience,
            message: text,
          );
      _controller.clear();
      ref.invalidate(taskNotesProvider(widget.taskId));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(taskNotesProvider(widget.taskId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        notesAsync.when(
          data: (notes) => notes.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 6),
                  child: Text('Aucune note pour cet ouvrage.',
                      style: TextStyle(fontSize: 12.5, color: _slate)),
                )
              : Column(
                  children: notes.map(_noteTile).toList(),
                ),
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(
                child: SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))),
          ),
          error: (e, _) => Text('Erreur : $e',
              style: const TextStyle(fontSize: 12, color: Colors.red)),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _audience,
                isDense: true,
                decoration: const InputDecoration(
                  isDense: true,
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
                items: TaskNoteAudience.values
                    .map((a) => DropdownMenuItem(
                        value: a,
                        child: Text(TaskNoteAudience.label(a),
                            style: const TextStyle(fontSize: 12.5))))
                    .toList(),
                onChanged: (v) => setState(() => _audience = v ?? _audience),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                minLines: 1,
                maxLines: 3,
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: 'Écrire une note…',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.send, color: _navy),
              onPressed: _sending ? null : _send,
            ),
          ],
        ),
      ],
    );
  }

  Widget _noteTile(TaskNote note) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(note.senderName,
                  style: const TextStyle(
                      fontSize: 12.5, fontWeight: FontWeight.bold, color: _navy)),
              const SizedBox(width: 6),
              _audienceBadge(note.audience),
              const Spacer(),
              Text(DateFormat('dd/MM HH:mm').format(note.createdAt),
                  style: const TextStyle(fontSize: 10.5, color: _slate)),
            ],
          ),
          const SizedBox(height: 4),
          Text(note.message, style: const TextStyle(fontSize: 13, color: _navy)),
          for (final r in note.replies)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.subdirectory_arrow_right,
                      size: 14, color: _slate),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(r.senderName,
                            style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: _slate)),
                        if ((r.message ?? '').isNotEmpty)
                          Text(r.message!,
                              style:
                                  const TextStyle(fontSize: 12.5, color: _navy)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _audienceBadge(String audience) {
    final label = switch (audience) {
      TaskNoteAudience.client => 'Client',
      TaskNoteAudience.workers => 'Ouvriers',
      _ => 'Tous',
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0xFFE0E7FF),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: const TextStyle(
              fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF3730A3))),
    );
  }
}
