import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class WorkerListScreen extends StatefulWidget {
  const WorkerListScreen({super.key});

  @override
  State<WorkerListScreen> createState() => _WorkerListScreenState();
}

class _WorkerListScreenState extends State<WorkerListScreen> {
  final WorkerRepository _workerRepo = WorkerRepository();
  List<Worker> _allWorkers = [];
  bool _isLoading = true;
  String _searchQuery = '';
  int _selectedTab = 0; // 0 = Ouvriers, 1 = Sous-traitants
  final Set<String> _selectedWorkerIds = {};

  @override
  void initState() {
    super.initState();
    _loadWorkers();
  }

  Future<void> _loadWorkers() async {
    try {
      final workers = await _workerRepo.getWorkers();
      if (mounted) {
        setState(() {
          _allWorkers = workers;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading workers: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toggleSelection(String workerId) {
    setState(() {
      if (_selectedWorkerIds.contains(workerId)) {
        _selectedWorkerIds.remove(workerId);
      } else {
        _selectedWorkerIds.add(workerId);
      }
    });
  }

  /// Bottom sheet showing the worker's Identifiant + Mot de passe with copy.
  void _showCredentials(Worker w) {
    final code = w.accessCode ?? '';
    final password = w.accessPassword ?? '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Text("Accès de ${w.firstName} ${w.lastName}",
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0A1227))),
            const SizedBox(height: 4),
            Text(
              "Communiquez ces identifiants à l'ouvrier pour qu'il consulte ses tâches dans l'Espace Particulier.",
              style: TextStyle(fontSize: 13, color: Colors.grey[500]),
            ),
            const SizedBox(height: 20),
            if (code.isEmpty && password.isEmpty)
              Text(
                "Identifiants indisponibles. Vérifiez que le script worker_access.sql a été exécuté dans Supabase.",
                style: TextStyle(fontSize: 13, color: Colors.red[400]),
              )
            else ...[
              _credField("Identifiant", code),
              const SizedBox(height: 12),
              _credField("Mot de passe", password),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(
                        text: "Identifiant : $code\nMot de passe : $password"));
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Identifiants copiés")),
                    );
                  },
                  icon: const Icon(Icons.copy, size: 18),
                  label: const Text("Copier les identifiants"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0A1227),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _credField(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F8FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: TextStyle(fontSize: 12, color: Colors.grey[500])),
                const SizedBox(height: 2),
                SelectableText(
                  value,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F3995),
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy, size: 18, color: Color(0xFF1D74FF)),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text("$label copié")),
              );
            },
          ),
        ],
      ),
    );
  }

  List<Worker> get _filteredWorkers {
    return _allWorkers.where((w) {
      final name = "${w.firstName} ${w.lastName}".toLowerCase();
      final matchesSearch = name.contains(_searchQuery.toLowerCase());
      final matchesTab = _selectedTab == 0
          ? w.contactType == 'Ouvrier'
          : w.contactType == 'Sous-traitant';
      return matchesSearch && matchesTab;
    }).toList();
  }

  // Simulated favorites — first 2 workers (in real app this would be a DB field)
  List<Worker> get _favoriteWorkers {
    final filtered = _filteredWorkers;
    return filtered.length >= 2 ? filtered.sublist(0, 2) : filtered;
  }

  List<Worker> get _otherWorkers {
    final filtered = _filteredWorkers;
    return filtered.length > 2 ? filtered.sublist(2) : [];
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFF6F7FB);
    const accentBlue = Color(0xFF1B2E58);

    return Scaffold(
      backgroundColor: appBg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
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
                    child: const Icon(Icons.chevron_left,
                        color: darkNavy, size: 30),
                  ),
                  const SizedBox(width: 10),
                  // Title
                  Expanded(
                    child: Text(
                      "Sélectionner des\nparticipants",
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: darkNavy,
                        height: 1.25,
                      ),
                    ),
                  ),
                  // Valider button
                  GestureDetector(
                    onTap: () {
                      // Return selected worker IDs
                      final selectedWorkers = _allWorkers
                          .where((w) => _selectedWorkerIds.contains(w.id))
                          .toList();
                      context.pop(selectedWorkers);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 10),
                      decoration: BoxDecoration(
                        color: accentBlue,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        "Valider",
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context).colorScheme.surface,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Search Bar ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE8ECF2)),
                ),
                child: TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w500,
                    color: darkNavy,
                  ),
                  decoration: InputDecoration(
                    hintText: "Rechercher un participant...",
                    hintStyle: TextStyle(
                      color: Colors.grey[400],
                      fontWeight: FontWeight.w400,
                      fontSize: 15,
                    ),
                    border: InputBorder.none,
                    icon: Icon(Icons.search, color: Colors.grey[400], size: 22),
                    contentPadding:
                        const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 18),

            // ── Tab Pills ──
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF1F5),
                  borderRadius: BorderRadius.circular(30),
                ),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: [
                    _buildTabPill("Ouvriers", 0, darkNavy),
                    _buildTabPill("Sous-traitants", 1, darkNavy),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 8),

            // ── Worker List ──
            Expanded(
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                          color: Color(0xFF2E65F3)))
                  : _filteredWorkers.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.person_search,
                                  size: 64, color: Colors.grey[300]),
                              const SizedBox(height: 16),
                              Text(
                                "Aucun participant trouvé",
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey[400],
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          children: [
                            // Favoris section
                            if (_favoriteWorkers.isNotEmpty) ...[
                              const SizedBox(height: 16),
                              _buildSectionHeader("Favoris"),
                              const SizedBox(height: 8),
                              ..._favoriteWorkers.map(
                                  (w) => _buildWorkerRow(w)),
                            ],
                            // Tous Les Ouvriers section
                            if (_otherWorkers.isNotEmpty) ...[
                              const SizedBox(height: 20),
                              _buildSectionHeader(_selectedTab == 0
                                  ? "Tous Les Ouvriers"
                                  : "Tous Les Sous-traitants"),
                              const SizedBox(height: 8),
                              ..._otherWorkers
                                  .map((w) => _buildWorkerRow(w)),
                            ],
                            // If less than 3 workers, show all together without sections
                            if (_favoriteWorkers.isNotEmpty &&
                                _otherWorkers.isEmpty &&
                                _filteredWorkers.length <= 2) ...[
                              // Already shown in favorites section
                            ],
                            const SizedBox(height: 20),
                          ],
                        ),
            ),

            // ── Bottom Ajouter Button ──
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    await context.push('/workers/create');
                    _loadWorkers();
                  },
                  icon: Icon(Icons.person_add_alt_1,
                      color: Theme.of(context).colorScheme.surface, size: 22),
                  label: Text(
                    "Ajouter",
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: accentBlue,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Tab Pill Widget ──
  Widget _buildTabPill(String label, int index, Color darkNavy) {
    final isSelected = _selectedTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedTab = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? darkNavy : Colors.transparent,
            borderRadius: BorderRadius.circular(26),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : const Color(0xFF8B95A5),
            ),
          ),
        ),
      ),
    );
  }

  // ── Section Header ──
  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4.0),
      child: Text(
        title,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: Color(0xFF8B95A5),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // ── Worker Row ──
  Widget _buildWorkerRow(Worker worker) {
    const darkNavy = Color(0xFF0A1227);
    final isSelected = _selectedWorkerIds.contains(worker.id);

    return GestureDetector(
      onTap: () => _toggleSelection(worker.id),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10.0),
        child: Row(
          children: [
            // ── Circular Avatar with online dot ──
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFFE8ECF2),
                  ),
                  child: worker.profilePictureUrl != null
                      ? ClipOval(
                          child: Image.network(
                            worker.profilePictureUrl!,
                            width: 52,
                            height: 52,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Center(
                              child: Text(
                                _getInitials(worker),
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF5A6478),
                                ),
                              ),
                            ),
                          ),
                        )
                      : Center(
                          child: Text(
                            _getInitials(worker),
                            style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF5A6478),
                            ),
                          ),
                        ),
                ),
                // Green online dot
                Positioned(
                  left: 0,
                  bottom: 0,
                  child: Container(
                    width: 14,
                    height: 14,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: const Color(0xFFF6F7FB), width: 2.5),
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(width: 14),

            // ── Name + profession ──
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${worker.firstName} ${worker.lastName}",
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: darkNavy,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    worker.profession,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFF8B95A5),
                    ),
                  ),
                ],
              ),
            ),

            // ── Key icon: reveal Identifiant + Mot de passe ──
            if (worker.contactType == 'Ouvrier')
              GestureDetector(
                onTap: () => _showCredentials(worker),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  width: 36,
                  height: 36,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Color(0xFFEFF1F5),
                  ),
                  child: const Icon(Icons.vpn_key_outlined,
                      size: 18, color: Color(0xFF1B2E58)),
                ),
              ),

            // ── Circular Checkbox ──
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? const Color(0xFF1B2E58)
                    : Colors.transparent,
                border: Border.all(
                  color: isSelected
                      ? const Color(0xFF1B2E58)
                      : const Color(0xFFD0D5DD),
                  width: 2,
                ),
              ),
              child: isSelected
                  ? Icon(Icons.check,
                      color: Theme.of(context).colorScheme.surface, size: 16)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  String _getInitials(Worker worker) {
    final first =
        worker.firstName.isNotEmpty ? worker.firstName[0].toUpperCase() : '';
    final last =
        worker.lastName.isNotEmpty ? worker.lastName[0].toUpperCase() : '';
    return '$first$last';
  }
}
