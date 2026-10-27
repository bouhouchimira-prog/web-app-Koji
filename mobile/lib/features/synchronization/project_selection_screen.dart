import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';

class ProjectSelectionScreen extends StatefulWidget {
  const ProjectSelectionScreen({super.key});

  @override
  State<ProjectSelectionScreen> createState() => _ProjectSelectionScreenState();
}

class _ProjectSelectionScreenState extends State<ProjectSelectionScreen> {
  final ProjectRepository _repository = ProjectRepository();
  List<Project> _projects = [];
  Set<String> _selectedProjectIds = {};
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    try {
      final projects = await _repository.fetchProjects();
      if (mounted) setState(() => _projects = projects);
    } catch (e) {
      debugPrint('Error loading projects: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _toggleSelection(String id) {
    setState(() {
      if (_selectedProjectIds.contains(id)) {
        _selectedProjectIds.remove(id);
      } else {
        _selectedProjectIds.add(id);
      }
    });
  }

  void _onContinue() {
    if (_selectedProjectIds.isEmpty) return;
    // Navigate to worker assignment, pass first selected project
    final selectedProject = _projects.firstWhere(
        (p) => _selectedProjectIds.contains(p.id));
    context.push(
      '/projects/assign/${selectedProject.id}',
      extra: selectedProject,
    );
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    final filteredProjects = _projects
        .where((p) =>
            p.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            p.clientName.toLowerCase().contains(_searchQuery.toLowerCase()))
        .toList();

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
                        onTap: () {
                          if (context.canPop()) {
                            context.pop();
                          } else {
                            context.go('/home');
                          }
                        },
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
                        hintText: "Rechercher un chantier...",
                        hintStyle: TextStyle(
                          color: Colors.grey[400],
                          fontWeight: FontWeight.w400,
                        ),
                        border: InputBorder.none,
                        suffixIcon:
                            Icon(Icons.search, color: const Color(0xFF2E65F3), size: 22),
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Section Title
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24.0),
                  child: Text(
                    "Sélection du chantier",
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: darkNavy,
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Project List
                Expanded(
                  child: _isLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                              color: Color(0xFF2E65F3)))
                      : filteredProjects.isEmpty
                          ? _buildEmptyState()
                          : ListView.separated(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 24, vertical: 8),
                              itemCount: filteredProjects.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 16),
                              itemBuilder: (context, index) {
                                final project = filteredProjects[index];
                                final isSelected =
                                    _selectedProjectIds.contains(project.id);
                                return _buildProjectCard(
                                    project, isSelected);
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
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
              child: SizedBox(
                height: 56,
                width: double.infinity,
                child: ElevatedButton(
                  onPressed:
                      _selectedProjectIds.isNotEmpty ? _onContinue : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _selectedProjectIds.isNotEmpty
                        ? darkNavy
                        : const Color(0xFFE2E8F0),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                    disabledBackgroundColor: const Color(0xFFE2E8F0),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        "Continuer (${_selectedProjectIds.length} sélectionnés)",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: _selectedProjectIds.isNotEmpty
                              ? Colors.white
                              : const Color(0xFF8B95A5),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Icon(
                        Icons.arrow_forward,
                        color: _selectedProjectIds.isNotEmpty
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

  Widget _buildProjectCard(Project project, bool isSelected) {
    const darkNavy = Color(0xFF0A1227);

    Color statusBg;
    Color statusText;

    switch (project.status) {
      case 'En Cours':
        statusBg = const Color(0xFFE3F2FD);
        statusText = const Color(0xFF1D74FF);
        break;
      case 'Terminé':
        statusBg = const Color(0xFFE8F5E9);
        statusText = const Color(0xFF43A047);
        break;
      case 'À Venir':
        statusBg = const Color(0xFFFFF3E0);
        statusText = const Color(0xFFFF9800);
        break;
      default:
        statusBg = Colors.grey[100]!;
        statusText = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isSelected
              ? const Color(0xFF2E65F3)
              : const Color(0xFFEEF2F6),
          width: isSelected ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: statusBg,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        project.status,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: statusText,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      project.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: darkNavy,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    _buildInfoRow(
                        Icons.person_outline, project.clientName),
                    const SizedBox(height: 4),
                    if (project.address != null)
                      _buildInfoRow(
                          Icons.location_on_outlined, project.address!),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              // Project Image
              project.imageUrl != null
                  ? Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        image: DecorationImage(
                          image: NetworkImage(project.imageUrl!),
                          fit: BoxFit.cover,
                        ),
                      ),
                    )
                  : Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8EDF8),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: const Icon(Icons.home_work_outlined,
                          color: Color(0xFF0A1227), size: 36),
                    ),
            ],
          ),
          const SizedBox(height: 16),
          // Select Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () => _toggleSelection(project.id),
              style: ElevatedButton.styleFrom(
                backgroundColor: isSelected
                    ? const Color(0xFF2E65F3).withValues(alpha: 0.1)
                    : const Color(0xFF2E65F3),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
              ),
              child: Text(
                isSelected
                    ? "✓ Sélectionné"
                    : "Sélectionner ce chantier",
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: isSelected
                      ? const Color(0xFF2E65F3)
                      : Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF8B95A5)),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(
              fontSize: 13,
              color: Color(0xFF8B95A5),
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.home_work_outlined,
              size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            "Aucun chantier trouvé",
            style: TextStyle(
              fontSize: 16,
              color: Colors.grey[400],
            ),
          ),
        ],
      ),
    );
  }
}
