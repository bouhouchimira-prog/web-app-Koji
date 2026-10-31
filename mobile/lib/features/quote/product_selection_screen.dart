import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/quote/models/quote_models.dart';
import 'package:koji/features/quote/product_details_screen.dart';
import 'package:koji/features/quote/repository/product_repository.dart';

class ProductSelectionScreen extends ConsumerStatefulWidget {
  final String? roomId;
  final String? taskId;
  final String? categoryFilter;

  const ProductSelectionScreen({
    super.key,
    this.roomId,
    this.taskId,
    this.categoryFilter,
  });

  @override
  ConsumerState<ProductSelectionScreen> createState() =>
      _ProductSelectionScreenState();
}

class _ProductSelectionScreenState
    extends ConsumerState<ProductSelectionScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _brandController = TextEditingController();
  final TextEditingController _priceController = TextEditingController();
  final TextEditingController _imageUrlController = TextEditingController();
  final TextEditingController _packagingController = TextEditingController();

  String _searchQuery = '';
  String _activeFilter = 'Catégoris';
  String? _selectedGamme;
  Set<String> _favorites = {};

  String _selectedCategory = 'Peinture';
  String _selectedUnit = 'u';

  final List<String> _categories = [
    'Peinture', 'Enduit', 'Outillage', 'Materiaux', 'Autre'
  ];
  final List<String> _units = ['u', 'L', 'kg', 'm2', 'ml'];
  final List<String> _gammes = ['Gamme A', 'Gamme B', 'Gamme C'];

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);
    final productsAsync = ref.watch(productsProvider);
    final isSelectionMode = widget.roomId != null && widget.taskId != null;

    return Scaffold(
      backgroundColor: appBg,
      body: Stack(
        children: [
          // Background Gradient
          Positioned(
            top: -50,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withValues(alpha: 0.6),
                    const Color(0xFFFBE4D2).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24.0, vertical: 16.0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          if (Navigator.canPop(context)) {
                            Navigator.pop(context);
                          } else {
                            context.go('/home');
                          }
                        },
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: darkNavy.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.chevron_left,
                              color: darkNavy, size: 28),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          isSelectionMode
                              ? "Recherche de Produits"
                              : "Recherche des Fournitures",
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: darkNavy,
                          ),
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                ),

                // Content based on async state
                Expanded(
                  child: productsAsync.when(
                    data: (allProducts) =>
                        _buildContent(allProducts, isSelectionMode, darkNavy),
                    loading: () => const Center(
                        child: CircularProgressIndicator(
                            color: Color(0xFF2E65F3))),
                    error: (err, _) =>
                        Center(child: Text('Erreur: $err')),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      // FAB for add product (only in non-selection mode)
      floatingActionButton: !isSelectionMode
          ? FloatingActionButton(
              onPressed: _showAddProductDialog,
              backgroundColor: darkNavy,
              child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface),
            )
          : null,
    );
  }

  Widget _buildContent(
      List<Product> allProducts, bool isSelectionMode, Color darkNavy) {
    // Filter
    final filteredProducts = allProducts.where((p) {
      if (widget.categoryFilter != null &&
          widget.categoryFilter!.isNotEmpty) {
        if (p.category.trim().toLowerCase() !=
            widget.categoryFilter!.trim().toLowerCase()) {
          return false;
        }
      }
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return p.name.toLowerCase().contains(q) ||
          p.brand.toLowerCase().contains(q) ||
          p.category.toLowerCase().contains(q);
    }).toList();

    return Column(
      children: [
        // Search Bar
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFEEF2F6)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: (val) =>
                  setState(() => _searchQuery = val),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w500,
                color: Color(0xFF0A1227),
              ),
              decoration: InputDecoration(
                hintText: "Peinture, Enduit, Outillage...",
                hintStyle: TextStyle(
                  color: Colors.grey[400],
                  fontWeight: FontWeight.w400,
                ),
                border: InputBorder.none,
                suffixIcon: const Icon(Icons.search,
                    color: Color(0xFF0A1227), size: 22),
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ),

        const SizedBox(height: 14),

        // Filter Chips
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Row(
            children: [
              _buildFilterChip('Catégoris'),
              const SizedBox(width: 10),
              _buildFilterChip('Fournisseur'),
              const SizedBox(width: 10),
              _buildGammeChip(darkNavy),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Results Count
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${filteredProducts.length} Résultats trouvés',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[500],
                  fontWeight: FontWeight.w500,
                ),
              ),
              Row(
                children: [
                  Text(
                    'Tirer par',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF0A1227),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.keyboard_arrow_down,
                      color: Color(0xFF0A1227), size: 18),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Product List
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            itemCount: filteredProducts.length,
            itemBuilder: (context, index) {
              return _buildProductCard(
                  filteredProducts[index], isSelectionMode);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String label) {
    final isActive = _activeFilter == label;
    return GestureDetector(
      onTap: () => setState(() => _activeFilter = label),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
            horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: isActive
              ? const Color(0xFF0A1227)
              : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: isActive
              ? null
              : Border.all(color: const Color(0xFFE0E7FF)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isActive ? Colors.white : Colors.grey[500],
          ),
        ),
      ),
    );
  }

  Widget _buildGammeChip(Color darkNavy) {
    final isActive = _activeFilter == 'Gamme';
    return PopupMenuButton<String>(
      onSelected: (val) {
        setState(() {
          _activeFilter = 'Gamme';
          _selectedGamme = val;
        });
      },
      offset: const Offset(0, 44),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      itemBuilder: (_) => _gammes
          .map((g) => PopupMenuItem(
                value: g,
                child: Text(
                  g,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ))
          .toList(),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
            horizontal: 18, vertical: 10),
        decoration: BoxDecoration(
          color: isActive ? darkNavy : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: isActive
              ? null
              : Border.all(color: const Color(0xFFE0E7FF)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _selectedGamme ?? 'Gamme',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isActive ? Colors.white : Colors.grey[500],
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.keyboard_arrow_down,
                size: 18,
                color: isActive ? Colors.white : Colors.grey[500]),
          ],
        ),
      ),
    );
  }

  Widget _buildProductCard(Product product, bool isSelectionMode) {
    const darkNavy = Color(0xFF0A1227);
    final isFavorite = _favorites.contains(product.id);

    return GestureDetector(
      onLongPress: !isSelectionMode ? () => _confirmDelete(product) : null,
      onTap: () async {
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => ProductDetailsScreen(
              product: product,
              initialQuantity: 1.0,
            ),
          ),
        );
        if (result != null && result is double) {
          if (mounted && isSelectionMode) {
            Navigator.pop(context, {'product': product, 'quantity': result});
          }
        }
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 14),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image
            Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(14),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: product.imageUrl.isNotEmpty
                    ? (product.imageUrl.startsWith('http')
                        ? Image.network(product.imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                const Icon(Icons.image,
                                    color: Colors.grey, size: 36))
                        : Image.asset(product.imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                const Icon(Icons.image,
                                    color: Colors.grey, size: 36)))
                    : const Icon(Icons.image,
                        color: Colors.grey, size: 36),
              ),
            ),

            const SizedBox(width: 14),

            // Details
            Expanded(
              child: SizedBox(
                height: 90,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment:
                              MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              "${product.brand.toUpperCase()} PREMIUM",
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF8B95A5),
                                letterSpacing: 0.5,
                              ),
                            ),
                            // Star favorite
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  if (isFavorite) {
                                    _favorites.remove(product.id);
                                  } else {
                                    _favorites.add(product.id);
                                  }
                                });
                              },
                              child: Icon(
                                isFavorite
                                    ? Icons.star
                                    : Icons.star_border,
                                size: 20,
                                color: isFavorite
                                    ? const Color(0xFFFFB800)
                                    : const Color(0xFFCBD5E1),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          product.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: darkNavy,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            const Icon(Icons.tune,
                                size: 12, color: Color(0xFF8B95A5)),
                            const SizedBox(width: 4),
                            Text(
                              '10m²/L • 15L',
                              style: const TextStyle(
                                fontSize: 11,
                                color: Color(0xFF8B95A5),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      mainAxisAlignment:
                          MainAxisAlignment.spaceBetween,
                      children: [
                        RichText(
                          text: TextSpan(
                            children: [
                              TextSpan(
                                text:
                                    '${product.priceHT.toStringAsFixed(2)}€',
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: darkNavy,
                                ),
                              ),
                              const TextSpan(
                                text: ' HT/U',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Color(0xFF8B95A5),
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          width: 32,
                          height: 32,
                          decoration: const BoxDecoration(
                            color: Color(0xFF2E65F3),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.add,
                              color: Theme.of(context).colorScheme.surface, size: 20),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddProductDialog() {
    _nameController.clear();
    _brandController.clear();
    _priceController.clear();
    _imageUrlController.clear();
    _packagingController.clear();
    setState(() {
      _selectedCategory = 'Peinture';
      _selectedUnit = 'u';
    });

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(builder: (context, setDialogState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20)),
            title: const Text("Nouveau Produit",
                style: TextStyle( fontWeight: FontWeight.bold)),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _dialogField(_nameController, "Nom du produit*"),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _selectedCategory,
                    decoration: const InputDecoration(
                        labelText: "Catégorie",
                        border: OutlineInputBorder()),
                    items: _categories
                        .map((c) =>
                            DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (val) =>
                        setDialogState(() => _selectedCategory = val!),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _dialogField(
                            _priceController, "Prix HT*",
                            keyboardType: const TextInputType
                                .numberWithOptions(decimal: true)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedUnit,
                          decoration: const InputDecoration(
                              labelText: "Unité",
                              border: OutlineInputBorder()),
                          items: _units
                              .map((u) => DropdownMenuItem(
                                  value: u, child: Text(u)))
                              .toList(),
                          onChanged: (val) =>
                              setDialogState(() => _selectedUnit = val!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _dialogField(_packagingController,
                      "Conditionnement (ex: Pot 10L)"),
                  const SizedBox(height: 10),
                  _dialogField(_brandController, "Marque"),
                  const SizedBox(height: 10),
                  _dialogField(
                      _imageUrlController, "URL Image (Optionnel)"),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text("Annuler",
                    style: TextStyle(color: Colors.grey)),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0A1227),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () async {
                  if (_nameController.text.isNotEmpty &&
                      _priceController.text.isNotEmpty) {
                    final price = double.tryParse(_priceController.text
                            .replaceAll(',', '.')) ??
                        0.0;
                    final newProduct = {
                      'name': _nameController.text,
                      'brand': _brandController.text.isNotEmpty
                          ? _brandController.text
                          : null,
                      'price_ht': price,
                      'image_url': _imageUrlController.text.isNotEmpty
                          ? _imageUrlController.text
                          : null,
                      'category': _selectedCategory,
                      'unit': _selectedUnit,
                      'packaging': _packagingController.text.isNotEmpty
                          ? _packagingController.text
                          : null,
                      'consumption_rule_type': 'fixed',
                      'consumption_rule_factor': 1.0,
                    };
                    try {
                      await ref
                          .read(productRepositoryProvider)
                          .addProduct(newProduct);
                      ref.invalidate(productsProvider);
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      debugPrint("Error adding product: $e");
                    }
                  }
                },
                child: Text("Créer",
                    style: TextStyle(color: Theme.of(context).colorScheme.surface)),
              ),
            ],
          );
        });
      },
    );
  }

  Widget _dialogField(TextEditingController controller, String label,
      {TextInputType? keyboardType}) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
          labelText: label, border: const OutlineInputBorder()),
    );
  }

  void _confirmDelete(Product product) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text("Supprimer ?"),
          content:
              Text("Voulez-vous vraiment supprimer ${product.name} ?"),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("Annuler"),
            ),
            TextButton(
              onPressed: () async {
                await ref
                    .read(productRepositoryProvider)
                    .deleteProduct(product.id);
                ref.invalidate(productsProvider);
                if (context.mounted) Navigator.pop(context);
              },
              child: const Text("Supprimer",
                  style: TextStyle(color: Colors.red)),
            ),
          ],
        );
      },
    );
  }
}
