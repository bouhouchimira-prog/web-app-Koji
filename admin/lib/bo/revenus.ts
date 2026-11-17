import { hasStripe, getStripe } from '@/lib/stripe'
import { etatWeb } from './donnees'

// Revenus du mois (maquette PRO-24.11) : abonnements (factures Stripe
// payées), jetons du Radar (achats crédités par le webhook de koji-web,
// db.jetonsAchats), remboursements et impayés (Stripe). Lecture seule.
// Les montants HT des jetons sont déduits du TTC (TVA 20 %).
export type Mouvement = { quand: string; type: 'abonnement' | 'jetons' | 'remboursement'; reference: string; client: string; ht: number; ttc: number }

const TVA = 0.2
const tz = 'Europe/Paris'
export const jourParis = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
export const moisParis = (iso = new Date().toISOString()) => jourParis(iso).slice(0, 7)

function bornes(mois: string) {
  const [a, m] = mois.split('-').map(Number)
  // Marge d'un jour de chaque côté, puis filtre exact sur le jour de Paris.
  return { gte: Math.floor(Date.UTC(a, m - 1, 1) / 1000) - 86400, lt: Math.floor(Date.UTC(a, m, 1) / 1000) + 86400 }
}

export async function revenusDuMois(mois: string) {
  const { gte, lt } = bornes(mois)
  const dans = (iso: string) => iso && jourParis(iso).startsWith(mois)
  const mouvements: Mouvement[] = []
  let abonnes: number | null = null
  let essais: number | null = null
  let impayes: { montant: number; nombre: number } | null = null
  // Chaque lecture Stripe est indépendante : une clé restreinte peut lire
  // les abonnements sans lire les factures ni les remboursements.
  const refuses: string[] = []

  if (hasStripe) {
    const stripe = getStripe()
    const [factures, remboursements, ouvertes, actifs, enEssai] = await Promise.allSettled([
      stripe.invoices.list({ status: 'paid', created: { gte, lt }, limit: 100 }).autoPagingToArray({ limit: 2000 }),
      stripe.refunds.list({ created: { gte, lt }, limit: 100 }).autoPagingToArray({ limit: 2000 }),
      stripe.invoices.list({ status: 'open', limit: 100 }).autoPagingToArray({ limit: 2000 }),
      stripe.subscriptions.list({ status: 'active', limit: 100 }).autoPagingToArray({ limit: 5000 }),
      stripe.subscriptions.list({ status: 'trialing', limit: 100 }).autoPagingToArray({ limit: 5000 })
    ])
    if (factures.status === 'fulfilled') {
      for (const f of factures.value) {
        const quand = new Date(((f.status_transitions?.paid_at || f.created) as number) * 1000).toISOString()
        if (!dans(quand) || !f.amount_paid) continue
        mouvements.push({ quand, type: 'abonnement', reference: f.number || f.id, client: f.customer_email || '', ht: (f.total_excluding_tax ?? f.subtotal) / 100, ttc: f.amount_paid / 100 })
      }
    } else refuses.push('factures (Invoices : lecture)')
    if (remboursements.status === 'fulfilled') {
      for (const r of remboursements.value) {
        const quand = new Date(r.created * 1000).toISOString()
        if (!dans(quand) || r.status === 'failed' || r.status === 'canceled') continue
        mouvements.push({ quand, type: 'remboursement', reference: r.id, client: '', ht: -(r.amount / 100) / (1 + TVA), ttc: -(r.amount / 100) })
      }
    } else refuses.push('remboursements (Charges and Refunds : lecture)')
    if (ouvertes.status === 'fulfilled') {
      const enRetard = ouvertes.value.filter((f) => f.attempt_count > 0)
      impayes = { montant: enRetard.reduce((t, f) => t + f.amount_remaining, 0) / 100, nombre: enRetard.length }
    } else if (!refuses.some((r) => r.startsWith('factures'))) refuses.push('factures (Invoices : lecture)')
    if (actifs.status === 'fulfilled') abonnes = actifs.value.length
    else refuses.push('abonnements (Subscriptions : lecture)')
    if (enEssai.status === 'fulfilled') essais = enEssai.value.length
  }
  const facturesLues = hasStripe && !refuses.some((r) => r.startsWith('factures'))

  const db = await etatWeb()
  for (const a of (db.jetonsAchats || []) as Record<string, unknown>[]) {
    const quand = String(a.le || '')
    if (!dans(quand)) continue
    const ttc = Number(a.montantTtc) || 0
    mouvements.push({ quand, type: 'jetons', reference: String(a.sessionId || a.id || ''), client: String(a.userId || ''), ht: ttc / (1 + TVA), ttc })
  }
  const jetonsVendus = ((db.jetonsAchats || []) as Record<string, unknown>[]).filter((a) => dans(String(a.le || ''))).reduce((t, a) => t + (Number(a.quantite) || 0), 0)

  mouvements.sort((a, b) => b.quand.localeCompare(a.quand))
  const somme = (type: Mouvement['type']) => mouvements.filter((m) => m.type === type).reduce((t, m) => t + m.ht, 0)
  return { stripe: hasStripe, refuses, facturesLues, mouvements, abonnes, essais, impayes, jetonsVendus, totaux: { abonnements: somme('abonnement'), jetons: somme('jetons'), remboursements: somme('remboursement') } }
}

export function parJour(mouvements: Mouvement[]) {
  const jours = new Map<string, { abonnements: number; jetons: number; remboursements: number }>()
  for (const m of mouvements) {
    const j = jourParis(m.quand)
    const t = jours.get(j) || { abonnements: 0, jetons: 0, remboursements: 0 }
    if (m.type === 'abonnement') t.abonnements += m.ht
    else if (m.type === 'jetons') t.jetons += m.ht
    else t.remboursements += m.ht
    jours.set(j, t)
  }
  return [...jours.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([jour, t]) => ({ jour, ...t, total: t.abonnements + t.jetons + t.remboursements }))
}
