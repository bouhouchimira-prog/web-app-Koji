import Link from 'next/link'
import { annuaire, etatWeb } from '@/lib/bo/donnees'
import { SEUIL_SANS_REPONSE_H, fils, libelleDemande, type Ligne } from '@/lib/bo/client'
import { dateCourte, nomCourt } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'

// Conversations client ↔ entreprise (maquette PRO-24.7) : suivi et
// modération. Le contenu ne s'ouvre que sur motif (mot-clé détecté) ; le
// reste est en métadonnées (qui, quand, combien).
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function Conversations() {
  await exigerBackOffice()
  const [db, { qui }] = await Promise.all([etatWeb(), annuaire()])
  const offres = new Map(((db.chantierOffres || []) as Ligne[]).map((o) => [s(o.id), o]))
  const liste = fils((db.chantierOffreMessages || []) as Ligne[])

  const lignes: LigneListe[] = liste.map((f) => {
    const offre = offres.get(f.offreId)
    const p = qui(f.particulierUserId || s(offre?.userId))
    const particulier = nomCourt(s(p?.nom || offre?.clientName), s(p?.email))
    const entreprise = qui(f.entrepriseUserId)?.nom || 'Entreprise'
    const sansReponse = f.sansReponseH >= SEUIL_SANS_REPONSE_H
    return {
      id: f.id,
      cellules: [
        { b: `${particulier} ↔ ${entreprise}` },
        `${offre ? libelleDemande(offre).toLowerCase() : 'demande'} · ${f.nb} message${f.nb > 1 ? 's' : ''}`,
        f.motif || (sansReponse ? `${f.sansReponseH} h sans réponse ${f.dernierPar === 'entreprise' ? 'du particulier' : 'de l\'entreprise'}` : '—'),
        dateCourte(f.dernier),
        { tag: f.motif ? 'À lire' : 'RAS', ton: f.motif ? 'plein' : 'gris' }
      ],
      filtres: [f.motif ? 'mots_cles' : '', sansReponse ? 'sans_reponse' : ''].filter(Boolean),
      recherche: `${particulier} ${entreprise} ${offre ? libelleDemande(offre) : ''} ${s(offre?.city)}`,
      lien: { href: `/dashboard/conversations/${encodeURIComponent(f.id)}`, label: f.motif ? 'Lire' : 'Voir' }
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> Conversations client ↔ entreprise · suivi et modération</span><h1>Conversations client ↔ entreprise</h1></div>
        <div className="bo-acts"><Link className="bo-btn" href="/dashboard/conversations-ia">Discussions avec l&apos;assistant</Link></div>
      </div>
      <Liste
        colonnes={['Conversation', 'Contexte', 'Motif', 'Date', 'État']}
        lignes={lignes}
        placeholder="Particulier, entreprise, chantier…"
        filtres={[{ id: 'mots_cles', label: 'Mots-clés', compte: true }, { id: 'sans_reponse', label: `Sans réponse ${SEUIL_SANS_REPONSE_H} h`, compte: true }, { id: 'toutes', label: 'Toutes (métadonnées)' }]}
        initial="toutes"
        vide="Aucune conversation."
      />
      <p className="bo-note">Le contenu d&apos;un fil ne s&apos;ouvre que sur motif (mot-clé de paiement hors Koji ou de propos interdits) ; chaque lecture est tracée (qui, quand, motif). Les autres fils restent en métadonnées.</p>
    </div>
  )
}
