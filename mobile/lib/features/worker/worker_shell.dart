import 'package:flutter/material.dart';

import 'package:koji/features/worker/worker_home_screen.dart';
import 'package:koji/features/worker/worker_archives_screen.dart';
import 'package:koji/features/worker/worker_tasks_screen.dart';

/// Root of the Worker (ouvrier) space, reached from the sessionless
/// "Espace Particulier" login when an OUV-XXXXXX code matches. Hosts the three
/// worker sections behind a bottom navigation bar:
///   • Accueil   → "Mes chantiers en cours" (WorkerHomeScreen)
///   • Tâches    → the flat task checklist (WorkerTasksScreen)
///   • Archives  → terminated chantiers with full history (WorkerArchivesScreen)
class WorkerShell extends StatefulWidget {
  final String workerId;
  final String? workerName;

  const WorkerShell({
    super.key,
    required this.workerId,
    this.workerName,
  });

  @override
  State<WorkerShell> createState() => _WorkerShellState();
}

class _WorkerShellState extends State<WorkerShell> {
  static const _navy = Color(0xFF1F2937);
  static const _green = Color(0xFF22C55E);

  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      WorkerHomeScreen(workerId: widget.workerId, workerName: widget.workerName),
      WorkerTasksScreen(workerId: widget.workerId, workerName: widget.workerName),
      WorkerArchivesScreen(workerId: widget.workerId),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        backgroundColor: Colors.white,
        indicatorColor: const Color(0xFFDCFCE7),
        height: 64,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined, color: _navy),
            selectedIcon: Icon(Icons.home, color: _green),
            label: 'Accueil',
          ),
          NavigationDestination(
            icon: Icon(Icons.checklist_outlined, color: _navy),
            selectedIcon: Icon(Icons.checklist, color: _green),
            label: 'Tâches',
          ),
          NavigationDestination(
            icon: Icon(Icons.inventory_2_outlined, color: _navy),
            selectedIcon: Icon(Icons.inventory_2, color: _green),
            label: 'Archives',
          ),
        ],
      ),
    );
  }
}
