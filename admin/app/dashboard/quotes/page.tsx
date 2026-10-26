import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import QuotesClientPage, { type QuoteRow } from './QuotesClientPage'

// Refonte (25 oct) : passage en composant client (QuotesClientPage) pour
// que les puces de filtre et "Exporter" soient reellement fonctionnels.
export default async function QuotesPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false })
  const quotes = (data || []) as QuoteRow[]

  return <QuotesClientPage initialQuotes={quotes} />
}
