import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class PlanningProjectTasksScreen extends StatefulWidget {
  final Project project;

  const PlanningProjectTasksScreen({super.key, required this.project});

  @override
  State<PlanningProjectTasksScreen> createState() => _PlanningProjectTasksScreenState();
}

class _PlanningProjectTasksScreenState extends State<PlanningProjectTasksScreen> {
  final ProjectRepository _repository = ProjectRepository();
  late Future<List<TaskItem>> _tasksFuture;
  
  @override
  void initState() {
    super.initState();
    _tasksFuture = _repository.fetchProjectTasks(widget.project.id);
  }

  void _refreshTasks() {
    setState(() {
      _tasksFuture = _repository.fetchProjectTasks(widget.project.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    final darkBlue = const Color(0xFF0F3995);
    final scaffoldBg = const Color(0xFFF5F8FF);

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
                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Icon(Icons.chevron_left, color: darkBlue),
          ),
        ),
        title: Text(
          widget.project.title,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: darkBlue,
          ),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Missions du chantier",
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: darkBlue,
                ),
              ),
              const SizedBox(height: 16),
              Expanded(
                child: FutureBuilder<List<TaskItem>>(
                  future: _tasksFuture,
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    final tasks = snapshot.data ?? [];
                    if (tasks.isEmpty) {
                      return Center(
                        child: Text(
                          "Aucune mission pour ce chantier",
                          style: TextStyle( color: Colors.grey),
                        ),
                      );
                    }

                    return ListView.separated(
                      itemCount: tasks.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 16),
                      itemBuilder: (context, index) => _buildTaskCard(tasks[index], darkBlue),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTaskCard(TaskItem task, Color darkBlue) {
    final startTime = task.startTime ?? "--:--";
    final duration = task.duration ?? "";
    
    return GestureDetector(
      onTap: () => _showScheduleTaskDialog(task),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border(
             left: BorderSide(
               color: task.status == 'En Cours' ? Colors.blue : Colors.orange, 
               width: 4
             ),
          ),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time Column
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  startTime,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: darkBlue,
                  ),
                ),
                Text(
                  duration,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ],
            ),
            
            Container(
              height: 40, 
              width: 1, 
              color: Colors.grey[200], 
              margin: const EdgeInsets.symmetric(horizontal: 16)
            ),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    task.taskName,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: darkBlue,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.meeting_room, size: 14, color: Colors.grey),
                      const SizedBox(width: 4),
                      Text(
                        task.roomName,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            
            // Edit Icon
            Icon(Icons.edit_calendar, color: darkBlue.withAlpha((0.5 * 255).round())),
          ],
        ),
      ),
    );
  }

  Future<void> _showScheduleTaskDialog(TaskItem task) async {
    // Current values
    DateTime startDate = task.startDate ?? task.scheduledDate ?? DateTime.now();
    DateTime endDate = task.endDate ?? startDate;
    TimeOfDay startTime = _parseTime(task.startTime) ?? const TimeOfDay(hour: 8, minute: 0);
    TimeOfDay endTime = _parseTime(task.endTime) ?? TimeOfDay(hour: startTime.hour + 1, minute: startTime.minute);
    
    // Worker selection
    String? selectedWorkerId = task.workerId;
    List<Worker> workers = [];
    final workerRepo = WorkerRepository();
    
    // Fetch workers first
    try {
      workers = await workerRepo.getWorkers();
    } catch (e) {
      debugPrint("Error fetching workers: $e");
    }

    if (!mounted) return;

    await showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setStateDialog) {
            final dateFormat = DateFormat('dd/MM/yyyy');
            
            return AlertDialog(
              title: const Text("Planifier la mission", style: TextStyle( fontWeight: FontWeight.bold)),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                     mainAxisSize: MainAxisSize.min,
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                        // DATES RANGE
                        const Text("Période", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text("${dateFormat.format(startDate)} - ${dateFormat.format(endDate)}"),
                          trailing: const Icon(Icons.calendar_today, color: Color(0xFF0F3995)),
                          onTap: () async {
                            final picked = await showDateRangePicker(
                              context: dialogContext,
                              firstDate: DateTime(2023),
                              lastDate: DateTime(2030),
                              initialDateRange: DateTimeRange(start: startDate, end: endDate),
                            );
                            if (picked != null) {
                               setStateDialog(() {
                                 startDate = picked.start;
                                 endDate = picked.end;
                               });
                            }
                          },
                        ),
                        const Divider(),
                        
                        // TIME
                        const Text("Horaires", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                        Row(
                          children: [
                            Expanded(
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: const Text("Début"),
                                subtitle: Text(startTime.format(dialogContext)),
                                onTap: () async {
                                  final picked = await showTimePicker(context: dialogContext, initialTime: startTime);
                                  if (picked != null) setStateDialog(() => startTime = picked);
                                },
                              ),
                            ),
                            Expanded(
                              child: ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: const Text("Fin"),
                                subtitle: Text(endTime.format(dialogContext)),
                                onTap: () async {
                                  final picked = await showTimePicker(context: dialogContext, initialTime: endTime);
                                  if (picked != null) setStateDialog(() => endTime = picked);
                                },
                              ),
                            ),
                          ],
                        ),
                        const Divider(),

                        // WORKER ASSIGNMENT
                        const Text("Attribué à", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                        const SizedBox(height: 8),
                        workers.isEmpty 
                          ? const Text("Aucun ouvrier disponible")
                          : DropdownButtonFormField<String>(
                              value: selectedWorkerId,
                              decoration: const InputDecoration(
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              ),
                              items: workers.map((w) => DropdownMenuItem(
                                value: w.id,
                                child: Text("${w.firstName} ${w.lastName}"),
                              )).toList(),
                              onChanged: (val) => setStateDialog(() => selectedWorkerId = val),
                              hint: const Text("Sélectionner un ouvrier"),
                            ),
                     ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text("Annuler"),
                ),
                ElevatedButton(
                  onPressed: () async {
                    // Start Update
                    try {
                       await _repository.updateTaskScheduleAdvanced(
                         task.id, 
                         startDate: startDate,
                         endDate: endDate,
                         startTime: "${startTime.hour.toString().padLeft(2,'0')}:${startTime.minute.toString().padLeft(2,'0')}",
                         endTime: "${endTime.hour.toString().padLeft(2,'0')}:${endTime.minute.toString().padLeft(2,'0')}",
                         workerId: selectedWorkerId,
                       );
                       
                       if (!dialogContext.mounted) return;
                       Navigator.pop(dialogContext);
                       if (!mounted) return;
                       _refreshTasks();
                       ScaffoldMessenger.of(dialogContext).showSnackBar(const SnackBar(content: Text("Mission planifiée avec succès")));
                    } catch (e) {
                      if (!dialogContext.mounted) return;
                      ScaffoldMessenger.of(dialogContext).showSnackBar(SnackBar(content: Text("Erreur: $e")));
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F3995),
                    foregroundColor: Colors.white,
                  ),
                  child: const Text("Enregistrer"),
                ),
              ],
            );
          }
        );
      },
    );
  }

  TimeOfDay? _parseTime(String? timeStr) {
    if (timeStr == null || !timeStr.contains(':')) return null;
    final parts = timeStr.split(':');
    return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
  }
}
