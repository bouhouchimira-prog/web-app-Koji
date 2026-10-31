import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/quote/models/quote_models.dart';

class ProductDetailsScreen extends StatefulWidget {
  final Product product;
  final double initialQuantity;
  final String roomLabel; // Context info (e.g. "Salon")

  const ProductDetailsScreen({
    super.key,
    required this.product,
    this.initialQuantity = 0,
    this.roomLabel = '',
  });

  @override
  State<ProductDetailsScreen> createState() => _ProductDetailsScreenState();
}

class _ProductDetailsScreenState extends State<ProductDetailsScreen> {
  late double _quantity;

  @override
  void initState() {
    super.initState();
    _quantity = widget.initialQuantity > 0 ? widget.initialQuantity : 1.0;
  }

  void _increment() {
    setState(() {
      _quantity++;
    });
  }

  void _decrement() {
    if (_quantity > 0) {
      setState(() {
        _quantity--;
      });
    }
  }

  void _save() {
    Navigator.pop(context, _quantity);
  }

  @override
  Widget build(BuildContext context) {
    final totalPrice = widget.product.priceHT * _quantity;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: Text(
          'Détails Produit',
          style: AppTheme.headingStyle(context)
              .copyWith(fontSize: 18, color: AppTheme.darkNavy),
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back,
                color: AppTheme.darkNavy, size: 20),
            onPressed: () => context.pop(),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Product Image Large
            Container(
              height: 250,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: widget.product.imageUrl.startsWith('http')
                    ? Image.network(widget.product.imageUrl, fit: BoxFit.cover)
                    : (widget.product.imageUrl.isNotEmpty
                        ? Image.asset(widget.product.imageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                                Icons.image,
                                size: 80,
                                color: Colors.grey))
                        : const Icon(Icons.image,
                            size: 80, color: Colors.grey)),
              ),
            ),

            const SizedBox(height: 32),

            // Brand & Name
            Text(
              widget.product.brand.toUpperCase(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppTheme.textLight,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              widget.product.name,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: AppTheme.darkNavy,
                height: 1.2,
              ),
            ),

            const SizedBox(height: 24),

            // Price & Unit
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${widget.product.priceHT.toStringAsFixed(2)}€ HT / ${widget.product.unit}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1D74FF),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE0E7FF),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    widget.product.packaging.isNotEmpty
                        ? widget.product.packaging
                        : 'Unité',
                    style: const TextStyle(
                      color: Color(0xFF1D74FF),
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 32),

            // Quantity Selector
            const Text(
              'Quantité',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTheme.darkNavy,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE0E7FF)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Decrement
                  IconButton(
                    onPressed: _decrement,
                    icon: const Icon(Icons.remove_circle_outline,
                        color: Color(0xFF1D74FF)),
                  ),
                  // Quantity Display
                  Text(
                    _quantity.toStringAsFixed(0),
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.darkNavy,
                    ),
                  ),
                  // Increment
                  IconButton(
                    onPressed: _increment,
                    icon: const Icon(Icons.add_circle_outline,
                        color: Color(0xFF1D74FF)),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 48),

            // Total Estimation
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Total estimé:',
                  style: TextStyle(
                    fontSize: 18,
                    color: AppTheme.textLight,
                  ),
                ),
                Text(
                  '${totalPrice.toStringAsFixed(2)}€ HT',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1D74FF),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ElevatedButton(
            onPressed: _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1D74FF),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 18),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
              elevation: 0,
            ),
            child: const Text(
              'Valider et ajouter à la tâche',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
