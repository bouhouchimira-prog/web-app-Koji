/// Catégories de produits / fournitures — liste de SECOURS (style Odoo).
/// La source réelle est la table Supabase `product_categories`
/// (cf. supabase/create_product_categories.sql) ; cette liste sert de repli
/// hors-ligne ou si la table est vide. Utilisée par le sélecteur de fournitures
/// du devis ET le formulaire de création, pour rester cohérent partout.
const List<String> kFournitureCategories = [
  'Carrelage',
  'Chauffage',
  'Couverture',
  'Cuisine',
  'Démolition',
  'Démolition / préparation',
  'Électricité',
  'Enduit',
  'Façade',
  'Isolation',
  'Maçonnerie',
  'Main-d\'œuvre',
  'Matériaux',
  'Menuiserie',
  'Menuiserie extérieure',
  'Murs',
  'Nettoyage',
  'Outillage',
  'Peinture',
  'Placoplâtre',
  'Plâtrerie',
  'Plomberie',
  'Revêtement de sol',
  'Sanitaire',
  'Serrurerie / Métallerie',
  'Terrassement',
  'Toiture',
  'VRD / Extérieur',
  'Autre',
];

class Fournisseur {
  final String id;
  final String name;
  final String? logoUrl;
  final DateTime createdAt;

  const Fournisseur({
    required this.id,
    required this.name,
    this.logoUrl,
    required this.createdAt,
  });

  factory Fournisseur.fromMap(Map<String, dynamic> map) {
    return Fournisseur(
      id: map['id'] as String,
      name: map['name'] as String,
      logoUrl: map['logo_url'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'name': name,
      if (logoUrl != null) 'logo_url': logoUrl,
    };
  }
}

class Fourniture {
  final String id;
  final String name;
  final String category;
  final double prixAchatHT;
  final double prixVenteHT;
  final String? conditionnement;
  final String? barcode;
  final String? imageUrl;
  final String? sourceUrl;
  final String? fournisseurId;
  final String? fournisseurName; // Joined field
  final DateTime createdAt;

  const Fourniture({
    required this.id,
    required this.name,
    required this.category,
    required this.prixAchatHT,
    required this.prixVenteHT,
    this.conditionnement,
    this.barcode,
    this.imageUrl,
    this.sourceUrl,
    this.fournisseurId,
    this.fournisseurName,
    required this.createdAt,
  });

  factory Fourniture.fromMap(Map<String, dynamic> map) {
    // Handle joined fournisseur name
    String? supplierName;
    if (map['fournisseurs'] != null && map['fournisseurs'] is Map) {
      supplierName = (map['fournisseurs'] as Map)['name'] as String?;
    }

    return Fourniture(
      id: map['id'] as String,
      name: map['name'] as String,
      category: (map['category'] as String?) ?? 'Autre',
      prixAchatHT: (map['prix_achat_ht'] as num?)?.toDouble() ?? 0.0,
      prixVenteHT: (map['prix_vente_ht'] as num?)?.toDouble() ?? 0.0,
      conditionnement: map['conditionnement'] as String?,
      barcode: map['barcode'] as String?,
      imageUrl: map['image_url'] as String?,
      sourceUrl: map['source_url'] as String?,
      fournisseurId: map['fournisseur_id'] as String?,
      fournisseurName: supplierName,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  Map<String, dynamic> toInsertMap() {
    return {
      'name': name,
      'category': category,
      'prix_achat_ht': prixAchatHT,
      'prix_vente_ht': prixVenteHT,
      if (conditionnement != null) 'conditionnement': conditionnement,
      if (barcode != null) 'barcode': barcode,
      if (imageUrl != null) 'image_url': imageUrl,
      if (sourceUrl != null) 'source_url': sourceUrl,
      if (fournisseurId != null) 'fournisseur_id': fournisseurId,
    };
  }
}
