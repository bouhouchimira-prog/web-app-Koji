import { annuaire, etatWeb } from '@/lib/bo/donnees'
import { ETATS_DEMANDE, SEUIL_SANS_REPONSE_H, etatDemande, libelleDemande, positionsActives, prixRecommande, rdvConfirmes, rdvProposes, type Ligne } from '@/lib/bo/client'
import { dateCourte, euros, ilYa30Jours, nomCourt, pourcent } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import RelanceDemande from '@/components/bo/RelanceDemande'
import { exigerBackOffice } from '@/lib/require-admin'

// Demandes des particuliers (maquette PRO-24.13) : publiées, sans réponse,
// rendez-vous, retirées ; relance des entreprises de la zone pour une
// demande restée sans réponse. Le prix recommandé est affiché, jamais
// modifié depuis le back-office.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function Demandes() {
  await exigerBackOffice()
  const [db, { qui }] = await Promise.all([etatWeb(), annuaire()])
  const offres = (db.chantierOffres || []) as Ligne[]
  const positions = (db.chantierPositionnements || []) as Ligne[]
  const messages = (db.chantierOffreMessages || []) as Ligne[]
  const depuis = ilYa30Jours()
  const lignesBrutes = offres.map((o) => {
    const id = s(o.id)
    const e = etatDemande(o, positions, messages)
    const nbPos = positionsActives(id, positions).length
    const publiee = s(o.publishedAt || o.createdAt)
    return { o, id, e, nbPos, publiee, rdv: rdvConfirmes(id, messages).length, visite: rdvProposes(id, messages).length }
  }).sort((a, b) => b.publiee.localeCompare(a.publiee))
  const recents = lignesBrutes.filter((l) => l.publiee >= depuis)
  const sansReponse = lignesBrutes.filter((l) => l.e.etat === 'sans_reponse')
  const zones = [...new Set(sansReponse.map((l) => s(l.o.postalCode).slice(0, 2)).filter(Boolean))].sort()
  const rdv = recents.filter((l) => l.rdv > 0).length
  const retirees = recents.filter((l) => l.e.etat === 'retiree').length

  const lignes: LigneListe[] = lignesBrutes.map(({ o, id, e, nbPos, publiee, rdv: r, visite }) => {
    const u = qui(s(o.userId))
    const nom = nomCourt(s(u?.nom || o.clientName), s(u?.email || o.clientEmail))
    const prix = prixRecommande(o)
    const suivi = e.etat === 'retiree' ? 'retirée par le particulier'
      : `${nbPos} position${nbPos > 1 ? 's' : ''}${r ? ' · rendez-vous confirmé' : visite ? ' · visite proposée' : e.etat === 'sans_reponse' ? ` · ${e.heures} h sans réponse` : ''}`
    return {
      id,
      cellules: [
        { b: libelleDemande(o), small: s(o.description).slice(0, 80) },
        `${nom}${o.city ? ` · ${s(o.city)}` : ''}`,
        prix ? euros(prix) : '—',
        suivi,
        dateCourte(publiee),
        { tag: ETATS_DEMANDE[e.etat], ton: e.etat === 'sans_reponse' ? 'plein' : e.etat === 'pourvue' ? '' : 'gris' }
      ],
      filtres: [e.etat],
      recherche: `${nom} ${s(o.city)} ${s(o.postalCode)} ${s(o.metier)} ${s(o.description)}`,
      lien: u ? { href: `/dashboard/particuliers/${s(o.userId)}`, label: 'Ouvrir' } : undefined
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> Demandes · {recents.length} publiée{recents.length > 1 ? 's' : ''} sur 30 j</span><h1>Demandes</h1></div>
      </div>
      <div className="bo-kpis quatre">
        <div><span>Publiées · 30 j</span><b>{recents.length}</b></div>
        <div><span>Sans réponse {SEUIL_SANS_REPONSE_H} h</span><b>{sansReponse.length}</b><small>{zones.length ? `zone${zones.length > 1 ? 's' : ''} ${zones.join(', ')}` : 'aucune zone'}</small></div>
        <div><span>Rendez-vous confirmés</span><b>{rdv}</b><small>{pourcent(rdv, recents.length)}</small></div>
        <div><span>Retirées</span><b>{retirees}</b><small>{pourcent(retirees, recents.length)}</small></div>
      </div>
      <Liste
        colonnes={['Demande', 'Particulier', 'Prix recommandé', 'Positions', 'Publiée', 'État']}
        lignes={lignes}
        placeholder="Particulier, ville, métier…"
        filtres={[{ id: 'toutes', label: 'Toutes' }, { id: 'sans_reponse', label: `Sans réponse ${SEUIL_SANS_REPONSE_H} h`, compte: true }, { id: 'en_cours', label: 'En cours' }, { id: 'pourvue', label: 'Pourvues' }, { id: 'retiree', label: 'Retirées' }]}
        vide="Aucune demande."
      />
      <div className="bo-card">
        <h2>Sans réponse depuis {SEUIL_SANS_REPONSE_H} h</h2>
        {sansReponse.length ? sansReponse.map(({ o, id, e }) => (
          <div key={id} className="bo-alerte">
            <div><b>{libelleDemande(o)}{o.city ? ` · ${s(o.city)}` : ''}</b><small>{e.heures} h sans réponse</small></div>
            <RelanceDemande offreId={id} />
          </div>
        )) : <p className="bo-note">Aucune demande n&apos;attend depuis plus de {SEUIL_SANS_REPONSE_H} h.</p>}
        <p className="bo-note">Relancer : message de service aux entreprises dont la zone couvre le chantier (rayon déclaré, {15} km par défaut), métier correspondant, sauf celles qui ont coupé l&apos;e-mail « nouveau chantier dans votre zone ». Prévenir : « nous cherchons encore » au particulier, avec la proposition d&apos;élargir la zone.</p>
      </div>
    </div>
  )
}
