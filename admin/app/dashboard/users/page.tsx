import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import UsersClientPage, { type UserRow } from './UsersClientPage'

// Refonte maquette (25 oct, AdminUsers.dc.html) + passage en composant
// client (UsersClientPage) pour que les puces de filtre et "+ Ajouter un
// utilisateur" soient reellement fonctionnels (avant : 100% decoratif).
export default async function UsersPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
  const users = (data || []) as UserRow[]

  return <UsersClientPage initialUsers={users} />
}
