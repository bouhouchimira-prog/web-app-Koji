import 'package:koji/features/pricing/models/pricing_models.dart';
import 'package:koji/features/quote/models/quote_models.dart';

class PricingEngine {
  /// Calculates the price for a specific task given the quantity and context.
  static PriceBreakdown calculateTaskPrice({
    required SmartTask task,
    required double quantity, // Surface, length, or count
    required RealityFactors realityFactors,
    required PricingProfile pricingProfile,
    required List<Product> selectedProducts, // Products assigned to this task
  }) {
    // 1. Calculate Base Time
    double baseTime = 0.0;
    if (task.isFixedTime) {
      baseTime = task.normativeTime;
    } else {
      baseTime = task.normativeTime * quantity;
    }

    // 2. Apply Reality Coefficients (Corrected Time)
    // "They modify labor time, not price directly" implies we adjust the hours.
    double correctedTime = baseTime * realityFactors.totalCoefficient;

    // 3. Calculate Labor Cost
    double laborCost = correctedTime * pricingProfile.hourlyRate;

    // 4. Calculate Material Cost
    double totalMaterialCost = 0.0;

    // Iterate over requirements defined by the Task (The "Smart" part)
    for (final req in task.materialRequirements) {
      // Attempt to find a selected product matching this category
      // Note: In a real app, we might match by exact ID if saved,
      // but here we match by Category to simulation "Smart Selection"
      final product = selectedProducts.firstWhere(
        (p) => p.category == req.productCategory,
        orElse: () => const Product(
            id: 'null',
            name: '',
            imageUrl: '',
            priceHT: 0,
            unit: '',
            category: ''),
      );

      double qtyNeeded = 0.0;

      if (req.isFixedQuantity) {
        qtyNeeded = 1.0;
      } else {
        // Standard Yield Calculation: Surface / Yield
        // Example: 47m2 / 5m2/L = 9.4L
        if (req.yield > 0) {
          qtyNeeded = quantity / req.yield;
        }
      }

      // Rounding logic: "9.4 L -> rounded to 10 L"
      // We ceil the quantity to simulate buying full units
      double unitsToBuy = qtyNeeded.ceilToDouble();

      // Determine Price
      double unitPrice = req.defaultPricePerUnit;
      if (product.id != 'null') {
        unitPrice = product.priceHT;
      }

      totalMaterialCost += unitsToBuy * unitPrice;
    }

    // Add costs of selected products that might NOT have been in requirements?
    // For now, strict adherence to Task Requirements guarantees the "Smart" formula.
    // Any extra "Consumables" product selected manually by user would be lost here
    // unless we also iterate selectedProducts.
    // But for the Pricing Engine core, we follow the Task Definition.

    return PriceBreakdown(
      totalTimeHours: baseTime,
      correctedTimeHours: correctedTime,
      laborCost: laborCost,
      materialCost: totalMaterialCost,
      totalHt: laborCost + totalMaterialCost,
    );
  }
}
