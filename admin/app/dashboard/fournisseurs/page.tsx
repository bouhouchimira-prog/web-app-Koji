import Link from 'next/link'
import { etatWeb } from '@/lib/bo/donnees'
import type { Ligne } from '@/lib/bo/client'
import { ETATS_PARTENAIRE, GERER_PARTENAIRES, etatPartenaire } from '@/lib/bo/partenaires'
import { dateCourte, euros } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'

// Fournisseurs partenaires (maquette PRO-24.5) : catalogue, état,
// commandes reçues par bons envoyés depuis Koji (PRO-07.6). Prix publics
// et prix Koji seulement : les prix négociés des entreprises restent
// privés. Ajout, import du catalogue et publication : back-office de
// koji-web.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function Fournisseurs() {
  const db = await etatWeb()
  const partenaires = (db.partenaires || []) as Ligne[]
  const bons = ((db.bonsCommande || []) as Ligne[]).filter((b) => b.partenaireId && b.envoyeLe)

  const lignes: LigneListe[] = partenaires.map((p) => {
    const e = etatPartenaire(p)
    const articles = Array.isArray(p.articles) ? p.articles.length : 0
    const commandes = bons.filter((b) => s(b.partenaireId) === s(p.id))
    const montant = commandes.reduce((t, b) => t + ((Array.isArray(b.lignes) ? b.lignes : []) as Ligne[]).reduce((u, l) => u + (Number(l.quantite) || 0) * (Number(l.prixHt) || 0), 0), 0)
    return {
      id: s(p.id),
      cellules: [
        { b: s(p.nom), small: [s(p.zone), s(p.email)].filter(Boolean).join(' · ') },
        s(p.metiers) || '—',
        articles ? `catalogue ${new Intl.NumberFormat('fr-FR').format(articles)} réf. · fichier${p.validite ? ` · prix valables jusqu'au ${dateCourte(`${s(p.validite)}T12:00:00Z`)}` : ''}` : 'aucun catalogue importé',
        `${commandes.length} commande${commandes.length > 1 ? 's' : ''}${commandes.length ? ` · ${euros(montant)} HT` : ''}`,
        p.misAJour ? dateCourte(`${s(p.misAJour)}T12:00:00Z`) : '—',
        { tag: ETATS_PARTENAIRE[e], ton: e === 'actif' ? '' : e === 'perime' ? 'plein' : 'gris' }
      ],
      filtres: [e],
      recherche: `${s(p.nom)} ${s(p.metiers)} ${s(p.zone)}`,
      lien: { href: GERER_PARTENAIRES, label: 'Gérer' }
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Partenaires</span> Fournisseurs partenaires · {partenaires.length}</span><h1>Fournisseurs</h1></div>
        <div className="bo-acts">
          <Link className="bo-btn" href="/dashboard/fournisseurs-entreprises">Fournisseurs des entreprises</Link>
          <a className="bo-btn main" href={GERER_PARTENAIRES}>Ajouter un fournisseur</a>
        </div>
      </div>
      <Liste
        colonnes={['Fournisseur', 'Famille', 'Catalogue', 'Commandes reçues', 'Mise à jour', 'État']}
        lignes={lignes}
        placeholder="Fournisseur…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'actif', label: 'Actifs' }, { id: 'perime', label: 'Prix à mettre à jour', compte: true }, { id: 'brouillon', label: 'Non publiés' }]}
        vide="Aucun fournisseur partenaire pour l'instant."
      />
      <div className="bo-card">
        <h2>Un partenaire fournisseur</h2>
        <div className="bo-kv"><span>Catalogue</span><b>fichier importé (mercuriale) ; prix publics et prix Koji, jamais les prix négociés des entreprises</b></div>
        <div className="bo-kv"><span>Commandes reçues</span><b>bons envoyés depuis Koji (PRO-07.6)</b></div>
        <div className="bo-kv"><span>Compte partenaire</span><b>pas encore d&apos;accès pour le fournisseur lui-même</b></div>
        <p className="bo-note">Ajout, import du fichier et publication se font dans le back-office du site (getkoji.io/admin/partenaires).</p>
      </div>
    </div>
  )
}
