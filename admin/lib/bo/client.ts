// Back-office Koji, côté Client et devis (maquettes PRO-24.3, 24.4, 24.7,
// 24.12, 24.13) : règles pures, sans accès aux données. Les demandes, les
// positions et les messages viennent de la base JSON de koji-web
// (chantierOffres, chantierPositionnements, chantierOffreMessages).

export type Ligne = Record<string, unknown>
const s = (v: unknown) => String(v ?? '')
const HEURE = 3600000

// Demandes (Radar côté Client)
export type EtatDemande = 'pourvue' | 'en_cours' | 'sans_reponse' | 'retiree'
export const ETATS_DEMANDE: Record<EtatDemande, string> = { pourvue: 'Pourvue', en_cours: 'En cours', sans_reponse: 'Sans réponse', retiree: 'Retirée' }
export const SEUIL_SANS_REPONSE_H = 48

export function positionsActives(offreId: string, positions: Ligne[]) {
  return positions.filter((p) => s(p.offerId) === offreId && s(p.status) === 'Active')
}

// Un rendez-vous confirmé : réponse « accepted » à une proposition de visite.
export function rdvConfirmes(offreId: string, messages: Ligne[]) {
  return messages.filter((m) => s(m.offerId) === offreId && s(m.rdvStatus) === 'accepted')
}

export function rdvProposes(offreId: string, messages: Ligne[]) {
  return messages.filter((m) => s(m.offerId) === offreId && s(m.kind) === 'rdv_proposal')
}

export function etatDemande(offre: Ligne, positions: Ligne[], messages: Ligne[], maintenant = Date.now()): { etat: EtatDemande; heures: number } {
  const id = s(offre.id)
  const publiee = Date.parse(s(offre.publishedAt || offre.createdAt)) || maintenant
  const heures = Math.floor((maintenant - publiee) / HEURE)
  if (/retir/i.test(s(offre.status))) return { etat: 'retiree', heures }
  if (rdvConfirmes(id, messages).length) return { etat: 'pourvue', heures }
  if (!positionsActives(id, positions).length && heures >= SEUIL_SANS_REPONSE_H) return { etat: 'sans_reponse', heures }
  return { etat: 'en_cours', heures }
}

export function libelleDemande(offre: Ligne) {
  const metier = s(offre.metier)
  const desc = s(offre.description).split(/[.\n]/)[0].trim()
  const titre = metier ? metier.charAt(0).toUpperCase() + metier.slice(1) : desc || 'Demande'
  return titre.length > 70 ? `${titre.slice(0, 69)}…` : titre
}

export function prixRecommande(offre: Ligne) {
  const min = Number(offre.priceRangeMin) || 0
  const max = Number(offre.priceRangeMax) || 0
  if (min && max) return Math.round((min + max) / 2)
  return min || max || Number(offre.budget) || 0
}

// Relance d'une demande sans réponse : entreprises dont la zone couvre le
// chantier (rayon déclaré, 15 km par défaut), métier correspondant, et qui
// n'ont pas coupé l'e-mail « Un nouveau chantier dans votre zone ».
export const RAYON_DEFAUT_KM = 15

export function distanceKm(a: [number, number], b: [number, number]) {
  const r = Math.PI / 180
  const dLat = (b[0] - a[0]) * r
  const dLon = (b[1] - a[1]) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(x))
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function entreprisesDeLaZone(offre: Ligne, comptes: { id: string; email: string | null; business_info?: Record<string, unknown> | null }[], prefs: Record<string, unknown> = {}) {
  const lat = Number(offre.lat)
  const lon = Number(offre.lon)
  const metier = normal(s(offre.metier))
  return comptes.filter((u) => {
    const b = u.business_info || {}
    if (!u.email || b._accountType === 'particulier') return false
    const zLat = Number(b.zoneLat)
    const zLon = Number(b.zoneLon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(zLat) || !Number.isFinite(zLon) || (!zLat && !zLon)) return false
    if (distanceKm([lat, lon], [zLat, zLon]) > (Number(b.zoneRadiusKm) || RAYON_DEFAUT_KM)) return false
    const metiers = Array.isArray(b._professions) ? (b._professions as unknown[]).map((m) => normal(s(m))) : []
    if (metier && metiers.length && !metiers.some((m) => m.includes(metier) || metier.includes(m))) return false
    const p = (prefs[u.id] as { notifications?: { evenements?: { chantier_zone?: { email?: boolean } } } } | undefined)?.notifications?.evenements?.chantier_zone?.email
    return p !== false
  })
}

// Conversations client ↔ entreprise : un fil = une demande × une entreprise.
// Le contenu ne s'ouvre que sur motif (mot-clé détecté) ; le reste est en
// métadonnées. Les signalements par l'utilisateur n'existent pas encore
// dans Koji Client.
export const MOTS_CLES: { motif: string; re: RegExp }[] = [
  { motif: 'propos de paiement hors Koji détectés (mot-clé)', re: /\b(virement|en esp[eè]ces|en liquide|cash|\brib\b|iban|paypal|lydia|western union|sans facture|au noir|de la main [àa] la main)\b/i },
  { motif: 'propos interdits détectés (mot-clé)', re: /\b(connard|connasse|salope|encul[ée]|pute|nique|fdp|ta gueule|batard|bâtard)\b/i }
]

export function motifMotCle(textes: string[]) {
  for (const { motif, re } of MOTS_CLES) if (textes.some((t) => re.test(t))) return motif
  return ''
}

export type Fil = { id: string; offreId: string; entrepriseUserId: string; particulierUserId: string; nb: number; dernier: string; dernierPar: string; motif: string; sansReponseH: number }

export const cleFil = (offreId: string, entrepriseUserId: string) => `${offreId}~${entrepriseUserId}`

export function fils(messages: Ligne[], maintenant = Date.now()): Fil[] {
  const groupes = new Map<string, Ligne[]>()
  for (const m of messages) {
    const cle = cleFil(s(m.offerId), s(m.entrepriseUserId))
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle)!.push(m)
  }
  return [...groupes.entries()].map(([id, liste]) => {
    const tri = [...liste].sort((a, b) => s(a.createdAt).localeCompare(s(b.createdAt)))
    const der = tri[tri.length - 1]
    const attente = Math.floor((maintenant - (Date.parse(s(der.createdAt)) || maintenant)) / HEURE)
    return {
      id, offreId: s(der.offerId), entrepriseUserId: s(der.entrepriseUserId), particulierUserId: s(tri.find((m) => m.particulierUserId)?.particulierUserId),
      nb: tri.length, dernier: s(der.createdAt), dernierPar: s(der.senderType), motif: motifMotCle(tri.map((m) => s(m.message))), sansReponseH: attente
    }
  }).sort((a, b) => b.dernier.localeCompare(a.dernier))
}

// Devis passés par la plateforme (table quotes de koji-web), lecture seule.
export type DevisLigne = { id: string; user_id: string; status: string | null; created_at: string | null; signed_at: string | null; total_ttc: number | null; reference: string | null; metadata?: Ligne | null; web_extras?: Ligne | null }
export type EtatDevis = 'signe' | 'expire' | 'attente' | 'brouillon' | 'refuse' | 'annule'
export const ETATS_DEVIS: Record<EtatDevis, string> = { signe: 'Signé', expire: 'Expiré', attente: 'Envoyé', brouillon: 'Brouillon', refuse: 'Refusé', annule: 'Annulé' }

// Dates de devis : ISO (2026-11-03…) ou française (03/11/2026).
export function jour(v: string) {
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(v)
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : ''
}
const plusJours = (j: string, n: number) => (j ? new Date(Date.parse(`${j}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10) : '')

export function infosDevis(d: DevisLigne, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const meta = (d.metadata || {}) as Ligne
  const extras = (d.web_extras || {}) as Ligne
  const client = (meta.client || {}) as Ligne
  const statut = s(d.status).toLowerCase()
  const signeLe = s(d.signed_at || extras.signedAt)
  const envoyeLe = s(extras.sentAt)
  const date = jour(s(meta.date)) || jour(s(d.created_at))
  const finValidite = plusJours(jour(envoyeLe || date) || aujourdhui, Number(meta.validity) || 30)
  let etat: EtatDevis = 'brouillon'
  if (signeLe || ['signe', 'signé', 'signed', 'accepte'].includes(statut)) etat = 'signe'
  else if (statut.startsWith('refus') || s(extras.refusedAt)) etat = 'refuse'
  else if (statut.startsWith('annul') || s(extras.cancelledAt)) etat = 'annule'
  else if (['envoye', 'envoyé', 'sent'].includes(statut) || envoyeLe) etat = finValidite < aujourdhui ? 'expire' : 'attente'
  const joursRestants = etat === 'attente' ? Math.round((Date.parse(finValidite) - Date.parse(aujourdhui)) / 86400000) : null
  return {
    etat, signeLe, envoyeLe, date, finValidite, joursRestants,
    numero: s(d.reference || meta.quoteNumber) || '—',
    version: s(extras.versionNumber),
    client: s(client.name) || [s(extras.clientFirstName), s(extras.clientLastName)].filter(Boolean).join(' ') || s(extras.clientCompanyName) || '—',
    ttc: Number(d.total_ttc) || 0,
    radar: Boolean(extras.chantierOffreId)
  }
}

// Support Client : catégorie et urgence d'un message de particulier.
export const CATEGORIES_SUPPORT: { cat: string; re: RegExp; urgent?: boolean }[] = [
  { cat: 'connexion', re: /\b(code|connexion|connecter|mot de passe|identifiant|sms)\b/i, urgent: true },
  { cat: 'données', re: /\b(supprim|effac|donn[ée]es|rgpd|compte)/i },
  { cat: 'paiements', re: /\b(paiement|pay[ée]|acompte|re[çc]u|rembours|carte|factur)/i },
  { cat: 'rétractation', re: /\b(r[ée]tract|annul)/i },
  { cat: 'suivi de demande', re: /\b(entreprise|artisan|r[ée]pond|devis|rendez-vous|visite|demande)/i }
]

export function categorieSupport(message: string) {
  const c = CATEGORIES_SUPPORT.find((x) => x.re.test(message))
  return { categorie: c?.cat || 'autre', urgent: Boolean(c?.urgent) }
}

export const estParticulierRapport = (r: Ligne) => ['particulier', 'portal', 'client'].includes(s(r.accountType || r.sessionKind).toLowerCase())

export function mediane(valeurs: number[]) {
  if (!valeurs.length) return null
  const t = [...valeurs].sort((a, b) => a - b)
  const m = Math.floor(t.length / 2)
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2
}
