import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';

class ChantierListScreen extends ConsumerStatefulWidget {
  const ChantierListScreen({super.key});

  @override
  ConsumerState<ChantierListScreen> createState() => _ChantierListScreenState();
}

class _ChantierListScreenState extends ConsumerState<ChantierListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final List<String> _tabs = [
    "Tous",
    "En cours",
    "Acceptés",
    "Refusés",
    "Archives",
  ];

  // Tab controller setup
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this); // 5 tabs
    _tabController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authRepositoryProvider).currentUser;

    if (user == null) {
      return const Scaffold(
        body: Center(child: Text("Veuillez vous connecter")),
      );
    }

    final chantiersAsync = ref.watch(userChantiersProvider(user.id));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 20, 24, 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Spacer(),
                  Text(
                    'Chantiers',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.onSurface,
                    ),
                  ),
                  const Spacer(),
                  // Bell Icon
                  Stack(
                    alignment: Alignment.topRight,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surface,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Icon(
                          Icons.notifications_none_outlined,
                          color: Theme.of(context).colorScheme.onSurface,
                          size: 24,
                        ),
                      ),
                      Positioned(
                        top: 8,
                        right: 12,
                        child: Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFFEF4444), // Red dot
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Tab Bar
            SizedBox(
              height: 40,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                scrollDirection: Axis.horizontal,
                itemCount: _tabs.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final isSelected = _tabController.index == index;
                  return GestureDetector(
                    onTap: () {
                      _tabController.animateTo(index);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected 
                            ? Theme.of(context).colorScheme.primary 
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                        border: isSelected
                            ? null
                            : Border.all(color: Theme.of(context).dividerColor),
                      ),
                      child: Text(
                        _tabs[index],
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight:
                              isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected
                              ? Theme.of(context).colorScheme.onPrimary
                              : Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 20),

            // List
            Expanded(
              child: chantiersAsync.when(
                data: (chantiers) {
                  // Filter logic based on tabs
                  final filtered = chantiers.where((c) {
                    final status = c['status']?.toString().toLowerCase() ?? '';

                    final isArchived = status == 'termine' ||
                        status == 'terminé' ||
                        status == 'completed' ||
                        status == 'done' ||
                        status == 'archived';

                    if (_tabController.index == 0) return !isArchived; // Tous (actifs)
                    if (_tabController.index == 1 &&
                        (status == 'en cours' || status == 'en attente')) {
                      return true; // En cours
                    }
                    if (_tabController.index == 2 &&
                        (status == 'accepté' || status == 'accepte')) {
                      return true; // Acceptés
                    }
                    if (_tabController.index == 3 && status == 'refusé') {
                      return true; // Refusés
                    }
                    if (_tabController.index == 4 && isArchived) {
                      return true; // Archives (terminé + archived)
                    }
                    return false;
                  }).toList();

                  if (filtered.isEmpty) {
                    return const Center(
                      child: Text(
                        "Aucun chantier trouvé",
                        style: TextStyle( color: Colors.grey),
                      ),
                    );
                  }

                  return ListView.separated(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 16),
                    itemBuilder: (context, index) {
                      final item = filtered[index];
                      // Map real data to UI
                      final mappedItem = {
                        'id': item['id'],
                        'name': item['title'] ?? 'Chantier Sans Nom',
                        'type': item['property_type'] ?? 'Rénovation',
                        'ref': item['reference'] ?? 'N/A',
                        'date': _formatDateForBadge(item['created_at']),
                        'status': _formatStatusForUI(item['status']),
                        'price': '${item['estimated_budget'] ?? '0'} €',
                      };
                      return _buildChantierCard(mappedItem, context);
                    },
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, stack) => Center(child: Text('Erreur: $err')),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDateForBadge(String? isoDate) {
    if (isoDate == null) return "N/A";
    try {
      final dt = DateTime.parse(isoDate);
      final months = [
        'Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return "${dt.day} ${months[dt.month - 1]}";
    } catch (_) {
      return "N/A";
    }
  }

  String _formatStatusForUI(String? dbStatus) {
    if (dbStatus == null) return 'En cours';
    final s = dbStatus.toLowerCase();
    if (s.contains('accepté') || s.contains('accepte')) return 'Accepté';
    if (s == 'termine' || s == 'terminé' || s == 'completed' || s == 'done') return 'Terminé';
    if (s == 'archived') return 'Archivé';
    if (s.contains('refusé')) return 'Refusé';
    return 'En cours';
  }

  Widget _buildChantierCard(Map<String, dynamic> item, BuildContext context) {
    return GestureDetector(
      onTap: () {
        // Pass the actual database ID to the dashboard so it can fetch its own real data
        final Map<String, dynamic> extraData = {
          'id': item['id'], // Real ID for subsequent fetches
          'reference': item['ref'],
        };
        context.push('/chantier/dashboard', extra: extraData);
      },
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
              blurRadius: 15,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['name'],
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item['type']} • ${item['ref']}',
                      style: TextStyle(
                        fontSize: 13,
                        color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item['date'],
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF3B82F6),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    _buildStatusChip(item['status']),
                    if (item['hasTrash'] == true) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.delete_outline,
                          color: Color(0xFFEF4444), size: 22),
                    ],
                    if (item['hasDownload'] == true) ...[
                      const SizedBox(width: 8),
                      const Icon(Icons.file_download_outlined,
                          color: Color(0xFF3B82F6), size: 22),
                    ],
                  ],
                ),
                Text(
                  item['price'],
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    Color bgColor;
    Color textColor;
    IconData icon;

    switch (status) {
      case 'En cours':
        bgColor = const Color(0xFFEFF6FF);
        textColor = const Color(0xFF3B82F6);
        icon = Icons.circle; // small dot
        break;
      case 'Accepté':
        bgColor = const Color(0xFFECFDF5);
        textColor = const Color(0xFF10B981);
        icon = Icons.check_circle;
        break;
      case 'Terminé':
        bgColor = const Color(0xFFECFDF5);
        textColor = const Color(0xFF10B981);
        icon = Icons.check_circle;
        break;
      case 'Archivé':
        bgColor = const Color(0xFFF1F5F9);
        textColor = const Color(0xFF64748B);
        icon = Icons.archive_outlined;
        break;
      case 'Refusé':
        bgColor = const Color(0xFFFEF2F2);
        textColor = const Color(0xFFEF4444);
        icon = Icons.cancel;
        break;
      default:
        bgColor = const Color(0xFFF1F5F9);
        textColor = const Color(0xFF64748B);
        icon = Icons.info;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: textColor.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: textColor),
          const SizedBox(width: 6),
          Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
