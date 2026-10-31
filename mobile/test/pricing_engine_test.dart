import 'package:flutter_test/flutter_test.dart';
import 'package:koji/features/quote/domain/pricing_engine.dart';
import 'package:koji/features/pricing/models/pricing_models.dart';
import 'package:koji/features/quote/models/quote_models.dart';

void main() {
  group('Pricing Engine Verification - Child Bedroom', () {
    // 1. Setup Context
    // Access: Apartment (1.15), Condition: Medium (1.20) => 1.38
    final context = RealityFactors(
      access: 1.15,
      condition: 1.20,
      surface: 1.0,
    );
    
    // Rate: 50€/h (350 / 7)
    final profile = PricingProfile(
      id: 'test-profile',
      profession: 'Peintre',
      dailyRateHT: 350,
      hoursPerDay: 7,
    );

    // 2. Setup Products
    // Paint: 12€/L. Yield handled by task/engine interaction.
    final paintProduct = Product(id: 'p1', name: 'Paint', priceHT: 12.0, unit: 'L', category: 'Peinture', imageUrl: '');
    // Primer: 10€/L.
    final primerProduct = Product(id: 'p2', name: 'Primer', priceHT: 10.0, unit: 'L', category: 'Peinture', imageUrl: ''); // or 'Primaire' in Data
    // Filler: 18€/Bag.
    final fillerProduct = Product(id: 'p3', name: 'Filler', priceHT: 18.0, unit: 'Sac', category: 'Enduit', imageUrl: '');
    // Consumables: Mock logic via task?
    
    // 3. Define Tasks (As per PricingData but locally for test precision)
    
    // Skimming (Ratissage) - Walls 35m2
    // Req: Filler 8m2/bag
    final taskSkimming = SmartTask(
      id: 'ratissage', label: 'Skim', profession: 'Peintre', unit: 'm2', normativeTime: 0.15,
      materialRequirements: [MaterialRequirement(taskId: 'ratissage', productCategory: 'Enduit', yield: 8.0, defaultPricePerUnit: 18.0)]
    );

    // Sanding - Walls 35m2
    final taskSanding = SmartTask(
      id: 'poncage', label: 'Sand', profession: 'Peintre', unit: 'm2', normativeTime: 0.06,
      materialRequirements: [] // Consumables assumed separate or negligible for now
    );

    // Primer - Total 47m2 (Walls+Ceiling per prompt logic)
    // Req: Primer 8m2/L
    final taskPrimer = SmartTask(
      id: 'impression', label: 'Prime', profession: 'Peintre', unit: 'm2', normativeTime: 0.10,
      materialRequirements: [MaterialRequirement(taskId: 'impression', productCategory: 'Peinture', yield: 8.0, defaultPricePerUnit: 10.0)]
    );

    // Wall Painting (2 coats) - Walls 35m2
    // Req: Paint 10m2/L/coat -> 5m2/L total
    final taskWallPaint = SmartTask(
      id: 'paint_murs', label: 'Paint Walls', profession: 'Peintre', unit: 'm2', normativeTime: 0.60,
      materialRequirements: [MaterialRequirement(taskId: 'paint_murs', productCategory: 'Peinture', yield: 5.0, defaultPricePerUnit: 12.0)]
    );

    // Ceiling Painting (2 coats) - Ceiling 12m2
    // Req: Paint 5m2/L
    final taskCeilPaint = SmartTask(
      id: 'paint_ceil', label: 'Paint Ceil', profession: 'Peintre', unit: 'm2', normativeTime: 0.70,
      materialRequirements: [MaterialRequirement(taskId: 'paint_ceil', productCategory: 'Peinture', yield: 5.0, defaultPricePerUnit: 12.0)]
    );

    // Protection - Fixed
    final taskProt = SmartTask(
      id: 'prot', label: 'Prot', profession: 'Peintre', unit: 'forfait', normativeTime: 2.50, isFixedTime: true,
      materialRequirements: [] 
    );
    final taskClean = SmartTask(
      id: 'clean', label: 'Clean', profession: 'Peintre', unit: 'forfait', normativeTime: 1.0, isFixedTime: true,
      materialRequirements: [] 
    );


    test('Complete Quote Calculation', () {
       double totalLabor = 0;
       double totalMaterial = 0;
       double totalTime = 0;

       // function to run engine
       void run(SmartTask t, double qty, List<Product> prods) {
          final res = PricingEngine.calculateTaskPrice(
            task: t, quantity: qty, realityFactors: context, pricingProfile: profile, selectedProducts: prods
          );
          totalLabor += res.laborCost;
          totalMaterial += res.materialCost;
          totalTime += res.totalTimeHours; 
       }

       // Execute
       run(taskSkimming, 35.0, [fillerProduct]); // 5 bags = 90€
       run(taskSanding, 35.0, []);
       run(taskPrimer, 47.0, [primerProduct]); // 6L = 60€
       run(taskWallPaint, 35.0, [paintProduct]); // 35/5 = 7L -> 7 * 12 = 84€
       run(taskCeilPaint, 12.0, [paintProduct]); // 12/5 = 2.4 -> 3L -> 3 * 12 = 36€
       // Total Paint: 84 + 36 = 120€?
       // Prompt says total surface 47 -> 94 coverage -> 9.4L -> 10L. 120€.
       // If we calculate separately:
       // Wall: 35m2 / 5 = 7L.
       // Ceil: 12m2 / 5 = 2.4L -> 3L.
       // Total: 10L. Matches.
       
       run(taskProt, 1.0, []);
       run(taskClean, 1.0, []);
       
       // Add Consumables Manually (55€) as per prompt (no task Logic for it yet)
       totalMaterial += 55.0;

       // Verify Time
       // Base: 44.95
       expect(totalTime, closeTo(44.95, 0.01), reason: "Base Time");
       
       // Verify Labor
       // 44.95 * 1.38 = 62.031
       // Labor: 62.031 * 50 = 3101.55
       expect(totalLabor, closeTo(3101.55, 1.0), reason: "Labor Cost");
       
       // Verify Material
       // 90 + 60 + 120 + 55 = 325
       expect(totalMaterial, closeTo(325.0, 1.0), reason: "Material Cost");
       
       // Total
       // 3426.55
       expect(totalLabor + totalMaterial, closeTo(3426.50, 2.0));
    });
  });
}
