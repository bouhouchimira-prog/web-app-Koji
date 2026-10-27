import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:koji/features/fournitures/models/fourniture_model.dart';

class FournitureRepository {
  final SupabaseClient _client;

  FournitureRepository(this._client);

  // ─── FOURNISSEURS ─────────────────────────

  Future<List<Fournisseur>> getFournisseurs() async {
    final data = await _client
        .from('fournisseurs')
        .select()
        .order('name', ascending: true);
    return (data as List).map((e) => Fournisseur.fromMap(e)).toList();
  }

  Future<Fournisseur> addFournisseur(String name, {String? logoUrl}) async {
    final userId = _client.auth.currentUser!.id;
    final data = await _client.from('fournisseurs').insert({
      'user_id': userId,
      'name': name,
      if (logoUrl != null) 'logo_url': logoUrl,
    }).select().single();
    return Fournisseur.fromMap(data);
  }

  Future<void> deleteFournisseur(String id) async {
    await _client.from('fournisseurs').delete().eq('id', id);
  }

  // ─── CATÉGORIES DE PRODUITS ───────────────
  // Source : table `product_categories` (globales + celles de l'utilisateur).
  // Repli sur kFournitureCategories si la table est vide / injoignable.
  Future<List<String>> getProductCategories() async {
    try {
      final data = await _client
          .from('product_categories')
          .select('name, sort_order')
          .order('sort_order', ascending: true)
          .order('name', ascending: true);
      final names = (data as List)
          .map((e) => (e['name'] as String?)?.trim() ?? '')
          .where((s) => s.isNotEmpty)
          .toList();
      // Dédoublonnage en conservant l'ordre.
      final seen = <String>{};
      final ordered = <String>[];
      for (final n in names) {
        if (seen.add(n.toLowerCase())) ordered.add(n);
      }
      return ordered.isEmpty ? kFournitureCategories : ordered;
    } catch (_) {
      return kFournitureCategories;
    }
  }

  // ─── FOURNITURES ──────────────────────────

  Future<List<Fourniture>> getAllFournitures() async {
    final data = await _client
        .from('fournitures')
        .select('*, fournisseurs(name)')
        .order('created_at', ascending: false);
    return (data as List).map((e) => Fourniture.fromMap(e)).toList();
  }

  Future<List<Fourniture>> getFournituresByFournisseur(String fournisseurId) async {
    final data = await _client
        .from('fournitures')
        .select('*, fournisseurs(name)')
        .eq('fournisseur_id', fournisseurId)
        .order('name', ascending: true);
    return (data as List).map((e) => Fourniture.fromMap(e)).toList();
  }

  Future<List<Fourniture>> getRecentFournitures({int limit = 20}) async {
    final data = await _client
        .from('fournitures')
        .select('*, fournisseurs(name)')
        .order('created_at', ascending: false)
        .limit(limit);
    return (data as List).map((e) => Fourniture.fromMap(e)).toList();
  }

  Future<List<Fourniture>> getDiversFournitures() async {
    final data = await _client
        .from('fournitures')
        .select('*, fournisseurs(name)')
        .isFilter('fournisseur_id', null)
        .order('created_at', ascending: false);
    return (data as List).map((e) => Fourniture.fromMap(e)).toList();
  }

  /// Upload une image de fourniture (galerie) → renvoie l'URL publique.
  /// Bucket : `fourniture-images` (créer le bucket public côté Supabase).
  Future<String> uploadFournitureImage(String filePath) async {
    final userId = _client.auth.currentUser!.id;
    final bytes = await File(filePath).readAsBytes();
    final ext = filePath.contains('.') ? filePath.split('.').last : 'jpg';
    final name =
        '$userId/${DateTime.now().millisecondsSinceEpoch}.$ext';
    await _client.storage.from('fourniture-images').uploadBinary(
          name,
          bytes,
          fileOptions: FileOptions(upsert: true, contentType: 'image/$ext'),
        );
    return _client.storage.from('fourniture-images').getPublicUrl(name);
  }

  Future<Fourniture> addFourniture(Map<String, dynamic> fournitureData) async {
    final userId = _client.auth.currentUser!.id;
    final data = await _client.from('fournitures').insert({
      ...fournitureData,
      'user_id': userId,
    }).select('*, fournisseurs(name)').single();
    return Fourniture.fromMap(data);
  }

  Future<void> updateFourniture(String id, Map<String, dynamic> updates) async {
    await _client.from('fournitures').update(updates).eq('id', id);
  }

  Future<void> deleteFourniture(String id) async {
    await _client.from('fournitures').delete().eq('id', id);
  }
}

// ─── PROVIDERS ──────────────────────────────

final fournitureRepositoryProvider = Provider<FournitureRepository>((ref) {
  return FournitureRepository(Supabase.instance.client);
});

final fournisseursProvider = FutureProvider<List<Fournisseur>>((ref) {
  return ref.read(fournitureRepositoryProvider).getFournisseurs();
});

final recentFournituresProvider = FutureProvider<List<Fourniture>>((ref) {
  return ref.read(fournitureRepositoryProvider).getRecentFournitures();
});

final allFournituresProvider = FutureProvider<List<Fourniture>>((ref) {
  return ref.read(fournitureRepositoryProvider).getAllFournitures();
});

/// Catégories de produits depuis Supabase (avec repli sur kFournitureCategories).
final productCategoriesProvider = FutureProvider<List<String>>((ref) {
  return ref.read(fournitureRepositoryProvider).getProductCategories();
});

final diversFournituresProvider = FutureProvider<List<Fourniture>>((ref) {
  return ref.read(fournitureRepositoryProvider).getDiversFournitures();
});

final fournisseurFournituresProvider =
    FutureProvider.family<List<Fourniture>, String>((ref, fournisseurId) {
  return ref.read(fournitureRepositoryProvider).getFournituresByFournisseur(fournisseurId);
});
