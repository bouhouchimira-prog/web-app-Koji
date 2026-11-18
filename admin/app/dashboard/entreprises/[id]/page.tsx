import Link from 'next/link'
import { notFound } from 'next/navigation'
import { devis as lireDevis, estSigneDevis, etatWeb, utilisateur } from '@/lib/bo/donnees'
import { DOCUMENTS, documentsDe, estEntreprise, etatDocument, nomEntreprise, offreDe, separer } from '@/lib/bo/regles'
import ActionDocument from '@/components/bo/ActionDocument'
import { exigerBackOffice } from '@/lib/require-admin'

// Fiche entreprise (maquette PRO-24, gabarit fiche) : en-tête avec
// actions, colonne compte / vérifications / activité, colonne journal /
// support. « Se connecter en tant que » n'est pas proposé (action à tracer
// et à encadrer avant de l'ouvrir).
export const dynamic = 'force-dynamic'

type Ligne = Record<string, unknown>
const s = (v: unknown) => String(v ?? '')
const masque = (v: string, garder = 3) => (v.length > garder ? `${v.slice(0, 1)}${'•'.repeat(Math.max(0, v.length - garder - 1))}${v.slice(-garder)}` : v)
const date = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Paris' }).format(new Date(iso)) : '')
const dateHeure = (iso: string) => (iso ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso)) : '')

export default async function FicheEntreprise({ params }: { params: Promise<{ id: string }> }) {
  await exigerBackOffice()
  const { id } = await params
  const u = await utilisateur(id)
  if (!u || !estEntreprise(u)) notFound()
  const [ses, db] = await Promise.all([lireDevis(id), etatWeb()])
  const { business, extras } = separer(u)
  const o = offreDe(u)
  const docs = documentsDe(u)
  const positions = ((db.chantierPositionnements || []) as Ligne[]).filter((p) => s(p.entrepriseUserId) === id)
  const rdv = ((db.chantierOffreMessages || []) as Ligne[]).filter((m) => s(m.entrepriseUserId) === id && s(m.rdvStatus) === 'accepted').length
  const jetons = ((db.jetonsAchats || []) as Ligne[]).filter((a) => s(a.userId) === id && !a.offert).reduce((t, a) => t + (Number(a.quantite) || 0), 0)
  const avis = ((db.avis || []) as Ligne[]).filter((a) => s(a.userId) === id && a.verifie)
  const moyenneAvis = avis.length ? avis.reduce((t, a) => t + (Number(a.note) || 0), 0) / avis.length : 0
  const journal = ((db.history || []) as Ligne[]).filter((h) => s(h.userId) === id).sort((a, b) => s(b.createdAt).localeCompare(s(a.createdAt))).slice(0, 10)
  const support = ((db.technicalReports || []) as Ligne[]).filter((r) => s(r.userId) === id).sort((a, b) => s(b.createdAt).localeCompare(s(a.createdAt))).slice(0, 5)
  const nom = nomEntreprise(u)
  const metiers = Array.isArray(extras._professions) ? (extras._professions as string[]).join(', ') : s(u.profession)
  const decAValider = docs.decennale && etatDocument('decennale', docs.decennale).etat === 'a_valider'

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> <Link href="/dashboard/entreprises">Entreprises</Link> › {nom}</span><h1>{nom}</h1></div>
        <div className="bo-acts">
          {u.email ? <a className="bo-btn" href={`mailto:${u.email}`}>Écrire</a> : null}
          {decAValider ? <Link className="bo-btn main" href="/dashboard/entreprises/verifications">Valider la décennale</Link> : null}
        </div>
      </div>
      <div className="bo-g2 fiche">
        <div className="bo">
          <div className="bo-card">
            <h2>Compte</h2>
            <div className="bo-kv"><span>SIRET</span><b>{business.siret ? masque(s(business.siret)) : '—'}</b></div>
            <div className="bo-kv"><span>Offre</span><b>{o.label}{o.essai && o.joursEssai !== null ? ` · ${o.joursEssai >= 0 ? `J-${o.joursEssai}` : 'essai terminé'}` : ''}</b></div>
            <div className="bo-kv"><span>Inscrite</span><b>{date(s(u.created_at))}</b></div>
            <div className="bo-kv"><span>Dirigeant</span><b>{u.full_name || '—'}{u.phone ? ` · ${masque(s(u.phone), 2)}` : ''}</b></div>
            <div className="bo-kv"><span>Métiers</span><b>{metiers || '—'}</b></div>
            <div className="bo-kv"><span>Ville</span><b>{s(business.city || business.ville) || '—'}</b></div>
          </div>
          <div className="bo-card">
            <h2>Vérifications</h2>
            {Object.entries(DOCUMENTS).map(([cle, label]) => {
              const e = etatDocument(cle, docs[cle])
              return (
                <div key={cle} className="bo-alerte">
                  <div><b>{label}</b><small>{e.label}</small></div>
                  {['a_valider', 'expire', 'bientot'].includes(e.etat) && docs[cle]?.fileDataUrl ? <ActionDocument userId={id} doc={cle} avecDate={cle === 'decennale' || cle === 'urssaf'} finActuelle={s(docs[cle]?.expiryDate)} /> : <span className={`bo-tag ${e.etat === 'ok' ? '' : e.bloquant ? 'plein' : 'gris'}`}>{e.etat === 'ok' ? 'OK' : e.etat === 'manquant' ? 'manquant' : e.label}</span>}
                </div>
              )
            })}
          </div>
          <div className="bo-card">
            <h2>Activité</h2>
            <div className="bo-kv"><span>Devis</span><b>{ses.length} · {ses.filter(estSigneDevis).length} signé{ses.filter(estSigneDevis).length > 1 ? 's' : ''}</b></div>
            <div className="bo-kv"><span>Radar</span><b>{positions.length} position{positions.length > 1 ? 's' : ''} · {rdv} rendez-vous</b></div>
            <div className="bo-kv"><span>Jetons achetés</span><b>{jetons}</b></div>
            <div className="bo-kv"><span>Avis</span><b>{avis.length}{avis.length ? ` · ${moyenneAvis.toFixed(1).replace('.', ',')} étoiles` : ''}</b></div>
          </div>
        </div>
        <div className="bo">
          <div className="bo-card">
            <h2>Journal</h2>
            <div className="bo-journal">{journal.length ? journal.map((h) => <div key={s(h.id)}><time>{dateHeure(s(h.createdAt))}</time><span>{s(h.label)}</span></div>) : <p className="bo-note">Aucune action enregistrée.</p>}</div>
          </div>
          <div className="bo-card">
            <h2>Support</h2>
            {support.length ? support.map((r) => (
              <div key={s(r.id)} className="bo-alerte">
                <div><b>« {s(r.message).slice(0, 90)}{s(r.message).length > 90 ? '…' : ''} »</b><small>{date(s(r.createdAt))} · {s(r.status || 'ouvert')}</small></div>
                {u.email ? <a className="bo-btn" href={`mailto:${u.email}?subject=${encodeURIComponent('Votre demande au support Koji')}`}>Répondre</a> : null}
              </div>
            )) : <p className="bo-note">Aucune demande de support.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
