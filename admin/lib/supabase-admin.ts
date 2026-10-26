import { createClient } from '@supabase/supabase-js'

// Client service_role, usage serveur uniquement (routes API) — jamais
// importe depuis un composant client. Necessaire pour creer des comptes
// Supabase Auth (auth.admin.createUser), chose que la cle anon ne permet
// pas. Meme cle que SUPABASE_SERVICE_ROLE_KEY cote koji-web (meme projet
// Supabase).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — ajoute-le dans .env.local (et sur Vercel)')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}
