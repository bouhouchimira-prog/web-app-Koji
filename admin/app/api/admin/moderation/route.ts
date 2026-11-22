import { NextResponse } from 'next/server'
import { sessionBackOffice } from '@/lib/require-admin'
import { appelerSite } from '@/lib/bo/moderation'
import { journaliser } from '@/lib/bo/journal'

// Décision sur un signalement de contenu (page Signalements) : le site
// l'applique, le back-office l'inscrit au journal des accès.
const ACTIONS: Record<string, string> = {
  retirer: 'signalement : contenu retiré',
  suspendre: 'signalement : compte suspendu',
  reactiver: 'signalement : compte réactivé',
  classer: 'signalement : classé',
  rouvrir: 'signalement : rouvert'
}

export async function POST(request: Request) {
  const admin = await sessionBackOffice()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const reportId = String(body.reportId || '')
  const action = String(body.action || '')
  if (!reportId || !ACTIONS[action]) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  const r = await appelerSite(action, reportId, String(admin.email || ''))
  if (!r.ok) return NextResponse.json({ error: r.erreur }, { status: r.status })
  const a = r.data.examen?.auteur
  await journaliser({ admin: String(admin.email || ''), action: ACTIONS[action], cibleType: a?.type || 'signalement', cibleId: a?.id || reportId, motif: `signalement ${reportId}${r.data.detail ? ` · ${r.data.detail}` : ''}` })
  return NextResponse.json({ detail: r.data.detail || '' })
}
