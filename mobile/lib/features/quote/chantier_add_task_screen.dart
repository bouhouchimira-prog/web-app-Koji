import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';

class ChantierAddTaskScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;
  const ChantierAddTaskScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierAddTaskScreen> createState() => _ChantierAddTaskScreenState();
}

class _ChantierAddTaskScreenState extends ConsumerState<ChantierAddTaskScreen> {
  final _repository = ChantierRepository();
  static const _kDark = Color(0xFF0F172A);
  static const _kBg = Color(0xFFF5F0EB);
  static const _kBorder = Color(0xFFE2E8F0);

  bool _showForm = false;
  bool _isLoading = false;

  // Form state
  final _titleCtrl = TextEditingController();
  final _personCtrl = TextEditingController();
  final _noteCtrl = TextEditingController();
  DateTime? _selectedDate;
  String _lierA = 'Aucun';

  final List<String> _lierAOptions = [
    'Aucun',
    'Budget',
    'Devis',
    'Prochain RDV',
    'Documents',
  ];

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _personCtrl.dispose();
    _noteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final chantierId = widget.data['id'] as String?;
    
    // Fallback if no ID is provided
    if (chantierId == null) {
      return const Scaffold(body: Center(child: Text("ID Chantier manquant")));
    }

    final tasksAsync = ref.watch(chantierTasksProvider(chantierId));

    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            if (!_showForm)
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 16),
                child: GestureDetector(
                  onTap: () => setState(() => _showForm = true),
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
                          'Ajouter une tâche',
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
            Expanded(
              child: _showForm
                  ? _buildForm()
                  : tasksAsync.when(
                      loading: () => const Center(child: CircularProgressIndicator(color: _kDark)),
                      error: (err, stack) => Center(child: Text('Erreur: $err')),
                      data: (tasks) {
                        if (tasks.isEmpty) {
                          return _buildEmpty();
                        }
                        return _buildTaskList(tasks);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: _kBg,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () {
                if (_showForm) {
                  setState(() => _showForm = false);
                } else {
                  context.pop();
                }
              },
              child: const Icon(Icons.chevron_left_rounded,
                  color: _kDark, size: 30),
            ),
          ),
          const Text(
            'Ajouter tâche',
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

  // ── Empty state ──
  Widget _buildEmpty() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 38),
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
        child: const Center(
          child: Text(
            'Aucune tâche',
            style: TextStyle(
              fontSize: 15,
              color: Color(0xFF94A3B8),
            ),
          ),
        ),
      ),
    );
  }

  // ── Task list ──
  Widget _buildTaskList(List<Map<String, dynamic>> tasks) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
      itemCount: tasks.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _buildTaskTile(tasks[i]),
    );
  }

  Widget _buildTaskTile(Map<String, dynamic> task) {
    final bool isDone = task['is_done'] == true;
    final String title = task['label'] as String? ?? '';
    final String subtitle = task['note'] as String? ?? ''; // Simplified subtitle logic
    final chantierId = widget.data['id'] as String?;

    Future<void> toggle() async {
      try {
        await _repository.updateTaskStatus(task['id'], !isDone);
        if (chantierId != null) {
          ref.invalidate(chantierTasksProvider(chantierId));
        }
      } catch (e) {
        debugPrint('Error toggling task: $e');
      }
    }

    return Container(
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
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: toggle,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                // Circle checkbox — visual only; the whole row already toggles.
                AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isDone ? _kDark : Colors.white,
                    border: Border.all(
                      color: isDone ? _kDark : const Color(0xFFCBD5E1),
                      width: 1.8,
                    ),
                  ),
                  child: isDone
                      ? Icon(Icons.check_rounded,
                          size: 14,
                          color: Theme.of(context).colorScheme.surface)
                      : null,
                ),
                const SizedBox(width: 14),
                // Text
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _kDark,
                          decoration: isDone
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                        ),
                      ),
                      if (subtitle.isNotEmpty)
                        Text(
                          subtitle,
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF64748B),
                          ),
                        ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded,
                    color: Color(0xFF94A3B8), size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Add form ──
  Widget _buildForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Intitulé *
          _label('Intitulé', required: true),
          _field(
            controller: _titleCtrl,
            hint: 'Ex: Commander carrelage',
          ),
          const SizedBox(height: 20),

          // Date
          _label('Date'),
          GestureDetector(
            onTap: _pickDate,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _kBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _selectedDate != null
                        ? '${_selectedDate!.month.toString().padLeft(2, '0')}/${_selectedDate!.day.toString().padLeft(2, '0')}/${_selectedDate!.year}'
                        : '10/27/2023',
                    style: TextStyle(
                      fontSize: 14,
                      color: _selectedDate != null
                          ? _kDark
                          : const Color(0xFF94A3B8),
                    ),
                  ),
                  const Icon(Icons.calendar_today_outlined,
                      size: 20, color: Color(0xFF94A3B8)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Lier à
          _label('Lier à'),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _lierA,
                isExpanded: true,
                icon: const Icon(Icons.keyboard_arrow_down_rounded,
                    color: Color(0xFF94A3B8)),
                style: const TextStyle( fontSize: 14, color: _kDark),
                items: _lierAOptions
                    .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                    .toList(),
                onChanged: (v) => setState(() => _lierA = v ?? 'Aucun'),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Personne
          _label('Personne'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.person_outline_rounded,
                    size: 20, color: Color(0xFF94A3B8)),
                const SizedBox(width: 10),
                Expanded(
                  child: TextField(
                    controller: _personCtrl,
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      hintText: 'Sélectionner un contact',
                      hintStyle: TextStyle(
                          fontSize: 14,
                          color: Color(0xFF94A3B8)),
                    ),
                    style: const TextStyle( fontSize: 14, color: _kDark),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Note (optionnel)
          _label('Note (optionnel)'),
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _kBorder),
            ),
            child: TextField(
              controller: _noteCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                border: InputBorder.none,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                hintText: 'Ajouter des détails...',
                hintStyle: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF94A3B8)),
              ),
              style: const TextStyle( fontSize: 14, color: _kDark),
            ),
          ),
          const SizedBox(height: 32),

          // Enregistrer
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _saveTask,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kDark,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: _isLoading 
                ? SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      color: Theme.of(context).colorScheme.surface,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                'Enregistrer',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.surface,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: _kDark,
            ),
          ),
          if (required) ...[
            const SizedBox(width: 3),
            const Text(
              '*',
              style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFFEF4444),
                  fontWeight: FontWeight.bold),
            ),
          ],
        ],
      ),
    );
  }

  Widget _field(
      {required TextEditingController controller, required String hint}) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kBorder),
      ),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          hintText: hint,
          hintStyle: const TextStyle( fontSize: 14, color: Color(0xFF94A3B8)),
        ),
        style:
            const TextStyle( fontSize: 14, color: _kDark),
      ),
    );
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _saveTask() async {
    if (_titleCtrl.text.trim().isEmpty) return;

    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) return;

    setState(() => _isLoading = true);
    
    try {
      // NOTE: In the future, the chantier_tasks schema can be expanded 
      // to include columns like 'note', 'person', 'date', 'lierA'
      // For now, mapping label -> titleCtrl.text.trim()
      await _repository.addTask(chantierId, _titleCtrl.text.trim());
      ref.invalidate(chantierTasksProvider(chantierId));

      if (mounted) {
        setState(() {
          // Reset form
          _titleCtrl.clear();
          _personCtrl.clear();
          _noteCtrl.clear();
          _selectedDate = null;
          _lierA = 'Aucun';
          _showForm = false;
        });
      }
    } catch (e) {
      debugPrint('Error inserting task: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Erreur Supabase: $e', style: const TextStyle()),
            backgroundColor: const Color(0xFFEF4444),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
}
