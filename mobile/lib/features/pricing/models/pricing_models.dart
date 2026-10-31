// Domain models for the backend-driven pricing system

class PricingProfile {
  final String id;
  final String profession;
  final double dailyRateHT;
  final double hoursPerDay;
  final bool isActive;

  PricingProfile({
    required this.id,
    required this.profession,
    required this.dailyRateHT,
    required this.hoursPerDay,
    this.isActive = true,
  });

  double get hourlyRate => dailyRateHT / hoursPerDay;

  factory PricingProfile.fromJson(Map<String, dynamic> json) {
    return PricingProfile(
      id: json['id'] as String,
      profession: json['profession'] as String,
      dailyRateHT: (json['daily_rate_ht'] as num).toDouble(),
      hoursPerDay: (json['hours_per_day'] as num).toDouble(),
      isActive: json['is_active'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'profession': profession,
      'daily_rate_ht': dailyRateHT,
      'hours_per_day': hoursPerDay,
      'is_active': isActive,
    };
  }
}

class SmartTask {
  final String id;
  final String label;
  final String profession;
  final String unit;
  final double normativeTime;
  final bool isFixedTime;
  final List<MaterialRequirement> materialRequirements;

  const SmartTask({
    required this.id,
    required this.label,
    required this.profession,
    required this.unit,
    required this.normativeTime,
    this.isFixedTime = false,
    this.materialRequirements = const [],
  });

  factory SmartTask.fromJson(Map<String, dynamic> json,
      {List<MaterialRequirement>? requirements}) {
    return SmartTask(
      id: json['id'] as String,
      label: json['label'] as String,
      profession: json['profession'] as String,
      unit: json['unit'] as String,
      normativeTime: (json['normative_time'] as num).toDouble(),
      isFixedTime: json['is_fixed_time'] as bool? ?? false,
      materialRequirements: requirements ?? [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'profession': profession,
      'unit': unit,
      'normative_time': normativeTime,
      'is_fixed_time': isFixedTime,
    };
  }
}

class MaterialRequirement {
  final String taskId; // Fixed: now stored as a typed field for direct lookup
  final String productCategory;
  final double yield;
  final double defaultPricePerUnit;
  final bool isFixedQuantity;

  const MaterialRequirement({
    required this.taskId,
    required this.productCategory,
    required this.yield,
    required this.defaultPricePerUnit,
    this.isFixedQuantity = false,
  });

  factory MaterialRequirement.fromJson(Map<String, dynamic> json) {
    return MaterialRequirement(
      taskId: json['task_id'] as String? ?? '',
      productCategory: json['product_category'] as String,
      yield: (json['yield'] as num).toDouble(),
      defaultPricePerUnit: (json['default_price_per_unit'] as num).toDouble(),
      isFixedQuantity: json['is_fixed_quantity'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'task_id': taskId,
      'product_category': productCategory,
      'yield': yield,
      'default_price_per_unit': defaultPricePerUnit,
      'is_fixed_quantity': isFixedQuantity,
    };
  }
}

class RealityFactors {
  final double access;
  final double condition;
  final double surface;

  const RealityFactors({
    this.access = 1.0,
    this.condition = 1.0,
    this.surface = 1.0,
  });

  double get globalCoefficient => access * condition * surface;
  double get totalCoefficient => globalCoefficient; // Alias for compatibility
}

class PriceBreakdown {
  final double totalTimeHours;
  final double correctedTimeHours;
  final double laborCost;
  final double materialCost;
  final double totalHt;

  const PriceBreakdown({
    required this.totalTimeHours,
    required this.correctedTimeHours,
    required this.laborCost,
    required this.materialCost,
    required this.totalHt,
  });
}
