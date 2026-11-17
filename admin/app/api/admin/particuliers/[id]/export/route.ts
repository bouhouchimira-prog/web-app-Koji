import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/require-admin'
import { etatWeb, particuliers } from '@/lib/bo/donnees'
import { journaliser } from '@/lib/bo/journal'
import type { Ligne } from '@/lib/bo/client'

// Export des données d'un particulier (RGPD art. 20, maquette PRO-24.3) :
// même périmètre que l'export libre-service de koji-web
// (app/api/account/export) — profil, demandes Radar, messages, paiements,
// notifications — sans aucun secret. L'accès est tracé.
const s = (v: unknown) => String(v ?? '')

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSession()
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { id } = await params
  // Profil sans secret : la fiche normalisée (aucun mot de passe ni jeton).
  const profil = (await particuliers()).find((p) => p.id === id)
  if (!profil) return NextResponse.json({ error: 'Particulier introuvable.' }, { status: 404 })
  const db = await etatWeb()
  const offres = ((db.chantierOffres || []) as Ligne[]).filter((o) => s(o.userId) === id)
  const ids = new Set(offres.map((o) => s(o.id)))
  const contenu = {
    accountType: 'particulier',
    generatedAt: new Date().toISOString(),
    profil,
    offresRadarDesChantiers: offres,
    messages: ((db.chantierOffreMessages || []) as Ligne[]).filter((m) => ids.has(s(m.offerId))),
    paiements: ((db.chantierPaiements || []) as Ligne[]).filter((p) => ids.has(s(p.offerId))),
    notifications: ((db.notifications || []) as Ligne[]).filter((n) => s(n.userId) === id)
  }
  await journaliser({ admin: s(admin.email), action: 'export des données', cibleType: 'particulier', cibleId: id, motif: 'RGPD art. 20' })
  return new NextResponse(JSON.stringify(contenu, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="koji-donnees-${id.slice(0, 8)}.json"`, 'Cache-Control': 'no-store' }
  })
}
