import { redirect } from 'next/navigation'
import { exigerBackOffice } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'
import { journaliser } from '@/lib/bo/journal'
import QuoteDetailClient from './QuoteDetailClient'

// Contenu d'un devis (maquette PRO-24.4) : ouvert seulement en support,
// et chaque ouverture est tracée dans le journal des accès. Le devis est lu
// avec la clé du back-office, après le contrôle d'accès : avant le 18 nov.,
// il était lu avec les droits du compte connecté, la base le refusait et la
// page renvoyait vers la liste sans rien inscrire au journal.
export const dynamic = 'force-dynamic'

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerBackOffice()
  const { id } = await params
  const { data: quote } = await createAdminClient().from('quotes').select('*').eq('id', id).maybeSingle()
  if (!quote) redirect('/dashboard/quotes')
  await journaliser({ admin: String(admin.email || admin.id), action: 'lecture d\'un devis', cibleType: 'devis', cibleId: id, motif: 'support' })
  return <QuoteDetailClient quote={quote} />
}
