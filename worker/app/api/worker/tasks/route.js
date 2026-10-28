/**
 * Get worker tasks
 * GET /api/worker/tasks?workerId=xxx
 */

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const workerId = searchParams.get('workerId')

    if (!workerId) {
      return Response.json(
        { error: 'workerId requis' },
        { status: 400 }
      )
    }

    // TODO: Query tasks assigned to this worker from Supabase

    return Response.json([])
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
