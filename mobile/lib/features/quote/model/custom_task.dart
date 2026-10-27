class CustomTask {
  final String id;
  final String title;
  final String? description;
  final String profession;
  final List<String> imageUrls;
  final Map<String, dynamic> defaultProducts;

  // ── KOJI Banque de Temps fields ────────────────────────────────────────
  final String? code;
  final String? famille;
  final String? unite;
  final double? tempsHU;
  final String? typePoste;   // 'POSTE' or 'SOUS-POSTE'
  final String? parentId;    // non-null for sous-postes

  // populated in memory after fetch — not a DB column
  List<CustomTask> subTasks;

  CustomTask({
    required this.id,
    required this.title,
    this.description,
    required this.profession,
    this.imageUrls = const [],
    this.defaultProducts = const {},
    this.code,
    this.famille,
    this.unite,
    this.tempsHU,
    this.typePoste,
    this.parentId,
    this.subTasks = const [],
  });

  bool get isParent => typePoste == 'POSTE' || (parentId == null && subTasks.isNotEmpty);
  bool get isChild  => parentId != null;

  // Sum of children temps_hu (if has children), else own tempsHU
  double get effectiveTempsHU {
    if (subTasks.isNotEmpty) {
      return subTasks.fold(0.0, (s, t) => s + (t.tempsHU ?? 0));
    }
    return tempsHU ?? 0;
  }

  factory CustomTask.fromMap(Map<String, dynamic> map) {
    return CustomTask(
      id: map['id'],
      title: map['title'],
      description: map['description'],
      profession: map['profession'] ?? '',
      imageUrls: List<String>.from(map['image_urls'] ?? []),
      defaultProducts: Map<String, dynamic>.from(map['default_products'] ?? {}),
      code: map['code'] as String?,
      famille: map['famille'] as String?,
      unite: map['unite'] as String?,
      tempsHU: (map['temps_hu'] as num?)?.toDouble(),
      typePoste: map['type_poste'] as String?,
      parentId: map['parent_id'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'title': title,
      'description': description,
      'profession': profession,
      'image_urls': imageUrls,
      'default_products': defaultProducts,
      if (code != null) 'code': code,
      if (famille != null) 'famille': famille,
      if (unite != null) 'unite': unite,
      if (tempsHU != null) 'temps_hu': tempsHU,
      if (typePoste != null) 'type_poste': typePoste,
      if (parentId != null) 'parent_id': parentId,
    };
  }

  double coutMOParUnite(double tauxHoraire) => effectiveTempsHU * tauxHoraire;
}
