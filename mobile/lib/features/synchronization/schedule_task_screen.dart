import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/notification_service.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';
import 'package:koji/features/synchronization/widgets/calendar_month_picker.dart';
import 'package:koji/features/synchronization/widgets/duration_selector.dart';
import 'package:koji/features/synchronization/widgets/time_picker_wheel.dart';

/// Create / edit a [ScheduledTask]. This is the central scheduling form
/// reached from the chantier dashboard, the to-do list, the sync hub, and
/// the planning screen.
class ScheduleTaskScreen extends ConsumerStatefulWidget {
  final String? chantierId;
  final String? chantierTaskId;
  final String? editingTaskId;
  final DateTime? initialDate;
  final String? initialTitle;
  final String? initialWorkerId;

  const ScheduleTaskScreen({
    super.key,
    this.chantierId,
    this.chantierTaskId,
    this.editingTaskId,
    this.initialDate,
    this.initialTitle,
    this.initialWorkerId,
  });

  @override
  ConsumerState<ScheduleTaskScreen> createState() =>
      _ScheduleTaskScreenState();
}

class _ScheduleTaskScreenState extends ConsumerState<ScheduleTaskScreen> {
  static const _darkNavy = Color(0xFF0A1227);
  static const _appBg = Color(0xFFFBFBFC);

  final _titleController = TextEditingController();
  final _notesController = TextEditingController();

  DateTime _currentMonth =
      DateTime(DateTime.now().year, DateTime.now().month);
  late DateTime _selectedDate;
  int _hour = 8;
  int _minute = 0;
  int _durationMinutes = 60;

  List<Project> _chantiers = [];
  List<Worker> _workers = [];
  List<Map<String, dynamic>> _chantierTasks = [];

  String? _selectedChantierId;
  final Set<String> _selectedWorkerIds = {};
  String? _selectedChantierTaskId;

  /// Primary worker = first selected (drives conflict detection + legacy field).
  String? get _selectedWorkerId =>
      _selectedWorkerIds.isEmpty ? null : _selectedWorkerIds.first;

  bool _loading = true;
  bool _saving = false;
  ScheduledTask? _conflict; // populated when we surface a warning inline

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate ?? DateTime.now();
    _currentMonth = DateTime(_selectedDate.year, _selectedDate.month);
    _selectedChantierId = widget.chantierId;
    _selectedChantierTaskId = widget.chantierTaskId;
    if (widget.initialWorkerId != null) {
      _selectedWorkerIds.add(widget.initialWorkerId!);
    }
    if (widget.initialTitle != null) _titleController.text = widget.initialTitle!;
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final projects = await ProjectRepository().fetchProjects();
      final workers = await WorkerRepository().getWorkers();

      // If editing, load the existing task and pre-fill.
      ScheduledTask? existing;
      if (widget.editingTaskId != null) {
        existing = await ref
            .read(scheduledTaskRepositoryProvider)
            .fetchById(widget.editingTaskId!);
      }

      List<Map<String, dynamic>> chantierTasks = [];
      if (_selectedChantierId != null) {
        chantierTasks =
            await ChantierRepository().getTasks(_selectedChantierId!);
      }

      if (!mounted) return;
      setState(() {
        _chantiers = projects;
        _workers = workers;
        _chantierTasks = chantierTasks;

        if (existing != null) {
          _titleController.text = existing.title;
          _notesController.text = existing.notes ?? '';
          _selectedDate = existing.scheduledDate;
          _currentMonth =
              DateTime(existing.scheduledDate.year, existing.scheduledDate.month);
          final parts = existing.startTime.split(':');
          _hour = int.parse(parts[0]);
          _minute = int.parse(parts[1]);
          _durationMinutes = existing.durationMinutes;
          _selectedChantierId = existing.chantierId;
          _selectedWorkerIds
            ..clear()
            ..addAll(existing.workerIds);
          _selectedChantierTaskId = existing.chantierTaskId;
        } else {
          // Defaults: pre-select the only chantier/worker if there is exactly one.
          _selectedChantierId ??=
              _chantiers.isNotEmpty ? _chantiers.first.id : null;
          if (_selectedWorkerIds.isEmpty && _workers.isNotEmpty) {
            _selectedWorkerIds.add(_workers.first.id);
          }
        }

        _loading = false;
      });
    } catch (e) {
      debugPrint('ScheduleTaskScreen bootstrap error: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reloadChantierTasks(String chantierId) async {
    try {
      final tasks = await ChantierRepository().getTasks(chantierId);
      if (!mounted) return;
      setState(() {
        _chantierTasks = tasks;
        _selectedChantierTaskId = null;
      });
    } catch (_) {
      if (mounted) setState(() => _chantierTasks = []);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  String get _startTimeHHmm =>
      '${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}';

  Future<void> _recomputeConflict() async {
    if (_selectedWorkerId == null) {
      setState(() => _conflict = null);
      return;
    }
    final conflict = await ref.read(scheduledTaskRepositoryProvider).checkConflict(
          workerId: _selectedWorkerId!,
          date: _selectedDate,
          startTime: _startTimeHHmm,
          durationMinutes: _durationMinutes,
          excludeTaskId: widget.editingTaskId,
        );
    if (mounted) setState(() => _conflict = conflict);
  }

  Future<void> _save() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      _snack('Veuillez saisir un titre de tâche');
      return;
    }
    if (_selectedChantierId == null) {
      _snack('Veuillez choisir un chantier');
      return;
    }
    if (_selectedWorkerIds.isEmpty) {
      _snack('Veuillez choisir au moins un ouvrier');
      return;
    }

    setState(() => _saving = true);
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      if (user == null) throw Exception('Utilisateur non connecté');

      final repo = ref.read(scheduledTaskRepositoryProvider);

      final conflict = await repo.checkConflict(
        workerId: _selectedWorkerId!,
        date: _selectedDate,
        startTime: _startTimeHHmm,
        durationMinutes: _durationMinutes,
        excludeTaskId: widget.editingTaskId,
      );

      if (conflict != null) {
        final proceed = await _confirmConflict(conflict);
        if (!proceed) {
          if (mounted) setState(() => _saving = false);
          return;
        }
      }

      final task = ScheduledTask(
        id: widget.editingTaskId ?? '',
        userId: user.id,
        chantierId: _selectedChantierId!,
        chantierTaskId: _selectedChantierTaskId,
        workerId: _selectedWorkerId!,
        title: title,
        notes: _notesController.text.trim().isEmpty
            ? null
            : _notesController.text.trim(),
        scheduledDate: DateTime(
            _selectedDate.year, _selectedDate.month, _selectedDate.day),
        startTime: _startTimeHHmm,
        durationMinutes: _durationMinutes,
      );

      final workerIds = _selectedWorkerIds.toList();
      final ScheduledTask saved;
      if (widget.editingTaskId == null) {
        saved = await repo.create(task, workerIds: workerIds);
      } else {
        saved = await repo.update(task, workerIds: workerIds);
      }

      // Invalidate providers so the planning + chantier views refresh.
      ref.invalidate(scheduledTasksForDayProvider(task.scheduledDate));
      ref.invalidate(scheduledTasksForChantierProvider(task.chantierId));

      // Keep notifications in sync with the latest schedule.
      unawaited(NotificationService.instance.refreshDailySummary());
      unawaited(NotificationService.instance.scheduleTaskReminder(saved));

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.editingTaskId == null
              ? 'Tâche planifiée avec succès !'
              : 'Tâche mise à jour'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
      context.pop(true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        _snack('Erreur : $e');
      }
    }
  }

  Future<bool> _confirmConflict(ScheduledTask conflict) async {
    final worker = _workers.firstWhere(
      (w) => w.id == conflict.workerId,
      orElse: () => Worker(
          id: '',
          firstName: 'Ouvrier',
          lastName: '',
          profession: ''),
    );
    final fullName =
        '${worker.firstName} ${worker.lastName}'.trim();

    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Conflit détecté'),
            content: Text(
              '$fullName a déjà une tâche "${conflict.title}" '
              'de ${conflict.startTime} à ${conflict.endTime} ce jour-là.\n\n'
              'Voulez-vous quand même enregistrer ?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Annuler'),
              ),
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Forcer'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _appBg,
      body: Stack(
        children: [
          Positioned(
            top: -50,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withValues(alpha: 0.6),
                    const Color(0xFFFBE4D2).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    children: [
                      _buildHeader(),
                      Expanded(child: _buildForm()),
                    ],
                  ),
          ),
          if (!_loading)
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(
                    left: 24, right: 24, bottom: 24),
                child: SizedBox(
                  height: 56,
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2E65F3),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      elevation: 0,
                    ),
                    child: _saving
                        ? SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: Theme.of(context).colorScheme.surface,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            widget.editingTaskId == null
                                ? 'Planifier la tâche'
                                : 'Enregistrer',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.surface,
                            ),
                          ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () =>
                Navigator.canPop(context) ? context.pop() : context.go('/home'),
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: _darkNavy.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child:
                  const Icon(Icons.chevron_left, color: _darkNavy, size: 28),
            ),
          ),
          Expanded(
            child: Text(
              widget.editingTaskId == null
                  ? 'Planifier une tâche'
                  : 'Modifier la tâche',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: _darkNavy,
              ),
            ),
          ),
          const SizedBox(width: 44),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _label('Chantier'),
          const SizedBox(height: 8),
          _chantierDropdown(),

          const SizedBox(height: 20),
          _label('Tâche à planifier'),
          const SizedBox(height: 8),
          _chantierTaskDropdown(),
          const SizedBox(height: 12),
          _textField(
            controller: _titleController,
            hint: 'Titre de la tâche (ex: Pose carrelage)',
          ),

          const SizedBox(height: 20),
          _label('Ouvriers'),
          const SizedBox(height: 4),
          const Text(
            'Sélectionnez un ou plusieurs ouvriers',
            style: TextStyle(fontSize: 12, color: Color(0xFF8B95A5)),
          ),
          const SizedBox(height: 10),
          _workerMultiSelect(),

          const SizedBox(height: 24),
          CalendarMonthPicker(
            currentMonth: _currentMonth,
            selectedDate: _selectedDate,
            onDateSelected: (d) {
              setState(() {
                _selectedDate = d;
                _currentMonth = DateTime(d.year, d.month);
              });
              _recomputeConflict();
            },
            onMonthChanged: (m) => setState(() => _currentMonth = m),
          ),

          const SizedBox(height: 24),
          const Center(
            child: Text(
              "Heure de début",
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: _darkNavy,
              ),
            ),
          ),
          const SizedBox(height: 12),
          TimePickerWheel(
            hour: _hour,
            minute: _minute,
            onHourChanged: (h) {
              setState(() => _hour = h);
              _recomputeConflict();
            },
            onMinuteChanged: (m) {
              setState(() => _minute = m);
              _recomputeConflict();
            },
          ),

          const SizedBox(height: 24),
          _label('Durée'),
          const SizedBox(height: 10),
          DurationSelector(
            selectedMinutes: _durationMinutes,
            onChanged: (m) {
              setState(() => _durationMinutes = m);
              _recomputeConflict();
            },
          ),

          const SizedBox(height: 20),
          _label('Note (optionnel)'),
          const SizedBox(height: 8),
          _textField(
            controller: _notesController,
            hint: 'Informations complémentaires…',
            maxLines: 3,
          ),

          const SizedBox(height: 16),
          if (_conflict != null) _conflictBanner(_conflict!),

          const SizedBox(height: 110),
        ],
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: _darkNavy,
        ),
      );

  Widget _textField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: TextField(
        controller: controller,
        maxLines: maxLines,
        style: const TextStyle(fontSize: 15, color: _darkNavy),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(
            color: const Color(0xFF8B95A5).withValues(alpha: 0.6),
          ),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    );
  }

  Widget _chantierDropdown() {
    return _dropdownShell(
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
            setState(() {
              _selectedChantierId = id;
              _selectedChantierTaskId = null;
              _chantierTasks = [];
            });
            _reloadChantierTasks(id);
          },
        ),
      ),
    );
  }

  Widget _workerMultiSelect() {
    if (_workers.isEmpty) {
      return _dropdownShell(
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Text(
            "Aucun ouvrier — créez d'abord un profil ouvrier",
            style: TextStyle(color: Color(0xFF8B95A5), fontSize: 14),
          ),
        ),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: _workers.map((w) {
        final selected = _selectedWorkerIds.contains(w.id);
        final name =
            '${w.firstName} ${w.lastName}'.trim().isEmpty ? 'Ouvrier' : '${w.firstName} ${w.lastName}'.trim();
        return FilterChip(
          selected: selected,
          onSelected: (v) {
            setState(() {
              if (v) {
                _selectedWorkerIds.add(w.id);
              } else {
                _selectedWorkerIds.remove(w.id);
              }
            });
            _recomputeConflict();
          },
          avatar: Icon(
            Icons.person,
            size: 18,
            color: selected ? Colors.white : const Color(0xFF2E65F3),
          ),
          label: Text(name),
          labelStyle: TextStyle(
            color: selected ? Colors.white : _darkNavy,
            fontWeight: FontWeight.w600,
          ),
          backgroundColor: Theme.of(context).colorScheme.surface,
          selectedColor: const Color(0xFF2E65F3),
          showCheckmark: false,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: selected ? const Color(0xFF2E65F3) : const Color(0xFFEEF2F6),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _chantierTaskDropdown() {
    if (_chantierTasks.isEmpty) {
      return _dropdownShell(
        child: const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Text(
            'Aucune tâche existante — saisissez un titre ci-dessous',
            style: TextStyle(color: Color(0xFF8B95A5), fontSize: 14),
          ),
        ),
      );
    }
    return _dropdownShell(
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String?>(
          isExpanded: true,
          value: _selectedChantierTaskId,
          hint: const Text('Lier à une tâche existante (optionnel)'),
          items: [
            const DropdownMenuItem<String?>(
              value: null,
              child: Text('Aucune — nouvelle tâche'),
            ),
            ..._chantierTasks.map((t) => DropdownMenuItem<String?>(
                  value: t['id'] as String,
                  child: Text(
                    t['label'] as String? ?? 'Tâche',
                    overflow: TextOverflow.ellipsis,
                  ),
                )),
          ],
          onChanged: (id) {
            setState(() {
              _selectedChantierTaskId = id;
              if (id != null) {
                final match = _chantierTasks.firstWhere(
                  (t) => t['id'] == id,
                  orElse: () => <String, dynamic>{},
                );
                final label = match['label'] as String?;
                if (label != null && _titleController.text.trim().isEmpty) {
                  _titleController.text = label;
                }
              }
            });
          },
        ),
      ),
    );
  }

  Widget _dropdownShell({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFEEF2F6)),
      ),
      child: child,
    );
  }

  Widget _conflictBanner(ScheduledTask c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF3E0).withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Color(0xFFFF9800), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Conflit: ${c.title} déjà planifié ${c.startTime}–${c.endTime}',
              style: TextStyle(
                fontSize: 13,
                color: const Color(0xFFFF9800).withValues(alpha: 0.9),
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
