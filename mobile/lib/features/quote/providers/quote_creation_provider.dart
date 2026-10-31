import 'package:koji/features/pricing/models/pricing_models.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/model/expense_item.dart';
import 'package:koji/features/quote/repository/quote_task_repository.dart';
import 'package:flutter/material.dart';

/// Strongly-typed client information for the quote creation flow.
/// Replaces the previous Map<String, dynamic> clientInfo.
class ClientInfo {
  final String name;
  final String email;
  final String phone;
  final String address;

  const ClientInfo({
    this.name = '',
    this.email = '',
    this.phone = '',
    this.address = '',
  });

  /// Build from a legacy Map for backwards-compatibility.
  factory ClientInfo.fromMap(Map<String, dynamic> map) {
    return ClientInfo(
      name: map['name'] as String? ?? '',
      email: map['email'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      address: map['address'] as String? ?? '',
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'email': email,
        'phone': phone,
        'address': address,
      };

  bool get isEmpty =>
      name.isEmpty && email.isEmpty && phone.isEmpty && address.isEmpty;
  bool get isNotEmpty => !isEmpty;
}

class QuoteCreationState {
  final ClientInfo clientInfo;
  final List<String> visualEvidenceImages;
  final List<String> selectedRoomIds;
  final Map<String, dynamic> roomEstimations; // Map<roomId, List<ExpenseItem>>
  final Map<String, dynamic> roomTasks;
  final String? userProfession;
  final Map<String, RealityFactors> roomContexts;
  final String? chantierId;
  // When non-null, the flow is editing an existing devis — the recap should
  // upsert against this id and the room/task screens should rehydrate from
  // roomTasks instead of starting empty.
  final String? editingQuoteId;

  QuoteCreationState({
    ClientInfo? clientInfo,
    this.visualEvidenceImages = const [],
    this.selectedRoomIds = const [],
    this.roomEstimations = const {},
    this.roomTasks = const {},
    this.userProfession,
    this.roomContexts = const {},
    this.chantierId,
    this.editingQuoteId,
  }) : clientInfo = clientInfo ?? const ClientInfo();

  QuoteCreationState copyWith({
    ClientInfo? clientInfo,
    List<String>? visualEvidenceImages,
    List<String>? selectedRoomIds,
    Map<String, dynamic>? roomEstimations,
    Map<String, dynamic>? roomTasks,
    String? userProfession,
    Map<String, RealityFactors>? roomContexts,
    String? chantierId,
    String? editingQuoteId,
  }) {
    return QuoteCreationState(
      clientInfo: clientInfo ?? this.clientInfo,
      visualEvidenceImages: visualEvidenceImages ?? this.visualEvidenceImages,
      selectedRoomIds: selectedRoomIds ?? this.selectedRoomIds,
      roomEstimations: roomEstimations ?? this.roomEstimations,
      roomTasks: roomTasks ?? this.roomTasks,
      userProfession: userProfession ?? this.userProfession,
      roomContexts: roomContexts ?? this.roomContexts,
      chantierId: chantierId ?? this.chantierId,
      editingQuoteId: editingQuoteId ?? this.editingQuoteId,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'client': clientInfo.toMap(),
      'images': visualEvidenceImages,
      'roomIds': selectedRoomIds,
      'expenses': roomEstimations,
      'tasks': roomTasks,
      'profession': userProfession,
      if (chantierId != null) 'chantier_id': chantierId,
      if (editingQuoteId != null) 'id': editingQuoteId,
    };
  }
}

class QuoteCreationNotifier extends StateNotifier<QuoteCreationState> {
  QuoteCreationNotifier() : super(QuoteCreationState());

  void updateClientInfo(ClientInfo info) {
    state = state.copyWith(clientInfo: info);
  }

  void addVisualEvidence(String path) {
    state = state
        .copyWith(visualEvidenceImages: [...state.visualEvidenceImages, path]);
  }

  void setVisualEvidence(List<String> paths) {
    state = state.copyWith(visualEvidenceImages: paths);
  }

  void setSelectedRooms(List<String> roomIds) {
    state = state.copyWith(selectedRoomIds: roomIds);
  }

  void updateRoomTasks(String roomId, Map<String, dynamic> taskDetails) {
    final newTasks = Map<String, dynamic>.from(state.roomTasks);
    newTasks[roomId] = taskDetails;
    state = state.copyWith(roomTasks: newTasks);
  }

  void updateRoomEstimation(String roomId, dynamic expenses) {
    final newEstimations = Map<String, dynamic>.from(state.roomEstimations);
    newEstimations[roomId] = expenses;
    state = state.copyWith(roomEstimations: newEstimations);
  }

  void setProfession(String profession) {
    state = state.copyWith(userProfession: profession);
  }

  void setChantierId(String chantierId) {
    state = state.copyWith(chantierId: chantierId);
  }

  void updateRoomContext(String roomId, RealityFactors context) {
    final newContexts = Map<String, RealityFactors>.from(state.roomContexts);
    newContexts[roomId] = context;
    state = state.copyWith(roomContexts: newContexts);
  }

  void reset() {
    state = QuoteCreationState();
  }

  /// Hydrate the creation state from a previously-saved quote so the user
  /// can re-enter the build flow (rooms → tasks → recap) and edit anything.
  ///
  /// [savedQuote] is the row map produced by `getUserQuotes` (contains client,
  /// company, quoteNumber, etc.). The rooms/tasks tables are queried on demand.
  Future<void> seedFromSavedQuote(Map<String, dynamic> savedQuote) async {
    final quoteId = savedQuote['id'] as String?;
    if (quoteId == null || quoteId.isEmpty) return;

    final repo = QuoteTaskRepository();
    final rooms = await repo.getQuoteRooms(quoteId);

    final selectedRoomIds = <String>[];
    final roomEstimations = <String, List<ExpenseItem>>{};
    final roomTasks = <String, Map<String, dynamic>>{};

    for (final room in rooms) {
      final roomName = (room['name'] as String?) ?? '';
      if (roomName.isEmpty) continue;
      selectedRoomIds.add(roomName);

      final tasks = await repo.getQuoteTasks(room['id'] as String);
      final expenseItems = <ExpenseItem>[];
      final taskDetails = <String, dynamic>{};

      for (final t in tasks) {
        final taskId = (t['task_id'] as String?) ?? '';
        if (taskId.isEmpty) continue;

        final inputs = (t['inputs'] is Map)
            ? Map<String, dynamic>.from(t['inputs'] as Map)
            : <String, dynamic>{};
        final selectedProducts = (t['selected_products'] is Map)
            ? Map<String, dynamic>.from(t['selected_products'] as Map)
                .map((k, v) => MapEntry(k, (v as num).toDouble()))
            : <String, double>{};
        final selectedFournitures = (inputs['selectedFournitures'] is Map)
            ? Map<String, Map<String, dynamic>>.from(
                (inputs['selectedFournitures'] as Map).map(
                  (k, v) => MapEntry(
                    k.toString(),
                    Map<String, dynamic>.from(v as Map),
                  ),
                ),
              )
            : <String, Map<String, dynamic>>{};

        final laborUnit = (t['unit_price_ht'] as num?)?.toDouble() ?? 0.0;
        final materialUnit = (t['total_price_ht'] as num?)?.toDouble() ?? 0.0;
        final qty = (inputs['quantity'] as num?)?.toDouble() ?? 1.0;
        final materialQty =
            (inputs['fournituresQty'] as num?)?.toDouble() ?? qty;

        expenseItems.add(ExpenseItem(
          id: taskId,
          title: (t['label'] as String?) ?? '',
          subtitle: (t['note'] as String?) ?? '',
          icon: Icons.build_outlined,
          quantity: qty,
          laborCost: laborUnit,
          materialCost: materialUnit,
          tax: 20.0,
          hourlyRate: (inputs['tauxHoraire'] as num?)?.toDouble() ?? 0.0,
          normativeTime: (inputs['hours'] as num?)?.toDouble() ?? 0.0,
        ));

        // Strip the embedded helpers out of inputs so the task screen sees
        // a clean inputs map (the embedded keys are mirrored in the
        // top-level taskDetails entry below, where the rest of the flow
        // expects them).
        final cleanInputs = Map<String, dynamic>.from(inputs)
          ..remove('selectedFournitures')
          ..remove('hours')
          ..remove('tauxHoraire')
          ..remove('conditionCoeff')
          ..remove('unite')
          ..remove('code')
          ..remove('famille')
          ..remove('hideFournitures');
        // Quantity is also mirrored at the top level for the recap, but the
        // task screen reads it from inputs['surface'] / inputs['quantity'],
        // so leave it in cleanInputs.

        taskDetails[taskId] = {
          'taskId': taskId,
          'label': (t['label'] as String?) ?? '',
          'inputs': cleanInputs,
          'selectedProducts': selectedProducts,
          'selectedFournitures': selectedFournitures,
          'note': t['note'],
          'photoPaths':
              (t['photo_paths'] as List?)?.cast<String>() ?? <String>[],
          'hours': (inputs['hours'] as num?)?.toDouble() ?? 0.0,
          'quantity': qty,
          'tauxHoraire': (inputs['tauxHoraire'] as num?)?.toDouble() ?? 0.0,
          'conditionCoeff':
              (inputs['conditionCoeff'] as num?)?.toDouble() ?? 1.0,
          'unite': (inputs['unite'] as String?) ?? 'u',
          'code': (inputs['code'] as String?) ?? '',
          'famille': (inputs['famille'] as String?) ?? '',
          'fournituresQty': materialQty,
          'fournituresUnitPrice': materialUnit,
          'fournituresTotal':
              (inputs['fournituresTotal'] as num?)?.toDouble() ??
                  materialQty * materialUnit,
          'hideFournitures': inputs['hideFournitures'] as bool? ?? false,
        };
      }

      if (expenseItems.isNotEmpty) {
        roomEstimations[roomName] = expenseItems;
      }
      if (taskDetails.isNotEmpty) {
        roomTasks[roomName] = taskDetails;
      }
    }

    final clientMap = (savedQuote['client'] is Map)
        ? Map<String, dynamic>.from(savedQuote['client'] as Map)
        : <String, dynamic>{};

    state = state.copyWith(
      editingQuoteId: quoteId,
      chantierId: savedQuote['chantier_id'] as String?,
      clientInfo: ClientInfo.fromMap(clientMap),
      selectedRoomIds: selectedRoomIds,
      roomEstimations: roomEstimations,
      roomTasks: roomTasks,
    );
  }
}

final quoteCreationProvider =
    StateNotifierProvider<QuoteCreationNotifier, QuoteCreationState>((ref) {
  return QuoteCreationNotifier();
});
