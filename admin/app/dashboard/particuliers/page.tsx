import { etatWeb, particuliers as lireParticuliers } from '@/lib/bo/donnees'
import { SEUIL_SANS_REPONSE_H, etatDemande, libelleDemande, positionsActives, type Ligne } from '@/lib/bo/client'
import { dateCourte, nomCourt } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'

// Particuliers (maquette PRO-24.3, gabarit liste) : comptes du site et de
// l'app Koji, projet en cours, dernière activité, état ; filtres projet
// actif, sans réponse 48 h, demandes retirées. Nom réduit (accès au strict
// nécessaire).
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function Particuliers() {
  await exigerBackOffice()
  const [parts, db] = await Promise.all([lireParticuliers(), etatWeb()])
  const offres = (db.chantierOffres || []) as Ligne[]
  const positions = (db.chantierPositionnements || []) as Ligne[]
  const messages = (db.chantierOffreMessages || []) as Ligne[]

  const lignes: LigneListe[] = parts.map((p) => {
    const siennes = offres.filter((o) => s(o.userId) === p.id).sort((a, b) => s(b.publishedAt || b.createdAt).localeCompare(s(a.publishedAt || a.createdAt)))
    const etats = siennes.map((o) => ({ o, e: etatDemande(o, positions, messages) }))
    const actives = etats.filter((x) => x.e.etat !== 'retiree')
    const derniere = etats[0]
    let projet = 'aucune demande'
    if (derniere) {
      const n = positionsActives(s(derniere.o.id), positions).length
      projet = `${libelleDemande(derniere.o).toLowerCase()} · ${derniere.e.etat === 'retiree' ? 'demande retirée' : derniere.e.etat === 'pourvue' ? 'rendez-vous confirmé' : derniere.e.etat === 'sans_reponse' ? `${derniere.e.heures} h sans réponse` : `${n} proposition${n > 1 ? 's' : ''}`}`
      if (siennes.length > 1) projet += ` (+${siennes.length - 1})`
    }
    const activite = [p.majLe, p.derniereConnexion, ...siennes.map((o) => s(o.updatedAt || o.publishedAt)), ...messages.filter((m) => s(m.particulierUserId) === p.id && s(m.senderType) !== 'entreprise').map((m) => s(m.createdAt))].filter(Boolean).sort().at(-1) || p.creeLe
    const etat = !p.actif ? 'désactivé' : actives.length ? 'actif' : etats.length ? 'retiré' : 'inscrit'
    const ville = s(derniere?.o.city) || p.adresse.split(',').at(-1)?.trim() || ''
    const filtres = [actives.length ? 'actif' : '', etats.some((x) => x.e.etat === 'sans_reponse') ? 'sans_reponse' : '', etats.some((x) => x.e.etat === 'retiree') ? 'retiree' : ''].filter(Boolean)
    const nom = nomCourt(p.nom, p.email)
    return {
      id: p.id,
      cellules: [{ b: nom, small: p.source === 'app' ? 'app Koji' : 'site' }, ville || '—', projet, dateCourte(activite), { tag: etat, ton: etat === 'actif' ? '' : 'gris' }],
      filtres,
      recherche: `${p.nom} ${p.telephone} ${p.email} ${ville} ${projet}`,
      lien: { href: `/dashboard/particuliers/${p.id}`, label: 'Ouvrir' }
    }
  }).sort((a, b) => Number(b.filtres.includes('actif')) - Number(a.filtres.includes('actif')))

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> Particuliers · {parts.length} compte{parts.length > 1 ? 's' : ''}</span><h1>Particuliers</h1></div>
      </div>
      <Liste
        colonnes={['Particulier', 'Ville', 'Projet', 'Dernière activité', 'État']}
        lignes={lignes}
        placeholder="Nom, téléphone, ville…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'actif', label: 'Avec projet actif' }, { id: 'sans_reponse', label: `Sans réponse ${SEUIL_SANS_REPONSE_H} h`, compte: true }, { id: 'retiree', label: 'Demandes retirées' }]}
        vide="Aucun particulier."
      />
    </div>
  )
}
