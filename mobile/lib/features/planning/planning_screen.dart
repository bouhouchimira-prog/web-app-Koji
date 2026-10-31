import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/scheduled_task_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';
import 'package:koji/features/synchronization/services/worker_schedule_pdf_service.dart';

class PlanningScreen extends ConsumerStatefulWidget {
  const PlanningScreen({super.key});

  @override
  ConsumerState<PlanningScreen> createState() => _PlanningScreenState();
}

class _PlanningScreenState extends ConsumerState<PlanningScreen> {
  bool _isDayView = true;
  DateTime _selectedDate = DateTime.now();
  DateTime _currentMonth = DateTime(DateTime.now().year, DateTime.now().month);

  List<Worker> _workers = [];
  bool _workersLoaded = false;
  List<ScheduledTask> _monthTasks = [];

  // Color palette for per-chantier stripes in the day agenda.
  static const List<Color> _chantierColors = [
    Color(0xFF2E65F3), // Blue
    Color(0xFF10B981), // Green
    Color(0xFFFF9800), // Orange
    Color(0xFFEF4444), // Red
    Color(0xFF8B5CF6), // Purple
  ];

  @override
  void initState() {
    super.initState();
    _loadWorkers();
    _loadMonthTasks();
  }

  Future<void> _loadWorkers() async {
    try {
      final workers = await WorkerRepository().getWorkers();
      if (mounted) {
        setState(() {
          _workers = workers;
          _workersLoaded = true;
        });
      }
    } catch (e) {
      debugPrint('Error loading workers: $e');
      if (mounted) setState(() => _workersLoaded = true);
    }
  }

  Future<void> _loadMonthTasks() async {
    try {
      final from = DateTime(_currentMonth.year, _currentMonth.month, 1);
      final to = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
      final tasks = await ref
          .read(scheduledTaskRepositoryProvider)
          .fetchForRange(from, to);
      if (mounted) setState(() => _monthTasks = tasks);
    } catch (e) {
      debugPrint('Error loading month tasks: $e');
    }
  }

  /// Deterministic color per chantier id (so the same chantier always paints
  /// the same color in both day and month views).
  Color _chantierColor(String chantierId) {
    final idx = chantierId.hashCode.abs() % _chantierColors.length;
    return _chantierColors[idx];
  }

  DateTime get _weekStart {
    final weekday = _selectedDate.weekday;
    return _selectedDate.subtract(Duration(days: weekday - 1));
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    return Scaffold(
      backgroundColor: appBg,
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await context.push<bool>(
            '/synchronization/schedule-task',
            extra: {'initialDate': _selectedDate},
          );
          if (created == true) {
            ref.invalidate(scheduledTasksForDayProvider(
                DateTime(_selectedDate.year, _selectedDate.month,
                    _selectedDate.day)));
            _loadMonthTasks();
          }
        },
        backgroundColor: const Color(0xFF2E65F3),
        child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface),
      ),
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
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(darkNavy),
                _buildViewToggle(darkNavy),
                const SizedBox(height: 20),
                Expanded(
                  child:
                      _isDayView ? _buildDayView(darkNavy) : _buildMonthView(darkNavy),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── HEADER ───────────────────────────────
  Widget _buildHeader(Color darkNavy) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
      child: Row(
        children: [
          GestureDetector(
            onTap: () {
              if (Navigator.canPop(context)) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: darkNavy.withValues(alpha: 0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Icon(Icons.chevron_left, color: darkNavy, size: 28),
            ),
          ),
          Expanded(
            child: Text(
              "Planning",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: darkNavy,
              ),
            ),
          ),
          const SizedBox(width: 44),
        ],
      ),
    );
  }

  // ─── VIEW TOGGLE ──────────────────────────
  Widget _buildViewToggle(Color darkNavy) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 60),
      child: Container(
        height: 52,
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(30),
          boxShadow: [
            BoxShadow(
              color: darkNavy.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _isDayView = true),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: _isDayView ? darkNavy : Colors.transparent,
                    borderRadius: BorderRadius.circular(26),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    "Jour",
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _isDayView ? Colors.white : darkNavy,
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => _isDayView = false),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  decoration: BoxDecoration(
                    color: !_isDayView ? darkNavy : Colors.transparent,
                    borderRadius: BorderRadius.circular(26),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    "Mois",
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: !_isDayView ? Colors.white : darkNavy,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  DAY VIEW — per-worker agenda
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Widget _buildDayView(Color darkNavy) {
    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    final weekStart = _weekStart;
    final monthName = _monthNames[_selectedDate.month];

    final dayKey = DateTime(
        _selectedDate.year, _selectedDate.month, _selectedDate.day);
    final tasksAsync = ref.watch(scheduledTasksForDayProvider(dayKey));

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Semaine du ${weekStart.day} $monthName",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: darkNavy,
                ),
              ),
              Row(
                children: [
                  Text(
                    "$monthName ${_selectedDate.year}",
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF8B95A5),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.calendar_month,
                      size: 18, color: Color(0xFF8B95A5)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(7, (index) {
              final date = weekStart.add(Duration(days: index));
              final isSelected = date.day == _selectedDate.day &&
                  date.month == _selectedDate.month &&
                  date.year == _selectedDate.year;
              return GestureDetector(
                onTap: () => setState(() => _selectedDate = date),
                child: Column(
                  children: [
                    Text(
                      weekDays[index],
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: isSelected
                            ? darkNavy
                            : const Color(0xFF8B95A5),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: isSelected ? darkNavy : Colors.transparent,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        "${date.day}",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? Colors.white : darkNavy,
                        ),
                      ),
                    ),
                  ],
                ),
              );
            }),
          ),
          const SizedBox(height: 28),
          tasksAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                  child: CircularProgressIndicator(color: Color(0xFF2E65F3))),
            ),
            error: (e, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 40),
              child: Center(child: Text('Erreur: $e')),
            ),
            data: (tasks) => _buildPerWorkerAgenda(darkNavy, tasks),
          ),
          const SizedBox(height: 120),
        ],
      ),
    );
  }

  Widget _buildPerWorkerAgenda(Color darkNavy, List<ScheduledTask> tasks) {
    if (!_workersLoaded) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child:
            Center(child: CircularProgressIndicator(color: Color(0xFF2E65F3))),
      );
    }
    if (_workers.isEmpty) {
      return Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "Missions du jour",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: darkNavy,
                ),
              ),
              const Text(
                "0 ouvrier",
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF8B95A5),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Text(
                'Ajoutez un ouvrier pour commencer à planifier',
                style: TextStyle(fontSize: 14, color: Color(0xFF8B95A5)),
              ),
            ),
          ),
        ],
      );
    }

    final grouped = <String, List<ScheduledTask>>{};
    for (final t in tasks) {
      grouped.putIfAbsent(t.workerId, () => []).add(t);
    }

    final totalMinutes = tasks.fold<int>(0, (s, t) => s + t.durationMinutes);
    final hours = totalMinutes / 60;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              "Missions du jour",
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: darkNavy,
              ),
            ),
            Text(
              "${tasks.length} tâche${tasks.length == 1 ? '' : 's'} · ${hours.toStringAsFixed(1)}h",
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF8B95A5),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ..._workers.map((w) {
          final workerTasks = grouped[w.id] ?? const <ScheduledTask>[];
          return _buildWorkerSection(darkNavy, w, workerTasks);
        }),
      ],
    );
  }

  Widget _buildWorkerSection(
      Color darkNavy, Worker w, List<ScheduledTask> tasks) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF4FF),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  _initials(w),
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF2E65F3),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${w.firstName} ${w.lastName}'.trim(),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: darkNavy,
                      ),
                    ),
                    if (w.profession.isNotEmpty)
                      Text(
                        w.profession,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF8B95A5),
                        ),
                      ),
                  ],
                ),
              ),
              if (tasks.isNotEmpty)
                GestureDetector(
                  onTap: () => _shareWorkerDay(w, tasks),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.ios_share,
                      size: 18,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (tasks.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text(
                'Aucune tâche aujourd\'hui',
                style: TextStyle(fontSize: 13, color: Color(0xFF8B95A5)),
              ),
            )
          else
            ...tasks.map((t) => _buildTaskRow(t, darkNavy)),
        ],
      ),
    );
  }

  Widget _buildTaskRow(ScheduledTask t, Color darkNavy) {
    final color = _chantierColor(t.chantierId);
    final chantierLabel = [
      if ((t.chantierReference ?? '').isNotEmpty) t.chantierReference,
      if ((t.chantierCity ?? '').isNotEmpty) t.chantierCity,
    ].whereType<String>().join(' · ');

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: GestureDetector(
        onTap: () async {
          final changed = await context.push<bool>(
            '/synchronization/schedule-task',
            extra: {'editingTaskId': t.id},
          );
          if (changed == true) {
            ref.invalidate(scheduledTasksForDayProvider(
                DateTime(_selectedDate.year, _selectedDate.month,
                    _selectedDate.day)));
            _loadMonthTasks();
          }
        },
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 58,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.startTime,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: color,
                    ),
                  ),
                  Text(
                    t.endTime,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF8B95A5),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 4,
              height: 48,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    t.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: darkNavy,
                    ),
                  ),
                  if (chantierLabel.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        chantierLabel,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF8B95A5),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _shareWorkerDay(Worker w, List<ScheduledTask> tasks) async {
    try {
      await WorkerSchedulePdfService().shareWorkerDay(
        worker: w,
        day: _selectedDate,
        tasks: tasks,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur PDF: $e')),
        );
      }
    }
  }

  String _initials(Worker w) {
    final a = w.firstName.isNotEmpty ? w.firstName[0] : '';
    final b = w.lastName.isNotEmpty ? w.lastName[0] : '';
    final s = (a + b).toUpperCase();
    return s.isEmpty ? '?' : s;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  MONTH VIEW
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Widget _buildMonthView(Color darkNavy) {
    final monthName = _monthNames[_currentMonth.month];

    // Stats for this month
    final totalMinutes =
        _monthTasks.fold<int>(0, (s, t) => s + t.durationMinutes);
    final workedDays = _monthTasks
        .map((t) =>
            '${t.scheduledDate.year}-${t.scheduledDate.month}-${t.scheduledDate.day}')
        .toSet()
        .length;
    final totalHours = (totalMinutes / 60).toStringAsFixed(1);

    // Aggregate top chantiers by task count.
    final byChantier = <String, int>{};
    final chantierLabels = <String, String>{};
    for (final t in _monthTasks) {
      byChantier.update(t.chantierId, (v) => v + 1, ifAbsent: () => 1);
      final label = [
        if ((t.chantierReference ?? '').isNotEmpty) t.chantierReference,
        if ((t.chantierCity ?? '').isNotEmpty) t.chantierCity,
      ].whereType<String>().join(' · ');
      chantierLabels.putIfAbsent(t.chantierId, () => label.isEmpty ? 'Chantier' : label);
    }
    final topChantiers = byChantier.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Text(
                    "$monthName ${_currentMonth.year}",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(Icons.calendar_month, size: 20, color: darkNavy),
                ],
              ),
              Row(
                children: [
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _currentMonth = DateTime(
                            _currentMonth.year, _currentMonth.month - 1);
                      });
                      _loadMonthTasks();
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFEEF2F6)),
                      ),
                      child: Icon(Icons.chevron_left,
                          color: darkNavy, size: 20),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _currentMonth = DateTime(
                            _currentMonth.year, _currentMonth.month + 1);
                      });
                      _loadMonthTasks();
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFEEF2F6)),
                      ),
                      child: Icon(Icons.chevron_right,
                          color: darkNavy, size: 20),
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildCalendarGrid(darkNavy),
          const SizedBox(height: 28),
          Text(
            "Aperçu du mois",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: darkNavy,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatCard(
                  icon: Icons.calendar_month,
                  label: "Jours planifiés",
                  value: "$workedDays jour${workedDays == 1 ? '' : 's'}",
                  darkNavy: darkNavy,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildStatCard(
                  icon: Icons.access_time_rounded,
                  label: "Total heures",
                  value: "$totalHours h",
                  darkNavy: darkNavy,
                ),
              ),
            ],
          ),
          const SizedBox(height: 28),
          Text(
            "Chantiers principaux",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: darkNavy,
            ),
          ),
          const SizedBox(height: 16),
          if (topChantiers.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'Aucune tâche planifiée ce mois',
                style: TextStyle(fontSize: 14, color: Color(0xFF8B95A5)),
              ),
            )
          else
            ...topChantiers.take(5).map((e) {
              final label = chantierLabels[e.key] ?? 'Chantier';
              return _buildChantierItem(
                label,
                '${e.value} tâche${e.value == 1 ? '' : 's'} planifiée${e.value == 1 ? '' : 's'}',
                _chantierColor(e.key),
                darkNavy,
              );
            }),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildCalendarGrid(Color darkNavy) {
    final dayHeaders = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final lastDay = DateTime(_currentMonth.year, _currentMonth.month + 1, 0);
    final startWeekday = firstDay.weekday;
    final today = DateTime.now();

    final byDay = <int, int>{};
    for (final t in _monthTasks) {
      if (t.scheduledDate.year == _currentMonth.year &&
          t.scheduledDate.month == _currentMonth.month) {
        byDay.update(t.scheduledDate.day, (v) => v + 1, ifAbsent: () => 1);
      }
    }

    List<Widget> cells = [];

    for (final d in dayHeaders) {
      cells.add(Center(
        child: Text(
          d,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: Color(0xFF8B95A5),
            letterSpacing: 0.5,
          ),
        ),
      ));
    }

    final prevMonthEnd =
        DateTime(_currentMonth.year, _currentMonth.month, 0).day;
    for (int i = startWeekday - 1; i > 0; i--) {
      cells.add(Center(
        child: Text(
          "${prevMonthEnd - i + 1}",
          style: TextStyle(
            fontSize: 14,
            color: const Color(0xFF8B95A5).withValues(alpha: 0.4),
          ),
        ),
      ));
    }

    for (int day = 1; day <= lastDay.day; day++) {
      final isToday = today.day == day &&
          today.month == _currentMonth.month &&
          today.year == _currentMonth.year;
      final hasEvent = byDay.containsKey(day);

      cells.add(GestureDetector(
        onTap: () {
          setState(() {
            _selectedDate =
                DateTime(_currentMonth.year, _currentMonth.month, day);
            _isDayView = true;
          });
        },
        child: Container(
          decoration: BoxDecoration(
            color: isToday ? darkNavy : Colors.transparent,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                "$day",
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isToday ? Colors.white : darkNavy,
                ),
              ),
              if (hasEvent && !isToday)
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: Color(0xFF2E65F3),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
        ),
      ));
    }

    final remaining = 7 - (cells.length - 7) % 7;
    if (remaining < 7) {
      for (int i = 1; i <= remaining; i++) {
        cells.add(Center(
          child: Text(
            "$i",
            style: TextStyle(
              fontSize: 14,
              color: const Color(0xFF8B95A5).withValues(alpha: 0.4),
            ),
          ),
        ));
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 7,
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
        childAspectRatio: 1.0,
        children: cells,
      ),
    );
  }

  Widget _buildStatCard({
    required IconData icon,
    required String label,
    required String value,
    required Color darkNavy,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, size: 28, color: darkNavy),
          const SizedBox(height: 12),
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Color(0xFF8B95A5)),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: darkNavy,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChantierItem(
      String title, String subtitle, Color color, Color darkNavy) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 40,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: darkNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF8B95A5),
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right, color: Color(0xFF8B95A5), size: 22),
        ],
      ),
    );
  }

  static const _monthNames = [
    '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
}
