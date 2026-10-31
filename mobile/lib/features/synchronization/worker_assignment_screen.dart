import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class WorkerAssignmentScreen extends StatefulWidget {
  final Project project;

  const WorkerAssignmentScreen({super.key, required this.project});

  @override
  State<WorkerAssignmentScreen> createState() => _WorkerAssignmentScreenState();
}

class _WorkerAssignmentScreenState extends State<WorkerAssignmentScreen> {
  final WorkerRepository _workerRepo = WorkerRepository();
  final ProjectRepository _projectRepo = ProjectRepository();

  List<Worker> _allWorkers = [];
  Set<String> _selectedWorkerIds = {};
  String _selectedFilter = 'Tous';
  bool _isLoading = true;
  String _searchQuery = '';

  // Unique professions from loaded workers
  List<String> _professionFilters = ['Tous'];

  @override
  void initState() {
    super.initState();
    _loadWorkers();
  }

  Future<void> _loadWorkers() async {
    try {
      final workers = await _workerRepo.getWorkers();
      final professions = workers
          .map((w) => w.profession)
          .toSet()
          .toList()
        ..sort();

      if (mounted) {
        setState(() {
          _allWorkers = workers;
          _professionFilters = ['Tous', ...professions];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading workers: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedWorkerIds.contains(id)) {
        _selectedWorkerIds.remove(id);
      } else {
        _selectedWorkerIds.add(id);
      }
    });
  }

  Future<void> _submitAssignment() async {
    if (_selectedWorkerIds.isEmpty) return;

    try {
      await _projectRepo.assignWorkersToProject(
          widget.project.id, _selectedWorkerIds.toList());
      if (mounted) {
        context.pushReplacement('/projects/success');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    // Filter workers by profession and search
    final filteredWorkers = _allWorkers.where((w) {
      final matchesSearch = "${w.firstName} ${w.lastName}"
          .toLowerCase()
          .contains(_searchQuery.toLowerCase());
      final matchesProfession =
          _selectedFilter == 'Tous' || w.profession == _selectedFilter;
      return matchesSearch && matchesProfession;
    }).toList();

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
                          "Affectation aux chantiers",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 18,
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
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface,
                      borderRadius: BorderRadius.circular(16),
                      border:
                          Border.all(color: const Color(0xFFE0E7FF)),
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
                        hintText: "Rechercher un artisan...",
                        hintStyle: TextStyle(
                          color: Colors.grey[400],
                          fontWeight: FontWeight.w400,
                        ),
                        border: InputBorder.none,
                        suffixIcon: const Icon(Icons.search,
                            color: Color(0xFF2E65F3), size: 22),
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Profession Filter Chips
                SizedBox(
                  height: 44,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 24),
                    itemCount: _professionFilters.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(width: 8),
                    itemBuilder: (context, index) {
                      final filter = _professionFilters[index];
                      final isActive = _selectedFilter == filter;
                      return GestureDetector(
                        onTap: () =>
                            setState(() => _selectedFilter = filter),
                        child: AnimatedContainer(
                          duration:
                              const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 10),
                          decoration: BoxDecoration(
                            color: isActive
                                ? darkNavy
                                : Colors.white,
                            borderRadius:
                                BorderRadius.circular(24),
                            border: isActive
                                ? null
                                : Border.all(
                                    color:
                                        const Color(0xFFE0E7FF)),
                          ),
                          child: Text(
                            filter,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isActive
                                  ? Colors.white
                                  : darkNavy,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),

                const SizedBox(height: 20),

                // Section Title
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24.0),
                  child: Text(
                    "Sélectionner l'équipe",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),
                ),

                const SizedBox(height: 12),

                // Worker List
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: Color(0xFF2E65F3)))
                      : filteredWorkers.isEmpty
                          ? Center(
                              child: Text(
                                "Aucun artisan trouvé",
                                style: TextStyle(
                                  fontSize: 15,
                                  color: Colors.grey[400],
                                ),
                              ),
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24),
                              itemCount: filteredWorkers.length,
                              itemBuilder: (context, index) {
                                final worker =
                                    filteredWorkers[index];
                                return _buildWorkerItem(worker);
                              },
                            ),
                ),
              ],
            ),
          ),

          // Bottom Continue Button
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding:
                  const EdgeInsets.fromLTRB(24, 12, 24, 32),
              child: SizedBox(
                height: 56,
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _selectedWorkerIds.isNotEmpty
                      ? _submitAssignment
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor:
                        _selectedWorkerIds.isNotEmpty
                            ? darkNavy
                            : const Color(0xFFE2E8F0),
                    shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(16)),
                    elevation: 0,
                    disabledBackgroundColor:
                        const Color(0xFFE2E8F0),
                  ),
                  child: Row(
                    mainAxisAlignment:
                        MainAxisAlignment.center,
                    children: [
                      Text(
                        "Continuer (${_selectedWorkerIds.length} sélectionnés)",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: _selectedWorkerIds
                                  .isNotEmpty
                              ? Colors.white
                              : const Color(0xFF8B95A5),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.arrow_forward,
                        color: _selectedWorkerIds
                                .isNotEmpty
                            ? Colors.white
                            : const Color(0xFF8B95A5),
                        size: 20,
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

  Widget _buildWorkerItem(Worker worker) {
    const darkNavy = Color(0xFF0A1227);
    final isSelected = _selectedWorkerIds.contains(worker.id);

    return GestureDetector(
      onTap: () => _toggleSelection(worker.id),
      behavior: HitTestBehavior.opaque,
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        padding: const EdgeInsets.symmetric(
            horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFEEF2FF)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFE2E8F0),
                image: worker.profilePictureUrl != null
                    ? DecorationImage(
                        image: NetworkImage(
                            worker.profilePictureUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: worker.profilePictureUrl == null
                  ? Icon(Icons.person,
                      color: Colors.blueGrey[300])
                  : null,
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
                    "${worker.profession} - ${worker.status}",
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF8B95A5),
                    ),
                  ),
                ],
              ),
            ),
            // Checkbox
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected
                    ? const Color(0xFF2E65F3)
                    : Colors.transparent,
                border: isSelected
                    ? null
                    : Border.all(
                        color: const Color(0xFFCBD5E1),
                        width: 2),
              ),
              child: isSelected
                  ? Icon(Icons.check,
                      size: 18, color: Theme.of(context).colorScheme.surface)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
