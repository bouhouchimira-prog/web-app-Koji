import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/route_args.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/quote/repository/quote_repository.dart';
import 'package:koji/features/quote/models/quote_status.dart';

class QuoteListScreen extends ConsumerStatefulWidget {
  const QuoteListScreen({super.key});

  @override
  ConsumerState<QuoteListScreen> createState() => _QuoteListScreenState();
}

class _QuoteListScreenState extends ConsumerState<QuoteListScreen> {
  String _selectedFilter = 'Tous';
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authRepositoryProvider).currentUser;

    if (user == null) {
      return const Center(child: Text("Veuillez vous connecter"));
    }

    final quotesAsync = ref.watch(userQuotesProvider(user.id));

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title:
            Text("Historique des devis", style: AppTheme.headingStyle(context)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: CircleAvatar(
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            child: IconButton(
              icon: Icon(Icons.arrow_back_ios_new,
                  size: 16, color: Theme.of(context).primaryColor),
              onPressed: () => context.go('/home'),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            child: Column(
              children: [
                // Search Bar
                TextField(
                  controller: _searchController,
                  decoration: InputDecoration(
                    hintText: "Rechercher un devis...",
                    hintStyle:
                        TextStyle( color: Colors.grey),
                    prefixIcon: const SizedBox
                        .shrink(), // No prefix icon used in design, search icon is suffix
                    suffixIcon:
                        const Icon(Icons.search, color: Color(0xFF798AD4)),
                    filled: true,
                    fillColor: Theme.of(context).brightness == Brightness.dark
                        ? const Color(0xFF1E1E1E)
                        : const Color(0xFFF2F4F6),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Colors.grey[800]!
                              : const Color(0xFFD1D5DB)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                          color: Theme.of(context).brightness == Brightness.dark
                              ? Colors.grey[800]!
                              : const Color(0xFFD1D5DB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide:
                          BorderSide(color: Theme.of(context).primaryColor),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 20),
                // Filters
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip("Tous"),
                      const SizedBox(width: 10),
                      _buildFilterChip("En cours"),
                      const SizedBox(width: 10),
                      _buildFilterChip("Acceptés"),
                      const SizedBox(width: 10),
                      _buildFilterChip("Refusés"),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: quotesAsync.when(
              data: (quotes) {
                // Deduplicate by quoteNumber — keep only most recent per reference
                final seenRefs = <String>{};
                final uniqueQuotes = quotes.where((q) {
                  final ref = (q['quoteNumber'] ?? q['reference'] ?? q['id'] ?? '').toString();
                  if (ref.isEmpty) return true;
                  return seenRefs.add(ref);
                }).toList();

                // Filter Logic
                final filteredQuotes = uniqueQuotes.where((quote) {
                  final client = quote['client'] as Map<String, dynamic>? ?? {};
                  final clientName = (client['name'] ?? '').toLowerCase();
                  final quoteNumber =
                      (quote['quoteNumber'] ?? '').toLowerCase();

                  // Search Match based on Client Name or Quote Number
                  bool matchesSearch = clientName.contains(_searchQuery) ||
                      quoteNumber.contains(_searchQuery);

                  // Filter Match — use the shared classifier so quotes signed
                  // in the web app (status 'accepte' / signed_at set) land here.
                  bool matchesFilter = true;
                  if (_selectedFilter == "En cours")
                    matchesFilter = QuoteStatus.isInProgress(quote);
                  if (_selectedFilter == "Acceptés")
                    matchesFilter = QuoteStatus.isSigned(quote);
                  if (_selectedFilter == "Refusés")
                    matchesFilter = QuoteStatus.isRefused(quote);

                  return matchesSearch && matchesFilter;
                }).toList();

                if (filteredQuotes.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.inbox_outlined,
                            size: 64,
                            color: AppTheme.textLight.withValues(alpha: 0.5)),
                        const SizedBox(height: 16),
                        Text("Aucun devis trouvé",
                            style: TextStyle(
                                fontSize: 18,
                                color: AppTheme.textLight)),
                      ],
                    ),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: filteredQuotes.length,
                  itemBuilder: (context, index) {
                    final quote = filteredQuotes[index];
                    return _buildQuoteCard(quote);
                  },
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text("Erreur: $err")),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label) {
    final isSelected = _selectedFilter == label;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeColor = isDark ? Colors.white : AppTheme.darkNavy;

    return GestureDetector(
      onTap: () {
        setState(() {
          _selectedFilter = label;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? activeColor : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
              color: isSelected ? activeColor : const Color(0xFF9CA3AF)),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected
                ? (isDark ? Colors.black : Colors.white)
                : const Color(0xFF9CA3AF),
            fontWeight: FontWeight.w600,
            fontSize: 14,
          ),
        ),
      ),
    );
  }

  Widget _buildQuoteCard(Map<String, dynamic> quote) {
    final client = quote['client'] as Map<String, dynamic>? ?? {};
    final totals = quote['totals'] as Map<String, dynamic>? ?? {};
    final dateStr = quote['date'] ?? ''; // '24 Oct'
    final rawQuoteNumber = quote['quoteNumber'] ?? '000';
    // Format quote number for display if needed like #DEV-2026-010
    final displayQuoteNumber = rawQuoteNumber.toString().startsWith('#')
        ? rawQuoteNumber
        : '#$rawQuoteNumber';

    // Status Logic — shared classifier handles web-app 'accepte' / signed_at.
    String statusLabel = "En cours";
    Color statusColor = const Color(0xFFE0E7FF);
    Color statusTextColor = AppTheme.primaryBlue;
    Color statusDotColor = AppTheme.primaryBlue;

    if (QuoteStatus.isSigned(quote)) {
      statusLabel = "Accepté";
      statusColor = const Color(0xFFDCFCE7);
      statusTextColor = const Color(0xFF166534);
      statusDotColor = const Color(0xFF166534); // Check icon instead
    } else if (QuoteStatus.isRefused(quote)) {
      statusLabel = "Refusé";
      statusColor = const Color(0xFFFEE2E2);
      statusTextColor = const Color(0xFF991B1B);
      statusDotColor = const Color(0xFF991B1B); // X icon instead
    }

    // Project Type (Placeholder logic or extract from data if available)
    // Assuming we can derive it or it is stored. For now, use "Rénovation" or first room name
    String projectType = "Projet Rénovation";
    // Check if we have rooms to make it smarter?
    // It's not in the top level usually, but we can stick to a generic subtitle if not present.

    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => context.push('/quote/detail',
              extra: QuoteDetailArgs(data: quote)),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Row: Name and Date Badge
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      client['name'] ?? 'Client Inconnu',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                        color: isDark ? Colors.white : AppTheme.darkNavy,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F1EB), // Light beige for date
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        _formatDateForBadge(dateStr),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: const Color(0xFFA18B73),
                        ),
                      ),
                    )
                  ],
                ),
                const SizedBox(height: 4),
                // Subtitle
                Text(
                  "$projectType • $displayQuoteNumber",
                  style: TextStyle(
                    color: AppTheme.textLight,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),

                const SizedBox(height: 20),

                // Bottom Row: Status and Price
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Status Badge
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: statusColor),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (statusLabel == "Accepté")
                            Icon(Icons.check_circle,
                                size: 14, color: statusTextColor)
                          else if (statusLabel == "Refusé")
                            Icon(Icons.cancel, size: 14, color: statusTextColor)
                          else
                            Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                    color: statusDotColor,
                                    shape: BoxShape.circle)),
                          const SizedBox(width: 6),
                          Text(
                            statusLabel,
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: statusTextColor,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Price
                    Text(
                      "${(totals['ttc'] ?? 0).toStringAsFixed(2).replaceAll('.', ',')} €", // European format roughly
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: isDark ? Colors.white : AppTheme.darkNavy,
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatDateForBadge(String fullDate) {
    // Basic parser assuming dd/MM/yyyy from quote creation
    try {
      final parts = fullDate.split('/');
      if (parts.length == 3) {
        final dt = DateTime(
            int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
        final months = [
          'Jan',
          'Fev',
          'Mar',
          'Avr',
          'Mai',
          'Juin',
          'Juil',
          'Aout',
          'Sep',
          'Oct',
          'Nov',
          'Dec'
        ];
        return "${dt.day} ${months[dt.month - 1]}";
      }
    } catch (_) {}
    return "N/A";
  }
}

// One-shot REST fetch instead of a realtime `.stream()`. The `quotes` table has
// `json` columns (client/totals/metadata) and Postgres cannot diff `json` for
// realtime replication → "could not identify an equality operator for type json
// (42883)". `.select()` has no such limitation, so we fetch once and refresh via
// `ref.invalidate(userQuotesProvider(userId))` after every mutation (create /
// update / status change / delete) — same liveness, no broken realtime path.
final userQuotesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>((ref, userId) {
  return ref.read(quoteRepositoryProvider).getUserQuotesOnce(userId);
});
