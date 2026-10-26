import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireAdminSession } from '@/lib/require-admin'
import { sendMail } from '@/lib/mailer'

export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await request.json()
  const { segment, customEmails, subject, message } = body as {
    segment: 'all' | 'pro' | 'standard' | 'custom'
    customEmails?: string[]
    subject: string
    message: string
  }

  if (!subject || !message) {
    return NextResponse.json({ error: 'Objet et message requis' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() { } } }
  )

  let recipients: string[] = []
  if (segment === 'custom') {
    recipients = (customEmails || []).filter(Boolean)
  } else {
    let query = supabase.from('users').select('email')
    if (segment === 'pro') query = query.eq('is_pro', true)
    if (segment === 'standard') query = query.or('is_pro.is.null,is_pro.eq.false')
    const { data } = await query
    recipients = (data || []).map((u: { email: string }) => u.email).filter(Boolean)
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire trouvé pour cet envoi' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    recipients.map((to) => sendMail({ to, subject, text: message }))
  )
  const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length

  if (sentCount === 0) {
    return NextResponse.json({ error: "Aucun e-mail envoyé — vérifie la configuration SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS)." }, { status: 502 })
  }

  const { data: logRow, error: logError } = await supabase
    .from('admin_email_sends')
    .insert([{ subject, message, recipients_count: sentCount, segment: segment === 'custom' ? 'Destinataires personnalisés' : segment }])
    .select()
    .single()

  return NextResponse.json({ sentCount, total: recipients.length, log: logError ? null : logRow })
}
