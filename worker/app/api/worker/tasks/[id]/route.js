/**
 * Get/Update single task
 * GET /api/worker/tasks/[id] - Get task detail
 * PATCH /api/worker/tasks/[id] - Update task status
 */

const { getTaskById, updateTaskStatus } = require('@/lib/supabase-client');

export async function GET(req, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return Response.json(
        { error: 'Task ID requis' },
        { status: 400 }
      );
    }

    const task = await getTaskById(id);

    if (!task) {
      return Response.json(
        { error: 'Tâche non trouvée' },
        { status: 404 }
      );
    }

    const formattedTask = {
      id: task.id,
      label: task.label,
      description: task.description,
      project: task.projects?.name || task.project,
      projectAddress: task.projects?.address,
      status: task.status,
      done: task.done,
      dueDate: task.due_date,
      startDate: task.start_date,
      endDate: task.end_date,
      estimatedHours: task.estimated_hours,
      durationHours: task.duration_hours,
      quoteTitle: task.quotes?.title,
      quoteAmount: task.quotes?.total_amount,
      assignedTo: task.assigned_to,
      workerIds: task.worker_ids,
    };

    return Response.json(formattedTask, { status: 200 });
  } catch (error) {
    console.error('Get task error:', error);
    return Response.json(
      { error: 'Erreur lors du chargement de la tâche' },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const { status, done } = await req.json();

    if (!id || !status) {
      return Response.json(
        { error: 'Task ID et status requis' },
        { status: 400 }
      );
    }

    const updatedTask = await updateTaskStatus(id, status, done);

    return Response.json(
      {
        success: true,
        message: `Tâche marquée comme ${status}`,
        task: updatedTask,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update task error:', error);
    return Response.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}
