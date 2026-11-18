import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { sendMail } from '@/lib/mailer'
import { annuaire, etatWeb } from '@/lib/bo/donnees'
import { fils, libelleDemande, type Ligne } from '@/lib/bo/client'
import { journaliser } from '@/lib/bo/journal'

// Décision sur un fil client ↔ entreprise (maquette PRO-24.7) : « aucune
// suite » est inscrite au journal ; « rappel des règles » envoie le même
// message de service aux deux parties, puis l'inscrit au journal.
const s = (v: unknown) => String(v ?? '')
const REGLES = `Sur Koji, les échanges entre particuliers et entreprises restent courtois et respectueux. Ils ne contiennent ni coordonnées bancaires ni demande de paiement en dehors de ce que prévoit le devis signé.`

export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const id = s(body.fil)
  const decision = s(body.decision)
  if (!id || !['aucune_suite', 'rappel'].includes(decision)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  const db = await etatWeb()
  const fil = fils((db.chantierOffreMessages || []) as Ligne[]).find((f) => f.id === id)
  if (!fil) return NextResponse.json({ error: 'Conversation introuvable.' }, { status: 404 })

  if (decision === 'aucune_suite') {
    await journaliser({ admin: s(admin.email), action: 'décision : aucune suite', cibleType: 'conversation', cibleId: id, motif: fil.motif || 'contrôle' })
    return NextResponse.json({ ok: true })
  }

  const offre = ((db.chantierOffres || []) as Ligne[]).find((o) => s(o.id) === fil.offreId)
  const { qui } = await annuaire()
  const destinataires = [s(qui(fil.particulierUserId || s(offre?.userId))?.email || offre?.clientEmail), s(qui(fil.entrepriseUserId)?.email)].filter(Boolean)
  if (!destinataires.length) return NextResponse.json({ error: 'Aucune adresse pour ces deux comptes.' }, { status: 404 })
  const sujet = offre ? `Votre échange sur Koji : ${libelleDemande(offre)}` : 'Votre échange sur Koji'
  let envoyes = 0
  for (const to of destinataires) {
    const r = await sendMail({ to, subject: sujet, text: `Bonjour,\n\nNous vous rappelons les règles d'échange sur Koji.\n\n${REGLES}\n\nCe message est envoyé aux deux parties de la conversation.\n\nL'équipe Koji` })
    if (r.ok) envoyes++
  }
  if (!envoyes) return NextResponse.json({ error: 'Envoi impossible.' }, { status: 502 })
  await journaliser({ admin: s(admin.email), action: 'décision : rappel des règles', cibleType: 'conversation', cibleId: id, motif: fil.motif || 'contrôle' })
  return NextResponse.json({ envoyes })
}
