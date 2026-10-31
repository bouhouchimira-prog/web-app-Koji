import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/models/attendance_entry.dart';
import 'package:koji/features/synchronization/providers/attendance_provider.dart';
import 'package:koji/features/synchronization/repositories/attendance_repository.dart';
import 'package:koji/features/synchronization/services/attendance_pdf_service.dart';

/// Weekly attendance ledger for one worker: worked-vs-contracted diff badge,
/// manual entry add/delete, monthly PDF export. Counterpart to web's equipe
/// attendance tab. Reached from PointageHeuresScreen's contact picker.
class AttendanceWeeklyScreen extends ConsumerStatefulWidget {
  final Worker worker;

  const AttendanceWeeklyScreen({super.key, required this.worker});

  @override
  ConsumerState<AttendanceWeeklyScreen> createState() =>
      _AttendanceWeeklyScreenState();
}

class _AttendanceWeeklyScreenState
    extends ConsumerState<AttendanceWeeklyScreen> {
  DateTime _anyDayInWeek = DateTime.now();

  void _shiftWeek(int deltaDays) {
    setState(() => _anyDayInWeek = _anyDayInWeek.add(Duration(days: deltaDays)));
  }

  @override
  Widget build(BuildContext context) {
    final params = WeeklyAttendanceParams(widget.worker, _anyDayInWeek);
    final async = ref.watch(weeklyAttendanceProvider(params));

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      appBar: AppBar(
        title: Text('${widget.worker.firstName} ${widget.worker.lastName}'),
        actions: [
          IconButton(
            icon: const Icon(Icons.picture_as_pdf_outlined),
            tooltip: 'Export PDF (mois)',
            onPressed: () async {
              try {
                await AttendancePdfService().share(
                  worker: widget.worker,
                  month: _anyDayInWeek,
                );
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context)
                      .showSnackBar(SnackBar(content: Text('Erreur : $e')));
                }
              }
            },
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: () => _shiftWeek(-7),
                ),
                async.maybeWhen(
                  data: (s) => Text(
                    '${DateFormat('dd/MM').format(s.weekStart)} - ${DateFormat('dd/MM').format(s.weekEnd)}',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppTheme.textPrimary(context)),
                  ),
                  orElse: () => const SizedBox.shrink(),
                ),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: () => _shiftWeek(7),
                ),
              ],
            ),
          ),
          Expanded(
            child: async.when(
              data: (summary) => RefreshIndicator(
                onRefresh: () async =>
                    ref.invalidate(weeklyAttendanceProvider(params)),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                  children: [
                    _summaryCard(context, summary),
                    const SizedBox(height: 16),
                    if (summary.entries.isEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 24),
                        child: Center(
                          child: Text('Aucun pointage cette semaine',
                              style: TextStyle(
                                  color: AppTheme.textSecondary(context))),
                        ),
                      )
                    else
                      ...summary.entries.map((e) => _entryTile(context, e, params)),
                  ],
                ),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Erreur : $e')),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddEntrySheet(context, params),
        icon: const Icon(Icons.add),
        label: const Text('Ajouter'),
      ),
    );
  }

  Widget _summaryCard(BuildContext context, WeeklyAttendanceSummary s) {
    final (bg, fg, label) = s.isOver
        ? (const Color(0xFFFEE2E2), const Color(0xFFB91C1C), 'Dépassement')
        : s.isUnder
            ? (const Color(0xFFFEF3C7), const Color(0xFF92400E), 'Sous le contrat')
            : (const Color(0xFFDCFCE7), const Color(0xFF166534), 'Conforme');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surface(context),
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 3)),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${s.workedHours.toStringAsFixed(1)} h travaillées',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: AppTheme.textPrimary(context))),
                Text('Contrat : ${s.contractedHours.toStringAsFixed(1)} h / semaine',
                    style: TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary(context))),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
            child: Text(
                '$label ${s.diffHours >= 0 ? '+' : ''}${s.diffHours.toStringAsFixed(1)}h',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
          ),
        ],
      ),
    );
  }

  Widget _entryTile(
      BuildContext context, AttendanceEntry e, WeeklyAttendanceParams params) {
    return Dismissible(
      key: ValueKey(e.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red.shade100,
        child: const Icon(Icons.delete_outline, color: Colors.red),
      ),
      onDismissed: (_) async {
        await ref.read(attendanceRepositoryProvider).deleteEntry(e.id);
        ref.invalidate(weeklyAttendanceProvider(params));
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surface(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(AttendanceType.label(e.type),
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary(context))),
                  Text(
                    DateFormat('EEE dd/MM', 'fr_FR').format(e.date) +
                        (e.startTime != null && e.endTime != null
                            ? ' · ${e.startTime}-${e.endTime}'
                            : ''),
                    style: TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary(context)),
                  ),
                ],
              ),
            ),
            Text('${(e.durationMinutes / 60).toStringAsFixed(1)} h',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: AppTheme.textPrimary(context))),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddEntrySheet(
      BuildContext context, WeeklyAttendanceParams params) async {
    String type = AttendanceType.jour;
    DateTime date = DateTime.now();
    final startController = TextEditingController(text: '08:00');
    final endController = TextEditingController(text: '17:00');
    final hoursController = TextEditingController(text: '7');
    final labelController = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.only(
              left: 16, right: 16, top: 16, bottom: MediaQuery.of(ctx).viewInsets.bottom + 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Nouveau pointage',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: type,
                decoration: const InputDecoration(
                    labelText: 'Type', border: OutlineInputBorder()),
                items: AttendanceType.values
                    .map((t) => DropdownMenuItem(
                        value: t, child: Text(AttendanceType.label(t))))
                    .toList(),
                onChanged: (v) => setSheetState(() => type = v ?? type),
              ),
              const SizedBox(height: 12),
              if (type == AttendanceType.heures) ...[
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: startController,
                        decoration: const InputDecoration(
                            labelText: 'Début (HH:MM)', border: OutlineInputBorder()),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: endController,
                        decoration: const InputDecoration(
                            labelText: 'Fin (HH:MM)', border: OutlineInputBorder()),
                      ),
                    ),
                  ],
                ),
              ] else ...[
                TextField(
                  controller: hoursController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Durée (heures)', border: OutlineInputBorder()),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: labelController,
                decoration: const InputDecoration(
                    labelText: 'Note (optionnel)', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  int minutes;
                  String? startTime;
                  String? endTime;
                  if (type == AttendanceType.heures) {
                    startTime = startController.text.trim();
                    endTime = endController.text.trim();
                    minutes = AttendanceEntry.durationFromTimes(startTime, endTime);
                  } else {
                    final hours =
                        double.tryParse(hoursController.text.replaceAll(',', '.')) ?? 0;
                    minutes = (hours * 60).round();
                  }
                  final entry = AttendanceEntry(
                    id: '',
                    userId: '',
                    workerId: params.worker.id,
                    type: type,
                    date: date,
                    startTime: startTime,
                    endTime: endTime,
                    durationMinutes: minutes,
                    label: labelController.text.trim().isEmpty
                        ? null
                        : labelController.text.trim(),
                    createdAt: DateTime.now(),
                  );
                  await ref.read(attendanceRepositoryProvider).addEntry(entry);
                  ref.invalidate(weeklyAttendanceProvider(params));
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                child: const Text('Ajouter'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
