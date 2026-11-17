import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { annuaire } from '@/lib/bo/donnees'
import { estEntreprise, offreDe } from '@/lib/bo/regles'

// Envoi d'une communication (maquette PRO-24.9), cibles séparées :
// entreprises (toutes, abonnées Pro et Business, en essai), particuliers
// (message de service seulement : toute communication commerciale demande
// un consentement séparé et un lien de désinscription, qui n'existent pas
// encore), ou adresses saisies. Un e-mail par destinataire, aucune adresse
// partagée. L'envoi est inscrit dans admin_email_sends.
const CIBLES: Record<string, string> = {
  entreprises: 'Entreprises, toutes',
  abonnes: 'Entreprises Pro et Business',
  essai: 'Entreprises en essai',
  particuliers: 'Particuliers (message de service)',
  custom: 'Destinataires saisis'
}

export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const segment = String(body.segment || '')
  const subject = String(body.subject || '').trim()
  const message = String(body.message || '').trim()
  if (!CIBLES[segment]) return NextResponse.json({ error: 'Cible inconnue.' }, { status: 400 })
  if (!subject || !message) return NextResponse.json({ error: 'Objet et message requis.' }, { status: 400 })
  if (segment === 'particuliers' && body.service !== true) return NextResponse.json({ error: 'Vers les particuliers : messages de service seulement. Cochez la case pour confirmer.' }, { status: 400 })

  let recipients: string[] = []
  if (segment === 'custom') {
    recipients = (Array.isArray(body.customEmails) ? body.customEmails : []).map((e: unknown) => String(e).trim()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
  } else {
    const { comptes, particuliers } = await annuaire()
    const entreprises = comptes.filter(estEntreprise)
    if (segment === 'entreprises') recipients = entreprises.map((u) => String(u.email || ''))
    if (segment === 'abonnes') recipients = entreprises.filter((u) => ['pro', 'business'].includes(offreDe(u).plan)).map((u) => String(u.email || ''))
    if (segment === 'essai') recipients = entreprises.filter((u) => offreDe(u).essai).map((u) => String(u.email || ''))
    if (segment === 'particuliers') recipients = particuliers.filter((p) => p.actif).map((p) => p.email)
  }
  recipients = [...new Set(recipients.filter(Boolean).map((e) => e.toLowerCase()))]
  if (!recipients.length) return NextResponse.json({ error: 'Aucun destinataire pour cette cible.' }, { status: 400 })

  const results = await Promise.allSettled(recipients.map((to) => sendMail({ to, subject, text: message })))
  const sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length
  if (!sentCount) return NextResponse.json({ error: 'Aucun e-mail envoyé : vérifier la configuration SMTP.' }, { status: 502 })

  const { data: logRow, error: logError } = await createAdminClient()
    .from('admin_email_sends')
    .insert([{ subject, message, recipients_count: sentCount, segment: CIBLES[segment] }])
    .select()
    .single()
  return NextResponse.json({ sentCount, total: recipients.length, log: logError ? null : logRow })
}
