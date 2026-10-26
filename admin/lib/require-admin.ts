import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const ADMIN_EMAIL = 'ablexpertrenov@gmail.com'

// Meme controle que app/dashboard/layout.tsx, repete ici car les routes
// API ne passent pas par ce layout — sans ca, un appel direct a l'API
// contournerait la barriere d'acces a un seul compte.
export async function requireAdminSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return null
  }
  return user
}
