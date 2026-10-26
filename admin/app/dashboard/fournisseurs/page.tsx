import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import FournisseursClientPage from './FournisseursClientPage'

export default async function FournisseursPage() {
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

  const { data: fournisseurs } = await supabase
    .from('fournisseurs')
    .select('*')
    .order('name', { ascending: true })

  // Count fournitures per fournisseur
  const { data: counts } = await supabase
    .from('fournitures')
    .select('fournisseur_id')

  const countMap: Record<string, number> = {}
  ;(counts || []).forEach((row: any) => {
    if (row.fournisseur_id) {
      countMap[row.fournisseur_id] = (countMap[row.fournisseur_id] || 0) + 1
    }
  })

  return (
    <FournisseursClientPage
      initialFournisseurs={fournisseurs || []}
      countMap={countMap}
    />
  )
}
