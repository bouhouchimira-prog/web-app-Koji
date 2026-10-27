class LibraryOuvrage {
  final String id;
  final String code;
  final String designation;
  final String? famille;
  final String? unite;
  final double tempsHU;
  final double tauxHoraire;
  final double coutMoU;
  final String? commentaire;
  final double coefficient;
  final double reduction;

  /// Non-null when this row is a sous-ouvrage nested under another ouvrage.
  final String? parentId;

  /// Sous-ouvrages nested under this ouvrage. Populated in memory after fetch
  /// (assembled from parent_id) — never a DB column itself.
  final List<LibraryOuvrage> subOuvrages;

  const LibraryOuvrage({
    required this.id,
    required this.code,
    required this.designation,
    this.famille,
    this.unite,
    this.tempsHU = 0,
    this.tauxHoraire = 0,
    this.coutMoU = 0,
    this.commentaire,
    this.coefficient = 1.0,
    this.reduction = 0.0,
    this.parentId,
    this.subOuvrages = const [],
  });

  bool get isSubOuvrage => parentId != null;
  bool get hasSubOuvrages => subOuvrages.isNotEmpty;

  double get finalUnitPrice =>
      coutMoU * coefficient * (1 - (reduction / 100.0));

  factory LibraryOuvrage.fromMap(Map<String, dynamic> map) => LibraryOuvrage(
        id: map['id'] as String,
        code: map['code'] as String? ?? '',
        designation: map['designation'] as String? ?? '',
        famille: map['famille'] as String?,
        unite: map['unite'] as String?,
        tempsHU: (map['temps_hu'] as num?)?.toDouble() ?? 0,
        tauxHoraire: (map['taux_horaire'] as num?)?.toDouble() ?? 0,
        coutMoU: (map['cout_mo_u'] as num?)?.toDouble() ?? 0,
        commentaire: map['commentaire'] as String?,
        coefficient: (map['coefficient'] as num?)?.toDouble() ?? 1.0,
        reduction: (map['reduction'] as num?)?.toDouble() ?? 0.0,
        parentId: map['parent_id'] as String?,
      );

  Map<String, dynamic> toInsertMap(String userId) => {
        'user_id': userId,
        'code': code,
        'designation': designation,
        'famille': famille,
        'unite': unite,
        'temps_hu': tempsHU,
        'taux_horaire': tauxHoraire,
        'cout_mo_u': coutMoU,
        'commentaire': commentaire,
        'coefficient': coefficient,
        'reduction': reduction,
        if (parentId != null) 'parent_id': parentId,
      };

  Map<String, dynamic> toUpdateMap() => {
        'code': code,
        'designation': designation,
        'famille': famille,
        'unite': unite,
        'temps_hu': tempsHU,
        'taux_horaire': tauxHoraire,
        'cout_mo_u': coutMoU,
        'commentaire': commentaire,
        'coefficient': coefficient,
        'reduction': reduction,
        'parent_id': parentId,
        'updated_at': DateTime.now().toIso8601String(),
      };

  LibraryOuvrage copyWith({
    String? code,
    String? designation,
    String? famille,
    String? unite,
    double? tempsHU,
    double? tauxHoraire,
    double? coutMoU,
    String? commentaire,
    double? coefficient,
    double? reduction,
    String? parentId,
    List<LibraryOuvrage>? subOuvrages,
  }) {
    return LibraryOuvrage(
      id: id,
      code: code ?? this.code,
      designation: designation ?? this.designation,
      famille: famille ?? this.famille,
      unite: unite ?? this.unite,
      tempsHU: tempsHU ?? this.tempsHU,
      tauxHoraire: tauxHoraire ?? this.tauxHoraire,
      coutMoU: coutMoU ?? this.coutMoU,
      commentaire: commentaire ?? this.commentaire,
      coefficient: coefficient ?? this.coefficient,
      reduction: reduction ?? this.reduction,
      parentId: parentId ?? this.parentId,
      subOuvrages: subOuvrages ?? this.subOuvrages,
    );
  }
}
