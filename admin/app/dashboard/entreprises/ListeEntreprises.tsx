'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

export type LigneEntreprise = { id: string; nom: string; siret: string; ville: string; email: string; offre: string; offreLabel: string; activite: string; etat: string; ton: string; aVerifier: boolean }

const PAR_PAGE = 25
const FILTRES: [string, string, (l: LigneEntreprise) => boolean][] = [
  ['toutes', 'Toutes', () => true],
  ['start', 'Start', (l) => l.offre === 'start'],
  ['pro', 'Pro', (l) => l.offre === 'pro'],
  ['business', 'Business', (l) => l.offre === 'business'],
  ['trial', 'En essai', (l) => l.offre === 'trial'],
  ['verifier', 'À vérifier', (l) => l.aVerifier]
]
const quand = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso)) : '—')

export default function ListeEntreprises({ lignes }: { lignes: LigneEntreprise[] }) {
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('toutes')
  const [page, setPage] = useState(0)
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    const f = FILTRES.find((x) => x[0] === filtre)![2]
    return lignes.filter((l) => f(l) && (!t || `${l.nom} ${l.siret} ${l.ville} ${l.email}`.toLowerCase().includes(t))).sort((a, b) => b.activite.localeCompare(a.activite))
  }, [lignes, q, filtre])
  const debut = page * PAR_PAGE
  function exporter() {
    const lignesCsv = [['Entreprise', 'SIRET', 'Offre', 'Ville', 'Dernière activité', 'État'], ...visibles.map((l) => [l.nom, l.siret, l.offreLabel, l.ville, l.activite.slice(0, 10), l.etat])]
    const csv = '﻿' + lignesCsv.map((r) => r.map((x) => (/[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `entreprises-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }
  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> {lignes.length} compte{lignes.length > 1 ? 's' : ''}</span><h1>Entreprises</h1></div>
        <div className="bo-acts"><Link className="bo-btn" href="/dashboard/entreprises/verifications">Vérifications</Link><button type="button" className="bo-btn" onClick={exporter}>Export</button></div>
      </div>
      <div className="bo-filtres">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder="Nom, SIREN, ville…" aria-label="Rechercher une entreprise" />
        <div className="bo-tabs">{FILTRES.map(([id, label, f]) => <button key={id} type="button" className={filtre === id ? 'on' : ''} onClick={() => { setFiltre(id); setPage(0) }}>{label}{id === 'verifier' ? <span>{lignes.filter(f).length}</span> : null}</button>)}</div>
      </div>
      <table className="bo-table">
        <thead><tr><th>Entreprise</th><th>Offre</th><th>Ville</th><th>Dernière activité</th><th>État</th><th /></tr></thead>
        <tbody>
          {visibles.slice(debut, debut + PAR_PAGE).map((l) => (
            <tr key={l.id}>
              <td><b>{l.nom}</b><small>{l.email}</small></td>
              <td>{l.offreLabel}</td>
              <td>{l.ville || '—'}</td>
              <td>{quand(l.activite)}</td>
              <td><span className={`bo-tag ${l.ton === 'alerte' ? 'plein' : l.ton === 'ok' ? '' : 'gris'}`}>{l.etat}</span></td>
              <td><Link href={`/dashboard/entreprises/${l.id}`}>Ouvrir</Link></td>
            </tr>
          ))}
          {!visibles.length ? <tr><td colSpan={6}>Aucune entreprise.</td></tr> : null}
        </tbody>
      </table>
      <div className="bo-pages">
        <span>{visibles.length ? `${debut + 1} – ${Math.min(debut + PAR_PAGE, visibles.length)} sur ${visibles.length}` : ''}</span>
        <span className="bo-acts">
          {page > 0 ? <button type="button" className="bo-btn" onClick={() => setPage(page - 1)}>Précédent</button> : null}
          {debut + PAR_PAGE < visibles.length ? <button type="button" className="bo-btn" onClick={() => setPage(page + 1)}>Suivant</button> : null}
        </span>
      </div>
    </div>
  )
}
