// Formats communs du back-office (heure de Paris, euros, masquage).
const tz = 'Europe/Paris'
export const date = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }).format(new Date(iso)) : '')
export const dateCourte = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(iso)) : '')
export const dateHeure = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso)) : '')
export const euros = (n: number, decimales = 0) => `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n)} €`
export const pourcent = (n: number, d: number) => (d ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format((n / d) * 100)} %` : '—')
export const masque = (v: string, garder = 3) => (v.length > garder ? `${v.slice(0, 1)}${'•'.repeat(Math.max(0, v.length - garder - 1))}${v.slice(-garder)}` : v)

// Nom réduit d'un particulier (minimisation) : « Marie L. ».
export function nomCourt(nom: string, email = '') {
  const parties = nom.trim().split(/\s+/).filter(Boolean)
  if (!parties.length) return email ? `${email.split('@')[0].slice(0, 12)}…` : 'Particulier'
  return parties.length > 1 ? `${parties[0]} ${parties[parties.length - 1].charAt(0).toUpperCase()}.` : parties[0]
}

export const ilYa30Jours = (maintenant = Date.now()) => new Date(maintenant - 30 * 86400000).toISOString()
