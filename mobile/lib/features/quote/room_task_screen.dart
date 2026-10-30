
import 'dart:io';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/core/theme.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/profession_tasks_data.dart'; // Still using for categories structure
import 'package:koji/features/quote/models/quote_models.dart';
import 'package:image_picker/image_picker.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/features/quote/repository/product_repository.dart';
import 'package:koji/features/fournitures/fournitures_screen.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';
import 'package:koji/features/quote/model/expense_item.dart';

// NEW IMPORTS
import 'package:koji/features/quote/repository/task_repository.dart';
import 'package:koji/features/quote/model/custom_task.dart';
import 'package:koji/features/quote/create_task_screen.dart';
import 'package:koji/features/quote/ouvrage_library_screen.dart';
import 'package:koji/features/quote/model/library_ouvrage.dart';
import 'package:koji/features/pricing/models/pricing_models.dart';

class RoomTaskScreen extends ConsumerStatefulWidget {
  final List<String> selectedRoomIds;
  final List<String> images;

  const RoomTaskScreen({
    super.key,
    this.selectedRoomIds = const [],
    this.images = const [],
  });

  @override
  ConsumerState<RoomTaskScreen> createState() => _RoomTaskScreenState();
}

class _RoomTaskScreenState extends ConsumerState<RoomTaskScreen> {
  // --- UI State ---
  int _selectedRoomTab = 0;
  late List<String> _roomIds;
  
  // Trade Tabs
  List<String> _trades = [];
  String _selectedTrade = '';
  bool _isLoadingProfessions = true;
  
  // Custom Tasks
  List<CustomTask> _customTasks = [];
  
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = ''; // updated by _searchController listener

  // Persistent text controllers for the numeric inputs (quantité, forfait,
  // dynamic fields). Creating a fresh controller inside build() — as the old
  // code did with TextEditingController.fromValue — resets the cursor and value
  // on every keystroke, so the field looked "stuck" (e.g. could not clear 1.0).
  // We keep one controller per logical key and only seed its text once.
  final Map<String, TextEditingController> _fieldControllers = {};

  /// Force a field's text to [value] from outside the box (e.g. the "Adapter"
  /// dialog seeding the quantity). Used after a programmatic change so the box
  /// reflects it without recreating the controller.
  void _setFieldText(String key, String value) {
    final ctrl = _fieldControllers[key];
    if (ctrl != null && ctrl.text != value) {
      ctrl.value = TextEditingValue(
        text: value,
        selection: TextSelection.collapsed(offset: value.length),
      );
    }
  }

  // Logic State
  final Map<String, RoomTaskState> _taskStates = {};
  
  // Pricing State
  final Map<String, RealityFactors> _roomContexts = {};

  @override
  void initState() {
    super.initState();
    _roomIds = widget.selectedRoomIds.isNotEmpty
        ? widget.selectedRoomIds
        : ['salon', 'cuisine', 'chambre'];

    _searchController.addListener(() {
      setState(() => _searchQuery = _searchController.text.trim().toLowerCase());
    });

    // Edit-mode rehydration: when the user re-enters this screen via
    // "modifier un devis", quoteCreationProvider.roomTasks holds the saved
    // state. Replay it into _taskStates so existing task selections (with
    // their inputs, fournitures, hours) show up checked and editable.
    _restoreTaskStatesFromProvider();

    _loadUserProfessions();
  }

  @override
  void dispose() {
    _searchController.dispose();
    for (final c in _fieldControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _restoreTaskStatesFromProvider() {
    final saved = ref.read(quoteCreationProvider).roomTasks;
    if (saved.isEmpty) return;

    saved.forEach((roomId, perRoomRaw) {
      if (perRoomRaw is! Map) return;
      final perRoom = Map<String, dynamic>.from(perRoomRaw);
      perRoom.forEach((taskId, dRaw) {
        if (dRaw is! Map) return;
        final d = Map<String, dynamic>.from(dRaw);
        final key = _getKey(roomId, taskId);

        final inputs = (d['inputs'] is Map)
            ? Map<String, dynamic>.from(d['inputs'] as Map)
            : <String, dynamic>{};
        final selectedProducts = (d['selectedProducts'] is Map)
            ? Map<String, double>.from(
                (d['selectedProducts'] as Map).map(
                  (k, v) => MapEntry(k.toString(), (v as num).toDouble()),
                ),
              )
            : <String, double>{};
        final selectedFournitures = (d['selectedFournitures'] is Map)
            ? Map<String, Map<String, dynamic>>.from(
                (d['selectedFournitures'] as Map).map(
                  (k, v) => MapEntry(
                    k.toString(),
                    Map<String, dynamic>.from(v as Map),
                  ),
                ),
              )
            : <String, Map<String, dynamic>>{};

        // Make sure quantity is reachable from inputs['surface']/['quantity']
        // — _onContinue at line 886 reads inputs['surface'] for quantity.
        final qty = (d['quantity'] as num?)?.toDouble();
        if (qty != null) {
          inputs.putIfAbsent('quantity', () => qty);
          inputs.putIfAbsent('surface', () => qty);
        }

        _taskStates[key] = RoomTaskState(
          taskId: taskId.toString(),
          roomId: roomId.toString(),
          label: (d['label'] as String?) ?? '',
          isExpanded: false,
          inputs: inputs,
          note: d['note'] as String?,
          photoPaths: (d['photoPaths'] as List?)?.cast<String>(),
          selectedProducts: selectedProducts,
          selectedFournitures: selectedFournitures,
          hours: (d['hours'] as num?)?.toDouble() ?? 0.0,
          forfaitEnabled: d['forfaitEnabled'] as bool? ?? false,
          forfaitPrice: (d['forfaitPrice'] as num?)?.toDouble() ?? 0.0,
          hideFournitures: d['hideFournitures'] as bool? ?? false,
        );

        final cond = (d['conditionCoeff'] as num?)?.toDouble();
        if (cond != null && cond != 1.0) {
          _roomContexts[roomId.toString()] =
              RealityFactors(condition: cond);
        }
      });
    });
  }

  Future<void> _loadUserProfessions() async {
    try {
      final user = ref.read(authRepositoryProvider).currentUser;
      
      // Load Custom Tasks concurrently
      _loadCustomTasks();

      if (user != null) {
        final userData = await ref.read(userRepositoryProvider).getUser(user.id);
        
        // Handle 'profession' which might be List<dynamic> (from recent change) or String (legacy)
        List<String> userTrades = [];
        final rawProf = userData?['profession'];
        
        if (rawProf is List) {
          userTrades = rawProf.map((e) => e.toString()).toList();
        } else if (rawProf is String) {
           userTrades = [rawProf];
        }

        // Split any comma-separated values into individual trades
        // e.g. ['Plombier,Peintre'] → ['Plombier', 'Peintre']
        userTrades = userTrades
            .expand((t) => t.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty))
            .toList();
        
        if (userTrades.isEmpty) {
           userTrades = ['Peintre']; // Default fallback
        }
        
        if (mounted) {
          setState(() {
            _trades = userTrades;
            _selectedTrade = userTrades.first;
            _isLoadingProfessions = false;
          });
          _fetchCustomTasksForTrade(_selectedTrade);
        }
      } else {
         // Not logged in?
         if (mounted) setState(() { _trades = ['Peintre']; _selectedTrade = 'Peintre'; _isLoadingProfessions = false; });
      }
    } catch (e) {
      debugPrint('Error loading professions: $e');
      if (mounted) setState(() { _trades = ['Peintre']; _selectedTrade = 'Peintre'; _isLoadingProfessions = false; });
    }
  }

  Future<void> _loadCustomTasks() async {
      try {
        // Find current profession context if possible? Or fetch all.
        // For now, let's just fetch all tasks for this user (RLS handles filtering by user)
        // TaskRepository.getTasks filters by profession. Let's pass the selected trade later or just empty string if we want all?
        // Actually, let's fetch based on _selectedTrade when it changes. 
        // But for initState, we assume the first trade.
        // Let's create a separate method `_refetchCustomTasks` to call when tab changes.
      } catch(e) { debugPrint('err custom tasks: $e'); }
  }
  
  // Predefined ajustement reasons → coefficient (surcoût en %). The client
  // asked for a quick way to apply common site difficulties. The user can also
  // type a custom reason; either way the coefficient drives the price.
  static const List<(String, double)> _adjustmentReasons = [
    ('Mur fissuré', 1.15),
    ('Dernier étage', 1.10),
    ('Accès difficile', 1.20),
    ('Support dégradé', 1.15),
    ('Intervention complexe', 1.25),
  ];

  /// Prompts the user for an ajustement (coefficient/surcoût) AND a réduction
  /// to apply for THIS chantier, plus the quantity. The two adjustments are
  /// combinable (ajustement then réduction). Returns null if cancelled.
  /// Tuple = (coefficient, réduction %, quantité, raison ajustement).
  Future<(double, double, double, String)?> _askCoefficientReduction(
      LibraryOuvrage o) {
    final coeffCtrl = TextEditingController(text: _formatNum(o.coefficient));
    final reducCtrl = TextEditingController(text: _formatNum(o.reduction));
    final qtyCtrl = TextEditingController(text: '1');
    final reasonCtrl = TextEditingController();

    double parse(String s) =>
        double.tryParse(s.trim().replaceAll(',', '.')) ?? 0;

    return showDialog<(double, double, double, String)>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSt) {
            final coeff = parse(coeffCtrl.text);
            final reduc = parse(reducCtrl.text);
            final qty = parse(qtyCtrl.text);
            // Ajustement applied first, then réduction — both stack.
            final unit = o.coutMoU * coeff * (1 - (reduc / 100.0));
            final preview = unit * (qty > 0 ? qty : 1);
            final surchargePct = ((coeff - 1) * 100);

            return AlertDialog(
              title: const Text('Adapter pour ce chantier'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${o.code} — ${o.designation}',
                      style: const TextStyle(
                          fontSize: 13, color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 16),

                    // ── Quantité ──
                    const Text('Quantité',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: qtyCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setSt(() {}),
                      decoration: InputDecoration(
                        hintText: '1',
                        isDense: true,
                        suffixText: o.unite,
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ── Ajustement de prix (coefficient / surcoût) ──
                    Row(
                      children: [
                        const Text('Ajustement de prix',
                            style: TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w600)),
                        const Spacer(),
                        if (surchargePct.abs() > 0.01)
                          Text(
                            '${surchargePct > 0 ? '+' : ''}${surchargePct.toStringAsFixed(0)} %',
                            style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFFB45309)),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    // Predefined reasons as chips.
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _adjustmentReasons.map((r) {
                        final selected = reasonCtrl.text == r.$1;
                        return GestureDetector(
                          onTap: () => setSt(() {
                            reasonCtrl.text = r.$1;
                            coeffCtrl.text = _formatNum(r.$2);
                          }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: selected
                                  ? const Color(0xFFFEF3C7)
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: selected
                                    ? const Color(0xFFF59E0B)
                                    : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Text(
                              '${r.$1} (+${((r.$2 - 1) * 100).toStringAsFixed(0)}%)',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: selected
                                    ? const Color(0xFFB45309)
                                    : const Color(0xFF475569),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    // Custom reason (free text).
                    TextField(
                      controller: reasonCtrl,
                      onChanged: (_) => setSt(() {}),
                      decoration: const InputDecoration(
                        hintText: 'Raison personnalisée (optionnel)',
                        isDense: true,
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Text('Coefficient',
                            style: TextStyle(
                                fontSize: 12, color: Color(0xFF64748B))),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: coeffCtrl,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            onChanged: (_) => setSt(() {}),
                            decoration: const InputDecoration(
                              hintText: '1.00',
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ── Réduction (remise %) — combinable avec l'ajustement ──
                    const Text('Réduction (%)',
                        style: TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    TextField(
                      controller: reducCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setSt(() {}),
                      decoration: const InputDecoration(
                        hintText: '0',
                        isDense: true,
                        suffixText: '%',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 14),

                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Prix MO/u : ${unit.toStringAsFixed(2)} €  '
                            '(base ${o.coutMoU.toStringAsFixed(2)} €)',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF047857),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Total MO : ${preview.toStringAsFixed(2)} €',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF047857),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Annuler'),
                ),
                ElevatedButton(
                  // Return both adjustments + qty + reason; they combine.
                  onPressed: () => Navigator.pop(
                    ctx,
                    (
                      parse(coeffCtrl.text),
                      parse(reducCtrl.text),
                      parse(qtyCtrl.text),
                      reasonCtrl.text.trim(),
                    ),
                  ),
                  child: const Text('Ajouter'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  String _formatNum(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  Future<void> _openLibraryPicker() async {
    final picked = await Navigator.push<LibraryOuvrage>(
      context,
      MaterialPageRoute(
        builder: (_) => const OuvrageLibraryScreen(pickMode: true),
      ),
    );
    if (picked == null || !mounted) return;

    // Ask the user to confirm / override coefficient and réduction for THIS
    // chantier — they change from one chantier to another even though the
    // library defaults stay the same.
    final overrides = await _askCoefficientReduction(picked);
    if (overrides == null || !mounted) return;

    final coeff = overrides.$1;
    final reduc = overrides.$2;
    final qtyOverride = overrides.$3;
    final adjustReason = overrides.$4;
    final effectiveTemps =
        picked.tempsHU * coeff * (1 - (reduc / 100.0));

    try {
      final professionForTask = picked.famille?.trim().isNotEmpty == true
          ? picked.famille!.trim()
          : (_selectedTrade.isNotEmpty ? _selectedTrade : 'Autres');

      final created = await ref.read(taskRepositoryProvider).createTask(
            title: picked.designation,
            description: picked.commentaire,
            profession: professionForTask,
            code: picked.code,
            famille: picked.famille,
            unite: picked.unite,
            tempsHU: effectiveTemps,
            typePoste: 'POSTE',
          );

      if (!mounted) return;
      // Switch the trade tab so the new task is visible right away.
      if (_trades.contains(professionForTask) &&
          _selectedTrade != professionForTask) {
        setState(() => _selectedTrade = professionForTask);
      }
      await _fetchCustomTasksForTrade(_selectedTrade);
      if (!mounted) return;

      // Auto-select it for the current room with the library's temps.
      final currentRoom = _roomIds[_selectedRoomTab];
      _toggleTaskSelection(currentRoom, created.id, created.title, true);
      final key = _getKey(currentRoom, created.id);
      final state = _taskStates[key];
      if (state != null) {
        setState(() {
          state.hours = effectiveTemps;
          // Quantity entered in the "Adapter" dialog seeds the line; it stays
          // editable afterwards in the recap. Push it into the persistent
          // quantity controller too so the box shows the new value.
          if (qtyOverride > 0) {
            state.inputs['quantity'] = qtyOverride;
            state.inputs['surface'] = qtyOverride;
            // The visible "Quantité" field has id 'surface' (see quote_helpers).
            _setFieldText('$currentRoom|${created.id}|surface',
                _formatNum(qtyOverride));
          }
          // Record the price-adjustment reason as the line note so it surfaces
          // on the ouvrage (e.g. "Mur fissuré").
          if (adjustReason.isNotEmpty) {
            final existing = state.note?.trim() ?? '';
            state.note = existing.isEmpty
                ? 'Ajustement : $adjustReason'
                : '$existing — Ajustement : $adjustReason';
          }
        });
      }

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Ouvrage "${picked.code}" ajouté au chantier'),
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur ajout ouvrage: $e')),
      );
    }
  }

  // Call this when trade changes or initially
  Future<void> _fetchCustomTasksForTrade(String trade) async {
    try {
       final tasks = await ref.read(taskRepositoryProvider).getTasks(trade);
       if (mounted) setState(() => _customTasks = tasks);
    } catch (e) {
      debugPrint('Error load custom tasks: $e');
    }
  }

  String _getRoomLabel(String id) {
    if(id == 'salle_de_bain') return 'Sdb';
    return id[0].toUpperCase() + id.substring(1);
  }
  
  IconData _getRoomIcon(String id) {
     if (id.contains('salon')) return Icons.weekend_outlined;
     if (id.contains('cuisine')) return Icons.soup_kitchen_outlined;
     if (id.contains('chambre')) return Icons.bed_outlined;
     if (id.contains('bain')) return Icons.bathtub_outlined;
     return Icons.room_preferences_outlined;
  }

  // --- Logic Helpers ---

  String _getKey(String roomId, String taskId) => '${roomId}_$taskId';

  void _toggleTaskSelection(String roomId, String taskId, String label, bool value) {
    final key = _getKey(roomId, taskId);
    
    setState(() {
      if (!value) {
        if (_taskStates.containsKey(key)) {
          _taskStates.remove(key);
        }
      } else {
        // Selecting
        if (!_taskStates.containsKey(key)) {
           // Initialize state
           final newState = RoomTaskState(taskId: taskId, roomId: roomId, label: label, isExpanded: true);
           
           // Check if Standard Task inputs need init
           for(var field in getFieldsForTask(taskId)) {
             if(field.defaultValue != null) {
               newState.inputs[field.id] = field.defaultValue;
             }
           }
           
           // Check if Custom Task defaults need init
           try {
             final custom = _customTasks.firstWhere((t) => t.id == taskId, orElse: () => CustomTask(id: '', title: '', profession: ''));
             if (custom.id.isNotEmpty) {
               if (custom.description != null) newState.note = custom.description!;
               // Add images (URLs)
               newState.photoPaths.addAll(custom.imageUrls);
             }
           } catch(e) {/* ignore */}

           _taskStates[key] = newState;
           // Price adjustment is no longer prompted globally per room on
           // selection (client request). It is set per ouvrage when added from
           // the library. The room coefficient stays at its neutral default.
        } else {
          // Just expand
          _taskStates[key]!.isExpanded = true;
        }
      }
    });
  }
  
  /// Select/deselect a single task without toggling expansion — used by the
  /// per-famille "Tout sélectionner" action so the list doesn't explode open.
  void _setTaskSelected(String roomId, TaskItem item, bool selected) {
    final key = _getKey(roomId, item.id);
    if (!selected) {
      _taskStates.remove(key);
      return;
    }
    if (_taskStates.containsKey(key)) return;

    final newState = RoomTaskState(
      taskId: item.id,
      roomId: roomId,
      label: item.label,
      isExpanded: false,
    );
    for (var field in getFieldsForTask(item.id)) {
      if (field.defaultValue != null) {
        newState.inputs[field.id] = field.defaultValue;
      }
    }
    // Seed labour temps from the KOJI banque de temps so the line prices
    // immediately instead of starting at 0 h/u.
    if (item.tempsHU != null) newState.hours = item.tempsHU!;
    _taskStates[key] = newState;
  }

  /// "Tout sélectionner" for a famille section: (de)selects every ouvrage of
  /// the section AND their sous-ouvrages for the current room.
  void _toggleCategorySelection(
      TaskCategory category, String roomId, bool selected) {
    setState(() {
      for (final t in category.tasks) {
        _setTaskSelected(roomId, t, selected);
        for (final sub in t.subTasks) {
          _setTaskSelected(roomId, sub, selected);
        }
      }
    });
  }

  bool _isCategoryFullySelected(TaskCategory category, String roomId) {
    final all = <TaskItem>[
      for (final t in category.tasks) ...[t, ...t.subTasks],
    ];
    return all.isNotEmpty &&
        all.every((t) => _taskStates.containsKey(_getKey(roomId, t.id)));
  }

  /// Toggle controlling whether this ouvrage's fournitures are itemised in the
  /// devis / facture sent to the client. When hidden, the entrepreneur keeps the
  /// internal detail but the client only sees the line total.
  Widget _buildHideFournituresToggle(RoomTaskState state) {
    final hidden = state.hideFournitures;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: hidden ? const Color(0xFFFEF3C7) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: hidden ? const Color(0xFFF59E0B) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: [
          Icon(hidden ? Icons.visibility_off_outlined : Icons.visibility_outlined,
              size: 18,
              color: hidden ? const Color(0xFFB45309) : const Color(0xFF64748B)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              hidden
                  ? 'Fournitures masquées au client'
                  : 'Afficher les fournitures au client',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: hidden
                      ? const Color(0xFFB45309)
                      : const Color(0xFF334155)),
            ),
          ),
          Switch(
            value: !hidden,
            activeColor: const Color(0xFF22C55E),
            onChanged: (v) => setState(() => state.hideFournitures = !v),
          ),
        ],
      ),
    );
  }

  // --- UI Parts ---

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(productsProvider);
    
    if (_isLoadingProfessions || productsAsync.isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8F9FA),
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final currentRoom = _roomIds[_selectedRoomTab];

    // Map trade chip label → famille values in DB (one trade can cover multiple familles)
    List<String> _tradeFamilles(String trade) {
      const map = <String, List<String>>{
        'Peintre':        ['Peinture intérieure'],
        'Plombier':       ['Plomberie'],
        'Carreleur':      ['Carrelage'],
        'Electricien':    ['Electricité'],
        'Menuisier':      ['Menuiseries intérieures'],
        'Plâtrier':       ['Cloisons / Plafonds'],
        'Isolation':      ['Isolation'],
        'Revêtement sol': ['Revêtements sols souples'],
        'Démolition':     ['Démolition / Dépose'],
        'Nettoyage':      ['Nettoyage'],
      };
      // Handle combined trades (e.g. 'Plombier,Peintre') by splitting
      final parts = trade.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty);
      final result = <String>{};
      for (final part in parts) {
        result.addAll(map[part] ?? [part]);
      }
      return result.toList();
    }

    final familles = _tradeFamilles(_selectedTrade);
    final isAllTrades = _selectedTrade.toLowerCase().contains("tout corps");

    final famillesLower = familles.map((f) => f.toLowerCase()).toList();
    
    // Filter _customTasks by trade BEFORE mapping to TaskItem
    final filteredCustomTasks = isAllTrades ? _customTasks : _customTasks.where((t) {
      final fam = (t.famille ?? '').toLowerCase();
      final prof = t.profession.toLowerCase();
      final tradeLower = _selectedTrade.toLowerCase();
      
      // 1. Match by backend famille mapping
      if (famillesLower.contains(fam)) return true;
      
      // 2. Match by exact profession (ignoring accents)
      if (prof == tradeLower) return true;
      if (tradeLower == 'electricien' && prof == 'électricien') return true;
      if (tradeLower == 'électricien' && prof == 'electricien') return true;
      if (tradeLower == 'platrier' && prof == 'plâtrier') return true;
      if (tradeLower == 'plâtrier' && prof == 'platrier') return true;
      if (tradeLower == 'revêtement sol' && prof == 'revetement sol') return true;
      
      // 3. Fallback partial match
      if (prof.contains(tradeLower) || tradeLower.contains(prof)) return true;
      
      return false;
    });

    // Build task items (parents only — children attached as subTasks)
    final allTaskItems = filteredCustomTasks.map((t) => TaskItem(
      id: t.id,
      label: t.title,
      description: t.description,
      code: t.code,
      famille: t.famille ?? t.profession, // Use profession as category title if famille is null
      unite: t.unite,
      tempsHU: t.tempsHU,
      typePoste: t.typePoste,
      parentId: t.parentId,
      isGlobal: false,
      subTasks: t.subTasks.map((s) => TaskItem(
        id: s.id,
        label: s.title,
        description: s.description,
        code: s.code,
        famille: s.famille ?? s.profession,
        unite: s.unite,
        tempsHU: s.tempsHU,
        typePoste: s.typePoste,
        parentId: s.parentId,
      )).toList(),
    )).toList();

    final tradeFiltered = allTaskItems.toList();

    final backendTaskItems = _searchQuery.isEmpty
        ? tradeFiltered
        : tradeFiltered.where((t) {
            final code  = (t.code  ?? '').toLowerCase();
            final label = t.label.toLowerCase();
            return code.startsWith(_searchQuery) || label.contains(_searchQuery);
          }).toList();

    // Group filtered tasks by famille
    final Map<String, List<TaskItem>> byFamille = {};
    for (final t in backendTaskItems) {
      final fam = (t.famille?.isNotEmpty == true) ? t.famille! : _selectedTrade.toUpperCase();
      byFamille.putIfAbsent(fam, () => []).add(t);
    }
    final tasksForTrade = byFamille.entries
        .map((e) => TaskCategory(title: e.key, tasks: e.value))
        .toList();
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // 1. Custom Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 12),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.white, Color(0xFFEFF6FF)],
                ),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_left, color: Color(0xFF1D74FF), size: 28),
                    onPressed: () => context.pop(),
                  ),
                  Expanded(
                    child: Column(
                      children: [
                        Text(
                          'Créer vos ouvrages',
                          style: AppTheme.headingStyle(context).copyWith(
                            color: const Color(0xFF0F2648),
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.keyboard_arrow_right, color: Color(0xFF1D74FF), size: 28),
                    onPressed: () {}, // Future nav
                  ),
                ],
              ),
            ),

            // 2. Room Tabs (Dark Strip)
            Container(
               width: double.infinity,
               color: const Color(0xFF0F2648),
               padding: const EdgeInsets.symmetric(vertical: 20),
               child: SingleChildScrollView(
                 scrollDirection: Axis.horizontal,
                 padding: const EdgeInsets.symmetric(horizontal: 16),
                 child: Row(
                   children: List.generate(_roomIds.length, (index) {
                     final id = _roomIds[index];
                     final isSelected = index == _selectedRoomTab;
                     return GestureDetector(
                       onTap: () => setState(() => _selectedRoomTab = index),
                       child: Container(
                         margin: const EdgeInsets.only(right: 12),
                         padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                         decoration: BoxDecoration(
                           color: isSelected ? const Color(0xFF1D74FF) : Colors.white,
                           borderRadius: BorderRadius.circular(30),
                           // No border for selected, maybe slight shadow?
                         ),
                         child: Row(
                           children: [
                             Icon(
                               _getRoomIcon(id), 
                               color: isSelected ? Colors.white : const Color(0xFF0F2648), 
                               size: 20
                             ),
                             const SizedBox(width: 8),
                             Text(
                               _getRoomLabel(id), 
                               style: TextStyle(
                                 color: isSelected ? Colors.white : const Color(0xFF0F2648), 
                                 fontWeight: FontWeight.bold,
                                 fontSize: 14,
                               )
                             ),
                           ],
                         ),
                       ),
                     );
                   }),
                 ),
               ),
            ),
          
          // 2. Trade Tabs (Segmented) - Only show if we have multiple trades or just header if 1
          if (_trades.isNotEmpty)
          Container(
            color: Theme.of(context).colorScheme.surface,
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: _trades.map((trade) {
                  final isSelected = _selectedTrade == trade;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(trade),
                      selected: isSelected,
                      onSelected: (val) {
                        if (val) {
                          setState(() => _selectedTrade = trade);
                          _fetchCustomTasksForTrade(trade);
                        }
                      },
                      selectedColor: const Color(0xFFE0E7FF),
                      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                      labelStyle: TextStyle(
                        color: isSelected ? const Color(0xFF1D74FF) : Colors.grey[700],
                        fontWeight: FontWeight.bold,
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: isSelected ? const Color(0xFF1D74FF) : Colors.grey[300]!)),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Ajouter des ouvrages',
                    style: AppTheme.headingStyle(context).copyWith(color: const Color(0xFF111827), fontSize: 22),
                  ),
                  const SizedBox(height: 8),

                  // NOTE: The global "Paramètres du chantier (Coeff)" button was
                  // removed (client request): price adjustment is no longer set
                  // globally on the devis. It is now defined per ouvrage when it
                  // is added from the library ("Adapter pour ce chantier" →
                  // ajustement + réduction). The room coefficient defaults to
                  // 1.0 (neutral) so existing math stays intact.
                  const SizedBox(height: 8),
                  
                  // Search
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Rechercher par code ou nom (ex: c → CAR)',
                      prefixIcon: const Icon(Icons.search, color: Colors.grey),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18, color: Colors.grey),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      filled: true,
                      fillColor: Colors.white,
                      contentPadding: const EdgeInsets.all(12),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none),
                    ),
                  ),
                  const SizedBox(height: 16),
                  
                  // BIBLIOTHÈQUE D'OUVRAGES BUTTON (pick from library)
                  InkWell(
                    onTap: _openLibraryPicker,
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFEA580C).withValues(alpha: 0.3)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.menu_book_outlined, color: Color(0xFFEA580C)),
                          SizedBox(width: 8),
                          Text(
                            'Bibliothèque d\'ouvrages',
                            style: TextStyle(
                              color: Color(0xFFEA580C),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // CREATE TASK BUTTON — top-level ouvrage only. Sous-ouvrages
                  // are added from inside their parent ouvrage card via the
                  // "Ajouter un sous-poste" button.
                  InkWell(
                    onTap: () async {
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) =>
                              CreateTaskScreen(profession: _selectedTrade),
                        ),
                      );
                      if (result == true) {
                        _fetchCustomTasksForTrade(_selectedTrade);
                      }
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF1D74FF).withValues(alpha: 0.3)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add_circle_outline, color: Color(0xFF1D74FF)),
                          SizedBox(width: 8),
                          Text(
                            'Créer une ouvrage',
                            style: TextStyle(
                              color: Color(0xFF1D74FF),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // ADD FOURNITURE BUTTON (standalone material-only line)
                  InkWell(
                    onTap: () => _addStandaloneFourniture(currentRoom),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF16A34A).withValues(alpha: 0.3)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shopping_cart_outlined, color: Color(0xFF16A34A)),
                          SizedBox(width: 8),
                          Text(
                            'Ajouter fourniture',
                            style: TextStyle(
                              color: Color(0xFF16A34A),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),
                  
                  // Tasks from backend
                  if (tasksForTrade.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(Icons.search_off, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 12),
                            Text(
                              _searchQuery.isNotEmpty
                                  ? 'Aucun résultat pour "$_searchQuery"'
                                  : 'Aucune tâche pour $_selectedTrade',
                              style: TextStyle(fontSize: 15, color: Colors.grey[500]),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _searchQuery.isNotEmpty
                                  ? 'Essayez un autre code ou nom.'
                                  : 'Créez une tâche via le bouton ci-dessus.',
                              style: TextStyle(fontSize: 13, color: Colors.grey[400]),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                  ...tasksForTrade.map((category) => _buildCategorySection(category, currentRoom)),
                  
                  const SizedBox(height: 100),
                ],
              ),

            ),
          ),
        ],
      ),
    ),
      bottomSheet: Container(
        color: Theme.of(context).colorScheme.surface,
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: SafeArea(
          // Single action (client request): "Enregistrer" saves everything
          // and opens the Récapitulatif du devis.
          child: ElevatedButton.icon(
            onPressed: _onSave,
            icon: const Icon(Icons.save_outlined, size: 20),
            label: const Text('Enregistrer',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1D3557),
              foregroundColor: Colors.white,
              minimumSize: const Size(double.infinity, 56),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
      ),
    );
  }

  /// "Enregistrer" — persists everything, then opens the Récapitulatif du
  /// devis (client request: one button, save and go to the next screen).
  void _onSave() async {
    await _persistToProvider();

    // Navigate straight to the Récapitulatif. The recap recomputes all
    // totals from `roomTasks` (already saved via updateRoomTasks), so the
    // intermediate summary step was redundant.
    if (!mounted) return;
    context.push(
      '/quote/detail',
      extra: QuoteDetailArgs(data: ref.read(quoteCreationProvider).toMap()),
    );
  }

  Future<void> _persistToProvider() async {
    // 1. Group tasks by room
    final tasksByRoom = <String, List<RoomTaskState>>{};
    
    // Group active tasks
    _taskStates.forEach((key, state) {
       // Use safe roomId from state
       tasksByRoom.putIfAbsent(state.roomId, () => []).add(state);
    });

       // 2. Process each room
    // 2. Process each room
    for (var entry in tasksByRoom.entries) {
       final roomId = entry.key;
       final tasks = entry.value;

       final expenseItems = <ExpenseItem>[];
       final taskDetails = <String, dynamic>{}; // Store full details

       for (var taskState in tasks) {
          // Calculate Product Cost
          double totalProductCost = 0;
          taskState.selectedFournitures.forEach((_, data) {
             final qty = (data['quantity'] as num?)?.toDouble() ?? 1;
             final unitPrice = (data['unitPrice'] as num?)?.toDouble() ?? 0;
             totalProductCost += unitPrice * qty;
          });

          // Determine Quantity (e.g. Surface)
          double quantity = 1.0;
          if (taskState.inputs.containsKey('surface')) {
             quantity = (taskState.inputs['surface'] as num).toDouble();
          }

          // Determine Labor Cost & Material Cost
          double laborUnitCost = 0.0;
          double materialUnitCost = 0.0;

          // Get hourly rate from user's business profile
          final user = ref.read(authRepositoryProvider).currentUser;
          double dailyRate = 350.0;
          double hoursPerDay = 7.0;

          if (user != null) {
            final userData = await ref.read(userRepositoryProvider).getUser(user.id);
            final businessInfo = userData?['business_info'] as Map<String, dynamic>?;
            if (businessInfo != null) {
              dailyRate = (businessInfo['dailyRate'] as num?)?.toDouble() ?? 350.0;
              hoursPerDay = (businessInfo['hoursPerDay'] as num?)?.toDouble() ?? 7.0;
            }
          }

          final hourlyRate = hoursPerDay > 0 ? dailyRate / hoursPerDay : dailyRate / 7.0;
          // Full chantier coefficient (access × condition × surface) — matches
          // the badge shown to the user. Using only `.condition` here dropped
          // the access/surface factors from the price.
          final conditionCoeff =
              (_roomContexts[roomId] ?? const RealityFactors()).totalCoefficient;
          final hours = taskState.hours; // per-unit temps (h/u)

          // Labor unit cost = temps(h/u) × hourly rate × coefficient.
          // `hours` is already per-unit, so do NOT divide by quantity.
          if (hours > 0) {
            laborUnitCost = hours * hourlyRate * conditionCoeff;
          }

          // Material cost from fournitures
          if (quantity > 0) {
            materialUnitCost = totalProductCost / quantity;
          } else {
            materialUnitCost = totalProductCost;
          }

          // Forfait: bill a single flat price. Quantity = 1, the whole price
          // lives in laborCost, no temps/fournitures breakdown is emitted.
          if (taskState.forfaitEnabled) {
            quantity = 1.0;
            laborUnitCost = taskState.forfaitPrice;
            materialUnitCost = 0.0;
          }

          expenseItems.add(ExpenseItem(
             id: taskState.taskId,
             title: taskState.label,
             subtitle: taskState.forfaitEnabled
                 ? 'Forfait'
                 : (hours > 0 ? '${hours.toStringAsFixed(1)}h × ${hourlyRate.toStringAsFixed(2)} €/h' : (totalProductCost > 0 ? 'Fournitures incluses' : 'Main d\'oeuvre')),
             quantity: quantity,
             laborCost: laborUnitCost,
             materialCost: materialUnitCost,
             icon: _getRoomIcon(roomId),
             tax: 20.0,
             hourlyRate: taskState.forfaitEnabled ? 0.0 : hourlyRate,
             normativeTime: taskState.forfaitEnabled ? 0.0 : hours,
          ));
          
          // Update Provider with context
          if (_roomContexts.containsKey(roomId)) {
             ref.read(quoteCreationProvider.notifier).updateRoomContext(roomId, _roomContexts[roomId]!);
          }
          
          // Serialize Task State for persistence
          // Lookup custom task metadata (code, famille, unite). Sous-ouvrages
          // are nested inside their parent's subTasks, so search there too —
          // otherwise they lose their code/famille AND their parent link, and
          // the récap shows them as orphan lines instead of grouped under
          // l'ouvrage with a somme.
          CustomTask? customTask;
          CustomTask? parentTask;
          for (final t in _customTasks) {
            if (t.id == taskState.taskId) {
              customTask = t;
              break;
            }
            for (final s in t.subTasks) {
              if (s.id == taskState.taskId) {
                customTask = s;
                parentTask = t;
                break;
              }
            }
            if (customTask != null) break;
          }

           taskDetails[taskState.taskId] = {
             'taskId': taskState.taskId,
             'label': taskState.label,
             'inputs': taskState.inputs,
             'selectedProducts': taskState.selectedProducts,
             'selectedFournitures': taskState.selectedFournitures,
             'note': taskState.note,
             'photoPaths': taskState.photoPaths,
             // KOJI fields for recap table
             'hours': taskState.hours,          // temps h/u entered by user
             'quantity': (taskState.inputs['quantity'] as num?)?.toDouble() ?? quantity,
             'tauxHoraire': hourlyRate,
             'conditionCoeff': conditionCoeff,
             'unite': customTask?.unite ?? 'u',
             'code': customTask?.code ?? '',
             // A sous-ouvrage inherits its parent's famille so the récap files
             // it under the same section instead of "Général".
             'famille': (customTask?.famille?.trim().isNotEmpty == true)
                 ? customTask!.famille!
                 : (parentTask?.famille ?? ''),
             // Parent link — lets the récap group sous-ouvrages under their
             // ouvrage and show the somme (Total ouvrage).
             'parentTaskId': customTask?.parentId ?? parentTask?.id ?? '',
             'forfaitEnabled': taskState.forfaitEnabled,
             'forfaitPrice': taskState.forfaitPrice,
             'hideFournitures': taskState.hideFournitures,
           };
       }
       
       // Update Provider
       ref.read(quoteCreationProvider.notifier).updateRoomEstimation(roomId, expenseItems);
       ref.read(quoteCreationProvider.notifier).updateRoomTasks(roomId, taskDetails);
    }

    // 3. Save User Profession if selected
    if (_selectedTrade.isNotEmpty) {
       ref.read(quoteCreationProvider.notifier).setProfession(_selectedTrade);
    }
  }

  Widget _buildCategorySection(TaskCategory category, String roomId) {
    final allSelected = _isCategoryFullySelected(category, roomId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  category.title.toUpperCase(),
                  style: const TextStyle(
                    color: Color(0xFF9CA3AF),
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                    letterSpacing: 1.0,
                  ),
                ),
              ),
              // "Tout sélectionner" (client request) — checks every ouvrage
              // and sous-ouvrage of this famille for the current pièce.
              InkWell(
                onTap: () =>
                    _toggleCategorySelection(category, roomId, !allSelected),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        allSelected
                            ? Icons.check_box
                            : Icons.check_box_outline_blank,
                        size: 18,
                        color: allSelected
                            ? const Color(0xFF1D74FF)
                            : const Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        allSelected ? 'Tout désélectionner' : 'Tout sélectionner',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: allSelected
                              ? const Color(0xFF1D74FF)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        ...category.tasks.map((taskItem) => _buildTaskCard(taskItem, roomId)),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _kojiChip(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: color),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }

  // Colour for a famille badge — mirrors CreateTaskScreen
  Color _familleColor(String? famille) {
    switch (famille) {
      case 'Carrelage':   return const Color(0xFFB45309);
      case 'Peinture':    return const Color(0xFF7C3AED);
      case 'Plomberie':   return const Color(0xFF0369A1);
      case 'Electricité': return const Color(0xFFD97706);
      case 'Menuiserie':  return const Color(0xFF166534);
      case 'Démolition':  return const Color(0xFFB91C1C);
      default:            return const Color(0xFF475569);
    }
  }

  Widget _buildTaskCard(TaskItem taskItem, String roomId) {
    final key = _getKey(roomId, taskItem.id);
    final isSelected = _taskStates.containsKey(key);
    final state = isSelected ? _taskStates[key]! : null;
    final isExpanded = state?.isExpanded ?? false;
    final hasKoji = taskItem.tempsHU != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? const Color(0xFF1D3557) : Colors.transparent,
          width: isSelected ? 2 : 0,
        ),
        boxShadow: const [
           BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.05),
            blurRadius: 10,
            offset: Offset(0, 4),
           ),
        ],
      ),
      child: Column(
        children: [
          // Header (Checkbox + Title)
          InkWell(
            onTap: () {
              if (isSelected) {
                 setState(() {
                   _taskStates[key]!.isExpanded = !_taskStates[key]!.isExpanded;
                 });
              } else {
                 _toggleTaskSelection(roomId, taskItem.id, taskItem.label, true);
              }
            },
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Checkbox custom
                  GestureDetector(
                    onTap: () => _toggleTaskSelection(roomId, taskItem.id, taskItem.label, !isSelected),
                    child: Container(
                      width: 24,
                      height: 24,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF1D3557) : Colors.white,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: isSelected ? const Color(0xFF1D3557) : Colors.grey[300]!),
                      ),
                      child: isSelected
                          ? Icon(
                              Icons.check,
                              color: Theme.of(context).colorScheme.surface,
                              size: 16,
                            )
                          : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Code + Famille badges (only when KOJI task)
                        if (hasKoji) ...[
                          Row(
                            children: [
                              if (taskItem.code != null)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: _familleColor(taskItem.famille).withValues(alpha: 0.12),
                                    borderRadius: BorderRadius.circular(5),
                                  ),
                                  child: Text(
                                    taskItem.code!,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      color: _familleColor(taskItem.famille),
                                    ),
                                  ),
                                ),
                              if (taskItem.famille != null) ...[
                                const SizedBox(width: 6),
                                Text(
                                  taskItem.famille!,
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                        ],
                        Text(
                          taskItem.label,
                          style: TextStyle(
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            fontSize: 15,
                            color: const Color(0xFF1F2937),
                          ),
                        ),
                        // KOJI metrics preview
                        if (taskItem.isParent && taskItem.subTasks.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          _kojiChip(Icons.account_tree_outlined,
                              '${taskItem.subTasks.length} sous-postes • ${taskItem.effectiveTempsHU.toStringAsFixed(2)} h/${taskItem.unite ?? 'u'}',
                              const Color(0xFF0369A1)),
                        ] else if (hasKoji) ...[
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              _kojiChip(Icons.access_time, '${taskItem.tempsHU} h/${taskItem.unite ?? 'u'}', const Color(0xFF3B82F6)),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  if (isSelected)
                    Icon(
                      isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      color: const Color(0xFF1D3557),
                    ),
                  // Edit / delete menu — only for user-created postes (not global).
                  if (!taskItem.isGlobal)
                    SizedBox(
                      width: 32,
                      height: 32,
                      child: PopupMenuButton<String>(
                        padding: EdgeInsets.zero,
                        icon: const Icon(Icons.more_vert,
                            size: 20, color: Color(0xFF94A3B8)),
                        onSelected: (action) {
                          if (action == 'edit') {
                            _editTask(taskItem);
                          } else if (action == 'delete') {
                            _confirmDeleteTask(taskItem);
                          }
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'edit',
                            child: Row(children: [
                              Icon(Icons.edit,
                                  size: 18, color: Color(0xFF0F172A)),
                              SizedBox(width: 8),
                              Text('Modifier'),
                            ]),
                          ),
                          PopupMenuItem(
                            value: 'delete',
                            child: Row(children: [
                              Icon(Icons.delete,
                                  size: 18, color: Color(0xFFEF4444)),
                              SizedBox(width: 8),
                              Text('Supprimer',
                                  style: TextStyle(color: Color(0xFFEF4444))),
                            ]),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Sub-tasks section — visible if parent has children OR if it's a top-level task (to let them add sub-tasks)
          if (taskItem.subTasks.isNotEmpty || !taskItem.isChild) ...[
            if (taskItem.subTasks.isNotEmpty)
              const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFE5E7EB)),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ...taskItem.subTasks.map((sub) => _buildSubTaskRow(sub, roomId)),
                  // Add sub-task button — only for user-created parents (not global)
                  if (!taskItem.isGlobal)
                    GestureDetector(
                      onTap: () async {
                        final result = await Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => CreateTaskScreen(
                            profession: _selectedTrade,
                            parentId: taskItem.id,
                            parentCode: taskItem.code,
                          )),
                        );
                        if (result == true) _fetchCustomTasksForTrade(_selectedTrade);
                      },
                      child: Container(
                        margin: const EdgeInsets.only(top: 6),
                        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F9FF),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFBAE6FD)),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add, size: 14, color: Color(0xFF0369A1)),
                            SizedBox(width: 4),
                            Text('Ajouter un sous-ouvrage', style: TextStyle(fontSize: 12, color: Color(0xFF0369A1), fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],

          // Expanded Content
          if (isSelected && isExpanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                 crossAxisAlignment: CrossAxisAlignment.stretch,
                 children: [
                   const Divider(height: 1, color: Color(0xFFE5E7EB)),
                   const SizedBox(height: 16),

                   // Note Input Area
                   Container(
                     padding: const EdgeInsets.all(12),
                     decoration: BoxDecoration(
                       color: const Color(0xFFF8FAFC),
                       borderRadius: BorderRadius.circular(12),
                       border: Border.all(color: const Color(0xFFE2E8F0)),
                     ),
                     child: Column(
                       children: [
                         TextField(
                           controller: TextEditingController(text: state!.note),
                           onChanged: (val) => state.note = val,
                           decoration: const InputDecoration(
                             hintText: 'Ajouter une note, une remarque importante...',
                               hintStyle: TextStyle( fontSize: 13, color: Color(0xFF94A3B8)),
                               border: InputBorder.none,
                               isDense: true,
                           ),
                           maxLines: 3,
                           style: const TextStyle( fontSize: 14),
                         ),
                         const SizedBox(height: 8),
                         Row(
                           mainAxisAlignment: MainAxisAlignment.end,
                           children: [
                             GestureDetector(
                               onTap: () async {
                                 final xfile = await ImagePicker().pickImage(source: ImageSource.gallery);
                                 if (xfile != null) setState(() => state.photoPaths.add(xfile.path));
                               },
                               child: const Icon(Icons.image_outlined, color: Color(0xFF64748B), size: 20),
                             ),
                             const SizedBox(width: 12),
                             GestureDetector(
                               onTap: () async {
                                 final xfile = await ImagePicker().pickImage(source: ImageSource.gallery); // Should be camera
                                 if (xfile != null) setState(() => state.photoPaths.add(xfile.path));
                               },
                               child: const Icon(Icons.camera_alt_outlined, color: Color(0xFF64748B), size: 20),
                             ),
                           ],
                         )
                       ],
                     ),
                   ),

                   if (state.photoPaths.isNotEmpty) ...[
                     const SizedBox(height: 12),
                     SizedBox(
                       height: 60,
                       child: ListView.separated(
                         scrollDirection: Axis.horizontal,
                         itemCount: state.photoPaths.length,
                         separatorBuilder: (_, __) => const SizedBox(width: 8),
                         itemBuilder: (context, index) {
                           return Stack(
                             clipBehavior: Clip.none,
                             children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: state.photoPaths[index].startsWith('http') 
                                     ? Image.network(state.photoPaths[index], width: 60, height: 60, fit: BoxFit.cover, errorBuilder: (_,__,___) => const Icon(Icons.error)) 
                                     : Image.file(File(state.photoPaths[index]), width: 60, height: 60, fit: BoxFit.cover),
                                ),
                               Positioned(
                                 top: -4, right: -4,
                                 child: GestureDetector(
                                   onTap: () => setState(() => state.photoPaths.removeAt(index)),
                                   child: Container(
                                     padding: const EdgeInsets.all(2),
                                     decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
                                     child: Icon(
                                       Icons.close,
                                       size: 10,
                                       color: Theme.of(context).colorScheme.surface,
                                     ),
                                   ),
                                 ),
                               ),
                             ],
                           );
                         },
                       ),
                     ),
                   ],
                   
                   const SizedBox(height: 20),

                   // AUCUN chiffrage ici (client request) : prix, forfait,
                   // quantités et totaux se saisissent uniquement dans le
                   // Récapitulatif du devis. On ne garde que la sélection des
                   // fournitures rattachées à l'ouvrage.
                   Align(
                     alignment: Alignment.centerRight,
                     child: _buildAddProductButton(roomId, taskItem.id),
                   ),

                   if (state.selectedFournitures.isNotEmpty) ...[
                     const SizedBox(height: 12),
                     // Hide/show fournitures toggle — only relevant when this
                     // ouvrage actually has fournitures attached.
                     _buildHideFournituresToggle(state),
                     const SizedBox(height: 12),

                     // Fournitures List
                     ...state.selectedFournitures.entries.map((entry) {
                        return _buildFournitureRow(
                          entry.value,
                          (newQty) {
                            setState(() {
                              state.selectedFournitures[entry.key]!['quantity'] = newQty;
                            });
                          },
                          () {
                            setState(() {
                              state.selectedFournitures.remove(entry.key);
                            });
                          },
                        );
                     }),
                   ],
                 ],
              ),
            ),
        ],
      ),
    );
  }
  
  Widget _buildSubTaskRow(TaskItem sub, String roomId) {
    final key = _getKey(roomId, sub.id);
    final isSelected = _taskStates.containsKey(key);

    return Padding(
      padding: const EdgeInsets.only(left: 8, bottom: 6),
      child: InkWell(
        onTap: () => _toggleTaskSelection(roomId, sub.id, sub.label, !isSelected),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFE5E7EB),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              // Tree branch icon
              const Text('└ ', style: TextStyle(fontSize: 14, color: Color(0xFF94A3B8), fontWeight: FontWeight.w300)),
              // Checkbox
              Container(
                width: 20,
                height: 20,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(
                  color: isSelected ? const Color(0xFF3B82F6) : Colors.white,
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(color: isSelected ? const Color(0xFF3B82F6) : const Color(0xFFCBD5E1)),
                ),
                child: isSelected
                    ? Icon(
                        Icons.check,
                        color: Theme.of(context).colorScheme.surface,
                        size: 14,
                      )
                    : null,
              ),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (sub.code != null)
                      Text(
                        sub.code!,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: _familleColor(sub.famille).withValues(alpha: 0.8),
                        ),
                      ),
                    Text(
                      sub.label,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                        color: const Color(0xFF374151),
                      ),
                    ),
                  ],
                ),
              ),
              // Temps badge
              if (sub.tempsHU != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    '${sub.tempsHU} h/${sub.unite ?? 'u'}',
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF3B82F6)),
                  ),
                ),
              // Edit / delete menu — only for user-created sub-tasks (not global).
              if (!sub.isGlobal)
                SizedBox(
                  width: 28,
                  height: 28,
                  child: PopupMenuButton<String>(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.more_vert,
                        size: 18, color: Color(0xFF94A3B8)),
                    onSelected: (action) {
                      if (action == 'edit') {
                        _editTask(sub);
                      } else if (action == 'delete') {
                        _confirmDeleteTask(sub);
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(
                        value: 'edit',
                        child: Row(children: [
                          Icon(Icons.edit, size: 18, color: Color(0xFF0F172A)),
                          SizedBox(width: 8),
                          Text('Modifier'),
                        ]),
                      ),
                      PopupMenuItem(
                        value: 'delete',
                        child: Row(children: [
                          Icon(Icons.delete,
                              size: 18, color: Color(0xFFEF4444)),
                          SizedBox(width: 8),
                          Text('Supprimer',
                              style: TextStyle(color: Color(0xFFEF4444))),
                        ]),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  /// Edit dialog — works for both parent postes and sous-postes.
  Future<void> _editTask(TaskItem item) async {
    // Expose every editable attribute of the task — not just désignation/code.
    // The client asked to be able to modify "from désignation to commentaire
    // and everything else" in one place.
    final titleCtrl = TextEditingController(text: item.label);
    final codeCtrl = TextEditingController(text: item.code ?? '');
    final descCtrl = TextEditingController(text: item.description ?? '');
    final uniteCtrl = TextEditingController(text: item.unite ?? '');
    // Sous-postes derive their temps individually; a parent with children sums
    // them, so editing the parent temps directly would be ignored.
    final isParentWithChildren = item.subTasks.isNotEmpty;
    final tempsCtrl = TextEditingController(
      text: item.tempsHU == null ? '' : _formatNum(item.tempsHU!),
    );

    InputDecoration deco(String label, {String? hint}) => InputDecoration(
          labelText: label,
          hintText: hint,
          isDense: true,
          border: const OutlineInputBorder(),
        );

    // La description des travaux est obligatoire : on suit l'erreur de
    // validation dans l'état local du dialogue pour l'afficher sous le champ.
    String? descError;

    final saved = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Modifier la tâche',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        content: SizedBox(
          width: double.maxFinite,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: titleCtrl,
                  autofocus: true,
                  textInputAction: TextInputAction.next,
                  decoration: deco('Désignation'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: codeCtrl,
                  decoration: deco('Code'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descCtrl,
                  minLines: 2,
                  maxLines: 5,
                  onChanged: (_) {
                    // Effacer l'erreur dès que l'utilisateur saisit du texte.
                    if (descError != null) {
                      setDialogState(() => descError = null);
                    }
                  },
                  decoration: deco('Description des travaux *',
                      hint: 'Détails affichés sous la tâche')
                      .copyWith(errorText: descError),
                ),
                const SizedBox(height: 12),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: uniteCtrl,
                        decoration: deco('Unité', hint: 'm², u, ml…'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: tempsCtrl,
                        enabled: !isParentWithChildren,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration: deco(
                          'Temps (h/u)',
                          hint: isParentWithChildren ? 'somme sous-postes' : '0',
                        ),
                      ),
                    ),
                  ],
                ),
                if (isParentWithChildren) ...[
                  const SizedBox(height: 6),
                  const Text(
                    'Le temps est calculé à partir des sous-postes.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ],
            ),
          ),
        ),
        actionsPadding:
            const EdgeInsets.fromLTRB(12, 0, 12, 8),
        actions: [
          // Delete lives in the same dialog so a task is always "modifiable
          // ou à supprimer" from one place.
          TextButton.icon(
            onPressed: () => Navigator.pop(ctx, 'delete'),
            icon: const Icon(Icons.delete_outline,
                size: 18, color: Color(0xFFEF4444)),
            label: const Text('Supprimer',
                style: TextStyle(color: Color(0xFFEF4444))),
          ),
          const Spacer(),
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: const Text('Annuler',
                style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F172A),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            onPressed: () async {
              if (titleCtrl.text.trim().isEmpty) return;
              final descText = descCtrl.text.trim();
              // Description des travaux obligatoire : on bloque l'enregistrement
              // et on affiche l'erreur sous le champ tant qu'elle est vide.
              if (descText.isEmpty) {
                setDialogState(() =>
                    descError = 'La description des travaux est obligatoire');
                return;
              }
              final tempsText =
                  tempsCtrl.text.trim().replaceAll(',', '.');
              try {
                await ref.read(taskRepositoryProvider).updateTask(
                      id: item.id,
                      title: titleCtrl.text.trim(),
                      code: codeCtrl.text.trim().isEmpty
                          ? null
                          : codeCtrl.text.trim(),
                      description: descText,
                      clearDescription: false,
                      unite: uniteCtrl.text.trim().isEmpty
                          ? null
                          : uniteCtrl.text.trim(),
                      tempsHU: isParentWithChildren
                          ? null
                          : double.tryParse(tempsText),
                    );
                if (ctx.mounted) Navigator.pop(ctx, 'saved');
              } catch (e) {
                if (!ctx.mounted) return;
                ScaffoldMessenger.of(ctx).showSnackBar(
                  SnackBar(
                    content: Text('Erreur: $e'),
                    backgroundColor: const Color(0xFFEF4444),
                  ),
                );
              }
            },
            child: const Text('Enregistrer',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      ),
    );

    if (saved == 'saved') {
      _fetchCustomTasksForTrade(_selectedTrade);
    } else if (saved == 'delete') {
      await _confirmDeleteTask(item);
    }
  }

  Future<void> _confirmDeleteTask(TaskItem item) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Supprimer cette tâche ?',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        content: Text(
            '"${item.label}" sera définitivement supprimée${item.subTasks.isNotEmpty ? ", ainsi que ses ${item.subTasks.length} sous-poste(s)" : ""}.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Annuler',
                style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFEF4444),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(taskRepositoryProvider).deleteTask(item.id);
      // Drop selection state if the user had selected this task in any room.
      // Keys are formatted as `<roomId>_<taskId>` (see _getKey).
      _taskStates.removeWhere((key, _) => key.endsWith('_${item.id}'));
      _fetchCustomTasksForTrade(_selectedTrade);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Erreur: $e'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
    }
  }

  Widget _buildAddProductButton(String roomId, String taskId) {
    return GestureDetector(
       onTap: () => _showAddProductModal(roomId, taskId),
       child: Container(
         height: 48,
         padding: const EdgeInsets.symmetric(horizontal: 16),
         decoration: BoxDecoration(
           color: const Color(0xFFEFF6FF),
           borderRadius: BorderRadius.circular(8),
           border: Border.all(color: const Color(0xFFBFDBFE), style: BorderStyle.none), // Can't do real dashed easily without package, solid light blue is fine as per modern trends or similar design
         ),
         child: const Row(
           mainAxisSize: MainAxisSize.min,
           children: [
             Icon(Icons.add_circle, color: Color(0xFF3B82F6), size: 20),
             SizedBox(width: 8),
             Text('Fourniture', style: TextStyle( color: Color(0xFF3B82F6), fontWeight: FontWeight.w600)),
           ],
         ),
       ),
    );
  }

  Widget _buildFournitureRow(
    Map<String, dynamic> item,
    Function(double) onQtyChanged,
    VoidCallback onDelete,
  ) {
     final name = (item['name'] ?? 'Fourniture').toString();
     final fournisseur = (item['fournisseur'] ?? 'Sans fournisseur').toString();
     final quantity = (item['quantity'] as num?)?.toDouble() ?? 1;
     final unitPrice = (item['unitPrice'] as num?)?.toDouble() ?? 0;
     final conditionnement = (item['conditionnement'] ?? '').toString();

     return Container(
         margin: const EdgeInsets.only(bottom: 12),
         padding: const EdgeInsets.all(8),
         decoration: BoxDecoration(
           color: Theme.of(context).colorScheme.surface,
           border: Border.all(color: const Color(0xFFE2E8F0)),
           borderRadius: BorderRadius.circular(12),
           boxShadow: [
             BoxShadow(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 2)),
           ],
         ),
         child: Row(
           children: [
             Container(
               width: 50, height: 50,
               decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8)),
               child: const Icon(Icons.inventory_2_outlined, size: 24, color: Colors.grey),
             ),
             const SizedBox(width: 12),
             Expanded(
               child: Column(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   Text(name, style: const TextStyle( fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)), maxLines: 2, overflow: TextOverflow.ellipsis),
                   const SizedBox(height: 2),
                   Text('$fournisseur${conditionnement.isNotEmpty ? ' • $conditionnement' : ''}', style: const TextStyle( color: Color(0xFF64748B), fontSize: 11)),
                   Text('${unitPrice.toStringAsFixed(2)} € / u', style: const TextStyle( color: Color(0xFF64748B), fontSize: 11)),
                 ],
               ),
             ),
             Column(
               crossAxisAlignment: CrossAxisAlignment.end,
               children: [
                 Text(
                   '${(quantity * unitPrice).toStringAsFixed(2)} €',
                   style: const TextStyle( fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                 ),
                 const SizedBox(height: 6),
                 Container(
                   padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                   decoration: BoxDecoration(
                     color: const Color(0xFFF8FAFC),
                     borderRadius: BorderRadius.circular(8),
                     border: Border.all(color: const Color(0xFFE2E8F0)),
                   ),
                   child: Row(
                     mainAxisSize: MainAxisSize.min,
                     children: [
                       GestureDetector(
                         onTap: () => onQtyChanged(max(1, quantity - 1)),
                         child: Container(
                           padding: const EdgeInsets.all(4),
                           decoration: const BoxDecoration(color: Color(0xFFEEF2FF), shape: BoxShape.circle),
                           child: const Icon(Icons.remove, size: 14, color: Color(0xFF1E3A8A)),
                         ),
                       ),
                       Padding(
                         padding: const EdgeInsets.symmetric(horizontal: 10),
                         child: Text(quantity.toInt().toString().padLeft(2, '0'), style: const TextStyle( fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF1E3A8A))),
                       ),
                       GestureDetector(
                         onTap: () => onQtyChanged(quantity + 1),
                         child: Container(
                           padding: const EdgeInsets.all(4),
                           decoration: const BoxDecoration(color: Color(0xFFEEF2FF), shape: BoxShape.circle),
                           child: const Icon(Icons.add, size: 14, color: Color(0xFF1E3A8A)),
                         ),
                       ),
                     ],
                   ),
                 ),
                 const SizedBox(height: 4),
                 GestureDetector(
                   onTap: onDelete,
                   child: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                 ),
               ],
             )
           ],
         ),
       );
  }
  

  /// Adds a standalone fourniture (material-only) line to the current room.
  /// Implemented as a pseudo-task with no labor (hours = 0): the recap renders
  /// it as a line where Main d'œuvre = 0 and Fournitures = unitPrice × qty.
  Future<void> _addStandaloneFourniture(String roomId) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const FournituresScreen(selectionMode: true),
      ),
    );
    if (result == null || result is! Map<String, dynamic>) return;

    final fournId = (result['id'] ?? '').toString();
    if (fournId.isEmpty) return;
    final name = (result['name'] ?? 'Fourniture').toString();
    final unitPrice = (result['unitPrice'] as num?)?.toDouble() ?? 0.0;

    // Synthesize a unique task id so multiple fournitures can coexist.
    final pseudoTaskId =
        'fourniture_${fournId}_${DateTime.now().millisecondsSinceEpoch}';
    final key = _getKey(roomId, pseudoTaskId);

    setState(() {
      final state = RoomTaskState(
        taskId: pseudoTaskId,
        roomId: roomId,
        label: name,
        isExpanded: false,
        hours: 0.0, // no labor — material-only line
      );
      state.inputs['quantity'] = 1.0;
      state.selectedFournitures[fournId] = {
        ...result,
        'quantity': 1.0,
        'unitPrice': unitPrice,
      };
      _taskStates[key] = state;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fourniture ajoutée : $name')),
      );
    }
  }

  Future<void> _showAddProductModal(String roomId, String taskId) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => const FournituresScreen(selectionMode: true),
      ),
    );
    if (result == null || result is! Map<String, dynamic>) return;

    final key = _getKey(roomId, taskId);
    final itemId = (result['id'] ?? '').toString();
    if (itemId.isEmpty) return;

    setState(() {
      _taskStates.putIfAbsent(
        key,
        () => RoomTaskState(taskId: taskId, roomId: roomId, label: ''),
      );
      _taskStates[key]!.selectedFournitures[itemId] = Map<String, dynamic>.from(result);
    });
  }
  

}
