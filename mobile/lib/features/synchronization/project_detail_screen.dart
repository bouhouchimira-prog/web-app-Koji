import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class ProjectDetailScreen extends StatefulWidget {
  final String projectId;
  final Project? project;

  const ProjectDetailScreen({
    super.key,
    required this.projectId,
    this.project,
  });

  @override
  State<ProjectDetailScreen> createState() => _ProjectDetailScreenState();
}

class _ProjectDetailScreenState extends State<ProjectDetailScreen> {
  final ProjectRepository _projectRepo = ProjectRepository();
  final WorkerRepository _workerRepo = WorkerRepository();

  Project? _project;
  List<Worker> _assignedWorkers = [];
  List<TaskItem> _projectTasks = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _project = widget.project;
    _loadProjectData();
  }

  Future<void> _loadProjectData() async {
    try {
      setState(() => _isLoading = true);

      // Load project if not provided
      if (_project == null) {
        final projects = await _projectRepo.fetchProjects();
        _project = projects.firstWhere((p) => p.id == widget.projectId);
      }

      // Load assigned workers
      final assignments =
          await _projectRepo.fetchAssignmentsForProject(widget.projectId);
      final workerIds = assignments.map((a) => a.workerId).toList();

      if (workerIds.isNotEmpty) {
        final allWorkers = await _workerRepo.getWorkers();
        _assignedWorkers =
            allWorkers.where((w) => workerIds.contains(w.id)).toList();
      }

      // Load project tasks
      _projectTasks = await _projectRepo.fetchProjectTasks(widget.projectId);

      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      debugPrint('Error loading project data: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ... (keep intervening methods same)

  Widget _buildTaskCard(TaskItem task) {
    // _buildTaskCard now receives TaskItem
    final taskName = task.taskName;
    final roomName = task.roomName;
    final status = task.status;

    Color statusColor;
    switch (status) {
      case 'En Cours':
        statusColor = const Color(0xFF1D74FF);
        break;
      case 'Terminé':
        statusColor = const Color(0xFF43A047);
        break;
      default:
        statusColor = Colors.grey;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withAlpha((0.05 * 255).round()),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF5F8FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.task_alt,
              color: Color(0xFF1D74FF),
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  taskName,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F3995),
                  ),
                ),
                if (roomName.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    roomName,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[600],
                    ),
                  ),
                ],
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withAlpha((0.1 * 255).round()),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              status,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _assignWorkers() async {
    if (_project == null) return;

    final result = await context.push(
      '/projects/assign/${widget.projectId}',
      extra: _project, // Pass the project object
    );
    if (result == true) {
      _loadProjectData(); // Reload data after assignment
    }
  }

  Future<void> _removeWorker(String workerId) async {
    try {
      await _projectRepo.removeWorkerAssignment(widget.projectId, workerId);
      _loadProjectData(); // Reload data
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Ouvrier retiré du chantier'),
            backgroundColor: Color(0xFF22C55E),
          ),
        );
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
    final darkBlue = const Color(0xFF0F3995);
    final scaffoldBg = const Color(0xFFF5F8FF);

    if (_isLoading) {
      return Scaffold(
        backgroundColor: scaffoldBg,
        appBar: AppBar(
          backgroundColor: scaffoldBg,
          elevation: 0,
          leading: GestureDetector(
            onTap: () => context.pop(),
            child: Container(
              margin: const EdgeInsets.only(left: 16),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Theme.of(context).colorScheme.onSurface.withAlpha((0.05 * 255).round()),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(Icons.chevron_left, color: darkBlue),
            ),
          ),
          title: Text(
            "Détails du chantier",
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: darkBlue,
            ),
          ),
          centerTitle: true,
        ),
        body: Center(child: CircularProgressIndicator(color: darkBlue)),
      );
    }

    if (_project == null) {
      return Scaffold(
        backgroundColor: scaffoldBg,
        body: const Center(child: Text('Projet non trouvé')),
      );
    }

    return Scaffold(
      backgroundColor: scaffoldBg,
      appBar: AppBar(
        backgroundColor: scaffoldBg,
        elevation: 0,
        leading: GestureDetector(
          onTap: () => context.pop(),
          child: Container(
            margin: const EdgeInsets.only(left: 16),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Theme.of(context).colorScheme.onSurface.withAlpha((0.05 * 255).round()),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(Icons.chevron_left, color: darkBlue),
          ),
        ),
        title: Text(
          "Détails du chantier",
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: darkBlue,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Project Info Card
              _buildProjectInfoCard(),

              const SizedBox(height: 24),

              // Assigned Workers Section
              _buildSectionHeader('Ouvriers assignés', _assignedWorkers.length),
              const SizedBox(height: 16),

              if (_assignedWorkers.isEmpty)
                _buildEmptyState('Aucun ouvrier assigné', Icons.person_off)
              else
                ..._assignedWorkers.map((worker) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildWorkerCard(worker),
                    )),

              const SizedBox(height: 16),

              // Assign Workers Button
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _assignWorkers,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1D74FF),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                  icon: Icon(Icons.person_add, color: Theme.of(context).colorScheme.surface),
                  label: Text(
                    'Assigner des ouvriers',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.surface,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Project Tasks Section
              _buildSectionHeader('Tâches du projet', _projectTasks.length),
              const SizedBox(height: 16),

              if (_projectTasks.isEmpty)
                _buildEmptyState('Aucune tâche disponible', Icons.task_alt)
              else
                ..._projectTasks.map((task) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _buildTaskCard(task),
                    )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProjectInfoCard() {
    final darkBlue = const Color(0xFF0F3995);

    Color statusBg;
    Color statusText;

    switch (_project!.status) {
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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withAlpha((0.05 * 255).round()),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                        _project!.status,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: statusText,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _project!.title,
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: darkBlue,
                      ),
                    ),
                  ],
                ),
              ),
              if (_project!.imageUrl != null)
                Container(
                  width: 80,
                  height: 80,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    image: DecorationImage(
                      image: NetworkImage(_project!.imageUrl!),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow(Icons.person, _project!.clientName),
          const SizedBox(height: 8),
          if (_project!.address != null)
            _buildInfoRow(Icons.location_on, _project!.address!),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, int count) {
    final darkBlue = const Color(0xFF0F3995);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: darkBlue,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: const Color(0xFFE3F2FD),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            count.toString(),
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1D74FF),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildWorkerCard(Worker worker) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withAlpha((0.05 * 255).round()),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: const Color(0xFFE3F2FD),
            backgroundImage: worker.profilePictureUrl != null
                ? NetworkImage(worker.profilePictureUrl!)
                : null,
            child: worker.profilePictureUrl == null
                ? const Icon(Icons.person, color: Color(0xFF1D74FF))
                : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${worker.firstName} ${worker.lastName}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F3995),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  worker.profession,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => _showRemoveWorkerDialog(worker),
            icon: const Icon(Icons.close, color: Colors.red),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.grey[400]),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: Colors.grey[600],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(String message, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(icon, size: 48, color: Colors.grey[300]),
            const SizedBox(height: 16),
            Text(
              message,
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showRemoveWorkerDialog(Worker worker) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          'Retirer l\'ouvrier',
          style: TextStyle( fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Voulez-vous retirer ${worker.firstName} ${worker.lastName} de ce chantier?',
          style: const TextStyle(),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child:
                const Text('Annuler', style: TextStyle()),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _removeWorker(worker.id);
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text('Retirer',
                style: TextStyle( color: Theme.of(context).colorScheme.surface)),
          ),
        ],
      ),
    );
  }
}
