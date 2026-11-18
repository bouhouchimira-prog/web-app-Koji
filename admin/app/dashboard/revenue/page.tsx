import Link from 'next/link'
import { moisParis, parJour, revenusDuMois } from '@/lib/bo/revenus'
import { dateCourte, euros } from '@/lib/bo/format'
import { exigerBackOffice } from '@/lib/require-admin'

// Revenus (maquette PRO-24.11) : abonnements, jetons, remboursements,
// impayés du mois, par jour ; export comptable. Sources : Stripe (lecture
// seule) et les achats de jetons crédités par koji-web.
export const dynamic = 'force-dynamic'

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const decaler = (mois: string, n: number) => { const [a, m] = mois.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

export default async function Revenus({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await exigerBackOffice()
  const demande = (await searchParams).mois || ''
  const courant = moisParis()
  const mois = /^\d{4}-\d{2}$/.test(demande) && demande <= courant ? demande : courant
  const r = await revenusDuMois(mois)
  const jours = parJour(r.mouvements)
  const total = r.totaux.abonnements + r.totaux.jetons + r.totaux.remboursements
  const [a, m] = mois.split('-').map(Number)
  const e = (n: number) => euros(n, 2)

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> Revenus · {MOIS[m - 1]} {a}</span><h1>Revenus</h1></div>
        <div className="bo-acts">
          <Link className="bo-btn" href={`/dashboard/revenue?mois=${decaler(mois, -1)}`}>Mois précédent</Link>
          {mois < courant ? <Link className="bo-btn" href={`/dashboard/revenue?mois=${decaler(mois, 1)}`}>Mois suivant</Link> : null}
          <a className="bo-btn main" href={`/api/admin/revenus/export?mois=${mois}`}>Export comptable</a>
        </div>
      </div>
      {!r.stripe ? <p className="bo-ok">Stripe n&apos;est pas configuré ici : seuls les achats de jetons sont comptés.</p> : null}
      {r.refuses.length ? <p className="bo-ok">La clé Stripe du back-office ne peut pas lire : {r.refuses.join(', ')}. Ajouter ces droits de lecture à la clé restreinte dans Stripe (Développeurs, Clés API), puis recharger. Les montants concernés restent vides en attendant.</p> : null}
      <div className="bo-kpis quatre">
        <div><span>Abonnements</span><b>{r.facturesLues ? e(r.totaux.abonnements) : '—'}</b><small>{r.abonnes ?? '—'} abonné{(r.abonnes || 0) > 1 ? 's' : ''}{r.essais ? ` · ${r.essais} en essai` : ''}</small></div>
        <div><span>Jetons</span><b>{e(r.totaux.jetons)}</b><small>{r.jetonsVendus} vendu{r.jetonsVendus > 1 ? 's' : ''}</small></div>
        <div><span>Total HT</span><b>{e(total)}</b><small>remboursements {e(r.totaux.remboursements)}</small></div>
        <div><span>Impayés</span><b>{r.impayes ? e(r.impayes.montant) : '—'}</b><small>prélèvements refusés : {r.impayes ? r.impayes.nombre : '—'}</small></div>
      </div>
      <table className="bo-table">
        <thead><tr><th>Jour</th><th>Abonnements</th><th>Jetons</th><th>Remboursements</th><th>Total HT</th></tr></thead>
        <tbody>
          {jours.map((j) => <tr key={j.jour}><td>{dateCourte(`${j.jour}T12:00:00Z`)}</td><td>{e(j.abonnements)}</td><td>{e(j.jetons)}</td><td>{e(j.remboursements)}</td><td><b>{e(j.total)}</b></td></tr>)}
          {!jours.length ? <tr><td colSpan={5}>Aucun mouvement ce mois-ci.</td></tr> : null}
        </tbody>
      </table>
      <p className="bo-note">Montants HT. Abonnements : factures Stripe payées ; jetons : achats crédités sur le Radar (HT déduit du TTC à 20 %) ; impayés : factures ouvertes après au moins un prélèvement refusé. L&apos;export comptable liste chaque mouvement du mois.</p>
    </div>
  )
}
