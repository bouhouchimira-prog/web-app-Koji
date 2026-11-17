import { hasStripe, getStripe, PRO_PRICE_IDS, BUSINESS_PRICE_IDS } from '@/lib/stripe'
import { BAREME_JETONS, OFFRES_KOJI } from '@/lib/bo/tarifs'
import { euros } from '@/lib/bo/format'

// Prix et offres (maquette PRO-24.10) : les trois offres, leurs prix (lus
// dans Stripe, mêmes ids que koji-web), ce qu'elles incluent, le barème
// des jetons du Radar. Lecture seule : un prix Stripe ne se modifie pas,
// une hausse se publie en créant un nouveau prix (préavis aux abonnés),
// ce qui n'est pas encore proposé ici.
export const dynamic = 'force-dynamic'

type Prix = { mois: number | null; an: number | null }

async function prixStripe(ids: { month: string; year: string }): Promise<Prix> {
  if (!hasStripe) return { mois: null, an: null }
  const stripe = getStripe()
  const [m, a] = await Promise.all([
    ids.month ? stripe.prices.retrieve(ids.month).catch(() => null) : Promise.resolve(null),
    ids.year ? stripe.prices.retrieve(ids.year).catch(() => null) : Promise.resolve(null)
  ])
  return { mois: m?.unit_amount != null ? m.unit_amount / 100 : null, an: a?.unit_amount != null ? a.unit_amount / 100 : null }
}

export default async function PrixEtOffres() {
  const [pro, business] = await Promise.all([prixStripe(PRO_PRICE_IDS), prixStripe(BUSINESS_PRICE_IDS)])
  const prix: Record<string, Prix> = { start: { mois: 0, an: 0 }, pro, business }
  const montant = (n: number | null, periode: string) => (n == null ? '—' : n === 0 ? '0 €' : `${euros(n, n % 1 ? 2 : 0)} HT / ${periode}`)

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> Prix et offres</span><h1>Prix et offres</h1></div>
      </div>
      {!hasStripe ? <p className="bo-ok">Stripe n&apos;est pas configuré ici : les prix Pro et Business ne peuvent pas être lus.</p> : null}
      <table className="bo-table">
        <thead><tr><th>Offre</th><th>Mensuel</th><th>Annuel</th><th>Jetons</th><th>Comptes</th><th>État</th></tr></thead>
        <tbody>
          {OFFRES_KOJI.map((o) => {
            const p = prix[o.plan]
            const lu = o.plan === 'start' || p.mois != null
            return (
              <tr key={o.plan}>
                <td><b>{o.label}</b><small>{o.inclus}</small></td>
                <td>{montant(p.mois, 'mois')}</td>
                <td>{montant(p.an, 'an')}</td>
                <td>{o.jetonsInclus} inclus / mois<small>puis {o.prixJetonHt} € HT le jeton · {o.positions} positions simultanées</small></td>
                <td>{o.comptes} compte{o.comptes > 1 ? 's' : ''}</td>
                <td><span className={`bo-tag ${lu ? '' : 'gris'}`}>{lu ? 'Actif' : 'Prix non lu'}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="bo-g2">
        <div className="bo-card">
          <h2>Barème des jetons</h2>
          <p className="bo-note">Prix d&apos;un chantier du Radar, d&apos;après le budget estimé par Koji (TTC).</p>
          {BAREME_JETONS.map((b) => <div key={b.tranche} className="bo-kv"><span>{b.tranche}</span><b>{b.jetons} jeton{b.jetons > 1 ? 's' : ''}</b></div>)}
        </div>
        <div className="bo-card">
          <h2>Règles</h2>
          <div className="bo-kv"><span>Changement de prix</span><b>nouveau prix Stripe · préavis aux abonnés · date d&apos;effet</b></div>
          <div className="bo-kv"><span>Codes et remises</span><b>programme pionniers · à définir</b></div>
          <div className="bo-kv"><span>Historique</span><b>dans Stripe (prix datés, jamais modifiés)</b></div>
          <p className="bo-note">Les prix se lisent dans Stripe (mêmes identifiants que le site). Les jetons inclus, le prix du jeton et les positions viennent des règles de koji-web.</p>
        </div>
      </div>
    </div>
  )
}
