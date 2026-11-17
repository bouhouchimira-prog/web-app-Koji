// Back-office Koji (maquettes PRO-24 à 24.2) : règles pures, sans accès
// aux données. Les comptes viennent de la table Supabase « users » de
// koji-web (business_info : champs de l'entreprise, extras préfixés « _ »).

export type Utilisateur = {
  id: string
  email: string | null
  is_pro: boolean | null
  created_at: string | null
  updated_at?: string | null
  full_name?: string | null
  phone?: string | null
  profession?: string | null
  subscription_status?: string | null
  subscription_product?: string | null
  subscription_expires_at?: string | null
  trial_ends_at?: string | null
  business_info?: Record<string, unknown> | null
  email_verified?: boolean | null
  address?: string | null
}

export type Doc = { fileDataUrl?: string; expiryDate?: string; updatedDate?: string; valideLe?: string; refuseLe?: string; motif?: string; recuLe?: string }

const j10 = (v: unknown) => String(v || '').slice(0, 10)
const plus = (jour: string, n: number) => new Date(Date.parse(`${jour}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

export function separer(u: Utilisateur) {
  const business: Record<string, unknown> = {}
  const extras: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(u.business_info || {})) (k.startsWith('_') ? extras : business)[k] = v
  return { business, extras }
}

export function estEntreprise(u: Utilisateur) {
  const { extras } = separer(u)
  if (extras._accountType) return extras._accountType !== 'particulier'
  return u.is_pro !== false
}

export function nomEntreprise(u: Utilisateur) {
  const { business, extras } = separer(u)
  return String(business.raisonSociale || extras._name || u.full_name || (u.email || '').split('@')[0] || 'Entreprise')
}

export const OFFRES: Record<string, string> = { start: 'Start', pro: 'Pro', business: 'Business', trial: 'Essai' }

export function offreDe(u: Utilisateur, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const { extras } = separer(u)
  const produit = String(u.subscription_product || '').toLowerCase()
  const actif = ['active', 'trialing', 'trial'].includes(String(u.subscription_status || '').toLowerCase())
  const depuisProduit = actif ? (produit.includes('business') ? 'business' : produit.includes('start') ? 'start' : produit.includes('pro') ? 'pro' : '') : ''
  const plan = depuisProduit || String(extras._billingPlan || '') || (extras._grandfathered ? 'pro' : 'trial')
  const finEssai = j10(u.trial_ends_at)
  return { plan, label: OFFRES[plan] || plan, essai: plan === 'trial', joursEssai: plan === 'trial' && finEssai ? Math.round((Date.parse(finEssai) - Date.parse(aujourdhui)) / 86400000) : null }
}

export const DOCUMENTS: Record<string, string> = { decennale: 'Décennale', urssaf: 'URSSAF', kbis: 'Kbis', rcpro: 'RC professionnelle' }

export function documentsDe(u: Utilisateur): Record<string, Doc> {
  const { business } = separer(u)
  return (business.documents as Record<string, Doc>) || {}
}

// État d'un document : à ajouter, à valider (reçu, pas encore vérifié),
// expiré (bloquant), expire sous 30 j, à jour, refusé.
export function etatDocument(cle: string, d: Doc = {}, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const fin = j10(d.expiryDate)
  if (!d.fileDataUrl) return { etat: 'manquant', label: cle === 'decennale' || cle === 'urssaf' ? 'manquante' : 'manquant', bloquant: cle === 'decennale' }
  if (d.refuseLe && (!d.recuLe || d.refuseLe >= d.recuLe)) return { etat: 'refuse', label: `refusé : ${d.motif || 'motif non précisé'}`, bloquant: cle === 'decennale' }
  if (fin && fin < aujourdhui) return { etat: 'expire', label: `expirée le ${fin.split('-').reverse().join('/')}`, bloquant: cle === 'decennale' }
  if (!d.valideLe || (d.recuLe && d.recuLe > d.valideLe)) return { etat: 'a_valider', label: 'reçu, à valider', bloquant: false }
  if (fin && fin <= plus(aujourdhui, 30)) return { etat: 'bientot', label: `expire le ${fin.split('-').reverse().join('/')}`, bloquant: false }
  if (cle === 'kbis' && d.valideLe && d.valideLe < plus(aujourdhui, -90)) return { etat: 'ancien', label: 'plus de 3 mois', bloquant: false }
  return { etat: 'ok', label: fin ? `à jour jusqu'au ${fin.split('-').reverse().join('/')}` : 'à jour', bloquant: false }
}

export function etatEntreprise(u: Utilisateur, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const o = offreDe(u, aujourdhui)
  const dec = etatDocument('decennale', documentsDe(u).decennale, aujourdhui)
  if (dec.etat === 'expire') return { label: 'décennale expirée', ton: 'alerte' }
  if (o.essai && o.joursEssai !== null && o.joursEssai >= 0) return { label: `essai J-${o.joursEssai}`, ton: 'neutre' }
  return { label: 'actif', ton: 'ok' }
}

export type LigneVerification = { userId: string; nom: string; doc: string; docLabel: string; constat: string; etat: string; ordre: number }

// File des vérifications (PRO-24.2) : documents reçus à valider, expirés,
// qui expirent sous 30 jours, refusés à redemander.
export function fileVerifications(liste: Utilisateur[], aujourdhui = new Date().toISOString().slice(0, 10)): LigneVerification[] {
  const ordre: Record<string, number> = { expire: 0, a_valider: 1, refuse: 2, bientot: 3, ancien: 4 }
  const out: LigneVerification[] = []
  for (const u of liste.filter(estEntreprise)) {
    const docs = documentsDe(u)
    for (const cle of Object.keys(DOCUMENTS)) {
      const e = etatDocument(cle, docs[cle], aujourdhui)
      if (!(e.etat in ordre)) continue
      out.push({ userId: u.id, nom: nomEntreprise(u), doc: cle, docLabel: DOCUMENTS[cle], constat: e.label, etat: e.etat, ordre: ordre[e.etat] })
    }
  }
  return out.sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr'))
}

export const ETATS_VERIF: Record<string, string> = { expire: 'Bloquant', a_valider: 'À valider', refuse: 'À redemander', bientot: 'Expire sous 30 j', ancien: 'À demander' }

// Chiffres du tableau de bord (PRO-24.1) sur 30 jours, avec la période
// précédente pour la comparaison.
export function surTrenteJours<T>(liste: T[], date: (x: T) => string | null | undefined, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const debut = plus(aujourdhui, -29)
  const avant = plus(aujourdhui, -59)
  const n = liste.filter((x) => j10(date(x)) >= debut).length
  const p = liste.filter((x) => { const d = j10(date(x)); return d >= avant && d < debut }).length
  return { n, evolution: p ? Math.round(((n - p) / p) * 100) : null }
}

export function joursSemaine(aujourdhui = new Date().toISOString().slice(0, 10)) {
  const d = new Date(`${aujourdhui}T12:00:00Z`)
  const lundi = plus(aujourdhui, -((d.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => plus(lundi, i))
}
