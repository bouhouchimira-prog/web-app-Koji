import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/synchronization/data/rdv_repository.dart';

class ChantierRdvScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const ChantierRdvScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierRdvScreen> createState() => _ChantierRdvScreenState();
}

class _ChantierRdvScreenState extends ConsumerState<ChantierRdvScreen> {
  static const _kDark = Color(0xFF0F172A);
  static const _kBlue = Color(0xFF1D74FF);

  List<Map<String, dynamic>> _rdvList = [];
  bool _loading = true;

  String? get _chantierId => widget.data['id'] as String?;

  @override
  void initState() {
    super.initState();
    _loadRdvs();
  }

  Future<void> _loadRdvs() async {
    final user = ref.read(authRepositoryProvider).currentUser;
    if (user == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final rdvs = await ref.read(rdvRepositoryProvider).getRdvs(
            userId: user.id,
            chantierId: _chantierId,
          );
      if (mounted) setState(() { _rdvList = rdvs; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteRdv(String rdvId, int index) async {
    try {
      await ref.read(rdvRepositoryProvider).deleteRdv(rdvId);
      if (mounted) setState(() => _rdvList.removeAt(index));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur suppression : ${e.toString()}')),
        );
      }
    }
  }

  void _addRdv() {
    final titleCtrl = TextEditingController();
    final personCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    DateTime selectedDate = DateTime.now();
    TimeOfDay selectedTime = const TimeOfDay(hour: 9, minute: 0);

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDs) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text(
            'Nouveau rendez-vous',
            style: TextStyle(fontWeight: FontWeight.bold, color: _kDark),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title
                _dialogField(titleCtrl, 'Ex : Réunion de chantier',
                    Icons.title_outlined, autofocus: true),
                const SizedBox(height: 10),
                // Person
                _dialogField(personCtrl, 'Ex : M. Durand', Icons.person_outline),
                const SizedBox(height: 10),
                // Note
                _dialogField(noteCtrl, 'Note (optionnel)', Icons.notes_outlined,
                    maxLines: 2),
                const SizedBox(height: 12),
                // Date picker
                GestureDetector(
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime(2030),
                    );
                    if (picked != null) setDs(() => selectedDate = picked);
                  },
                  child: _pickerTile(
                    icon: Icons.calendar_today_outlined,
                    label:
                        '${selectedDate.day.toString().padLeft(2, '0')} / ${selectedDate.month.toString().padLeft(2, '0')} / ${selectedDate.year}',
                  ),
                ),
                const SizedBox(height: 10),
                // Time picker
                GestureDetector(
                  onTap: () async {
                    final picked = await showTimePicker(
                      context: ctx,
                      initialTime: selectedTime,
                    );
                    if (picked != null) setDs(() => selectedTime = picked);
                  },
                  child: _pickerTile(
                    icon: Icons.access_time_outlined,
                    label:
                        '${selectedTime.hour.toString().padLeft(2, '0')}:${selectedTime.minute.toString().padLeft(2, '0')}',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler',
                  style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: () async {
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;

                Navigator.pop(ctx);

                final user = ref.read(authRepositoryProvider).currentUser;
                if (user == null) return;

                final scheduledAt = DateTime(
                  selectedDate.year,
                  selectedDate.month,
                  selectedDate.day,
                  selectedTime.hour,
                  selectedTime.minute,
                );

                try {
                  final saved =
                      await ref.read(rdvRepositoryProvider).createRdv(
                            userId: user.id,
                            title: title,
                            scheduledAt: scheduledAt,
                            duration: '1h',
                            note: noteCtrl.text.trim(),
                            workerName: personCtrl.text.trim(),
                            chantierId: _chantierId,
                          );
                  if (mounted) {
                    setState(() => _rdvList.add(saved));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('RDV ajouté avec succès'),
                        backgroundColor: Color(0xFF10B981),
                      ),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Erreur : ${e.toString()}')),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: _kDark,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
                elevation: 0,
              ),
              child: Text('Ajouter',
                  style: TextStyle(color: Theme.of(context).colorScheme.surface)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dialogField(
    TextEditingController ctrl,
    String hint,
    IconData icon, {
    bool autofocus = false,
    int maxLines = 1,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: ctrl,
        autofocus: autofocus,
        maxLines: maxLines,
        style: const TextStyle(fontSize: 14, color: _kDark),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 14),
          prefixIcon: Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        ),
      ),
    );
  }

  Widget _pickerTile({required IconData icon, required String label}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF64748B)),
          const SizedBox(width: 10),
          Text(label,
              style: const TextStyle(fontSize: 14, color: _kDark)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            // Add button
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 16),
              child: GestureDetector(
                onTap: _addRdv,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 14),
                  decoration: BoxDecoration(
                    color: _kDark,
                    borderRadius: BorderRadius.circular(32),
                    boxShadow: [
                      BoxShadow(
                        color: _kDark.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 22),
                      SizedBox(width: 8),
                      Text(
                        'Ajouter un rendez-vous',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.surface,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            // List
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : RefreshIndicator(
                      onRefresh: _loadRdvs,
                      child: _rdvList.isEmpty
                          ? _buildEmpty()
                          : _buildList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F0EB),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () =>
                  Navigator.canPop(context) ? context.pop() : context.go('/home'),
              child: const Icon(Icons.chevron_left_rounded,
                  color: _kDark, size: 30),
            ),
          ),
          const Text(
            'Prochain rendez-vous',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmpty() {
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 48),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                Icon(Icons.event_outlined,
                    size: 48, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                const Text(
                  'Aucun rendez-vous planifié',
                  style: TextStyle(fontSize: 15, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Appuyez sur + pour en ajouter un',
                  style: TextStyle(fontSize: 13, color: Color(0xFFCBD5E1)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildList() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
      itemCount: _rdvList.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, i) {
        final rdv = _rdvList[i];
        final rdvId = rdv['id'] as String?;
        return Dismissible(
          key: Key('rdv_${rdvId ?? i}'),
          direction: rdvId != null
              ? DismissDirection.endToStart
              : DismissDirection.none,
          background: Container(
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: 20),
            decoration: BoxDecoration(
              color: Colors.red.shade400,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(Icons.delete_outline, color: Theme.of(context).colorScheme.surface),
          ),
          confirmDismiss: (_) async {
            return await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                title: const Text('Supprimer ce RDV ?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Annuler'),
                  ),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.red),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: Text('Supprimer',
                        style: TextStyle(color: Theme.of(context).colorScheme.surface)),
                  ),
                ],
              ),
            );
          },
          onDismissed: (_) {
            if (rdvId != null) _deleteRdv(rdvId, i);
          },
          child: _buildRdvTile(rdv),
        );
      },
    );
  }

  Widget _buildRdvTile(Map<String, dynamic> rdv) {
    final scheduledAtRaw = rdv['scheduled_at'] as String?;
    final scheduledAt = scheduledAtRaw != null
        ? DateTime.tryParse(scheduledAtRaw)
        : null;

    final monthNames = [
      '', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
      'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
    ];

    final day = scheduledAt != null ? '${scheduledAt.day}' : '—';
    final month = scheduledAt != null ? monthNames[scheduledAt.month] : '—';
    final time = scheduledAt != null
        ? '${scheduledAt.hour.toString().padLeft(2, '0')}:${scheduledAt.minute.toString().padLeft(2, '0')}'
        : '—';
    final title = (rdv['title'] as String?) ?? 'Rendez-vous';
    final person = (rdv['worker_name'] as String?) ?? '';
    final duration = (rdv['duration'] as String?) ?? '';

    final isToday = scheduledAt != null &&
        scheduledAt.year == DateTime.now().year &&
        scheduledAt.month == DateTime.now().month &&
        scheduledAt.day == DateTime.now().day;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: isToday
            ? Border.all(color: _kBlue.withValues(alpha: 0.4), width: 1.5)
            : null,
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Date column
          SizedBox(
            width: 58,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$day $month',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: isToday ? _kBlue : _kDark,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  time,
                  style: const TextStyle(
                      fontSize: 13, color: Color(0xFF64748B)),
                ),
                if (duration.isNotEmpty)
                  Text(
                    duration,
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
              ],
            ),
          ),
          // Divider
          Container(
            width: 1,
            height: 44,
            margin: const EdgeInsets.symmetric(horizontal: 14),
            color: const Color(0xFFE2E8F0),
          ),
          // Info column
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _kDark,
                        ),
                      ),
                    ),
                    if (isToday)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _kBlue.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          "Aujourd'hui",
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: _kBlue,
                          ),
                        ),
                      ),
                  ],
                ),
                if (person.isNotEmpty) ...[
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(Icons.person_outline_rounded,
                          size: 14, color: Color(0xFF64748B)),
                      const SizedBox(width: 4),
                      Text(
                        person,
                        style: const TextStyle(
                            fontSize: 13, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
