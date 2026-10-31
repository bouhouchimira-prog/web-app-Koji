import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/supabase_config.dart';
import 'package:koji/features/quote/models/quote_models.dart';

class ProductRepository {
  Future<List<Product>> getProducts() async {
    final response = await SupabaseConfig.client
        .from('products')
        .select()
        .order('name', ascending: true);

    final data = response as List<dynamic>;
    return data.map((json) => Product.fromJson(json)).toList();
  }

  Future<void> addProduct(Map<String, dynamic> productData) async {
    await SupabaseConfig.client.from('products').insert(productData);
  }

  Future<void> deleteProduct(String productId) async {
    await SupabaseConfig.client.from('products').delete().eq('id', productId);
  }
}

final productRepositoryProvider = Provider((ref) => ProductRepository());

final productsProvider = FutureProvider<List<Product>>((ref) async {
  // Watch a refresh signal or just reload on call (for now basic FutureProvider)
  // In a real app we might use a StreamProvider or invalidate this provider on changes.
  return ref.watch(productRepositoryProvider).getProducts();
});
