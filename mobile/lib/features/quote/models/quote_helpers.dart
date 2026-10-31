// Application-layer helpers for the quote feature.
// These are lookup/mapping functions used by the UI to determine task
// input fields and default products. They do NOT belong in domain models.

import 'package:koji/features/quote/models/quote_domain_models.dart';

/// Returns the dynamic input fields required for a given task type.
/// The task's ID string is used to infer which measurement the user must supply.
List<TaskInputField> getFieldsForTask(String taskId) {
  final tid = taskId.toLowerCase();

  if (tid.contains('murs') ||
      tid.contains('peinture') ||
      tid.contains('enduit') ||
      tid.contains('sol') ||
      tid.contains('carrelage') ||
      tid.contains('parquet') ||
      tid.contains('ragreage')) {
    return const [
      TaskInputField(
          id: 'surface', label: 'Surface', suffix: 'm²', defaultValue: 15.0),
    ];
  }

  if (tid.contains('plinthe') ||
      tid.contains('cable') ||
      tid.contains('tuyau') ||
      tid.contains('froid') ||
      tid.contains('chaud')) {
    return const [
      TaskInputField(
          id: 'length', label: 'Longueur', suffix: 'ml', defaultValue: 10.0),
    ];
  }

  if (tid.contains('pose') ||
      tid.contains('install') ||
      tid.contains('wc') ||
      tid.contains('lavabo') ||
      tid.contains('prise') ||
      tid.contains('interrupteur')) {
    return const [
      TaskInputField(
          id: 'count', label: 'Nombre', suffix: 'u', defaultValue: 1.0),
    ];
  }

  // Default fallback
  return const [
    TaskInputField(
        id: 'surface', label: 'Quantité', suffix: 'u', defaultValue: 1.0),
  ];
}

/// Returns a filtered list of products that are relevant to a given task type.
List<Product> getDefaultProductsForTask(
    String taskId, List<Product> allProducts) {
  final tid = taskId.toLowerCase();

  if (tid.contains('peinture') ||
      tid.contains('murs') ||
      tid.contains('plafond') ||
      tid.contains('impression')) {
    return allProducts
        .where((p) =>
            p.category == 'Peinture' ||
            p.category == 'Consommable' ||
            p.category == 'Outillage')
        .take(3)
        .toList();
  }
  if (tid.contains('enduit') ||
      tid.contains('poncage') ||
      tid.contains('preparation')) {
    return allProducts
        .where((p) => p.category == 'Enduit' || p.category == 'Consommable')
        .toList();
  }
  if (tid.contains('elec') ||
      tid.contains('prise') ||
      tid.contains('interrupteur') ||
      tid.contains('cable') ||
      tid.contains('tableau')) {
    return allProducts
        .where((p) =>
            p.brand == 'Legrand' ||
            p.brand == 'Schneider' ||
            p.brand == 'Nexans' ||
            p.brand == 'Hager')
        .toList();
  }
  if (tid.contains('plomb') ||
      tid.contains('eau') ||
      tid.contains('wc') ||
      tid.contains('lavabo') ||
      tid.contains('robinet')) {
    return allProducts
        .where((p) =>
            p.category == 'Tuyauterie' ||
            p.category == 'Sanitaire' ||
            p.category == 'Robinetterie')
        .toList();
  }
  if (tid.contains('carrelage') ||
      tid.contains('faience') ||
      tid.contains('sol')) {
    return allProducts
        .where((p) =>
            p.category == 'Colle' ||
            p.category == 'Joint' ||
            p.category == 'Carrelage')
        .toList();
  }
  if (tid.contains('menuiserie') ||
      tid.contains('porte') ||
      tid.contains('fenetre') ||
      tid.contains('parquet') ||
      tid.contains('plinthe')) {
    return allProducts
        .where((p) =>
            p.category == 'Sol' ||
            p.category == 'Finition' ||
            p.category == 'Ouverture')
        .toList();
  }

  return allProducts.take(2).toList();
}
