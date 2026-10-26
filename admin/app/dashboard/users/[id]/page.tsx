import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserDetailClient from './UserDetailClient'

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const [{ data: user }, { data: quotes }] = await Promise.all([
    supabase.from('users').select('*').eq('id', id).single(),
    supabase.from('quotes').select('id, client_name, total_amount, status, created_at, signed_at').eq('user_id', id).order('created_at', { ascending: false })
  ])

  if (!user) {
    redirect('/dashboard/users')
  }

  return <UserDetailClient user={user} quotes={quotes || []} />
}
