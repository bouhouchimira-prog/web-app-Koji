import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import CommunicationsClientPage, { type EmailSendRow } from './CommunicationsClientPage'

// Refonte (25 oct) : page entierement decorative avant ce changement
// (segments/historique inventes, formulaire non controle, aucun envoi
// branche). Lit maintenant les vrais comptes (table `users`) pour les
// segments et le vrai historique (table `admin_email_sends`, voir
// ADMIN_EMAIL_SENDS_MIGRATION.sql) ; l'envoi passe par
// app/api/admin/send-email/route.ts (vrai SMTP, meme config que koji-web).
export default async function CommunicationsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  const [{ count: totalUsers }, { count: proUsers }, { data: history }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_pro', true),
    supabase.from('admin_email_sends').select('*').order('sent_at', { ascending: false }).limit(5)
  ])

  return (
    <CommunicationsClientPage
      totalUsers={totalUsers || 0}
      proUsers={proUsers || 0}
      history={(history || []) as EmailSendRow[]}
    />
  )
}
