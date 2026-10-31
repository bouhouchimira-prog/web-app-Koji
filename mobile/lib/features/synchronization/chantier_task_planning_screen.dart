import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/core/notification_service.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/quote/repository/quote_task_repository.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

/// Task-first planning: pick a chantier, see ALL its tasks, tap one to assign
/// an ouvrier + start date/time + end date/time. Each task row shows whether
/// it's already scheduled and to whom.
class ChantierTaskPlanningScreen extends ConsumerStatefulWidget {
  final String? initialChantierId;

  const ChantierTaskPlanningScreen({super.key, this.initialChantierId});

  @override
  ConsumerState<ChantierTaskPlanningScreen> createState() =>
      _ChantierTaskPlanningScreenState();
}

class _ChantierTaskPlanningScreenState
    extends ConsumerState<ChantierTaskPlanningScreen> {
  static const _darkNavy = Color(0xFF0A1227);
  static const _darkText = Color(0xFF031229);
  static const _greyText = Color(0xFF8B95A5);
  static const _appBg = Color(0xFFFBFBFC);
  static const _blue = Color(0xFF2E65F3);

  List<Project> _chantiers = [];
  List<Worker> _workers = [];
  List<Map<String, dynamic>> _chantierTasks = [];
  List<ScheduledTask> _scheduled = [];

  String? _selectedChantierId;
  bool _loading = true;
  bool _loadingTasks = false;
  String? _tasksError;
  String _debugInfo = '';

  @override
  void initState() {
    super.initState();
    _selectedChantierId = widget.initialChantierId;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final projects = await ProjectRepository().fetchProjects();
      final workers = await WorkerRepository().getWorkers();
      if (!mounted) return;
      setState(() {
        _chantiers = projects;
        _workers = workers;
        _selectedChantierId ??=
            projects.isNotEmpty ? projects.first.id : null;
        _loading = false;
      });
      if (_selectedChantierId != null) {
        await _loadTasks(_selectedChantierId!);
      }
    } catch (e) {
      debugPrint('ChantierTaskPlanning bootstrap error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadTasks(String chantierId) async {
    setState(() {
      _loadingTasks = true;
      _tasksError = null;
    });
    try {
      // Devis tasks (quote → rooms → quote_tasks) are the SAME tasks the user
      // sees in the recap. Fall back to the chantier_tasks checklist when the
      // chantier has no devis.
      debugPrint('[PLANNER] loadTasks chantierId=$chantierId');
      var tasks =
          await QuoteTaskRepository().getDevisTasksForChantier(chantierId);
      debugPrint('[PLANNER] devis tasks: ${tasks.length}');
      if (tasks.isEmpty) {
        tasks = await ChantierRepository().getTasks(chantierId);
        debugPrint('[PLANNER] chantier_tasks fallback: ${tasks.length}');
      }
      final scheduled = await ref
          .read(scheduledTaskRepositoryProvider)
          .fetchForChantier(chantierId);
      debugPrint('[PLANNER] scheduled: ${scheduled.length}');

      // Merge in already-scheduled tasks that aren't represented by a devis /
      // chantier_task row. A chantier can have scheduled tasks even when its
      // devis tasks query returns nothing (e.g. tasks created straight from the
      // planner, or stored without a quote_task link). Without this, those
      // planned tasks would be invisible here even though they show in the
      // synchronization view. We key existing rows by id so we don't duplicate.
      final existingIds = tasks.map((t) => t['id'] as String).toSet();
      for (final s in scheduled) {
        final linkId = s.quoteTaskId ?? s.chantierTaskId;
        // Already shown as a devis/chantier row → it'll be decorated, skip.
        if (linkId != null && existingIds.contains(linkId)) continue;
        // Otherwise surface the scheduled task itself as a row. Use the link id
        // when present (so _scheduledFor matches), else the scheduled task id.
        final rowId = linkId ?? s.id;
        if (existingIds.contains(rowId)) continue;
        existingIds.add(rowId);
        tasks.add({
          'id': rowId,
          'label': s.title,
          'room_name': '',
        });
      }

      // Diagnostic: when nothing showed, probe the DB directly so we can see
      // on-screen exactly what exists for this user/chantier.
      String debug = '';
      if (tasks.isEmpty) {
        debug = await _probe(chantierId);
      }

      if (!mounted) return;
      setState(() {
        _chantierTasks = tasks;
        _scheduled = scheduled;
        _debugInfo = debug;
        _loadingTasks = false;
      });
    } catch (e) {
      debugPrint('loadTasks error: $e');
      if (mounted) {
        setState(() {
          _chantierTasks = [];
          _scheduled = [];
          _loadingTasks = false;
          _tasksError = e.toString();
        });
      }
    }
  }

  /// Diagnostic probe: dumps EVERY quote the user owns with its real link
  /// fields + room/task counts, so we can see exactly how this chantier's devis
  /// is stored (and why the joins miss it). Temporary.
  Future<String> _probe(String chantierId) async {
    try {
      final c = Supabase.instance.client;
      final userId = c.auth.currentUser?.id;
      final chantier = await c
          .from('chantiers')
          .select('reference')
          .eq('id', chantierId)
          .maybeSingle();
      final ref = (chantier?['reference'] as String?) ?? '?';

      final quotes = await c
          .from('quotes')
          .select('id, reference, chantier_id, metadata')
          .eq('user_id', userId as Object)
          .order('created_at', ascending: false);

      final sb = StringBuffer();
      sb.writeln('DIAG chantier=$chantierId ref=$ref');
      sb.writeln('quotes total=${(quotes as List).length}');
      for (final q in quotes) {
        final qid = q['id'] as String;
        final meta = (q['metadata'] as Map?)?.cast<String, dynamic>() ?? {};
        final client = (meta['client'] as Map?)?.cast<String, dynamic>() ?? {};
        int rooms = 0, tasks = 0;
        final r = await c.from('quote_rooms').select('id').eq('quote_id', qid);
        rooms = (r as List).length;
        for (final room in r) {
          final t =
              await c.from('quote_tasks').select('id').eq('room_id', room['id']);
          tasks += (t as List).length;
        }
        sb.writeln('— q.ref=${q['reference']} ch_id=${q['chantier_id']} '
            'client=${client['name']} rooms=$rooms tasks=$tasks');
      }
      return sb.toString();
    } catch (e) {
      return 'DIAG error: $e';
    }
  }

  /// The scheduled assignment linked to a given task id (devis quote_task or
  /// chantier_task), if any.
  ScheduledTask? _scheduledFor(String taskId) {
    for (final s in _scheduled) {
      if (s.quoteTaskId == taskId ||
          s.chantierTaskId == taskId ||
          s.id == taskId) {
        return s;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _appBg,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Column(
                children: [
                  _buildHeader(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 4, 24, 0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Chantier',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: _darkNavy)),
                        const SizedBox(height: 8),
                        _chantierDropdown(),
                        const SizedBox(height: 20),
                        const Text('Tâches du chantier',
                            style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: _darkText)),
                        const SizedBox(height: 4),
                        const Text(
                          "Touchez une tâche pour assigner un ouvrier et des dates",
                          style: TextStyle(fontSize: 13, color: _greyText),
                        ),
                        const SizedBox(height: 12),
                      ],
                    ),
                  ),
                  Expanded(child: _buildTaskList()),
                ],
              ),
      ),
      floatingActionButton: _loading
          ? null
          : FloatingActionButton.extended(
              onPressed: _selectedChantierId == null ? null : _addNewTask,
              backgroundColor: _blue,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Nouvelle tâche',
                  style: TextStyle(
                      color: Colors.white, fontWeight: FontWeight.w700)),
            ),
    );
  }

  Widget _buildTaskList() {
    if (_loadingTasks) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_tasksError != null) {
      return _empty(
        "Erreur de chargement des tâches",
        _tasksError!,
      );
    }
    if (_chantierTasks.isEmpty) {
      return _empty(
        "Aucune tâche dans ce chantier",
        _debugInfo.isNotEmpty
            ? _debugInfo
            : "Appuyez sur « Nouvelle tâche » pour en créer une.",
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 100),
      itemCount: _chantierTasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (_, i) {
        final task = _chantierTasks[i];
        final id = task['id'] as String;
        final label = task['label'] as String? ?? 'Tâche';
        final roomName = task['room_name'] as String? ?? '';
        final assignment = _scheduledFor(id);
        return _taskCard(id, label, roomName, assignment);
      },
    );
  }

  Widget _taskCard(String taskId, String label, String roomName,
      ScheduledTask? assignment) {
    final df = DateFormat('dd/MM');
    final state = assignment?.stateAt(DateTime.now());
    final accent = state?.color ?? _greyText;

    return GestureDetector(
      onTap: () => _openAssignSheet(taskId, label, assignment),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: assignment != null
                ? accent.withValues(alpha: 0.3)
                : const Color(0xFFEEF2F6),
            width: 1.4,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: assignment != null ? accent : const Color(0xFFD7DCE3),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (roomName.isNotEmpty)
                    Text(roomName.toUpperCase(),
                        style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFFA18B73),
                            letterSpacing: 0.5)),
                  Text(label,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: _darkText)),
                  const SizedBox(height: 4),
                  if (assignment != null)
                    Text(
                      "${assignment.workerFullName} · "
                      "${df.format(assignment.scheduledDate)} ${assignment.startTime}"
                      " → ${df.format(assignment.endDate)} ${assignment.endTime}",
                      style: const TextStyle(fontSize: 12, color: _greyText),
                    )
                  else
                    const Text("Non assignée",
                        style: TextStyle(fontSize: 12, color: _greyText)),
                ],
              ),
            ),
            Icon(
              assignment != null ? Icons.edit_outlined : Icons.person_add_alt_1,
              size: 20,
              color: _blue,
            ),
          ],
        ),
      ),
    );
  }

  // ── Assign sheet: ouvrier + start (date/time) + end (date/time) ───────────
  Future<void> _openAssignSheet(
      String taskId, String label, ScheduledTask? existing) async {
    if (_workers.isEmpty) {
      _snack("Aucun ouvrier. Créez un profil d'abord.");
      return;
    }

    final now = DateTime.now();
    String? workerId = existing?.workerId ?? _workers.first.id;
    DateTime startDate = existing?.scheduledDate ?? now;
    TimeOfDay startTime = existing != null
        ? existing.startTimeOfDay
        : const TimeOfDay(hour: 8, minute: 0);
    DateTime endDate = existing?.endDate ?? startDate;
    TimeOfDay endTime = existing != null
        ? TimeOfDay(
            hour: int.parse(existing.endTime.split(':')[0]),
            minute: int.parse(existing.endTime.split(':')[1]))
        : const TimeOfDay(hour: 10, minute: 0);

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(builder: (ctx, setSheet) {
          DateTime startDateTime() => DateTime(startDate.year, startDate.month,
              startDate.day, startTime.hour, startTime.minute);
          DateTime endDateTime() => DateTime(endDate.year, endDate.month,
              endDate.day, endTime.hour, endTime.minute);

          Future<void> pickDate(bool isStart) async {
            final d = await showDatePicker(
              context: ctx,
              initialDate: isStart ? startDate : endDate,
              firstDate: DateTime(now.year - 1),
              lastDate: DateTime(now.year + 3),
            );
            if (d != null) {
              setSheet(() {
                if (isStart) {
                  startDate = d;
                  if (endDate.isBefore(startDate)) endDate = d;
                } else {
                  endDate = d;
                }
              });
            }
          }

          Future<void> pickTime(bool isStart) async {
            final t = await showTimePicker(
              context: ctx,
              initialTime: isStart ? startTime : endTime,
            );
            if (t != null) {
              setSheet(() => isStart ? startTime = t : endTime = t);
            }
          }

          final invalid = !endDateTime().isAfter(startDateTime());

          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 16,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(label,
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: _darkText)),
                const SizedBox(height: 16),
                const Text('Ouvrier',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _darkNavy)),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFEEF2F6)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      isExpanded: true,
                      value: workerId,
                      items: _workers
                          .map((w) => DropdownMenuItem(
                                value: w.id,
                                child: Text(
                                    '${w.firstName} ${w.lastName} · ${w.profession}'
                                        .trim(),
                                    overflow: TextOverflow.ellipsis),
                              ))
                          .toList(),
                      onChanged: (v) => setSheet(() => workerId = v),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _dateTimeRow('Début', startDate, startTime,
                    () => pickDate(true), () => pickTime(true)),
                const SizedBox(height: 10),
                _dateTimeRow('Fin', endDate, endTime, () => pickDate(false),
                    () => pickTime(false)),
                if (invalid) ...[
                  const SizedBox(height: 10),
                  const Text(
                    "La fin doit être après le début.",
                    style: TextStyle(color: Color(0xFFE5484D), fontSize: 12),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  height: 52,
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: invalid
                        ? null
                        : () => Navigator.pop(ctx, true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _blue,
                      disabledBackgroundColor:
                          _blue.withValues(alpha: 0.4),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                    child: const Text('Assigner',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700)),
                  ),
                ),
                if (existing != null) ...[
                  const SizedBox(height: 8),
                  Center(
                    child: TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Supprimer l\'assignation',
                          style: TextStyle(color: Color(0xFFE5484D))),
                    ),
                  ),
                ],
              ],
            ),
          );
        });
      },
    );

    if (saved == null) return; // dismissed

    if (saved == false && existing != null) {
      // "Supprimer l'assignation"
      await ref.read(scheduledTaskRepositoryProvider).delete(existing.id);
      await _loadTasks(_selectedChantierId!);
      return;
    }

    // Persist (create or update). We recompute start/end from the captured
    // closure values via a second call — but those live in the sheet, so we
    // instead read them back through a saved record below.
    await _persist(taskId, label, existing, startDate, startTime,
        endDate, endTime, workerId!);
  }

  Future<void> _persist(
    String taskId,
    String label,
    ScheduledTask? existing,
    DateTime startDate,
    TimeOfDay startTime,
    DateTime endDate,
    TimeOfDay endTime,
    String workerId,
  ) async {
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      if (user == null) throw Exception('Utilisateur non connecté');
      final repo = ref.read(scheduledTaskRepositoryProvider);

      String hhmm(TimeOfDay t) =>
          '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

      final startDt = DateTime(startDate.year, startDate.month, startDate.day,
          startTime.hour, startTime.minute);
      final endDt = DateTime(endDate.year, endDate.month, endDate.day,
          endTime.hour, endTime.minute);
      final duration = endDt.difference(startDt).inMinutes;

      // Determine the devis/chantier link to store. When editing, preserve the
      // existing row's real link (it may be a quote_task or a chantier_task).
      // When creating from a devis/chantier row, [taskId] is that row's id.
      final String? quoteLink;
      final String? chantierLink;
      if (existing != null) {
        quoteLink = existing.quoteTaskId;
        chantierLink = existing.chantierTaskId;
      } else {
        quoteLink = taskId;
        chantierLink = null;
      }

      final task = ScheduledTask(
        id: existing?.id ?? '',
        userId: user.id,
        chantierId: _selectedChantierId!,
        quoteTaskId: quoteLink,
        chantierTaskId: chantierLink,
        workerId: workerId,
        title: label,
        scheduledDate: DateTime(startDate.year, startDate.month, startDate.day),
        startTime: hhmm(startTime),
        durationMinutes: duration > 0 ? duration : 60,
        endDateExplicit: DateTime(endDate.year, endDate.month, endDate.day),
        endTimeExplicit: hhmm(endTime),
        status: existing?.status ?? 'À faire',
      );

      final ScheduledTask result;
      if (existing == null) {
        result = await repo.create(task);
      } else {
        result = await repo.update(task);
      }

      ref.invalidate(allScheduledTasksProvider);
      ref.invalidate(scheduledTasksForChantierProvider(task.chantierId));
      unawaited(NotificationService.instance.refreshDailySummary());
      unawaited(NotificationService.instance.scheduleTaskReminder(result));

      if (!mounted) return;
      _snack(existing == null ? 'Tâche assignée !' : 'Assignation mise à jour');
      await _loadTasks(_selectedChantierId!);
    } catch (e) {
      if (mounted) _snack('Erreur : $e');
    }
  }

  Future<void> _addNewTask() async {
    final controller = TextEditingController();
    final label = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Nouvelle tâche'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Ex: Pose carrelage salon',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Ajouter'),
          ),
        ],
      ),
    );
    if (label == null || label.isEmpty || _selectedChantierId == null) return;
    try {
      await ChantierRepository().addTask(_selectedChantierId!, label);
      await _loadTasks(_selectedChantierId!);
    } catch (e) {
      if (mounted) _snack('Erreur : $e');
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  Widget _dateTimeRow(String label, DateTime date, TimeOfDay time,
      VoidCallback onDate, VoidCallback onTime) {
    final df = DateFormat('EEE dd MMM', 'fr_FR');
    return Row(
      children: [
        SizedBox(
            width: 48,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _darkNavy))),
        Expanded(
          child: _pillButton(
            icon: Icons.calendar_today_outlined,
            text: df.format(date),
            onTap: onDate,
          ),
        ),
        const SizedBox(width: 8),
        _pillButton(
          icon: Icons.schedule,
          text:
              '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}',
          onTap: onTime,
        ),
      ],
    );
  }

  Widget _pillButton(
      {required IconData icon,
      required String text,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFEEF2F6)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: _greyText),
            const SizedBox(width: 6),
            Text(text,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _darkText)),
          ],
        ),
      ),
    );
  }

  Widget _chantierDropdown() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          isExpanded: true,
          value: _selectedChantierId,
          hint: const Text('Sélectionner un chantier'),
          items: _chantiers
              .map((c) => DropdownMenuItem(
                    value: c.id,
                    child: Text(
                      '${c.title}${c.address != null ? ' · ${c.address}' : ''}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ))
              .toList(),
          onChanged: (id) {
            if (id == null) return;
            setState(() => _selectedChantierId = id);
            _loadTasks(id);
          },
        ),
      ),
    );
  }

  Widget _empty(String title, String subtitle) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.checklist_rtl,
                size: 44, color: _greyText.withValues(alpha: 0.5)),
            const SizedBox(height: 14),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _darkText)),
            const SizedBox(height: 6),
            Text(subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: _greyText)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: [
          GestureDetector(
            onTap: () =>
                Navigator.canPop(context) ? context.pop() : context.go('/home'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: _darkNavy.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.chevron_left, color: _darkNavy, size: 28),
            ),
          ),
          const Expanded(
            child: Text(
              'Planifier une tâche',
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 20, fontWeight: FontWeight.w700, color: _darkNavy),
            ),
          ),
          const SizedBox(width: 44),
        ],
      ),
    );
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }
}
