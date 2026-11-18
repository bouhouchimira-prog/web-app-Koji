import { createAdminClient } from '@/lib/supabase-admin'
import { estEntreprise, nomEntreprise, type Utilisateur } from './regles'
import type { DevisLigne } from './client'

// Lecture des données de koji-web pour le back-office (clé service,
// serveur uniquement, pages protégées par le layout admin). Lecture seule,
// sauf les actions explicites (validation de documents).

const COLONNES = 'id,email,is_pro,created_at,updated_at,full_name,phone,profession,subscription_status,subscription_product,subscription_expires_at,trial_ends_at,business_info,email_verified,address'

export async function utilisateurs(): Promise<Utilisateur[]> {
  const { data, error } = await createAdminClient().from('users').select(COLONNES).order('created_at', { ascending: false })
  if (error) throw new Error(`Lecture des comptes impossible : ${error.message}`)
  return (data || []) as Utilisateur[]
}

export async function utilisateur(id: string): Promise<Utilisateur | null> {
  const { data } = await createAdminClient().from('users').select(COLONNES).eq('id', id).maybeSingle()
  return (data as Utilisateur) || null
}

export type Devis = { id: string; user_id: string; status: string | null; created_at: string | null; signed_at: string | null; total_ttc: number | null; reference: string | null }

export async function devis(userId?: string): Promise<Devis[]> {
  let q = createAdminClient().from('quotes').select('id,user_id,status,created_at,signed_at,total_ttc,reference').order('created_at', { ascending: false })
  if (userId) q = q.eq('user_id', userId)
  const { data } = await q
  return (data || []) as Devis[]
}

// Particuliers : comptes du site (table particulier_users_state, une ligne
// JSON tenue par koji-web) et comptes de l'app Koji (table users, non pro).
// Aucun secret n'est renvoyé (mots de passe, jetons d'activation).
export type Particulier = { id: string; nom: string; email: string; telephone: string; adresse: string; creeLe: string; majLe: string; derniereConnexion: string; emailVerifie: boolean; actif: boolean; source: 'site' | 'app' }

export async function particuliers(comptes?: Utilisateur[]): Promise<Particulier[]> {
  const [{ data }, users] = await Promise.all([
    createAdminClient().from('particulier_users_state').select('data').eq('id', 1).maybeSingle(),
    comptes ? Promise.resolve(comptes) : utilisateurs()
  ])
  const site = (((data as { data?: Record<string, unknown>[] } | null)?.data) || []).map((p): Particulier => {
    const perso = (p.personal || {}) as Record<string, unknown>
    return {
      id: String(p.id), nom: String(p.name || ''), email: String(p.email || ''), telephone: String(perso.phone || ''), adresse: String(perso.address || ''),
      creeLe: String(p.createdAt || ''), majLe: String(p.updatedAt || ''), derniereConnexion: String(p.lastLoginAt || ''),
      emailVerifie: !p.activationToken, actif: p.isActive !== false, source: 'site'
    }
  })
  const emails = new Set(site.map((p) => p.email.toLowerCase()).filter(Boolean))
  const app = users.filter((u) => !estEntreprise(u) && !emails.has(String(u.email || '').toLowerCase())).map((u): Particulier => ({
    id: u.id, nom: String(u.full_name || ''), email: String(u.email || ''), telephone: String(u.phone || ''), adresse: String(u.address || ''),
    creeLe: String(u.created_at || ''), majLe: String(u.updated_at || ''), derniereConnexion: '', emailVerifie: Boolean(u.email_verified), actif: true, source: 'app'
  }))
  return [...site, ...app].sort((a, b) => b.creeLe.localeCompare(a.creeLe))
}

// Annuaire id → nom et e-mail (entreprises et particuliers), pour nommer
// les deux parties d'une demande ou d'une conversation.
export async function annuaire() {
  const comptes = await utilisateurs()
  const parts = await particuliers(comptes)
  const m = new Map<string, { nom: string; email: string; entreprise: boolean }>()
  for (const u of comptes) m.set(u.id, { nom: estEntreprise(u) ? nomEntreprise(u) : String(u.full_name || ''), email: String(u.email || ''), entreprise: estEntreprise(u) })
  for (const p of parts) m.set(p.id, { nom: p.nom, email: p.email, entreprise: false })
  return { comptes, particuliers: parts, qui: (id: string) => m.get(id) }
}

// Devis avec les champs utiles à la liste du back-office (client, envoi,
// validité, origine Radar), sans le contenu (lignes, prix unitaires).
export async function devisListe(): Promise<DevisLigne[]> {
  const { data } = await createAdminClient().from('quotes').select('id,user_id,status,created_at,signed_at,total_ttc,reference,metadata->client,metadata->date,metadata->validity,metadata->quoteNumber,web_extras->sentAt,web_extras->signedAt,web_extras->versionNumber,web_extras->chantierOffreId,web_extras->clientFirstName,web_extras->clientLastName,web_extras->clientCompanyName,web_extras->refusedAt,web_extras->cancelledAt').order('created_at', { ascending: false })
  return ((data || []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), user_id: String(r.user_id), status: (r.status as string) ?? null, created_at: (r.created_at as string) ?? null, signed_at: (r.signed_at as string) ?? null, total_ttc: (r.total_ttc as number) ?? null, reference: (r.reference as string) ?? null,
    metadata: { client: r.client, date: r.date, validity: r.validity, quoteNumber: r.quoteNumber },
    web_extras: { sentAt: r.sentAt, signedAt: r.signedAt, versionNumber: r.versionNumber, chantierOffreId: r.chantierOffreId, clientFirstName: r.clientFirstName, clientLastName: r.clientLastName, clientCompanyName: r.clientCompanyName, refusedAt: r.refusedAt, cancelledAt: r.cancelledAt }
  }))
}

// Base JSON de koji-web (table koji_web_state, ligne 1) : Radar,
// notifications, avis, factures, support…
export async function etatWeb(): Promise<Record<string, unknown[]>> {
  const { data } = await createAdminClient().from('koji_web_state').select('data').eq('id', 1).maybeSingle()
  return ((data as { data?: Record<string, unknown[]> } | null)?.data) || {}
}

export const estSigneDevis = (d: { status?: string | null; signed_at?: string | null }) => Boolean(d.signed_at) || ['signe', 'signé', 'signed', 'accepte'].includes(String(d.status || '').toLowerCase())
