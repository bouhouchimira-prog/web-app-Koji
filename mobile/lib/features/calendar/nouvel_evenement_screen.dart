import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'data/calendar_event_model.dart';
import 'data/calendar_repository.dart';

class NouvelEvenementScreen extends StatefulWidget {
  /// When provided, the form is pre-filled and saves via updateEvent (edit mode).
  final CalendarEvent? initialEvent;

  const NouvelEvenementScreen({super.key, this.initialEvent});

  @override
  State<NouvelEvenementScreen> createState() => _NouvelEvenementScreenState();
}

class _NouvelEvenementScreenState extends State<NouvelEvenementScreen> {
  static const _darkNavy = Color(0xFF0A1227);
  static const _bg = Color(0xFFF7F8FA);
  static const _blue = Color(0xFF2E65F3);

  final _repo = CalendarRepository();
  final _client = Supabase.instance.client;

  final _titleCtrl = TextEditingController();
  final _clientCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  DateTime _startDate = DateTime.now();
  TimeOfDay _startTime = const TimeOfDay(hour: 8, minute: 30);
  DateTime _endDate = DateTime.now();
  TimeOfDay _endTime = const TimeOfDay(hour: 17, minute: 0);

  String _eventType = 'Chantier'; // Chantier | Devis | Urgence | Maintenance
  List<Map<String, dynamic>> _workers = [];
  final List<String> _selectedWorkerIds = [];
  String? _chefWorkerId;
  bool _isSaving = false;

  static const _eventTypes = ['Chantier', 'Devis', 'Urgence', 'Maintenance'];
  static const _typeColors = {
    'Chantier': _blue,
    'Devis': Color(0xFFFF9800),
    'Urgence': Color(0xFFEF4444),
    'Maintenance': Color(0xFF10B981),
  };

  bool get _isEditing => widget.initialEvent != null;

  @override
  void initState() {
    super.initState();
    _fetchWorkers();
    _prefillFromEvent(widget.initialEvent);
  }

  void _prefillFromEvent(CalendarEvent? event) {
    if (event == null) return;
    _titleCtrl.text = event.title;
    _clientCtrl.text = event.clientName ?? '';
    _addressCtrl.text = event.address ?? '';
    if (_eventTypes.contains(event.eventType)) {
      _eventType = event.eventType;
    }
    _startDate = event.startAt;
    _startTime = TimeOfDay(hour: event.startAt.hour, minute: event.startAt.minute);
    _endDate = event.endAt;
    _endTime = TimeOfDay(hour: event.endAt.hour, minute: event.endAt.minute);
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _clientCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchWorkers() async {
    try {
      final userId = _client.auth.currentUser?.id;
      if (userId == null) return;
      final data = await _client
          .from('workers')
          .select('id, first_name, last_name, profession, profile_picture_url')
          .order('first_name');
      if (mounted) setState(() => _workers = List<Map<String, dynamic>>.from(data as List));
    } catch (_) {}
  }

  Future<void> _pickDate({required bool isStart}) async {
    final initial = isStart ? _startDate : _endDate;
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(primary: _darkNavy),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) {
        _startDate = picked;
        if (_endDate.isBefore(_startDate)) _endDate = _startDate;
      } else {
        _endDate = picked;
      }
    });
  }

  Future<void> _pickTime({required bool isStart}) async {
    final initial = isStart ? _startTime : _endTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
      builder: (ctx, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(primary: _darkNavy),
        ),
        child: child!,
      ),
    );
    if (picked == null) return;
    setState(() {
      if (isStart) { _startTime = picked; } else { _endTime = picked; }
    });
  }

  String _formatDate(DateTime d) {
    const months = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
        'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return '${d.day} ${months[d.month]}';
  }

  String _formatTime(TimeOfDay t) {
    final h = t.hour.toString().padLeft(2, '0');
    final m = t.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Veuillez saisir un titre")),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final startAt = DateTime(
        _startDate.year, _startDate.month, _startDate.day,
        _startTime.hour, _startTime.minute,
      );
      final endAt = DateTime(
        _endDate.year, _endDate.month, _endDate.day,
        _endTime.hour, _endTime.minute,
      );

      if (_isEditing) {
        // Update existing event
        await _repo.updateEvent(widget.initialEvent!.id, {
          'title': _titleCtrl.text.trim(),
          'event_type': _eventType,
          'client_name': _clientCtrl.text.trim().isEmpty ? null : _clientCtrl.text.trim(),
          'address': _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
          'start_at': startAt.toIso8601String(),
          'end_at': endAt.toIso8601String(),
        });
      } else {
        // Create new event
        final userId = _client.auth.currentUser!.id;
        final event = CalendarEvent(
          id: '',
          userId: userId,
          title: _titleCtrl.text.trim(),
          eventType: _eventType,
          clientName: _clientCtrl.text.trim().isEmpty ? null : _clientCtrl.text.trim(),
          address: _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
          startAt: startAt,
          endAt: endAt,
          status: 'En Cours',
          createdAt: DateTime.now(),
        );
        await _repo.createEvent(event, _selectedWorkerIds, chefWorkerId: _chefWorkerId);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditing ? 'Événement mis à jour !' : 'Événement enregistré !'),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  // ─── BUILD ─────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('Titre De L\'intervention'),
                    _buildTitleField(),
                    const SizedBox(height: 20),

                    _sectionLabel('Client'),
                    _buildClientField(),
                    const SizedBox(height: 20),

                    Row(
                      children: [
                        Expanded(child: _buildDateTimeBlock(isStart: true)),
                        const SizedBox(width: 14),
                        Expanded(child: _buildDateTimeBlock(isStart: false)),
                      ],
                    ),
                    const SizedBox(height: 20),

                    _sectionLabel('Lieu Du Chantier'),
                    _buildAddressField(),
                    const SizedBox(height: 20),

                    _sectionLabel('Affecter Des Ouvriers'),
                    _buildWorkersRow(),
                    const SizedBox(height: 24),

                    _sectionLabel('Type D\'événement'),
                    _buildTypeSelector(),
                    const SizedBox(height: 32),

                    _buildSaveButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: const Icon(Icons.chevron_left, size: 28, color: _darkNavy),
          ),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Nouvel Evénement',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _darkNavy,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: _darkNavy,
        ),
      ),
    );
  }

  Widget _buildTitleField() {
    return _inputBox(
      child: TextField(
        controller: _titleCtrl,
        style: const TextStyle(fontSize: 14, color: _darkNavy),
        decoration: const InputDecoration(
          hintText: 'Ex: Pose De Menuiseries',
          hintStyle: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
          border: InputBorder.none,
          isDense: true,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }

  Widget _buildClientField() {
    return _inputBox(
      child: Row(
        children: [
          const Icon(Icons.search, color: Color(0xFFCBD5E1), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _clientCtrl,
              style: const TextStyle(fontSize: 14, color: _darkNavy),
              decoration: const InputDecoration(
                hintText: 'Rechercher Un Client...',
                hintStyle: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDateTimeBlock({required bool isStart}) {
    final label = isStart ? 'Début' : 'Fin';
    final date = isStart ? _startDate : _endDate;
    final time = isStart ? _startTime : _endTime;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w700, color: _darkNavy)),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () async {
            await _pickDate(isStart: isStart);
            await _pickTime(isStart: isStart);
          },
          child: _inputBox(
            child: Row(
              children: [
                const Icon(Icons.calendar_month_outlined,
                    size: 18, color: Color(0xFF64748B)),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _formatDate(date),
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: _darkNavy),
                    ),
                    Text(
                      _formatTime(time),
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF94A3B8)),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAddressField() {
    return _inputBox(
      child: Row(
        children: [
          const Icon(Icons.location_on_outlined,
              color: Color(0xFFCBD5E1), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _addressCtrl,
              style: const TextStyle(fontSize: 14, color: _darkNavy),
              decoration: const InputDecoration(
                hintText: 'Adresse Du Chantier...',
                hintStyle: TextStyle(color: Color(0xFFCBD5E1), fontSize: 14),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWorkersRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          ..._selectedWorkerIds.map((wid) {
            final w = _workers.firstWhere(
              (x) => x['id'] == wid,
              orElse: () => {'id': wid, 'first_name': '?', 'last_name': ''},
            );
            final isChef = wid == _chefWorkerId;
            final name = '${w['first_name']} ${w['last_name']}'.trim();
            return GestureDetector(
              onLongPress: () => setState(() {
                _selectedWorkerIds.remove(wid);
                if (_chefWorkerId == wid) _chefWorkerId = null;
              }),
              child: Container(
                margin: const EdgeInsets.only(right: 14),
                child: Column(
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2E8F0),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isChef ? _darkNavy : Colors.transparent,
                              width: 2.5,
                            ),
                          ),
                          child: w['profile_picture_url'] != null
                              ? ClipOval(
                                  child: Image.network(
                                    w['profile_picture_url'],
                                    fit: BoxFit.cover,
                                  ),
                                )
                              : Icon(Icons.person,
                                  size: 30, color: Colors.blueGrey[300]),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      isChef ? '$name (Chef)' : name.split(' ').first,
                      style: const TextStyle(fontSize: 11, color: _darkNavy),
                    ),
                  ],
                ),
              ),
            );
          }),
          // Add button
          GestureDetector(
            onTap: _showWorkerPicker,
            child: Column(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF94A3B8),
                      width: 1.5,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: const Icon(Icons.add, color: Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 6),
                const Text('Ajouter',
                    style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showWorkerPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => StatefulBuilder(builder: (ctx, setModal) {
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Text('Choisir un ouvrier',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: _darkNavy)),
            const SizedBox(height: 12),
            Flexible(
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _workers.length,
                itemBuilder: (_, i) {
                  final w = _workers[i];
                  final wid = w['id'] as String;
                  final selected = _selectedWorkerIds.contains(wid);
                  final isChef = _chefWorkerId == wid;
                  return ListTile(
                    leading: Container(
                      width: 42, height: 42,
                      decoration: const BoxDecoration(
                        color: Color(0xFFE2E8F0),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.person, color: Colors.blueGrey[300]),
                    ),
                    title: Text(
                      '${w['first_name']} ${w['last_name']}',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(w['profession'] ?? '',
                        style: const TextStyle(fontSize: 12)),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (selected)
                          GestureDetector(
                            onTap: () {
                              setModal(() {
                                _chefWorkerId = isChef ? null : wid;
                              });
                              setState(() {});
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: isChef
                                    ? _darkNavy
                                    : const Color(0xFFE2E8F0),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                'Chef',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: isChef
                                      ? Colors.white
                                      : _darkNavy,
                                ),
                              ),
                            ),
                          ),
                        const SizedBox(width: 8),
                        Checkbox(
                          value: selected,
                          activeColor: _darkNavy,
                          onChanged: (v) {
                            setModal(() {
                              if (v == true) {
                                _selectedWorkerIds.add(wid);
                              } else {
                                _selectedWorkerIds.remove(wid);
                                if (_chefWorkerId == wid) _chefWorkerId = null;
                              }
                            });
                            setState(() {});
                          },
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _darkNavy,
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text('Confirmer',
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.surface, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _buildTypeSelector() {
    return Row(
      children: _eventTypes.map((type) {
        final selected = _eventType == type;
        final color = _typeColors[type]!;
        return GestureDetector(
          onTap: () => setState(() => _eventType = type),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            margin: const EdgeInsets.only(right: 10),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: selected ? Colors.white : Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: selected ? color : const Color(0xFFE2E8F0),
                width: selected ? 2 : 1,
              ),
              boxShadow: selected
                  ? [
                      BoxShadow(
                        color: color.withValues(alpha: 0.15),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      )
                    ]
                  : [],
            ),
            child: Column(
              children: [
                Container(
                  width: 12, height: 12,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(height: 6),
                Text(
                  type,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: selected ? color : const Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: _darkNavy,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          elevation: 0,
        ),
        onPressed: _isSaving ? null : _save,
        child: _isSaving
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    color: Theme.of(context).colorScheme.surface, strokeWidth: 2.5),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Enregistrer au planning',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.surface,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.arrow_forward, color: Theme.of(context).colorScheme.surface, size: 20),
                ],
              ),
      ),
    );
  }

  Widget _inputBox({required Widget child}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE8EDF2)),
      ),
      child: child,
    );
  }
}
