import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

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

// Contrôle d'accès des PAGES du back-office (18 nov.). Le gabarit
// app/dashboard/layout.tsx ne suffit pas : lors d'une navigation interne,
// Next.js ne rend que la page et saute les gabarits déjà chargés, donc une
// requête fabriquée (en-tête RSC) recevait le contenu d'une page sans
// passer par le contrôle du gabarit. Chaque page et chaque lecture de
// données (lib/bo/donnees.ts) appelle donc exigerBackOffice(). Même règle
// que le gabarit : colonne users.is_admin si elle existe, sinon les deux
// comptes historiques.
const ADMINS_HISTORIQUES = ['ablexpertrenov@gmail.com', 'bouhouchimira@gmail.com']

export const sessionBackOffice = cache(async () => {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).maybeSingle()
  const admis = profile && typeof profile.is_admin === 'boolean' ? profile.is_admin : ADMINS_HISTORIQUES.includes(user.email || '')
  return admis ? user : null
})

export async function exigerBackOffice() {
  const user = await sessionBackOffice()
  if (!user) redirect('/auth/login')
  return user
}
