import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import 'package:koji/core/theme.dart';
import 'package:koji/features/interventions/models/intervention.dart';
import 'package:koji/features/interventions/providers/intervention_provider.dart';
import 'package:koji/features/interventions/repositories/intervention_repository.dart';
import 'package:koji/features/interventions/services/intervention_pdf_service.dart';

/// View + status actions (mark completed/reopen/archive) and "create invoice
/// from this intervention" for a single report.
class InterventionDetailScreen extends ConsumerWidget {
  final String interventionId;

  const InterventionDetailScreen({super.key, required this.interventionId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(interventionByIdProvider(interventionId));

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor(context),
      appBar: AppBar(
        title: const Text('Intervention'),
        actions: [
          async.maybeWhen(
            data: (i) => i == null
                ? const SizedBox.shrink()
                : IconButton(
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    onPressed: () => InterventionPdfService().share(i),
                  ),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: async.when(
        data: (i) {
          if (i == null) return const Center(child: Text('Introuvable'));
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(i.reference,
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.textPrimary(context))),
              const SizedBox(height: 4),
              Text(InterventionStatus.label(i.status),
                  style: const TextStyle(color: Color(0xFF64748B))),
              const SizedBox(height: 16),
              _row(context, 'Client', i.client),
              if ((i.site ?? '').isNotEmpty) _row(context, 'Site', i.site!),
              _row(context, 'Date', DateFormat('dd/MM/yyyy').format(i.date)),
              if ((i.equipement ?? '').isNotEmpty)
                _section(context, 'Équipement', i.equipement!),
              if ((i.constat ?? '').isNotEmpty)
                _section(context, 'Constat', i.constat!),
              if ((i.analyse ?? '').isNotEmpty)
                _section(context, 'Analyse', i.analyse!),
              if ((i.preconisations ?? '').isNotEmpty)
                _section(context, 'Préconisations', i.preconisations!),
              const SizedBox(height: 20),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  if (i.status != InterventionStatus.terminee)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Marquer terminée'),
                      onPressed: () async {
                        await ref
                            .read(interventionRepositoryProvider)
                            .markCompleted(i.id);
                        ref.invalidate(interventionByIdProvider(i.id));
                        ref.invalidate(interventionsProvider);
                      },
                    ),
                  if (i.status == InterventionStatus.terminee)
                    OutlinedButton.icon(
                      icon: const Icon(Icons.replay),
                      label: const Text('Rouvrir'),
                      onPressed: () async {
                        await ref
                            .read(interventionRepositoryProvider)
                            .reopen(i.id);
                        ref.invalidate(interventionByIdProvider(i.id));
                        ref.invalidate(interventionsProvider);
                      },
                    ),
                  if (i.status != InterventionStatus.archivee)
                    OutlinedButton.icon(
                      icon: const Icon(Icons.archive_outlined),
                      label: const Text('Archiver'),
                      onPressed: () async {
                        await ref
                            .read(interventionRepositoryProvider)
                            .archive(i.id);
                        ref.invalidate(interventionByIdProvider(i.id));
                        ref.invalidate(interventionsProvider);
                      },
                    ),
                  if (i.invoiceId == null)
                    ElevatedButton.icon(
                      icon: const Icon(Icons.receipt_long_outlined),
                      label: const Text('Facturer'),
                      onPressed: i.projectId == null
                          ? null
                          : () => _createInvoice(context, ref, i),
                    ),
                ],
              ),
              if (i.projectId == null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'Liez cette intervention à un chantier pour pouvoir la facturer.',
                    style: TextStyle(
                        fontSize: 12, color: AppTheme.textSecondary(context)),
                  ),
                ),
            ],
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur : $e')),
      ),
    );
  }

  Future<void> _createInvoice(
      BuildContext context, WidgetRef ref, Intervention i) async {
    final controller = TextEditingController();
    final amountStr = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Montant à facturer'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
              labelText: 'Montant TTC (€)', border: OutlineInputBorder()),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Facturer')),
        ],
      ),
    );
    final amount = double.tryParse((amountStr ?? '').replaceAll(',', '.'));
    if (amount == null || amount <= 0 || !context.mounted) return;

    try {
      await ref.read(interventionRepositoryProvider).createInvoiceFrom(
            intervention: i,
            amount: amount,
          );
      ref.invalidate(interventionByIdProvider(i.id));
      ref.invalidate(interventionsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Facture créée')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 90,
            child: Text(label,
                style: TextStyle(
                    fontSize: 12, color: AppTheme.textSecondary(context))),
          ),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontSize: 14, color: AppTheme.textPrimary(context))),
          ),
        ],
      ),
    );
  }

  Widget _section(BuildContext context, String title, String body) {
    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textSecondary(context))),
          const SizedBox(height: 4),
          Text(body,
              style: TextStyle(fontSize: 14, color: AppTheme.textPrimary(context))),
        ],
      ),
    );
  }
}
