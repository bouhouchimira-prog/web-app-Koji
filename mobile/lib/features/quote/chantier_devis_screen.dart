import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';

class ChantierDevisScreen extends ConsumerWidget {
  final Map<String, dynamic> data;
  const ChantierDevisScreen({super.key, required this.data});

  static const _kDark = Color(0xFF0F172A);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chantierId = data['id'] as String?;

    if (chantierId == null) {
      return const Scaffold(body: Center(child: Text('ID Chantier manquant')));
    }

    final quotesAsync = ref.watch(chantierQuotesProvider(chantierId));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F0EB),
      body: SafeArea(
        child: Column(
          children: [
            _buildAppBar(context),
            Expanded(
              child: quotesAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Erreur: $e')),
                data: (quotes) => quotes.isEmpty
                    ? _buildEmptyState(context, ref, chantierId)
                    : _buildDevisList(context, ref, chantierId, quotes),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: const Color(0xFFF5F0EB),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: GestureDetector(
              onTap: () => context.pop(),
              child: const Icon(Icons.chevron_left_rounded,
                  color: _kDark, size: 30),
            ),
          ),
          const Text(
            'Devis',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _kDark,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(
      BuildContext context, WidgetRef ref, String chantierId) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(vertical: 40),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(14),
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Center(
              child: Text(
                'Aucun Devis',
                style: TextStyle(
                  fontSize: 15,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: () => _createDevis(context, ref, chantierId),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'Créer un devis',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _kDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevisList(BuildContext context, WidgetRef ref, String chantierId,
      List<Map<String, dynamic>> quotes) {
    return Stack(
      children: [
        ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
          itemCount: quotes.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, i) => _buildDevisTile(context, ref, quotes[i]),
        ),
        Positioned(
          bottom: 20,
          left: 20,
          right: 20,
          child: GestureDetector(
            onTap: () => _createDevis(context, ref, chantierId),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: _kDark,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add, color: Theme.of(context).colorScheme.surface, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Créer un devis',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.surface,
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

  Widget _buildDevisTile(
      BuildContext context, WidgetRef ref, Map<String, dynamic> devis) {
    final String reference = devis['reference'] as String? ?? 'D-????';
    final double amount = (devis['total_ht'] as num?)?.toDouble() ?? 0;
    final String status = devis['status'] as String? ?? 'Draft';
    final String date = devis['date'] as String? ?? '';
    final client = devis['client'] as Map<String, dynamic>? ?? {};
    final String clientName = client['name'] as String? ?? '';

    Color statusColor;
    String statusLabel;
    switch (status) {
      case 'Signed':
        statusColor = const Color(0xFF22C55E);
        statusLabel = 'Devis signé';
        break;
      case 'Sent':
        statusColor = const Color(0xFF64748B);
        statusLabel = 'En attente signature';
        break;
      default:
        statusColor = const Color(0xFF3B82F6);
        statusLabel = 'En cours';
    }

    return GestureDetector(
      onTap: () async {
        // Edit-mode: seed the creation flow then enter the room/task editor
        // so tasks and fournitures are editable, not just the recap numbers.
        final messenger = ScaffoldMessenger.of(context);
        final router = GoRouter.of(context);
        try {
          ref.read(quoteCreationProvider.notifier).reset();
          await ref
              .read(quoteCreationProvider.notifier)
              .seedFromSavedQuote(devis);
          // Tout-en-un (demande client) : l'édition ouvre directement le
          // Récapitulatif, où ouvrages / sous-ouvrages / fournitures / notes /
          // lots sont tous modifiables. Plus d'écran « Créer vos ouvrages ».
          router.push('/quote/detail', extra: QuoteDetailArgs(data: devis));
        } catch (e) {
          messenger.showSnackBar(
            SnackBar(content: Text('Erreur de chargement du devis: $e')),
          );
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.description_outlined,
                  color: _kDark, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reference,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: _kDark,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (clientName.isNotEmpty) clientName,
                      if (date.isNotEmpty) date,
                      '${_fmt(amount)} € HT',
                    ].join('  ·  '),
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
                const SizedBox(height: 8),
                GestureDetector(
                  onTap: () => context.push('/quote/messages', extra: {
                    'quoteId': devis['id'],
                    'clientName': clientName,
                  }),
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.forum_outlined,
                      size: 18,
                      color: _kDark,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _createDevis(BuildContext context, WidgetRef ref, String chantierId) {
    // Store chantierId in quote creation state so it gets saved with the quote
    ref.read(quoteCreationProvider.notifier).reset();
    ref.read(quoteCreationProvider.notifier).setChantierId(chantierId);

    // Pre-fill client info from the chantier so the devis PDF isn't blank.
    // The chantier "référence" doubles as the client/project name; the
    // chantier address (street + postal code + city) becomes the client address.
    final reference = (data['reference'] as String?)?.trim() ?? '';
    final street = (data['street'] as String?)?.trim() ?? '';
    final postalCode =
        (data['postal_code'] as String?)?.trim() ??
        (data['postalCode'] as String?)?.trim() ??
        '';
    final city = (data['city'] as String?)?.trim() ?? '';
    // Email the client must use to open the devis signature link. Reads both
    // snake_case (chantier loaded from DB) and camelCase (freshly-created
    // chantier in-memory map), mirroring the postal_code handling above.
    final clientEmail =
        (data['client_email'] as String?)?.trim() ??
        (data['clientEmail'] as String?)?.trim() ??
        '';
    final addressParts = <String>[
      if (street.isNotEmpty) street,
      if (postalCode.isNotEmpty || city.isNotEmpty)
        [postalCode, city].where((s) => s.isNotEmpty).join(' '),
    ];
    final address = addressParts.join(', ');

    if (reference.isNotEmpty || address.isNotEmpty || clientEmail.isNotEmpty) {
      ref.read(quoteCreationProvider.notifier).updateClientInfo(
            ClientInfo(
              name: reference,
              address: address,
              email: clientEmail,
            ),
          );
    }

    context.push('/quote/room-selection', extra: <String>[]);
  }

  String _fmt(double v) {
    return v.toStringAsFixed(0).replaceAllMapped(
          RegExp(r'(\d)(?=(\d{3})+$)'),
          (m) => '${m[1]} ',
        );
  }
}
