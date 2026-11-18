import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { sendMail } from '@/lib/mailer'
import { annuaire, etatWeb, utilisateurs } from '@/lib/bo/donnees'
import { entreprisesDeLaZone, etatDemande, libelleDemande, type Ligne } from '@/lib/bo/client'

// Demande sans réponse (maquette PRO-24.13) : relancer les entreprises de
// la zone (message de service, un e-mail par entreprise, aucune adresse
// partagée) ou prévenir le particulier que la recherche continue.
const SITE = process.env.KOJI_WEB_URL || 'https://getkoji.io'
const SUPPORT_CLIENT = 'contact@getkoji.io'
const s = (v: unknown) => String(v ?? '')

export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const offreId = s(body.offreId)
  const cible = s(body.cible)
  if (!offreId || !['entreprises', 'particulier'].includes(cible)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

  const db = await etatWeb()
  const offre = ((db.chantierOffres || []) as Ligne[]).find((o) => s(o.id) === offreId)
  if (!offre) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 })
  const e = etatDemande(offre, (db.chantierPositionnements || []) as Ligne[], (db.chantierOffreMessages || []) as Ligne[])
  if (e.etat !== 'sans_reponse') return NextResponse.json({ error: 'Cette demande a déjà une réponse.' }, { status: 409 })
  const titre = libelleDemande(offre)
  const ville = s(offre.city)

  if (cible === 'entreprises') {
    const cibles = entreprisesDeLaZone(offre, await utilisateurs(), (db.comptePrefs || {}) as unknown as Record<string, unknown>)
    if (!cibles.length) return NextResponse.json({ error: 'Aucune entreprise dont la zone et le métier correspondent.' }, { status: 404 })
    let envoyes = 0
    for (const u of cibles) {
      const r = await sendMail({
        to: s(u.email),
        subject: `Un chantier attend une réponse${ville ? ` à ${ville}` : ''}`,
        text: `Bonjour,\n\nUne demande publiée sur Koji dans votre zone n'a pas encore reçu de réponse : ${titre}${ville ? ` (${ville})` : ''}.\n\nVoir la demande : ${SITE}/marketplace/${offreId}\n\nMessage de service Koji : vous le recevez parce que votre zone et votre métier correspondent. Vous pouvez couper ces e-mails dans Réglages, Notifications.\n\nL'équipe Koji`
      })
      if (r.ok) envoyes++
    }
    return NextResponse.json({ envoyes, total: cibles.length })
  }

  const { qui } = await annuaire()
  const to = s(qui(s(offre.userId))?.email || offre.clientEmail)
  if (!to) return NextResponse.json({ error: 'Aucune adresse pour ce particulier.' }, { status: 404 })
  const r = await sendMail({
    to,
    replyTo: SUPPORT_CLIENT,
    subject: 'Nous cherchons encore une entreprise pour votre projet',
    text: `Bonjour,\n\nVotre demande « ${titre} » n'a pas encore trouvé d'entreprise. Nous continuons à chercher et prévenons les entreprises de votre secteur.\n\nSi vous le souhaitez, nous pouvons élargir la zone de recherche : répondez simplement à ce message.\n\nL'équipe Koji`
  })
  if (!r.ok) return NextResponse.json({ error: r.error || 'Envoi impossible.' }, { status: 502 })
  return NextResponse.json({ envoyes: 1, total: 1 })
}
