import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireAdminSession } from '@/lib/require-admin'
import { journaliser } from '@/lib/bo/journal'
import QuoteDetailClient from './QuoteDetailClient'

// Contenu d'un devis (maquette PRO-24.4) : ouvert seulement en support,
// et chaque ouverture est tracée dans le journal des accès.
export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).single()

  if (!quote) {
    redirect('/dashboard/quotes')
  }

  const admin = await requireAdminSession()
  if (admin) await journaliser({ admin: String(admin.email), action: 'lecture d\'un devis', cibleType: 'devis', cibleId: id, motif: 'support' })

  return <QuoteDetailClient quote={quote} />
}
