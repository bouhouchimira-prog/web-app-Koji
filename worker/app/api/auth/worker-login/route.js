/**
 * Worker login endpoint
 * POST /api/auth/worker-login
 * Body: { email, password }
 * Response: { token, workerId, workerName, success: true }
 */

const { getWorkerByEmail } = require('@/lib/supabase-client')
const crypto = require('crypto')

function verifyPassword(password, hash) {
  return crypto
    .createHash('sha256')
    .update(password)
    .digest('hex') === hash
}

export async function POST(req) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return Response.json(
        { error: 'Email et mot de passe requis', success: false },
        { status: 400 }
      )
    }

    const worker = await getWorkerByEmail(email)

    if (!worker) {
      return Response.json(
        { error: 'Email ou mot de passe incorrect', success: false },
        { status: 401 }
      )
    }

    if (!worker.password_hash || !verifyPassword(password, worker.password_hash)) {
      return Response.json(
        { error: 'Email ou mot de passe incorrect', success: false },
        { status: 401 }
      )
    }

    const token = crypto.randomBytes(32).toString('hex')

    return Response.json(
      {
        success: true,
        token,
        workerId: worker.id,
        workerName: `${worker.first_name} ${worker.last_name}`.trim(),
        email: worker.email,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return Response.json(
      { error: 'Erreur serveur', success: false },
      { status: 500 }
    )
  }
}
