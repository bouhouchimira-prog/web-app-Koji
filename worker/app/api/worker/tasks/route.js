/**
 * Get worker tasks
 * GET /api/worker/tasks?workerId=xxx
 * Returns: Array of tasks assigned to this worker
 */

const { getWorkerTasks } = require('@/lib/supabase-client')

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const workerId = searchParams.get('workerId')

    if (!workerId) {
      return Response.json(
        { error: 'workerId requis', tasks: [] },
        { status: 400 }
      )
    }

    const tasks = await getWorkerTasks(workerId)

    const formattedTasks = tasks.map((task) => ({
      id: task.id,
      label: task.label,
      project: task.projects?.name || task.project || 'N/A',
      status: task.status,
      done: task.done,
      dueDate: task.due_date,
      startDate: task.start_date,
      estimatedHours: task.estimated_hours,
      description: task.description,
      location: task.location,
      quoteTitle: task.quotes?.title,
      quoteAmount: task.quotes?.total_amount,
    }))

    return Response.json(formattedTasks, { status: 200 })
  } catch (error) {
    console.error('Get tasks error:', error)
    return Response.json(
      { error: 'Erreur lors du chargement des tâches', tasks: [] },
      { status: 500 }
    )
  }
}
