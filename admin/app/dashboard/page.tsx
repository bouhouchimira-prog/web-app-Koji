import Link from 'next/link'
import { devis as lireDevis, estSigneDevis, etatWeb, utilisateurs } from '@/lib/bo/donnees'
import { estEntreprise, fileVerifications, joursSemaine, offreDe, surTrenteJours } from '@/lib/bo/regles'

// Tableau de bord du back-office (maquette PRO-24.1) : les huit chiffres
// décidés le 4 nov., deux univers côte à côte (Koji Pro, Koji Client), les
// alertes à traiter et l'activité de la semaine. Agrégats seulement : aucun
// nom de particulier ici.
export const dynamic = 'force-dynamic'

type Ligne = Record<string, unknown>
const s = (v: unknown) => String(v ?? '')
const j10 = (v: unknown) => s(v).slice(0, 10)
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const evo = (e: number | null) => (e === null ? '' : `${e >= 0 ? '+' : ''}${e} %`)

export default async function TableauDeBord() {
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const [comptes, tousDevis, db] = await Promise.all([utilisateurs(), lireDevis(), etatWeb()])
  const entreprises = comptes.filter(estEntreprise)
  const particuliers = comptes.filter((u) => !estEntreprise(u))
  const il7 = new Date(Date.now() - 7 * 86400000).toISOString()
  const il30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const il48h = new Date(Date.now() - 48 * 3600000).toISOString()

  const inscritsPro = surTrenteJours(entreprises, (u) => u.created_at, aujourdhui)
  const actives30 = new Set(tousDevis.filter((d) => s(d.created_at) >= il30).map((d) => d.user_id))
  const actives7 = new Set(tousDevis.filter((d) => s(d.created_at) >= il7).map((d) => d.user_id))
  const signes30 = tousDevis.filter((d) => estSigneDevis(d) && s(d.signed_at || d.created_at) >= il30)
  const moyenne = signes30.length ? signes30.reduce((t, d) => t + (Number(d.total_ttc) || 0), 0) / signes30.length : 0
  const offres = entreprises.map((u) => offreDe(u, aujourdhui).plan)
  const abonnes = offres.filter((p) => ['start', 'pro', 'business'].includes(p))
  const jetons = ((db.jetonsAchats || []) as Ligne[]).filter((a) => s(a.le) >= il30).reduce((t, a) => t + (Number(a.quantite) || 0), 0)

  const demandes = (db.chantierOffres || []) as Ligne[]
  const positions = (db.chantierPositionnements || []) as Ligne[]
  const messages = (db.chantierOffreMessages || []) as Ligne[]
  const support = (db.technicalReports || []) as Ligne[]
  const inscritsCli = surTrenteJours(particuliers, (u) => u.created_at, aujourdhui)
  const publiees30 = demandes.filter((d) => s(d.publishedAt || d.createdAt) >= il30)
  const avecPhotos = publiees30.filter((d) => Array.isArray(d.photos) && (d.photos as unknown[]).length).length
  const rdv30 = messages.filter((m) => s(m.rdvStatus) === 'accepted' && s(m.createdAt) >= il30).length
  const posPar = new Map<string, number>()
  for (const p of positions) posPar.set(s(p.offerId), (posPar.get(s(p.offerId)) || 0) + 1)
  const sansReponse = demandes.filter((d) => s(d.status) === 'Publiee' && s(d.publishedAt || d.createdAt) < il48h && !posPar.get(s(d.id)))
  const zones = [...new Set(sansReponse.map((d) => s(d.postalCode).slice(0, 2)).filter(Boolean))].slice(0, 4)
  const moyennePos = demandes.length ? [...posPar.values()].reduce((a, b) => a + b, 0) / demandes.length : 0
  const supportOuvert = (type: 'pro' | 'client') => support.filter((r) => s(r.status || 'ouvert') !== 'resolu' && (type === 'client' ? s(r.accountType) === 'particulier' : s(r.accountType) !== 'particulier')).length
  const verifs = fileVerifications(entreprises, aujourdhui)
  const decExpirees = verifs.filter((v) => v.doc === 'decennale' && v.etat === 'expire').length
  const aValider = verifs.filter((v) => v.etat === 'a_valider').length

  const jours = joursSemaine(aujourdhui)
  const parJour = jours.map((j) => demandes.filter((d) => j10(d.publishedAt || d.createdAt) === j).length)
  const max = Math.max(1, ...parJour)
  const noms = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']
  const date = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date())

  return (
    <div className="bo">
      <div className="bo-h"><div><span className="bo-eyebrow">{date.charAt(0).toUpperCase() + date.slice(1)}</span><h1>Tableau de bord</h1></div></div>
      <div className="bo-g2">
        <section className="bo">
          <span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> entreprises</span>
          <div className="bo-kpis">
            <div><span>Inscriptions entreprises · 30 j</span><b>{inscritsPro.n}</b><small>{evo(inscritsPro.evolution)}</small></div>
            <div><span>Entreprises actives</span><b>{actives30.size}</b><small>{actives7.size} cette semaine</small></div>
            <div><span>Devis signés · 30 j</span><b>{signes30.length}</b><small>{signes30.length ? `${eur(moyenne)} TTC en moyenne` : ''}</small></div>
            <div><span>Abonnements</span><b>{abonnes.length}</b><small>Pro {offres.filter((p) => p === 'pro').length} · Business {offres.filter((p) => p === 'business').length} · Start {offres.filter((p) => p === 'start').length}</small></div>
            <div><span>Jetons vendus · 30 j</span><b>{jetons}</b><small>achats Stripe</small></div>
            <div><span>Revenus du mois</span><b>—</b><small>voir Revenus (Stripe)</small></div>
          </div>
          <div className="bo-card">
            <h2>À traiter · Pro</h2>
            <div className="bo-alerte"><div><b>{decExpirees} décennale{decExpirees > 1 ? 's' : ''} expirée{decExpirees > 1 ? 's' : ''}</b><small>{aValider} document{aValider > 1 ? 's' : ''} reçu{aValider > 1 ? 's' : ''} à valider</small></div><Link className="bo-tag plein" href="/dashboard/entreprises/verifications">{decExpirees ? 'Bloquant' : 'Voir'}</Link></div>
            <div className="bo-alerte"><div><b>{supportOuvert('pro')} demande{supportOuvert('pro') > 1 ? 's' : ''} de support ouverte{supportOuvert('pro') > 1 ? 's' : ''}</b><small>entreprises</small></div><span className="bo-tag">À lire</span></div>
          </div>
        </section>
        <section className="bo">
          <span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> particuliers</span>
          <div className="bo-kpis">
            <div><span>Inscriptions particuliers · 30 j</span><b>{inscritsCli.n}</b><small>{evo(inscritsCli.evolution)}</small></div>
            <div><span>Demandes publiées · 30 j</span><b>{publiees30.length}</b><small>{publiees30.length ? `${Math.round((avecPhotos / publiees30.length) * 100)} % avec photos` : ''}</small></div>
            <div><span>Rendez-vous confirmés · 30 j</span><b>{rdv30}</b><small>{publiees30.length ? `${Math.round((rdv30 / publiees30.length) * 100)} % des demandes` : ''}</small></div>
            <div><span>Sans réponse depuis 48 h</span><b>{sansReponse.length}</b><small>{zones.length ? `zones ${zones.join(', ')}` : ''}</small></div>
            <div><span>Propositions par demande</span><b>{moyennePos.toFixed(1).replace('.', ',')}</b><small>sur 3 au plus</small></div>
            <div><span>Signalements ouverts</span><b>—</b><small>signalement pas encore disponible</small></div>
          </div>
          <div className="bo-card">
            <h2>À traiter · Client</h2>
            <div className="bo-alerte"><div><b>{sansReponse.length} demande{sansReponse.length > 1 ? 's' : ''} sans réponse depuis 48 h</b><small>aucune entreprise positionnée</small></div><span className="bo-tag">Échéance</span></div>
            <div className="bo-alerte"><div><b>{supportOuvert('client')} demande{supportOuvert('client') > 1 ? 's' : ''} de support ouverte{supportOuvert('client') > 1 ? 's' : ''}</b><small>particuliers</small></div><span className="bo-tag">À lire</span></div>
          </div>
        </section>
      </div>
      <div className="bo-card">
        <h2>Activité de la semaine</h2>
        <div className="bo-barres">{parJour.map((n, i) => <div key={jours[i]}><b>{n || ''}</b><i style={{ height: `${(n / max) * 100}%` }} /><span>{noms[i]}</span></div>)}</div>
        <p className="bo-note">Demandes publiées par jour (Koji Client).</p>
      </div>
    </div>
  )
}
