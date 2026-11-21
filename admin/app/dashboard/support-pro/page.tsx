import { etatWeb, utilisateurs } from '@/lib/bo/donnees'
import { nomEntreprise } from '@/lib/bo/regles'
import { estParticulierRapport, type Ligne } from '@/lib/bo/client'
import { categoriePro, estResolu } from '@/lib/bo/support'
import { dateHeure } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'
import { estModeration } from '@/lib/bo/moderation'

// Support Pro (maquette PRO-24.8) : file des demandes d'aide des
// entreprises (signalements envoyés depuis Koji Pro), séparée du support
// Client. Une demande s'ouvre avec son contexte (compte, offre, documents,
// page) ; réponse par e-mail avec un modèle.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function SupportPro() {
  await exigerBackOffice()
  const [db, comptes] = await Promise.all([etatWeb(), utilisateurs()])
  const parId = new Map(comptes.map((u) => [u.id, u]))
  const demandes = ((db.technicalReports || []) as Ligne[]).filter((r) => !estParticulierRapport(r) && !estModeration(r)).sort((a, b) => s(b.createdAt).localeCompare(s(a.createdAt)))
  const ouverts = demandes.filter((r) => !estResolu(s(r.status)))

  const lignes: LigneListe[] = demandes.map((r) => {
    const u = parId.get(s(r.userId))
    const compte = u ? nomEntreprise(u) : s(r.reporterCompany || r.reporterName) || 'Compte'
    const { categorie, urgent } = categoriePro(r)
    const fini = estResolu(s(r.status))
    const etat = fini ? 'Résolu' : urgent ? 'Urgent' : 'Ouvert'
    const msg = s(r.message)
    return {
      id: s(r.id),
      cellules: [{ b: compte }, `« ${msg.length > 70 ? `${msg.slice(0, 69)}…` : msg} »`, `${categorie}${r.page ? ` · ${s(r.page)}` : ''}`, dateHeure(s(r.createdAt)), { tag: etat, ton: etat === 'Urgent' ? 'plein' : etat === 'Résolu' ? 'gris' : '' }],
      filtres: [fini ? 'resolus' : 'ouverts', !fini && urgent ? 'urgents' : ''].filter(Boolean),
      recherche: `${compte} ${msg} ${categorie} ${s(r.page)} ${s(r.reporterEmail)}`,
      lien: { href: `/dashboard/support-pro/${encodeURIComponent(s(r.id))}`, label: 'Répondre' }
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> Support Pro · {ouverts.length} ouvert{ouverts.length > 1 ? 's' : ''}</span><h1>Support Pro</h1></div>
      </div>
      <Liste
        colonnes={['Compte', 'Sujet', 'Catégorie', 'Depuis', 'État']}
        lignes={lignes}
        placeholder="Entreprise, sujet…"
        filtres={[{ id: 'ouverts', label: 'Ouverts', compte: true }, { id: 'urgents', label: 'Urgents', compte: true }, { id: 'resolus', label: 'Résolus' }, { id: 'tous', label: 'Tous' }]}
        initial="ouverts"
        vide="Aucune demande."
      />
      <p className="bo-note">File distincte du support Client. Les demandes arrivent depuis « Signaler un problème » de Koji Pro ; la réponse part par e-mail.</p>
    </div>
  )
}
