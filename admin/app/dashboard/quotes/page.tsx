import { devisListe, utilisateurs } from '@/lib/bo/donnees'
import { nomEntreprise } from '@/lib/bo/regles'
import { ETATS_DEVIS, infosDevis } from '@/lib/bo/client'
import { dateCourte, euros, ilYa30Jours, pourcent } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'

// Devis passés par la plateforme (maquette PRO-24.4), lecture seule :
// volumes sur 30 jours, taux de signature, montant moyen signé, part du
// Radar. Les brouillons ne sont pas des devis passés par la plateforme et
// ne sont pas listés. Koji ne modifie jamais un devis.
export const dynamic = 'force-dynamic'

export default async function Devis() {
  await exigerBackOffice()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const [tous, comptes] = await Promise.all([devisListe(), utilisateurs()])
  const parId = new Map(comptes.map((u) => [u.id, u]))
  const passes = tous.map((d) => ({ d, i: infosDevis(d, aujourdhui) })).filter((x) => x.i.etat !== 'brouillon')
  const depuis = ilYa30Jours().slice(0, 10)
  const recents = passes.filter((x) => (x.i.envoyeLe || x.i.signeLe || x.i.date).slice(0, 10) >= depuis)
  const signes = recents.filter((x) => x.i.etat === 'signe')
  const moyenne = signes.length ? signes.reduce((t, x) => t + x.i.ttc, 0) / signes.length : 0
  const viaRadar = signes.filter((x) => x.i.radar).length

  const lignes: LigneListe[] = passes.map(({ d, i }) => {
    const u = parId.get(d.user_id)
    const entreprise = u ? nomEntreprise(u) : '—'
    const quand = i.etat === 'signe' ? `signé le ${dateCourte(i.signeLe)}` : i.etat === 'attente' ? (i.joursRestants !== null && i.joursRestants <= 7 ? `expire dans ${i.joursRestants} j` : `envoyé le ${dateCourte(i.envoyeLe || i.date)}`) : i.etat === 'expire' ? `expiré le ${dateCourte(i.finValidite)}` : dateCourte(i.date)
    const tag = i.etat === 'attente' && i.joursRestants !== null && i.joursRestants <= 7 ? 'Expire' : ETATS_DEVIS[i.etat]
    return {
      id: d.id,
      cellules: [`${i.numero}${i.version && i.version !== '001' ? ` v${Number(i.version)}` : ''}`, entreprise, i.client, euros(i.ttc, 2), quand, { tag, ton: i.etat === 'signe' ? 'plein' : i.etat === 'attente' ? '' : 'gris' }],
      filtres: [i.etat, i.radar ? 'radar' : ''].filter(Boolean),
      recherche: `${i.numero} ${entreprise} ${i.client}`,
      lien: { href: `/dashboard/quotes/${d.id}`, label: 'Ouvrir' }
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> Devis · 30 derniers jours</span><h1>Devis</h1></div>
      </div>
      <div className="bo-kpis quatre">
        <div><span>Envoyés</span><b>{recents.length}</b></div>
        <div><span>Signés</span><b>{signes.length}</b><small>{pourcent(signes.length, recents.length)}</small></div>
        <div><span>Montant moyen signé</span><b>{signes.length ? euros(moyenne) : '—'}</b><small>TTC</small></div>
        <div><span>Via le Radar</span><b>{signes.length ? pourcent(viaRadar, signes.length) : '—'}</b><small>des signés</small></div>
      </div>
      <Liste
        colonnes={['Devis', 'Entreprise', 'Client', 'TTC', 'Date', 'État']}
        lignes={lignes}
        placeholder="Numéro, entreprise, client…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'signe', label: 'Signés' }, { id: 'attente', label: 'En attente' }, { id: 'expire', label: 'Expirés' }, { id: 'radar', label: 'Radar' }]}
        vide="Aucun devis envoyé."
      />
      <p className="bo-note">Lecture seule : Koji ne modifie jamais un devis. Le contenu détaillé n&apos;est ouvert qu&apos;en support, avec trace (RGPD, minimisation).</p>
    </div>
  )
}
