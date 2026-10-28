/**
 * Worker login endpoint
 * POST /api/auth/worker-login
 * Body: { email, password }
 */

export async function POST(req) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return Response.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      )
    }

    // TODO: Query workers table from Supabase
    // TODO: Verify password hash
    // TODO: Return token and worker info

    return Response.json(
      { error: 'Authentification non implémentée' },
      { status: 501 }
    )
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
