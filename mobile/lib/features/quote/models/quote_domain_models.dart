// Pure domain models for the quote feature.
// These represent business concepts, have no Flutter/UI dependencies,
// and can be serialized to/from JSON for persistence.

// ─── Enums ──────────────────────────────────────────────────────────────────

enum InputType {
  number,
  text,
  toggle,
}

enum ConsumptionRuleType {
  fixed, // Quantity is fixed
  perM2, // Qty = ceil(surface * factor)
  perLinearMeter, // Qty = ceil(length * factor)
  perPiece, // Qty = ceil(pieces * factor)
  custom,
}

// ─── Value Objects ───────────────────────────────────────────────────────────

class ConsumptionRule {
  final ConsumptionRuleType type;
  final double factor; // e.g. 0.1 liters per m² → 10m² needs 1 liter

  const ConsumptionRule({
    required this.type,
    this.factor = 1.0,
  });
}

/// A dynamic input field required by a task (e.g. Surface, Length).
class TaskInputField {
  final String id;
  final String label;
  final String suffix; // e.g. "m²", "ml", "u"
  final InputType type;
  final double? defaultValue;

  const TaskInputField({
    required this.id,
    required this.label,
    required this.suffix,
    this.type = InputType.number,
    this.defaultValue,
  });
}

// ─── Product ─────────────────────────────────────────────────────────────────

/// Represents a physical product or supply.
class Product {
  final String id;
  final String name;
  final String imageUrl;
  final double priceHT;
  final String unit; // "L", "kg", "unit"
  final String packaging; // "15L", "Sac 25kg"
  final ConsumptionRule consumptionRule;
  final String category;
  final String brand;

  const Product({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.priceHT,
    required this.unit,
    this.packaging = '',
    this.consumptionRule =
        const ConsumptionRule(type: ConsumptionRuleType.fixed),
    this.category = 'Materiaux',
    this.brand = 'Generic',
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    final ruleTypeStr = json['consumption_rule_type'] as String? ?? 'fixed';
    final ruleFactor =
        (json['consumption_rule_factor'] as num?)?.toDouble() ?? 1.0;

    ConsumptionRuleType type;
    switch (ruleTypeStr) {
      case 'perM2':
        type = ConsumptionRuleType.perM2;
        break;
      case 'perLinearMeter':
        type = ConsumptionRuleType.perLinearMeter;
        break;
      case 'perPiece':
        type = ConsumptionRuleType.perPiece;
        break;
      case 'custom':
        type = ConsumptionRuleType.custom;
        break;
      default:
        type = ConsumptionRuleType.fixed;
    }

    return Product(
      id: json['id'] as String,
      name: json['name'] as String,
      imageUrl: json['image_url'] as String? ?? '',
      priceHT: (json['price_ht'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] as String? ?? 'u',
      packaging: json['packaging'] as String? ?? '',
      category: json['category'] as String? ?? 'Materiaux',
      brand: json['brand'] as String? ?? 'Generic',
      consumptionRule: ConsumptionRule(type: type, factor: ruleFactor),
    );
  }
}

// ─── Chantier (Project) Models ───────────────────────────────────────────────

/// Address for a project/chantier.
class ChantierAddress {
  final String street;
  final String? complement;
  final String postalCode;
  final String city;
  final String? country;

  const ChantierAddress({
    required this.street,
    this.complement,
    required this.postalCode,
    required this.city,
    this.country = 'France',
  });

  factory ChantierAddress.fromJson(Map<String, dynamic> json) {
    return ChantierAddress(
      street: json['street'] as String,
      complement: json['complement'] as String?,
      postalCode: json['postal_code'] as String,
      city: json['city'] as String,
      country: json['country'] as String? ?? 'France',
    );
  }

  Map<String, dynamic> toJson() => {
        'street': street,
        'complement': complement,
        'postal_code': postalCode,
        'city': city,
        'country': country,
      };

  String get fullAddress {
    final comp = complement?.isNotEmpty == true ? '$complement, ' : '';
    return '$comp$street, $postalCode $city';
  }
}

/// Client contact for a chantier.
class ChantierContact {
  final String firstName;
  final String lastName;
  final String? email;
  final String? phone;
  final String? company;

  const ChantierContact({
    required this.firstName,
    required this.lastName,
    this.email,
    this.phone,
    this.company,
  });

  factory ChantierContact.fromJson(Map<String, dynamic> json) {
    return ChantierContact(
      firstName: json['first_name'] as String,
      lastName: json['last_name'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      company: json['company'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'first_name': firstName,
        'last_name': lastName,
        'email': email,
        'phone': phone,
        'company': company,
      };

  String get fullName => '$firstName $lastName';
}

/// Main Chantier (Project) domain entity.
class Chantier {
  final String id;
  final String title;
  final String? description;
  final ChantierAddress address;
  final ChantierContact contact;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status; // 'draft', 'in_progress', 'completed', 'cancelled'
  final double? estimatedBudget;
  final String? notes;
  final List<String> photoPaths;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const Chantier({
    required this.id,
    required this.title,
    this.description,
    required this.address,
    required this.contact,
    this.startDate,
    this.endDate,
    this.status = 'draft',
    this.estimatedBudget,
    this.notes,
    List<String>? photoPaths,
    required this.createdAt,
    this.updatedAt,
  }) : photoPaths = photoPaths ?? const [];

  factory Chantier.fromJson(Map<String, dynamic> json) {
    return Chantier(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      address:
          ChantierAddress.fromJson(json['address'] as Map<String, dynamic>),
      contact:
          ChantierContact.fromJson(json['contact'] as Map<String, dynamic>),
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'] as String)
          : null,
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      status: json['status'] as String? ?? 'draft',
      estimatedBudget: (json['estimated_budget'] as num?)?.toDouble(),
      notes: json['notes'] as String?,
      photoPaths:
          (json['photo_paths'] as List<dynamic>?)?.cast<String>() ?? const [],
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'address': address.toJson(),
        'contact': contact.toJson(),
        'start_date': startDate?.toIso8601String(),
        'end_date': endDate?.toIso8601String(),
        'status': status,
        'estimated_budget': estimatedBudget,
        'notes': notes,
        'photo_paths': photoPaths,
        'created_at': createdAt.toIso8601String(),
        'updated_at': updatedAt?.toIso8601String(),
      };

  Chantier copyWith({
    String? title,
    String? description,
    ChantierAddress? address,
    ChantierContact? contact,
    DateTime? startDate,
    DateTime? endDate,
    String? status,
    double? estimatedBudget,
    String? notes,
    List<String>? photoPaths,
    DateTime? updatedAt,
  }) {
    return Chantier(
      id: id,
      title: title ?? this.title,
      description: description ?? this.description,
      address: address ?? this.address,
      contact: contact ?? this.contact,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      estimatedBudget: estimatedBudget ?? this.estimatedBudget,
      notes: notes ?? this.notes,
      photoPaths: photoPaths ?? this.photoPaths,
      createdAt: createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }
}

/// Helper class for creating a new chantier (mutable builder).
class ChantierCreationData {
  String title;
  String? description;
  ChantierAddress? address;
  ChantierContact? contact;
  DateTime? startDate;
  DateTime? endDate;
  double? estimatedBudget;
  String? notes;

  ChantierCreationData({
    this.title = '',
    this.description,
    this.address,
    this.contact,
    this.startDate,
    this.endDate,
    this.estimatedBudget,
    this.notes,
  });

  bool get isValid =>
      title.isNotEmpty &&
      address != null &&
      contact != null &&
      contact!.firstName.isNotEmpty &&
      contact!.lastName.isNotEmpty;

  Chantier toChantier() {
    if (!isValid) throw StateError('Cannot create Chantier from invalid data');
    return Chantier(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      title: title,
      description: description,
      address: address!,
      contact: contact!,
      startDate: startDate,
      endDate: endDate,
      estimatedBudget: estimatedBudget,
      notes: notes,
      createdAt: DateTime.now(),
    );
  }
}
