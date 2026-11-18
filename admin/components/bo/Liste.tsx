'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'

// Gabarit liste du back-office (maquette PRO-24) : recherche, onglets de
// filtre, tableau, pagination par 25. Les filtres sont des étiquettes
// posées par le serveur sur chaque ligne (aucune fonction ne traverse la
// frontière serveur / client).
export type Cellule = string | { b: string; small?: string } | { tag: string; ton?: string }
export type LigneListe = { id: string; cellules: Cellule[]; filtres: string[]; recherche: string; lien?: { href: string; label: string } }
export type Filtre = { id: string; label: string; compte?: boolean }

const PAR_PAGE = 25
const TOUS = ['tous', 'toutes']

function rendu(c: Cellule) {
  if (typeof c === 'string') return c || '—'
  if ('tag' in c) return <span className={`bo-tag ${c.ton || ''}`}>{c.tag}</span>
  return <><b>{c.b}</b>{c.small ? <small>{c.small}</small> : null}</>
}

export default function Liste({ colonnes, lignes, filtres, placeholder, vide = 'Aucun résultat.', initial }: { colonnes: string[]; lignes: LigneListe[]; filtres: Filtre[]; placeholder: string; vide?: ReactNode; initial?: string }) {
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState(initial || filtres[0]?.id || '')
  const [page, setPage] = useState(0)
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase()
    return lignes.filter((l) => (TOUS.includes(filtre) || l.filtres.includes(filtre)) && (!t || l.recherche.toLowerCase().includes(t)))
  }, [lignes, q, filtre])
  const debut = page * PAR_PAGE
  return (
    <>
      <div className="bo-filtres">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} placeholder={placeholder} aria-label="Rechercher" />
        <div className="bo-tabs">
          {filtres.map((f) => (
            <button key={f.id} type="button" className={filtre === f.id ? 'on' : ''} onClick={() => { setFiltre(f.id); setPage(0) }}>
              {f.label}{f.compte ? <span>{lignes.filter((l) => l.filtres.includes(f.id)).length}</span> : null}
            </button>
          ))}
        </div>
      </div>
      <table className="bo-table">
        <thead><tr>{colonnes.map((c) => <th key={c}>{c}</th>)}<th /></tr></thead>
        <tbody>
          {visibles.slice(debut, debut + PAR_PAGE).map((l) => (
            <tr key={l.id}>
              {l.cellules.map((c, i) => <td key={i}>{rendu(c)}</td>)}
              {/* Pas de préchargement : ouvrir une fiche inscrit une ligne au journal des accès. */}
              <td>{l.lien ? <Link href={l.lien.href} prefetch={false}>{l.lien.label}</Link> : null}</td>
            </tr>
          ))}
          {!visibles.length ? <tr><td colSpan={colonnes.length + 1}>{vide}</td></tr> : null}
        </tbody>
      </table>
      <div className="bo-pages">
        <span>{visibles.length ? `${debut + 1} – ${Math.min(debut + PAR_PAGE, visibles.length)} sur ${visibles.length}` : ''}</span>
        <span className="bo-acts">
          {page > 0 ? <button type="button" className="bo-btn" onClick={() => setPage(page - 1)}>Précédent</button> : null}
          {debut + PAR_PAGE < visibles.length ? <button type="button" className="bo-btn" onClick={() => setPage(page + 1)}>Suivant</button> : null}
        </span>
      </div>
    </>
  )
}
