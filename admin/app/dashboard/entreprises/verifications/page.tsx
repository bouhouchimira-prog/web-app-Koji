import Link from 'next/link'
import { utilisateurs } from '@/lib/bo/donnees'
import { documentsDe, ETATS_VERIF, fileVerifications } from '@/lib/bo/regles'
import ActionDocument from '@/components/bo/ActionDocument'
import { exigerBackOffice } from '@/lib/require-admin'

// File des vérifications (maquette PRO-24.2) : décennale, URSSAF, Kbis,
// RC pro ; à valider, bloquantes, qui expirent sous 30 jours.
export const dynamic = 'force-dynamic'

export default async function Verifications({ searchParams }: { searchParams: Promise<{ filtre?: string; q?: string }> }) {
  await exigerBackOffice()
  const { filtre = 'a_valider', q = '' } = await searchParams
  const comptes = await utilisateurs()
  const toutes = fileVerifications(comptes)
  const t = q.trim().toLowerCase()
  const FILTRES: [string, string, (e: string) => boolean][] = [
    ['a_valider', 'À valider', (e) => e === 'a_valider'],
    ['bloquantes', 'Bloquantes', (e) => e === 'expire'],
    ['bientot', 'Expirent sous 30 j', (e) => e === 'bientot'],
    ['toutes', 'Toutes', () => true]
  ]
  const f = FILTRES.find((x) => x[0] === filtre) || FILTRES[0]
  const lignes = toutes.filter((l) => f[2](l.etat) && (!t || l.nom.toLowerCase().includes(t)))
  const parId = new Map(comptes.map((u) => [u.id, u]))
  return (
    <div className="bo">
      <div className="bo-h"><div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> <Link href="/dashboard/entreprises">Entreprises</Link> › Vérifications</span><h1>Vérifications · {toutes.length}</h1></div></div>
      <form className="bo-filtres" action="/dashboard/entreprises/verifications">
        <input type="hidden" name="filtre" value={f[0]} />
        <input name="q" defaultValue={q} placeholder="Entreprise, SIREN…" aria-label="Rechercher une entreprise" />
        <div className="bo-tabs">{FILTRES.map(([id, label, test]) => <Link key={id} className={id === f[0] ? 'on' : ''} href={`/dashboard/entreprises/verifications?filtre=${id}${q ? `&q=${encodeURIComponent(q)}` : ''}`}>{label}<span>{toutes.filter((l) => test(l.etat)).length}</span></Link>)}</div>
      </form>
      <table className="bo-table">
        <thead><tr><th>Entreprise</th><th>Document</th><th>Constat</th><th>État</th><th /></tr></thead>
        <tbody>
          {lignes.length ? lignes.map((l) => {
            const d = documentsDe(parId.get(l.userId)!)[l.doc] || {}
            return (
              <tr key={`${l.userId}${l.doc}`}>
                <td><Link href={`/dashboard/entreprises/${l.userId}`}><b>{l.nom}</b></Link></td>
                <td>{l.docLabel}</td>
                <td>{l.constat}</td>
                <td><span className={`bo-tag ${l.etat === 'expire' ? 'plein' : ''}`}>{ETATS_VERIF[l.etat]}</span></td>
                <td><ActionDocument userId={l.userId} doc={l.doc} avecDate={l.doc === 'decennale' || l.doc === 'urssaf'} finActuelle={String(d.expiryDate || '')} /></td>
              </tr>
            )
          }) : <tr><td colSpan={5}>Aucun document dans cette file.</td></tr>}
        </tbody>
      </table>
      <p className="bo-note">Valider une attestation = date de fin saisie, document marqué vérifié ; refuser = motif obligatoire, message envoyé à l&apos;entreprise. Une décennale vérifiée par Koji n&apos;est pas une garantie donnée par Koji.</p>
    </div>
  )
}
