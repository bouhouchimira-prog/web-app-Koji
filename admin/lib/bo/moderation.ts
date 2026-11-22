import { createHmac } from 'crypto'
import type { Ligne } from './client'
import { exigerBackOffice } from '@/lib/require-admin'

// Signalements de contenu (Signaler / Bloquer dans les apps, App Store
// règle 1.2). L'examen et les décisions (retirer, suspendre, réactiver,
// classer) sont faits par le site (koji-web, /api/interne/moderation) :
// c'est lui qui tient la base partagée. Requête signée avec une clé dérivée
// de la clé de service Supabase, la même des deux côtés (lib/interne-signature.js
// dans koji-web).
const SITE = process.env.KOJI_WEB_URL || 'https://getkoji.io'
const s = (v: unknown) => String(v ?? '')

export const DELAI_MS = 24 * 3600 * 1000

export const estModeration = (r: Ligne) => ['contenu', 'blocage'].includes(s(r.nature)) || /^\[(Signalement contenu|Blocage)\]/.test(s(r.message))
export const estTraite = (r: Ligne) => /trait|resolu|résolu|clos/i.test(s(r.status))
export const natureLabel = (r: Ligne) => (s(r.nature) === 'blocage' || /^\[Blocage\]/.test(s(r.message)) ? 'Blocage' : 'Signalement')

const CIBLES: Record<string, string> = {
  message_devis: 'Messages d’un devis',
  offre_radar: 'Demande du Radar',
  conversation: 'Conversation'
}
export function cibleLabel(r: Ligne) {
  const c = (r.cible || {}) as { type?: string; id?: string }
  const type = s(c.type) || (/Type : (\S+)/.exec(s(r.message)) || [])[1] || ''
  const id = s(c.id)
  if (type === 'conversation' && id.startsWith('radar:')) return 'Conversation du Radar'
  if (type === 'conversation' && id.startsWith('devis:')) return 'Messages d’un devis'
  if (type === 'conversation' && id.startsWith('reseau:')) return 'Échange du Réseau pro'
  if (type === 'conversation' && id.startsWith('kojipage:')) return 'Demande KojiPage'
  return CIBLES[type] || 'Contenu'
}
// L'app Koji envoie accountType « particulier » ; sa session peut être celle
// de Supabase (messages des devis), que le site classe « entreprise ».
export const appli = (r: Ligne) => (['particulier', 'portal', 'client'].includes(s(r.accountType || r.sessionKind).toLowerCase()) ? 'Koji' : 'Koji Pro')

export type Auteur = { type: string; compte: string; id: string; nom: string; email: string; suspendu: boolean }
export type Contenu = { id: string; texte: string; le: string; retire: boolean }
export type Examen = { auteur: Auteur | null; contenus: Contenu[]; peutRetirer: boolean; peutSuspendre: boolean }
export type Reponse = { report: Ligne; examen: Examen; detail?: string }

function cle() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  return k ? createHmac('sha256', k).update('koji-appels-internes-v1').digest() : null
}

export async function appelerSite(action: string, reportId: string, par = ''): Promise<{ ok: true; data: Reponse } | { ok: false; erreur: string; status: number }> {
  await exigerBackOffice()
  const k = cle()
  if (!k) return { ok: false, erreur: 'SUPABASE_SERVICE_ROLE_KEY manquant.', status: 500 }
  const corps = JSON.stringify({ action, reportId, par })
  const t = String(Date.now())
  const signature = `${t}.${createHmac('sha256', k).update(`${t}.${corps}`).digest('base64url')}`
  try {
    const r = await fetch(`${SITE}/api/interne/moderation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-koji-interne': signature },
      body: corps,
      cache: 'no-store'
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { ok: false, erreur: s(j.error) || `Erreur du site (${r.status}).`, status: r.status }
    return { ok: true, data: j as Reponse }
  } catch {
    return { ok: false, erreur: 'Le site ne répond pas.', status: 502 }
  }
}
