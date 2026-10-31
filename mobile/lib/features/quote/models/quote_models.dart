// Barrel re-export file — exists so that all existing imports of
// `quote_models.dart` continue to compile without modification.
//
// New code should prefer importing directly from:
//   - quote_domain_models.dart  (Product, Chantier, ConsumptionRule, …)
//   - quote_ui_state.dart       (RoomTaskState)
//   - quote_helpers.dart        (getFieldsForTask, getDefaultProductsForTask)

export 'quote_domain_models.dart';
export 'quote_ui_state.dart';
export 'quote_helpers.dart';
