import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/interventions/models/intervention.dart';
import 'package:koji/features/interventions/providers/intervention_provider.dart';

/// List + status-filter tabs for standalone intervention/diagnostic reports.
class InterventionListScreen extends ConsumerStatefulWidget {
  const InterventionListScreen({super.key});

  @override
  ConsumerState<InterventionListScreen> createState() =>
      _InterventionListScreenState();
}

class _InterventionListScreenState
    extends ConsumerState<InterventionListScreen> {
  String? _statusFilter; // null = all

  @override
  Widget build(BuildContext context) {
    final interventionsAsync = ref.watch(interventionsProvider);

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      appBar: AppBar(
        title: const Text('Interventions'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () async {
              await context.push('/interventions/new');
              ref.invalidate(interventionsProvider);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                _filterChip(null, 'Toutes'),
                for (final s in [
                  InterventionStatus.aFaire,
                  InterventionStatus.enCours,
                  InterventionStatus.terminee,
                  InterventionStatus.facturee,
                  InterventionStatus.archivee,
                ])
                  _filterChip(s, InterventionStatus.label(s)),
              ],
            ),
          ),
          Expanded(
            child: interventionsAsync.when(
              data: (items) {
                final filtered = _statusFilter == null
                    ? items
                    : items.where((i) => i.status == _statusFilter).toList();
                if (filtered.isEmpty) {
                  return Center(
                    child: Text('Aucune intervention',
                        style: TextStyle(color: AppTheme.textSecondary(context))),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.invalidate(interventionsProvider),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _tile(filtered[i]),
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Erreur : $e')),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String? status, String label) {
    final selected = _statusFilter == status;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _statusFilter = status),
      ),
    );
  }

  Widget _tile(Intervention i) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () async {
        await context.push('/interventions/detail', extra: i.id);
        ref.invalidate(interventionsProvider);
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.surface(context),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 10,
                offset: const Offset(0, 3)),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(i.reference,
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textPrimary(context))),
                  const SizedBox(height: 4),
                  Text(i.client,
                      style: TextStyle(
                          fontSize: 13, color: AppTheme.textSecondary(context))),
                  Text(DateFormat('dd/MM/yyyy').format(i.date),
                      style: TextStyle(
                          fontSize: 11, color: AppTheme.textSecondary(context))),
                ],
              ),
            ),
            _statusBadge(i.status),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String status) {
    final (bg, fg) = switch (status) {
      InterventionStatus.terminee => (const Color(0xFFDCFCE7), const Color(0xFF166534)),
      InterventionStatus.enCours => (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8)),
      InterventionStatus.facturee => (const Color(0xFFF3E8FF), const Color(0xFF7E22CE)),
      InterventionStatus.archivee => (const Color(0xFFF1F5F9), const Color(0xFF64748B)),
      _ => (const Color(0xFFFEF3C7), const Color(0xFF92400E)),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(InterventionStatus.label(status),
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}
