import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase-admin'
import { sendMail } from '@/lib/mailer'
import { DOCUMENTS, nomEntreprise, type Doc, type Utilisateur } from '@/lib/bo/regles'

// Vérification d'un document d'entreprise (maquette PRO-24.2) :
// valider = date de fin saisie, document marqué vérifié ; refuser = motif
// obligatoire et message à l'entreprise. Écrit dans users.business_info
// (documents.{decennale|urssaf|kbis|rcpro}) — la même fiche que lit koji-web.
export async function POST(request: Request) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || '')
  const doc = String(body.doc || '')
  const action = String(body.action || '')
  if (!userId || !DOCUMENTS[doc] || !['valider', 'refuser'].includes(action)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

  const supa = createAdminClient()
  const { data, error } = await supa.from('users').select('id,email,full_name,business_info').eq('id', userId).maybeSingle()
  if (error || !data) return NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 })
  const u = data as Utilisateur
  const info = { ...(u.business_info || {}) } as Record<string, unknown>
  const documents = { ...((info.documents as Record<string, Doc>) || {}) }
  const d: Doc = { ...(documents[doc] || {}) }
  if (!d.fileDataUrl) return NextResponse.json({ error: 'Aucun document reçu à vérifier.' }, { status: 400 })
  const maintenant = new Date().toISOString()

  if (action === 'valider') {
    const jusqua = String(body.jusqua || '').slice(0, 10)
    if ((doc === 'decennale' || doc === 'urssaf') && !/^\d{4}-\d{2}-\d{2}$/.test(jusqua)) return NextResponse.json({ error: 'Saisissez la date de fin de validité.' }, { status: 400 })
    if (jusqua && jusqua < maintenant.slice(0, 10)) return NextResponse.json({ error: 'Cette date est déjà passée : le document est expiré.' }, { status: 400 })
    Object.assign(d, { valideLe: maintenant, valideePar: admin.email || 'admin', refuseLe: '', motif: '' })
    if (jusqua) d.expiryDate = jusqua
  } else {
    const motif = String(body.motif || '').trim().slice(0, 300)
    if (!motif) return NextResponse.json({ error: 'Le motif du refus est obligatoire.' }, { status: 400 })
    Object.assign(d, { refuseLe: maintenant, motif, valideLe: '' })
  }
  documents[doc] = d
  info.documents = documents
  const { error: e2 } = await supa.from('users').update({ business_info: info }).eq('id', userId)
  if (e2) return NextResponse.json({ error: `Enregistrement impossible : ${e2.message}` }, { status: 500 })

  let mail = null
  if (action === 'refuser' && u.email) {
    mail = await sendMail({
      to: u.email,
      subject: `Koji Pro · ${DOCUMENTS[doc]} à renvoyer`,
      text: `Bonjour,\n\nNous n'avons pas pu valider votre document « ${DOCUMENTS[doc]} » : ${d.motif}.\n\nRenvoyez-le depuis Koji Pro › Paramètres › Mon entreprise.\n\nL'équipe Koji\nentreprise@getkoji.io`
    })
  }
  return NextResponse.json({ ok: true, nom: nomEntreprise(u), document: { valideLe: d.valideLe || '', refuseLe: d.refuseLe || '', expiryDate: d.expiryDate || '' }, mail })
}
