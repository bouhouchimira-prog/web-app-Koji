import 'package:flutter/material.dart';

class ExpenseItem {
  String id;
  String title;
  String subtitle;
  IconData icon;
  double quantity;
  /// Total Prix MO = normativeTime × coeff × hourlyRate × quantity (already fully computed)
  double laborCost;
  /// Total Prix Fournitures (already computed for the full quantity)
  double materialCost;
  double tax;
  /// The reality/state coefficient (e.g. 1.0 Sain, 1.20 Moyen, 1.40 Dégradé)
  double stateCoefficient;
  /// Normative time per unit (h/m² or h/u) — for display only
  double normativeTime;
  /// Hourly rate used — for display only
  double hourlyRate;

  ExpenseItem({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    this.quantity = 0.0,
    this.laborCost = 0.0,
    this.materialCost = 0.0,
    this.tax = 0.0,
    this.stateCoefficient = 1.0,
    this.normativeTime = 0.0,
    this.hourlyRate = 0.0,
  });

  /// Prix MO total = laborCost (unit price €/u) × quantity
  double get prixMO => laborCost * quantity;

  /// Prix Fournitures total = materialCost (unit price €/u) × quantity
  double get prixFournitures => materialCost * quantity;

  /// Prix de vente HT = Prix MO + Prix Fournitures
  double get total => prixMO + prixFournitures;

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'title': title,
      'subtitle': subtitle,
      'quantity': quantity,
      'laborCost': laborCost,
      'materialCost': materialCost,
      'tax': tax,
      'stateCoefficient': stateCoefficient,
      // IconData is not serializable directly for JSON/Firestore usually,
      // but assuming we rebuild it or store code point.
      // For now we might skip icon in DB or store generic name.
    };
  }
}
