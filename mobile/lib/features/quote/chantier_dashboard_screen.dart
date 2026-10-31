import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/synchronization/data/rdv_repository.dart';

class ChantierDashboardScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;

  const ChantierDashboardScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierDashboardScreen> createState() =>
      _ChantierDashboardScreenState();
}

class _ChantierDashboardScreenState extends ConsumerState<ChantierDashboardScreen> {
  final _repository = ChantierRepository();

  Map<String, dynamic>? _nextRdv;
  bool _rdvLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadNextRdv();
    _linkOrphanQuotes();
  }

  /// Self-heal: a devis created standalone may have chantier_id = null, so the
  /// chantier shows "0 devis / aucune tâche". Stamp the link, then refresh the
  /// devis + À faire providers so the dashboard reflects it without a manual
  /// re-save of the devis.
  Future<void> _linkOrphanQuotes() async {
    final chantierId = widget.data['id'] as String?;
    if (chantierId == null) return;
    try {
      final linked = await _repository.linkOrphanQuotesToChantier(chantierId);
      if (linked > 0 && mounted) {
        ref.invalidate(chantierQuotesProvider(chantierId));
        ref.invalidate(chantierAFaireTasksProvider(chantierId));
      }
    } catch (_) {/* best-effort; strict match still works without it */}
  }

  Future<void> _loadNextRdv() async {
    final chantierId = widget.data['id'] as String?;
    final user = ref.read(authProvider).value;
    if (chantierId == null || user == null) {
      setState(() => _rdvLoaded = true);
      return;
    }
    try {
      final rdvRepo = ref.read(rdvRepositoryProvider);
      final rdvs = await rdvRepo.getRdvs(userId: user.id, chantierId: chantierId);
      final now = DateTime.now();
      final upcoming = rdvs.where((r) {
        final dt = DateTime.tryParse(r['scheduled_at'] as String? ?? '');
        return dt != null && dt.isAfter(now);
      }).toList();
      if (mounted) {
        setState(() {
          _nextRdv = upcoming.isNotEmpty ? upcoming.first : null;
          _rdvLoaded = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _rdvLoaded = true);
    }
  }

  String _formatRdvDate(String isoString) {
    final dt = DateTime.tryParse(isoString);
    if (dt == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final rdvDay = DateTime(dt.year, dt.month, dt.day);
    final diff = rdvDay.difference(today).inDays;
    final time = DateFormat('HH:mm').format(dt);
    if (diff == 0) return "Aujourd'hui, $time";
    if (diff == 1) return 'Demain, $time';
    return '${DateFormat('dd/MM').format(dt)}, $time';
  }

  String get _chantierName =>
      widget.data['reference'] as String? ?? 'Mon Chantier';

  // ──────────────────────────────────────────
  // Bottom sheet: "Ajouter tâche"
  // ──────────────────────────────────────────
  void _showAddMenu() {
    final data = widget.data;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddMenuSheet(
        onItemTap: (label) {
          Navigator.of(context).pop();
          switch (label) {
            case 'À faire':
              context.push('/chantier/afaire', extra: data);
              break;
            case 'Budget':
              context.push('/chantier/budget', extra: data);
              break;
            case 'Devis':
              context.push('/chantier/devis', extra: data);
              break;
            case 'Facturation':
              context.push('/chantier/facturation', extra: data);
              break;
            case 'Mes RDV':
              context.push('/chantier/rdv', extra: data);
              break;
            case 'Documents':
              context.push('/chantier/documents', extra: data);
              break;
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final chantierId = widget.data['id'] as String?;
    
    // Fallback if no ID is provided
    if (chantierId == null) {
      return const Scaffold(body: Center(child: Text("ID Chantier manquant")));
    }

    final tasksAsync = ref.watch(chantierTasksProvider(chantierId));
    final budgetAsync = ref.watch(chantierBudgetProvider(chantierId));
    final documentsAsync = ref.watch(chantierDocumentsProvider(chantierId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F2EE),
      floatingActionButton: _buildFAB(),
      body: SafeArea(
        child: tasksAsync.when(
          loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF0F172A))),
          error: (err, stack) => Center(child: Text('Erreur: $err')),
          data: (tasks) {
            return budgetAsync.when(
              loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF0F172A))),
              error: (err, stack) => Center(child: Text('Erreur Budget: $err')),
              data: (budget) {
                return documentsAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF0F172A))),
                  error: (err, stack) => Center(child: Text('Erreur Documents: $err')),
                  data: (documents) {
                    return CustomScrollView(
                      slivers: [
                        // ── App Bar ──
                        SliverToBoxAdapter(child: _buildAppBar()),

                        // ── Cards ──
                        SliverPadding(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
                          sliver: SliverList(
                            delegate: SliverChildListDelegate([
                              _buildAFaireCard(tasks),
                              const SizedBox(height: 14),
                              _buildBudgetCard(budget),
                              const SizedBox(height: 14),
                              _buildDevisRdvRow(),
                              const SizedBox(height: 14),
                              // Facturation moved to the app sidebar (drawer).
                              _buildDocumentsCard(documents),
                              const SizedBox(height: 14),
                              _buildWorkerActivityCard(),
                            ]),
                          ),
                        ),
                      ],
                    );
                  },
                );
              },
            );
          },
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildAppBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          // Back button
          GestureDetector(
            onTap: () {
              if (Navigator.canPop(context)) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE8E8E8)),
              ),
              child: const Icon(
                Icons.chevron_left_rounded,
                color: Color(0xFF0F172A),
                size: 22,
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Title + subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  ' Chantier',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                Text(
                  _chantierName,
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ],
            ),
          ),
          // Info button
          GestureDetector(
            onTap: () => context.push('/chantier/info', extra: widget.data),
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFE8E8E8)),
              ),
              child: const Icon(
                Icons.info_outline_rounded,
                color: Color(0xFF0F172A),
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildAFaireCard(List<Map<String, dynamic>> tasks) {
    return _SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              const Icon(Icons.description_outlined,
                  size: 18, color: Color(0xFF0F172A)),
              const SizedBox(width: 8),
              const Text(
                'À faire',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          // Checklist
          if (tasks.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 8.0),
              child: Text(
                'Aucune tâche pour le moment',
                style: TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 14,
                ),
              ),
            ),
          ...tasks.asMap().entries.map((e) {
            final task = e.value;
            final bool isDone = task['is_done'] == true;

            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: () async {
                  try {
                    await _repository.updateTaskStatus(task['id'], !isDone);
                  } catch (err) {
                    debugPrint('Error updating task: $err');
                  }
                },
                child: Row(
                  children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: isDone ? const Color(0xFF0F172A) : Colors.white,
                        border: Border.all(
                          color: isDone
                              ? const Color(0xFF0F172A)
                              : const Color(0xFFCBD5E1),
                          width: 1.5,
                        ),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: isDone
                          ? Icon(Icons.check,
                              size: 14, color: Theme.of(context).colorScheme.surface)
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        task['label'] as String,
                        style: TextStyle(
                          fontSize: 14,
                          color: isDone
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF0F172A),
                          decoration: isDone
                              ? TextDecoration.lineThrough
                              : TextDecoration.none,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildBudgetCard(Map<String, dynamic>? budget) {
    final moReal = num.tryParse(budget?['main_oeuvre_real']?.toString() ?? '0') ?? 0;
    final moEst = num.tryParse(budget?['main_oeuvre_estimated']?.toString() ?? '0') ?? 0;
    final fournitureReal = num.tryParse(budget?['fourniture_real']?.toString() ?? '0') ?? 0;
    final fournitureEst = num.tryParse(budget?['fourniture_estimated']?.toString() ?? '0') ?? 0;
    final diversReal = num.tryParse(budget?['divers_real']?.toString() ?? '0') ?? 0;
    final diversEst = num.tryParse(budget?['divers_estimated']?.toString() ?? '0') ?? 0;

    final totalReal = moReal + fournitureReal + diversReal;
    final totalEst = moEst + fournitureEst + diversEst;

    return GestureDetector(
      onTap: () => context.push('/chantier/budget', extra: widget.data),
      child: _SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.bar_chart_rounded, size: 18, color: Color(0xFF0F172A)),
                    SizedBox(width: 8),
                    Text(
                      'Budget',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                Text(
                  'Total: ${totalReal}€ / $totalEst€',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildBudgetRow('Main d\'œuvre', moReal, moEst),
            const SizedBox(height: 14),
            _buildBudgetRow('Fourniture', fournitureReal, fournitureEst),
            const SizedBox(height: 14),
            _buildBudgetRow('Divers', diversReal, diversEst),
          ],
        ),
      ),
    );
  }

  Widget _buildBudgetRow(String label, num actual, num estimated) {
    // Prevent division by zero, format appropriately.
    final ratio = estimated > 0 ? (actual / estimated).clamp(0.0, 1.0) : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 14,
                color: Color(0xFF0F172A),
              ),
            ),
            RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '${actual}€ ',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  TextSpan(
                    text: '/ $estimated €',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: ratio,
            minHeight: 6,
            backgroundColor: const Color(0xFFE2E8F0),
            valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF0F172A)),
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Réel/ Estimé',
          style: TextStyle(
            fontSize: 11,
            color: Color(0xFFCBD5E1),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  Widget _buildDevisRdvRow() {
    final chantierId = widget.data['id'] as String?;
    final quotesAsync = chantierId != null
        ? ref.watch(chantierQuotesProvider(chantierId))
        : null;

    final quoteCount = quotesAsync?.value?.length ?? 0;
    final rdvTitle = _nextRdv?['title'] as String? ?? 'Aucun RDV';
    final rdvDateStr = _nextRdv != null
        ? _formatRdvDate(_nextRdv!['scheduled_at'] as String)
        : 'Pas de RDV prévu';

    return Row(
      children: [
        // Devis card
        Expanded(
          child: GestureDetector(
            onTap: () => context.push('/chantier/devis', extra: widget.data),
            child: _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.description_outlined,
                          size: 16, color: Color(0xFF0F172A)),
                      SizedBox(width: 6),
                      Text(
                        'Devis',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '$quoteCount',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    quoteCount == 0
                        ? 'Aucun devis'
                        : quoteCount == 1
                            ? '1 devis'
                            : '$quoteCount devis',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        // RDV card
        Expanded(
          child: GestureDetector(
            onTap: () => context.push('/chantier/rdv', extra: widget.data),
            child: _SectionCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.calendar_today_outlined,
                          size: 16, color: Color(0xFF0F172A)),
                      SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          'Prochain RDV',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    rdvTitle,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF0F172A),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    rdvDateStr,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────
  // ──────────────────────────────────────────
  Widget _buildDocumentsCard(List<Map<String, dynamic>> documents) {
    return GestureDetector(
      onTap: () => context.push('/chantier/documents', extra: widget.data),
      child: _SectionCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: const [
                    Icon(Icons.folder_outlined,
                        size: 18, color: Color(0xFF0F172A)),
                    SizedBox(width: 8),
                    Text(
                      'Documents',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${documents.length} total',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (documents.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.picture_as_pdf_outlined,
                        color: Color(0xFFDC2626), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            documents.first['name'] as String? ?? 'Document sans nom',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0F172A),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Text(
                            'Récent',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else
              const Padding(
                padding: EdgeInsets.only(top: 4, bottom: 8),
                child: Text(
                  'Aucun document',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF94A3B8),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  // Suivi ouvriers: opens the read-only view of worker pointage / photos /
  // documents / réclamations on this chantier.
  Widget _buildWorkerActivityCard() {
    return GestureDetector(
      onTap: () =>
          context.push('/chantier/worker-activity', extra: widget.data),
      child: _SectionCard(
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.engineering_outlined,
                  size: 20, color: Color(0xFF16A34A)),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Suivi ouvriers',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Pointage, photos, documents et signalements',
                    style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────
  Widget _buildFAB() {
    return FloatingActionButton(
      onPressed: _showAddMenu,
      backgroundColor: const Color(0xFF0F172A),
      elevation: 4,
      child: Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 28),
    );
  }
}

// ─────────────────────────────────────────────────────
// Reusable white card wrapper
// ─────────────────────────────────────────────────────
class _SectionCard extends StatelessWidget {
  final Widget child;
  const _SectionCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

// ─────────────────────────────────────────────────────
// Bottom Sheet: "Ajouter tâche" navigation menu
// ─────────────────────────────────────────────────────
class _AddMenuSheet extends StatelessWidget {
  final void Function(String label) onItemTap;

  const _AddMenuSheet({required this.onItemTap});

  static const _items = [
    'À faire',
    'Budget',
    'Devis',
    'Facturation',
    'Mes RDV',
    'Documents',
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Title row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Ajouter tâche',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A),
                ),
              ),
              GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child:
                    const Icon(Icons.close, color: Color(0xFF94A3B8), size: 22),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Menu items
          ..._items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _MenuTile(
                label: item,
                onTap: () => onItemTap(item),
              ),
            ),
          ),

        ],
      ),
    );
  }
}

class _MenuTile extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _MenuTile({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0F172A),
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF94A3B8),
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
