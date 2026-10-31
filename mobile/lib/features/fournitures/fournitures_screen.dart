import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/fournitures/models/fourniture_model.dart';
import 'package:koji/features/fournitures/repository/fourniture_repository.dart';
import 'package:koji/features/fournitures/fournisseur_detail_screen.dart';
import 'package:koji/features/fournitures/add_fourniture_screen.dart';

class FournituresScreen extends ConsumerStatefulWidget {
  final bool selectionMode;
  const FournituresScreen({super.key, this.selectionMode = false});

  @override
  ConsumerState<FournituresScreen> createState() => _FournituresScreenState();
}

class _FournituresScreenState extends ConsumerState<FournituresScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    // Same 4 tabs in both modes (client request): Récents / Divers /
    // Fournitures / Fournisseurs — selection mode included, so the user can
    // pick a fourniture from any list, not only via a fournisseur.
    _tabController = TabController(length: 4, vsync: this, initialIndex: 0);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      body: SafeArea(
        child: Column(
          children: [
            // ─── HEADER ─────────────────────
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
                      icon: Icon(
                        Icons.arrow_back,
                        color: AppTheme.textPrimary(context),
                        size: 20,
                      ),
                      onPressed: () {
                        if (Navigator.canPop(context)) {
                          context.pop();
                        } else {
                          context.go('/home');
                        }
                      },
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Fournitures',
                      textAlign: TextAlign.center,
                      style: AppTheme.headingStyle(context)
                          .copyWith(fontSize: 20),
                    ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),

            const SizedBox(height: 8),

            // ─── TAB BAR ────────────────────
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withOpacity(0.04),
                    blurRadius: 10,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppTheme.darkNavy,
                  borderRadius: BorderRadius.circular(10),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                labelColor: Colors.white,
                unselectedLabelColor: AppTheme.textLight,
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 12,
                ),
                unselectedLabelStyle: const TextStyle(
                  fontWeight: FontWeight.w500,
                  fontSize: 12,
                ),
                labelPadding: const EdgeInsets.symmetric(horizontal: 2),
                padding: const EdgeInsets.all(4),
                tabs: const [
                  Tab(text: 'Récents'),
                  Tab(text: 'Divers'),
                  Tab(text: 'Fournitures'),
                  Tab(text: 'Fournisseurs'),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ─── TAB CONTENT ─────────────────
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _RecentsTab(selectionMode: widget.selectionMode),
                  _DiversTab(selectionMode: widget.selectionMode),
                  _AllFournituresTab(selectionMode: widget.selectionMode),
                  _FournisseursTab(selectionMode: widget.selectionMode),
                ],
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddOptions(context),
        backgroundColor: AppTheme.darkNavy,
        child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface),
      ),
    );
  }

  void _showAddOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppTheme.borderColor(context),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            _OptionTile(
              icon: Icons.inventory_2_outlined,
              label: 'Ajouter une fourniture',
              subtitle: 'Ajouter manuellement ou via un lien',
              onTap: () {
                Navigator.pop(ctx);
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const AddFournitureScreen(),
                  ),
                ).then((_) => _refreshAll());
              },
            ),
            const SizedBox(height: 12),
            _OptionTile(
              icon: Icons.store_outlined,
              label: 'Ajouter un fournisseur',
              subtitle: 'Créer un nouveau fournisseur',
              onTap: () {
                Navigator.pop(ctx);
                _showAddFournisseurDialog(context);
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _showAddFournisseurDialog(BuildContext context) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Nouveau Fournisseur',
            style: TextStyle( fontWeight: FontWeight.bold)),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: InputDecoration(
            hintText: 'Nom du fournisseur',
            hintStyle: TextStyle(color: AppTheme.textSecondary(context)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(
              'Annuler',
              style: TextStyle(color: AppTheme.textSecondary(context)),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.darkNavy,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              if (controller.text.trim().isNotEmpty) {
                await ref
                    .read(fournitureRepositoryProvider)
                    .addFournisseur(controller.text.trim());
                ref.invalidate(fournisseursProvider);
                if (ctx.mounted) Navigator.pop(ctx);
              }
            },
            child: Text(
              'Créer',
              style: TextStyle(color: Theme.of(context).colorScheme.surface),
            ),
          ),
        ],
      ),
    );
  }

  void _refreshAll() {
    ref.invalidate(recentFournituresProvider);
    ref.invalidate(diversFournituresProvider);
    ref.invalidate(allFournituresProvider);
    ref.invalidate(fournisseursProvider);
  }
}

// ─── RÉCENTS TAB ────────────────────────────

class _RecentsTab extends ConsumerWidget {
  final bool selectionMode;
  const _RecentsTab({this.selectionMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(recentFournituresProvider);
    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (items) {
        if (items.isEmpty) {
          return _EmptyState(
            icon: Icons.history,
            title: 'Aucune fourniture récente',
            subtitle: 'Vos fournitures récemment ajoutées apparaîtront ici.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: items.length,
          itemBuilder: (context, index) => _DeletableFournitureCard(
            item: items[index],
            selectionMode: selectionMode,
            onDeleted: () {
              ref.invalidate(recentFournituresProvider);
              ref.invalidate(diversFournituresProvider);
              ref.invalidate(allFournituresProvider);
              ref.invalidate(fournisseursProvider);
            },
          ),
        );
      },
    );
  }
}

// ─── DIVERS TAB ─────────────────────────────

class _DiversTab extends ConsumerWidget {
  final bool selectionMode;
  const _DiversTab({this.selectionMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(diversFournituresProvider);
    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (items) {
        if (items.isEmpty) {
          return _EmptyState(
            icon: Icons.category_outlined,
            title: 'Aucune fourniture diverse',
            subtitle: 'Les fournitures sans fournisseur apparaîtront ici.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: items.length,
          itemBuilder: (context, index) => _DeletableFournitureCard(
            item: items[index],
            selectionMode: selectionMode,
            onDeleted: () {
              ref.invalidate(recentFournituresProvider);
              ref.invalidate(diversFournituresProvider);
              ref.invalidate(allFournituresProvider);
              ref.invalidate(fournisseursProvider);
            },
          ),
        );
      },
    );
  }
}

// ─── FOURNITURES TAB (toutes) ───────────────

class _AllFournituresTab extends ConsumerWidget {
  final bool selectionMode;
  const _AllFournituresTab({this.selectionMode = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(allFournituresProvider);
    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (items) {
        if (items.isEmpty) {
          return _EmptyState(
            icon: Icons.inventory_2_outlined,
            title: 'Aucune fourniture',
            subtitle: 'Ajoutez vos fournitures via le bouton +.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: items.length,
          itemBuilder: (context, index) => _DeletableFournitureCard(
            item: items[index],
            selectionMode: selectionMode,
            onDeleted: () {
              ref.invalidate(recentFournituresProvider);
              ref.invalidate(diversFournituresProvider);
              ref.invalidate(allFournituresProvider);
              ref.invalidate(fournisseursProvider);
            },
          ),
        );
      },
    );
  }
}

// ─── FOURNISSEURS TAB ───────────────────────

class _FournisseursTab extends ConsumerWidget {
  final bool selectionMode;
  const _FournisseursTab({required this.selectionMode});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(fournisseursProvider);
    return asyncData.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (fournisseurs) {
        if (fournisseurs.isEmpty) {
          return _EmptyState(
            icon: Icons.store_outlined,
            title: 'Aucun fournisseur',
            subtitle: 'Ajoutez un fournisseur pour organiser vos fournitures.',
          );
        }
        return ListView.builder(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: fournisseurs.length,
          itemBuilder: (context, index) {
            final f = fournisseurs[index];
            return _FournisseurCard(
              fournisseur: f,
              selectionMode: selectionMode,
            );
          },
        );
      },
    );
  }
}

// ─── SHARED WIDGETS ─────────────────────────

/// Wraps a [_FournitureCard] with swipe-to-delete in the Récents/Divers tabs.
/// In selection mode we don't allow deleting (the card is being picked), so it
/// renders the plain card. [onDeleted] lets the parent tab refresh its lists.
class _DeletableFournitureCard extends ConsumerWidget {
  final Fourniture item;
  final bool selectionMode;
  final VoidCallback onDeleted;

  const _DeletableFournitureCard({
    required this.item,
    required this.selectionMode,
    required this.onDeleted,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final card = _FournitureCard(item: item, selectionMode: selectionMode);
    if (selectionMode) return card;

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
        child: Icon(Icons.delete, color: Theme.of(context).colorScheme.surface),
      ),
      confirmDismiss: (_) async {
        return await showDialog<bool>(
              context: context,
              builder: (ctx) => AlertDialog(
                shape:
                    RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                title: const Text('Supprimer cette fourniture ?',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                content: Text('"${item.name}" sera définitivement supprimée.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('Annuler',
                        style: TextStyle(color: Colors.grey)),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('Supprimer',
                        style: TextStyle(
                            color: Colors.red, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ) ??
            false;
      },
      onDismissed: (_) async {
        await ref.read(fournitureRepositoryProvider).deleteFourniture(item.id);
        onDeleted();
      },
      child: card,
    );
  }
}

class _FournitureCard extends StatelessWidget {
  final Fourniture item;
  final bool selectionMode;
  const _FournitureCard({required this.item, this.selectionMode = false});

  /// In selection mode, ask the user which price to bill (achat vs vente) and
  /// the quantity, then return the picked fourniture to the caller.
  Future<void> _pickPriceAndReturn(BuildContext context) async {
    final qtyController = TextEditingController(text: '1');
    bool useVente = true; // default to vente so margin isn't lost

    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSt) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Text(item.name,
              style: const TextStyle(fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: qtyController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                    labelText: 'Quantité', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              const Text('Prix à utiliser',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              _PriceOptionRow(
                label: "Prix d'achat",
                price: item.prixAchatHT,
                selected: !useVente,
                onTap: () => setSt(() => useVente = false),
              ),
              const SizedBox(height: 8),
              _PriceOptionRow(
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
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppTheme.darkNavy),
              onPressed: () {
                final parsed = double.tryParse(
                        qtyController.text.trim().replaceAll(',', '.')) ??
                    1;
                Navigator.pop(ctx, {
                  'qty': parsed <= 0 ? 1.0 : parsed,
                  'useVente': useVente,
                });
              },
              child: Text('Ajouter',
                  style:
                      TextStyle(color: Theme.of(context).colorScheme.surface)),
            ),
          ],
        ),
      ),
    );

    if (result == null || !context.mounted) return;
    final pickedVente = result['useVente'] as bool;
    Navigator.pop(context, {
      'id': item.id,
      'name': item.name,
      'fournisseur': item.fournisseurName ?? '',
      'unitPrice': pickedVente ? item.prixVenteHT : item.prixAchatHT,
      'sellPrice': item.prixVenteHT,
      'priceType': pickedVente ? 'vente' : 'achat',
      'quantity': (result['qty'] as num).toDouble(),
      'conditionnement': item.conditionnement ?? '',
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: selectionMode ? () => _pickPriceAndReturn(context) : null,
      child: Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: selectionMode
            ? Border.all(
                color: Theme.of(context)
                    .colorScheme
                    .primary
                    .withValues(alpha: 0.3),
              )
            : null,
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
          // Image / Icon
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppTheme.mutedSurface(context),
              borderRadius: BorderRadius.circular(12),
            ),
            child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(item.imageUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const Icon(Icons.inventory_2, color: Colors.grey)),
                  )
                : const Icon(Icons.inventory_2,
                    color: Color(0xFF94A3B8), size: 28),
          ),
          const SizedBox(width: 14),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary(context),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .primary
                            .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        item.category,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                    if (item.conditionnement != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        item.conditionnement!,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppTheme.textSecondary(context),
                        ),
                      ),
                    ],
                  ],
                ),
                if (item.fournisseurName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.fournisseurName!,
                    style: TextStyle(
                      fontSize: 11,
                      color: AppTheme.textSecondary(context),
                    ),
                  ),
                ],
              ],
            ),
          ),

          // Price
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${item.prixVenteHT.toStringAsFixed(2)} €',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary(context),
                ),
              ),
              Text(
                'H.T',
                style: TextStyle(
                  fontSize: 10,
                  color: AppTheme.textSecondary(context),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
    );
  }
}

class _FournisseurCard extends StatelessWidget {
  final Fournisseur fournisseur;
  final bool selectionMode;
  const _FournisseurCard({required this.fournisseur, required this.selectionMode});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final result = await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) =>
                FournisseurDetailScreen(
                  fournisseur: fournisseur,
                  selectionMode: selectionMode,
                ),
          ),
        );
        // In selection mode, the detail screen pops with the picked
        // fourniture map. Bubble it up so the original caller of
        // FournituresScreen receives the selection.
        if (selectionMode && result != null && context.mounted) {
          Navigator.pop(context, result);
        }
      },
      child: Container(
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
            // Logo
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppTheme.headerBackground(context),
                borderRadius: BorderRadius.circular(12),
              ),
              child: fournisseur.logoUrl != null
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: Image.network(fournisseur.logoUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Center(
                                child: Text(
                                  fournisseur.name.isNotEmpty
                                      ? fournisseur.name[0].toUpperCase()
                                      : 'F',
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.surface,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 20,
                                  ),
                                ),
                              )),
                    )
                  : Center(
                      child: Text(
                        fournisseur.name.isNotEmpty
                            ? fournisseur.name[0].toUpperCase()
                            : 'F',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.surface,
                          fontWeight: FontWeight.bold,
                          fontSize: 20,
                        ),
                      ),
                    ),
            ),
            const SizedBox(width: 14),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    fournisseur.name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary(context),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Voir les fournitures →',
                    style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

            Icon(Icons.chevron_right,
                color: AppTheme.textSecondary(context), size: 24),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  const _OptionTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppTheme.headerBackground(context),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: Theme.of(context).colorScheme.surface, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary(context),
                      )),
                  Text(subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary(context),
                      )),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: AppTheme.textSecondary(context)),
          ],
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyState({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(48),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppTheme.mutedSurface(context),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 36, color: AppTheme.textSecondary(context)),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: AppTheme.textPrimary(context),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppTheme.textSecondary(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Selectable achat/vente price row used in the "add to quote" dialog.
class _PriceOptionRow extends StatelessWidget {
  final String label;
  final double price;
  final bool selected;
  final VoidCallback onTap;

  const _PriceOptionRow({
    required this.label,
    required this.price,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
              color:
                  selected ? const Color(0xFF1D74FF) : const Color(0xFF94A3B8),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600)),
            ),
            Text('${price.toStringAsFixed(2)} €',
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}
