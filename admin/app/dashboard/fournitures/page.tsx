import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FournituresClientPage from './FournituresClientPage'

export default async function FournituresPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    }
  )

  const [{ data: fournitures }, { data: fournisseurs }] = await Promise.all([
    supabase
      .from('fournitures')
      .select('*, fournisseurs(name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('fournisseurs')
      .select('id, name')
      .order('name', { ascending: true })
  ])

  return (
    <FournituresClientPage
      initialFournitures={fournitures || []}
      fournisseurs={fournisseurs || []}
    />
  )
}
