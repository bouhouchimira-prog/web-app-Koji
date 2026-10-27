// UI state models for the quote feature.
// These contain view-specific state (expansion, photos, user inputs)
// that should NOT be persisted as-is and should NOT be mixed with
// pure domain entities.

/// Holds the UI state of a specific selected task in a room.
class RoomTaskState {
  final String taskId;
  final String roomId;
  final String label;

  /// Whether this task section is expanded in the UI.
  bool isExpanded;

  /// Dynamic user inputs keyed by input field ID.
  final Map<String, dynamic> inputs;

  /// Optional note left by the user for this task.
  String? note;

  /// Photos attached to this task during the quote flow.
  final List<String> photoPaths;

  /// Selected products for this task, keyed by product ID with quantity.
  final Map<String, double> selectedProducts;

  /// Selected fournitures for this task, keyed by fourniture ID.
  final Map<String, Map<String, dynamic>> selectedFournitures;

  /// Number of hours the user will work on this task.
  double hours;

  /// When true, this ouvrage is billed as a flat "forfait" — the detailed
  /// quantité / temps / main d'œuvre breakdown is ignored and [forfaitPrice]
  /// is used directly as the line total.
  bool forfaitEnabled;

  /// Flat price (HT) used when [forfaitEnabled] is true.
  double forfaitPrice;

  /// When true, the fournitures of this ouvrage are NOT itemised in the devis /
  /// facture sent to the client. The entrepreneur keeps the internal detail but
  /// the client only sees the line total (material cost is folded into it).
  bool hideFournitures;

  RoomTaskState({
    required this.taskId,
    required this.roomId,
    required this.label,
    this.isExpanded = false,
    Map<String, dynamic>? inputs,
    this.note,
    List<String>? photoPaths,
    Map<String, double>? selectedProducts,
    Map<String, Map<String, dynamic>>? selectedFournitures,
    this.hours = 0.0,
    this.forfaitEnabled = false,
    this.forfaitPrice = 0.0,
    this.hideFournitures = false,
  })  : inputs = inputs ?? {},
        photoPaths = photoPaths ?? [],
        selectedProducts = selectedProducts ?? {},
        selectedFournitures = selectedFournitures ?? {};

  RoomTaskState copyWith({
    bool? isExpanded,
    Map<String, dynamic>? inputs,
    String? note,
    List<String>? photoPaths,
    Map<String, double>? selectedProducts,
    Map<String, Map<String, dynamic>>? selectedFournitures,
    double? hours,
    bool? forfaitEnabled,
    double? forfaitPrice,
    bool? hideFournitures,
  }) {
    return RoomTaskState(
      taskId: taskId,
      roomId: roomId,
      label: label,
      isExpanded: isExpanded ?? this.isExpanded,
      inputs: inputs != null ? Map.from(inputs) : Map.from(this.inputs),
      note: note ?? this.note,
      photoPaths: photoPaths != null
          ? List.from(photoPaths)
          : List.from(this.photoPaths),
      selectedProducts: selectedProducts != null
          ? Map.from(selectedProducts)
          : Map.from(this.selectedProducts),
      selectedFournitures: selectedFournitures != null
          ? Map.from(selectedFournitures)
          : Map.from(this.selectedFournitures),
      hours: hours ?? this.hours,
      forfaitEnabled: forfaitEnabled ?? this.forfaitEnabled,
      forfaitPrice: forfaitPrice ?? this.forfaitPrice,
      hideFournitures: hideFournitures ?? this.hideFournitures,
    );
  }
}
