import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import QuoteDetailClient from './QuoteDetailClient'

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

  return <QuoteDetailClient quote={quote} />
}
