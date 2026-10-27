class TaskCategory {
  final String title;
  final List<TaskItem> tasks;

  TaskCategory({required this.title, required this.tasks});
}

class TaskItem {
  final String id;
  final String label;

  // KOJI Banque de Temps fields (null for legacy tasks)
  final String? description; // commentaire shown under the task
  final String? code;
  final String? famille;
  final String? unite;
  final double? tempsHU;
  final String? typePoste;  // 'POSTE' or 'SOUS-POSTE'
  final String? parentId;
  final List<TaskItem> subTasks;
  final bool isGlobal; // user_id IS NULL

  TaskItem({
    required this.id,
    required this.label,
    this.description,
    this.code,
    this.famille,
    this.unite,
    this.tempsHU,
    this.typePoste,
    this.parentId,
    this.subTasks = const [],
    this.isGlobal = false,
  });

  bool get isParent => subTasks.isNotEmpty || typePoste == 'POSTE';
  bool get isChild  => parentId != null;

  double get effectiveTempsHU {
    if (subTasks.isNotEmpty) return subTasks.fold(0.0, (s, t) => s + (t.tempsHU ?? 0));
    return tempsHU ?? 0;
  }
}

// Profession-specific task data
// CLEARED per user request - dynamic tasks only
final Map<String, List<TaskCategory>> professionTasksData = {
  // Empty - no default tasks
};

// Get tasks for a specific profession
List<TaskCategory> getTasksForProfession(String? profession) {
  // Return empty or fetch? logic updates might be needed elsewhere if this returns empty.
  if (profession == null) return [];

  // "Tout corps d'état" gets all tasks
  if (profession == "Tout corps d'état") {
    final allTasks = <TaskCategory>[];
    professionTasksData.forEach((key, value) {
      if (key != "Tout corps d'état") {
        allTasks.addAll(value);
      }
    });
    return allTasks;
  }

  return professionTasksData[profession] ?? [];
}
