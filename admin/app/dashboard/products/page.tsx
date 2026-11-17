import Link from 'next/link'
import { etatWeb } from '@/lib/bo/donnees'
import type { Ligne } from '@/lib/bo/client'
import { ETATS_PRODUIT, GERER_PARTENAIRES, catalogue } from '@/lib/bo/partenaires'
import { euros } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'

// Produits (maquette PRO-24.6) : catalogue consolidé des fournisseurs
// partenaires (mercuriales importées), avec les états publié, prix à
// vérifier, sans fournisseur actif, doublon. Les prix négociés des
// entreprises ne passent jamais ici. Import : back-office de koji-web.
export const dynamic = 'force-dynamic'

export default async function Produits() {
  const db = await etatWeb()
  const produits = catalogue((db.partenaires || []) as Ligne[])
  const lignes: LigneListe[] = produits.map((p) => ({
    id: p.id,
    cellules: [{ b: p.designation || '—' }, p.ref, p.partenaire, p.prixPublic ? `${euros(p.prixPublic, 2)} HT / ${p.unite}` : '—', p.famille || '—', { tag: ETATS_PRODUIT[p.etat], ton: p.etat === 'publie' ? '' : p.etat === 'a_verifier' ? 'plein' : 'gris' }],
    filtres: [p.etat],
    recherche: `${p.designation} ${p.ref} ${p.partenaire} ${p.famille}`
  }))

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Partenaires</span> Produits · {new Intl.NumberFormat('fr-FR').format(produits.length)} référence{produits.length > 1 ? 's' : ''}</span><h1>Produits</h1></div>
        <div className="bo-acts">
          <Link className="bo-btn" href="/dashboard/produits-app">Catalogue de l&apos;app</Link>
          <a className="bo-btn main" href={GERER_PARTENAIRES}>Importer un fichier</a>
        </div>
      </div>
      <Liste
        colonnes={['Produit', 'Référence', 'Fournisseur', 'Prix public', 'Famille', 'État']}
        lignes={lignes}
        placeholder="Référence, désignation…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'publie', label: 'Publiés' }, { id: 'a_verifier', label: 'À vérifier', compte: true }, { id: 'sans_fournisseur', label: 'Sans fournisseur' }, { id: 'doublon', label: 'Doublons', compte: true }]}
        vide="Aucun produit : aucun catalogue de partenaire importé."
      />
      <p className="bo-note">Le catalogue vient des fichiers importés pour chaque partenaire (la famille reprend ses métiers). Prix à vérifier : date de validité dépassée ou prix public manquant. Les prix négociés des entreprises ne passent jamais ici.</p>
    </div>
  )
}
