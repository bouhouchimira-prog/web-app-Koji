import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/fournitures/models/fourniture_model.dart';
import 'package:koji/features/fournitures/repository/fourniture_repository.dart';
import 'package:koji/features/fournitures/add_fourniture_screen.dart';

class FournisseurDetailScreen extends ConsumerWidget {
  final Fournisseur fournisseur;
  final bool selectionMode;

  const FournisseurDetailScreen({
    super.key,
    required this.fournisseur,
    this.selectionMode = false,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncItems = ref.watch(fournisseurFournituresProvider(fournisseur.id));

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      body: SafeArea(
        child: Column(
          children: [
            // ─── HEADER ─────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 12, 16, 0),
              child: Row(
                children: [
                  Container(
                    margin: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back,
                          color: AppTheme.darkNavy, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      fournisseur.name,
                      textAlign: TextAlign.center,
                      style: AppTheme.headingStyle(context)
                          .copyWith(fontSize: 20),
                    ),
                  ),
                  // Delete supplier
                  IconButton(
                    icon: const Icon(Icons.delete_outline,
                        color: Colors.red, size: 22),
                    onPressed: () => _confirmDelete(context, ref),
                  ),
                ],
              ),
            ),

            // ─── SUPPLIER HERO ──────────
            Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F2648), Color(0xFF1A3A6B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0F2648).withOpacity(0.3),
                    blurRadius: 15,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Center(
                      child: Text(
                        fournisseur.name.isNotEmpty
                            ? fournisseur.name[0].toUpperCase()
                            : 'F',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.surface,
                          fontWeight: FontWeight.bold,
                          fontSize: 24,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fournisseur.name,
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Theme.of(context).colorScheme.surface,
                          ),
                        ),
                        const SizedBox(height: 4),
                        asyncItems.when(
                          data: (items) => Text(
                            '${items.length} fournitures',
                            style: TextStyle(
                              fontSize: 13,
                              color: Theme.of(context).colorScheme.surface.withOpacity(0.7),
                            ),
                          ),
                          loading: () => const SizedBox.shrink(),
                          error: (_, __) => const SizedBox.shrink(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ─── PRODUCTS LIST ──────────
            Expanded(
              child: asyncItems.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Erreur: $e')),
                data: (items) {
                  if (items.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(48),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 80,
                              height: 80,
                              decoration: const BoxDecoration(
                                color: Color(0xFFF1F5F9),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.inventory_2_outlined,
                                  size: 36, color: Color(0xFF94A3B8)),
                            ),
                            const SizedBox(height: 20),
                            const Text(
                              'Aucune fourniture',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppTheme.darkNavy,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Ajoutez des fournitures à ce fournisseur.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 14,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      if (selectionMode) {
                        return GestureDetector(
                          onTap: () => _pickQuantityAndReturn(context, item),
                          child: _buildItemCard(context, item),
                        );
                      }

                      return Dismissible(
                        key: Key(item.id),
                        direction: DismissDirection.endToStart,
                        background: Container(
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 24),
                          margin: const EdgeInsets.only(bottom: 12),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(
                            Icons.delete,
                            color: Theme.of(context).colorScheme.surface,
                          ),
                        ),
                        onDismissed: (_) async {
                          await ref
                              .read(fournitureRepositoryProvider)
                              .deleteFourniture(item.id);
                          ref.invalidate(fournisseurFournituresProvider(
                              fournisseur.id));
                        },
                        child: _buildItemCard(context, item),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => AddFournitureScreen(
                preselectedFournisseur: fournisseur,
              ),
            ),
          ).then((_) {
            ref.invalidate(fournisseurFournituresProvider(fournisseur.id));
          });
        },
        backgroundColor: AppTheme.darkNavy,
        child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface),
      ),
    );
  }

  Future<void> _pickQuantityAndReturn(BuildContext context, Fourniture item) async {
    final qtyController = TextEditingController(text: '1');
    // Let the user decide which price to bill: prix d'achat (cost) or prix de
    // vente (with margin). Default to vente so margin isn't lost by accident.
    bool useVente = true;

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(
            item.name,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: qtyController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Quantité',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Prix à utiliser',
                  style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _priceOption(
                ctx,
                label: "Prix d'achat",
                price: item.prixAchatHT,
                selected: !useVente,
                onTap: () => setSt(() => useVente = false),
              ),
              const SizedBox(height: 8),
              _priceOption(
                ctx,
                label: 'Prix de vente',
                price: item.prixVenteHT,
                selected: useVente,
                onTap: () => setSt(() => useVente = true),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler'),
            ),
            ElevatedButton(
              onPressed: () {
                final parsed = double.tryParse(
                        qtyController.text.trim().replaceAll(',', '.')) ??
                    1;
                Navigator.pop(ctx, {
                  'qty': parsed <= 0 ? 1.0 : parsed,
                  'useVente': useVente,
                });
              },
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppTheme.darkNavy),
              child: Text(
                'Ajouter',
                style: TextStyle(color: Theme.of(context).colorScheme.surface),
              ),
            ),
          ],
        ),
      ),
    );

    if (result == null || !context.mounted) return;
    final qty = (result['qty'] as num).toDouble();
    final pickedVente = result['useVente'] as bool;
    final chosenPrice = pickedVente ? item.prixVenteHT : item.prixAchatHT;

    Navigator.pop(context, {
      'id': item.id,
      'name': item.name,
      'fournisseur': item.fournisseurName ?? fournisseur.name,
      'fournisseurId': item.fournisseurId ?? fournisseur.id,
      // unitPrice is what the quote bills — set it to the user's choice.
      'unitPrice': chosenPrice,
      'sellPrice': item.prixVenteHT,
      'priceType': pickedVente ? 'vente' : 'achat',
      'quantity': qty,
      'conditionnement': item.conditionnement ?? '',
    });
  }

  /// Selectable price row used in the add-to-quote dialog.
  Widget _priceOption(
    BuildContext context, {
    required String label,
    required double price,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFEFF6FF) : Colors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? const Color(0xFF1D74FF) : const Color(0xFFE2E8F0),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              size: 20,
              color: selected ? const Color(0xFF1D74FF) : const Color(0xFF94A3B8),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
            ),
            Text('${price.toStringAsFixed(2)} €',
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }

  Widget _buildItemCard(BuildContext context, Fourniture item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(12),
            ),
            child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(item.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const Icon(Icons.inventory_2,
                                color: Colors.grey)),
                  )
                : const Icon(Icons.inventory_2,
                    color: Color(0xFF94A3B8), size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.darkNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 1),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.category,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF3B82F6),
                        ),
                      ),
                    ),
                    if (item.conditionnement != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        item.conditionnement!,
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${item.prixAchatHT.toStringAsFixed(2)} €',
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF94A3B8),
                ),
              ),
              Text(
                '${item.prixVenteHT.toStringAsFixed(2)} €',
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.darkNavy,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Supprimer ce fournisseur ?',
            style: TextStyle( fontWeight: FontWeight.bold)),
        content: Text(
            'Toutes les fournitures de "${fournisseur.name}" seront supprimées.',
            style: const TextStyle()),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              await ref
                  .read(fournitureRepositoryProvider)
                  .deleteFournisseur(fournisseur.id);
              ref.invalidate(fournisseursProvider);
              if (ctx.mounted) Navigator.pop(ctx);
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Supprimer',
                style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}
