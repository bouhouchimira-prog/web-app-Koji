import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart';
import 'package:koji/features/quote/repository/quote_repository.dart';

class ArchivesScreen extends ConsumerStatefulWidget {
  const ArchivesScreen({super.key});

  @override
  ConsumerState<ArchivesScreen> createState() => _ArchivesScreenState();
}

class _ArchivesScreenState extends ConsumerState<ArchivesScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _isArchived(String? raw) {
    final s = (raw ?? '').toLowerCase();
    return s == 'archived' ||
        s == 'archive' ||
        s == 'archivé' ||
        s == 'archivee' ||
        s == 'archivée';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authRepositoryProvider).currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text('Veuillez vous connecter')),
      );
    }

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      body: SafeArea(
        child: Column(
          children: [
            // Header
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
                      'Archives',
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

            // Tab bar
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              child: TabBar(
                controller: _tabController,
                indicator: BoxDecoration(
                  color: AppTheme.darkNavy,
                  borderRadius: BorderRadius.circular(10),
                ),
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                labelColor: Colors.white,
                unselectedLabelColor: AppTheme.textSecondary(context),
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
                tabs: const [
                  Tab(text: 'Chantiers'),
                  Tab(text: 'Devis'),
                ],
              ),
            ),

            const SizedBox(height: 16),

            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _buildChantiersList(user.id),
                  _buildQuotesList(user.id),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChantiersList(String userId) {
    final chantiersAsync = ref.watch(userChantiersProvider(userId));

    return chantiersAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (list) {
        final archived = list.where((c) {
          return _isArchived(c['status'] as String?);
        }).toList();

        if (archived.isEmpty) {
          return _emptyState(
            icon: Icons.archive_outlined,
            title: 'Aucun chantier archivé',
            subtitle: 'Les chantiers archivés apparaîtront ici',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: archived.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final c = archived[index];
            final id = c['id'] as String?;
            final title = (c['title'] as String?)?.trim().isNotEmpty == true
                ? (c['title'] as String)
                : (c['reference'] as String?) ?? 'Chantier';
            final reference = (c['reference'] as String?) ?? '';

            return _archiveTile(
              icon: Icons.handyman_outlined,
              title: title,
              subtitle: reference,
              onTap: id == null
                  ? null
                  : () => context.push('/chantier/dashboard',
                      extra: {'id': id, 'reference': reference}),
              onRestore: id == null
                  ? null
                  : () async {
                      try {
                        await ref
                            .read(chantierRepositoryProvider)
                            .updateChantierStatus(id, 'en_cours');
                        ref.invalidate(userChantiersProvider(userId));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Chantier restauré')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Erreur: $e')),
                          );
                        }
                      }
                    },
              onDelete: id == null
                  ? null
                  : () async {
                      if (!await _confirmDelete('chantier')) return;
                      try {
                        await ref
                            .read(chantierRepositoryProvider)
                            .deleteChantier(id);
                        ref.invalidate(userChantiersProvider(userId));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Chantier supprimé')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Erreur: $e')),
                          );
                        }
                      }
                    },
            );
          },
        );
      },
    );
  }

  Widget _buildQuotesList(String userId) {
    final quotesAsync = ref.watch(userQuotesProvider(userId));

    return quotesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Erreur: $e')),
      data: (list) {
        final archived = list.where((q) {
          return _isArchived(q['status'] as String?);
        }).toList();

        if (archived.isEmpty) {
          return _emptyState(
            icon: Icons.description_outlined,
            title: 'Aucun devis archivé',
            subtitle: 'Les devis archivés apparaîtront ici',
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: archived.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, index) {
            final q = archived[index];
            final id = q['id'] as String?;
            final client = q['client'] as Map<String, dynamic>? ?? {};
            final clientName =
                (client['name'] as String?)?.trim().isNotEmpty == true
                    ? (client['name'] as String)
                    : 'Client';
            final ref0 =
                (q['quoteNumber'] ?? q['reference'] ?? '').toString();

            return _archiveTile(
              icon: Icons.description_outlined,
              title: clientName,
              subtitle: ref0,
              onTap: id == null
                  ? null
                  : () => context.push('/quote/detail', extra: q),
              onRestore: id == null
                  ? null
                  : () async {
                      try {
                        await ref
                            .read(quoteRepositoryProvider)
                            .updateQuoteStatus(id, 'en_cours');
                        ref.invalidate(userQuotesProvider(userId));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Devis restauré')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Erreur: $e')),
                          );
                        }
                      }
                    },
              onDelete: id == null
                  ? null
                  : () async {
                      if (!await _confirmDelete('devis')) return;
                      try {
                        await ref
                            .read(quoteRepositoryProvider)
                            .deleteQuote(id);
                        ref.invalidate(userQuotesProvider(userId));
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Devis supprimé')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Erreur: $e')),
                          );
                        }
                      }
                    },
            );
          },
        );
      },
    );
  }

  Future<bool> _confirmDelete(String label) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('Supprimer ce $label ?'),
            content: const Text(
                'Cette action est définitive et ne peut pas être annulée.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Annuler'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text(
                  'Supprimer',
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ],
          ),
        ) ??
        false;
  }

  Widget _archiveTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback? onTap,
    required VoidCallback? onRestore,
    VoidCallback? onDelete,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.mutedSurface(context),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: AppTheme.textPrimary(context)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary(context),
                    ),
                  ),
                  if (subtitle.isNotEmpty)
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        color: AppTheme.textSecondary(context),
                      ),
                    ),
                ],
              ),
            ),
            if (onRestore != null)
              IconButton(
                tooltip: 'Restaurer',
                icon: Icon(
                  Icons.unarchive_outlined,
                  color: AppTheme.textPrimary(context),
                  size: 20,
                ),
                onPressed: onRestore,
              ),
            if (onDelete != null)
              IconButton(
                tooltip: 'Supprimer',
                icon: const Icon(
                  Icons.delete_outline,
                  color: Colors.red,
                  size: 20,
                ),
                onPressed: onDelete,
              ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: AppTheme.textSecondary(context)),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTheme.textPrimary(context),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppTheme.textSecondary(context),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
