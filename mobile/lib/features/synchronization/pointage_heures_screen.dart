import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class PointageHeuresScreen extends StatefulWidget {
  const PointageHeuresScreen({super.key});

  @override
  State<PointageHeuresScreen> createState() => _PointageHeuresScreenState();
}

class _PointageHeuresScreenState extends State<PointageHeuresScreen> {
  final WorkerRepository _workerRepo = WorkerRepository();
  List<Worker> _allWorkers = [];
  bool _isLoading = true;
  String _searchQuery = '';

  // Avatar colors for initials
  static const List<Color> _avatarColors = [
    Color(0xFF2E65F3), // Blue
    Color(0xFF8B5CF6), // Purple
    Color(0xFFEF4444), // Red
    Color(0xFF10B981), // Green
    Color(0xFFFF9800), // Orange
    Color(0xFFEC4899), // Pink
  ];

  @override
  void initState() {
    super.initState();
    _loadContacts();
  }

  Future<void> _loadContacts() async {
    try {
      final workers = await _workerRepo.getWorkers();
      if (mounted) {
        setState(() {
          _allWorkers = workers;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading contacts: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _getInitials(Worker w) {
    final first = w.firstName.isNotEmpty ? w.firstName[0] : '';
    final last = w.lastName.isNotEmpty ? w.lastName[0] : '';
    return '$first$last'.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    final filteredWorkers = _allWorkers.where((w) {
      final name = "${w.firstName} ${w.lastName}".toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    // Split into recent (first 2) and all
    final recentWorkers =
        filteredWorkers.length > 2 ? filteredWorkers.take(2).toList() : filteredWorkers;
    final allWorkers = filteredWorkers;

    return Scaffold(
      backgroundColor: appBg,
      body: Stack(
        children: [
          // Background Gradient
          Positioned(
            top: -50,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withValues(alpha: 0.6),
                    const Color(0xFFFBE4D2).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24.0, vertical: 20.0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => context.pop(),
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: darkNavy.withValues(alpha: 0.04),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: const Icon(Icons.chevron_left,
                              color: darkNavy, size: 28),
                        ),
                      ),
                      const Expanded(
                        child: Text(
                          "Sélection d'un Contact",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: darkNavy,
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 44),
                    ],
                  ),
                ),

                // Search Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: TextField(
                      onChanged: (val) =>
                          setState(() => _searchQuery = val),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: darkNavy,
                      ),
                      decoration: InputDecoration(
                        hintText: "Rechercher un contact...",
                        hintStyle: TextStyle(
                          color:
                              const Color(0xFF8B95A5).withValues(alpha: 0.6),
                          fontWeight: FontWeight.w500,
                        ),
                        border: InputBorder.none,
                        prefixIcon: Icon(Icons.search,
                            color: const Color(0xFF8B95A5)
                                .withValues(alpha: 0.8),
                            size: 20),
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // List
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: Color(0xFF2E65F3)))
                      : SingleChildScrollView(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 24),
                          child: Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.start,
                            children: [
                              // Récents
                              if (recentWorkers.isNotEmpty) ...[
                                _buildSectionTitle("RÉCENTS"),
                                const SizedBox(height: 12),
                                ...recentWorkers.asMap().entries.map(
                                    (e) => _buildContactItem(
                                        e.value, e.key)),
                                const SizedBox(height: 20),
                              ],

                              // Tous les contacts
                              _buildSectionTitle("TOUS LES CONTACTS"),
                              const SizedBox(height: 12),
                              if (allWorkers.isEmpty)
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                      vertical: 20.0),
                                  child: Text(
                                    "Aucun contact trouvé.",
                                    style: TextStyle(
                                      color: Colors.grey[400],
                                    ),
                                  ),
                                ),
                              ...allWorkers.asMap().entries.map(
                                  (e) => _buildContactItem(
                                      e.value, e.key + 2)),

                              const SizedBox(height: 100),
                            ],
                          ),
                        ),
                ),
              ],
            ),
          ),

          // Bottom Button
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(
                  left: 24.0, right: 24.0, bottom: 32.0),
              child: SizedBox(
                height: 56,
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    await context.push('/synchronization/pointage/new-contact');
                    _loadContacts();
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: darkNavy,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.person_add_alt_1_outlined,
                          color: Theme.of(context).colorScheme.surface, size: 20),
                      SizedBox(width: 12),
                      Text(
                        "Nouveau contact",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.surface,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w800,
        color: Color(0xFF8B95A5),
        letterSpacing: 1.0,
      ),
    );
  }

  Widget _buildContactItem(Worker worker, int colorIndex) {
    const darkNavy = Color(0xFF0A1227);
    final color = _avatarColors[colorIndex % _avatarColors.length];
    final initials = _getInitials(worker);

    return GestureDetector(
      onTap: () {
        // Navigate to RDV form with selected contact
        context.push('/synchronization/pointage/rdv', extra: worker);
      },
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10.0),
        child: Row(
          children: [
            // Avatar with initials
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withValues(alpha: 0.15),
              ),
              alignment: Alignment.center,
              child: worker.profilePictureUrl != null
                  ? ClipOval(
                      child: Image.network(
                        worker.profilePictureUrl!,
                        width: 48,
                        height: 48,
                        fit: BoxFit.cover,
                      ),
                    )
                  : Text(
                      initials,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: color,
                      ),
                    ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${worker.firstName} ${worker.lastName}",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    worker.profession,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF8B95A5),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.access_time, color: darkNavy, size: 20),
              tooltip: 'Pointage / heures',
              onPressed: () => context.push(
                  '/synchronization/pointage/attendance',
                  extra: worker),
            ),
          ],
        ),
      ),
    );
  }
}
