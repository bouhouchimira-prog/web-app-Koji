import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/client/repository/client_repository.dart';

/// "Mes devis à signer" — the client's list of devis addressed to their email.
///
/// Sourced from [clientQuotesProvider] (chantiers.client_email match), not the
/// entreprise's owned quotes. Only the devis still awaiting signature are shown
/// here; signed ones move to the Documents tab.
class SignatureListScreen extends ConsumerWidget {
  const SignatureListScreen({super.key});

  static const _darkNavy = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotesAsync = ref.watch(clientQuotesProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Mes devis à signer',
            style: TextStyle(fontWeight: FontWeight.w800, color: _darkNavy)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, color: _darkNavy, size: 20),
          onPressed: () {
            if (Navigator.canPop(context)) {
              context.pop();
            } else {
              context.go('/client-home');
            }
          },
        ),
      ),
      body: quotesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorState(message: '$e'),
        data: (allQuotes) {
          final pending =
              allQuotes.where((q) => ClientRepository.isPending(q['status'])).toList();

          if (pending.isEmpty) return const _EmptyState();

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(clientQuotesProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(20),
              itemCount: pending.length,
              separatorBuilder: (_, __) => const SizedBox(height: 16),
              itemBuilder: (context, index) {
                return _SignatureQuoteCard(
                  quote: pending[index],
                  onTap: () async {
                    await context.push('/signature/sign',
                        extra: SignatureArgs(quote: pending[index]));
                    // Coming back after a signing attempt: refresh so a freshly
                    // signed devis drops out of the pending list.
                    ref.invalidate(clientQuotesProvider);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.task_alt_rounded, size: 72, color: Colors.grey.shade300),
          const SizedBox(height: 16),
          const Text('Aucun devis à signer',
              style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF94A3B8))),
          const SizedBox(height: 6),
          const Text(
            'Les devis envoyés par votre artisan\napparaîtront ici.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 13, color: Color(0xFFCBD5E1)),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
            const SizedBox(height: 12),
            Text('Impossible de charger vos devis.\n$message',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF64748B))),
          ],
        ),
      ),
    );
  }
}

class _SignatureQuoteCard extends StatelessWidget {
  final Map<String, dynamic> quote;
  final VoidCallback onTap;

  const _SignatureQuoteCard({required this.quote, required this.onTap});

  static const _darkNavy = Color(0xFF0F172A);
  static const _slate = Color(0xFF64748B);

  @override
  Widget build(BuildContext context) {
    final client = (quote['client'] as Map?)?.cast<String, dynamic>() ?? {};
    final company = (quote['company'] as Map?)?.cast<String, dynamic>() ?? {};
    final totals = (quote['totals'] as Map?)?.cast<String, dynamic>() ?? {};
    final totalTTC = (totals['ttc'] as num?)?.toDouble() ?? 0.0;
    final artisan = (company['raisonSociale'] as String?) ??
        (company['name'] as String?) ??
        'Votre artisan';

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      "N° ${quote['quoteNumber'] ?? quote['reference'] ?? '—'}",
                      style: const TextStyle(
                          color: Color(0xFF94A3B8),
                          fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: const Color(0xFFF59E0B)
                                .withValues(alpha: 0.25)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.draw_outlined,
                              size: 12, color: Color(0xFFD97706)),
                          SizedBox(width: 4),
                          Text('À signer',
                              style: TextStyle(
                                  color: Color(0xFFD97706),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12)),
                        ],
                      ),
                    )
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  client['name'] != null
                      ? "Devis — ${(client['name'] as String).split(' ').first}"
                      : "Votre devis",
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: _darkNavy),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.storefront_outlined,
                        size: 16, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(artisan,
                          style: const TextStyle(color: _slate),
                          overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
                if ((quote['date'] ?? '').toString().isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.calendar_today,
                          size: 16, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 6),
                      Text("Reçu le ${quote['date']}",
                          style: const TextStyle(color: _slate)),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                const Divider(height: 1),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text("Total TTC",
                            style: TextStyle(
                                fontSize: 10, color: Color(0xFF94A3B8))),
                        Text(
                            "${totalTTC.toStringAsFixed(2)} €",
                            style: const TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.w900,
                                color: _darkNavy)),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        children: [
                          Text("Signer",
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white)),
                          SizedBox(width: 6),
                          Icon(Icons.arrow_forward,
                              size: 16, color: Colors.white),
                        ],
                      ),
                    )
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}
