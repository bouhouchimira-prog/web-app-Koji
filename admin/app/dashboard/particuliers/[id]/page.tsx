import Link from 'next/link'
import { notFound } from 'next/navigation'
import { devisListe, etatWeb, particuliers, utilisateurs } from '@/lib/bo/donnees'
import { nomEntreprise } from '@/lib/bo/regles'
import { ETATS_DEMANDE, etatDemande, infosDevis, libelleDemande, positionsActives, prixRecommande, type Ligne } from '@/lib/bo/client'
import { date, dateHeure, euros, masque, nomCourt } from '@/lib/bo/format'
import { exigerBackOffice } from '@/lib/require-admin'

// Fiche d'un particulier (maquette PRO-24.3) : coordonnées masquées,
// projets et leur état, entreprise en contact, données (export,
// suppression), journal reconstitué depuis les demandes, positions,
// rendez-vous et devis signés.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')
const JOURS_SUPPRESSION = 30

export default async function FicheParticulier({ params }: { params: Promise<{ id: string }> }) {
  await exigerBackOffice()
  const { id } = await params
  const [db, comptes, tousDevis] = await Promise.all([etatWeb(), utilisateurs(), devisListe()])
  const u = (await particuliers(comptes)).find((p) => p.id === id)
  if (!u) notFound()
  const offres = ((db.chantierOffres || []) as Ligne[]).filter((o) => s(o.userId) === id).sort((a, b) => s(b.publishedAt || b.createdAt).localeCompare(s(a.publishedAt || a.createdAt)))
  const ids = new Set(offres.map((o) => s(o.id)))
  const positions = (db.chantierPositionnements || []) as Ligne[]
  const messages = (db.chantierOffreMessages || []) as Ligne[]
  const nomDe = (uid: string, snap?: unknown) => s((snap as Ligne | undefined)?.name || (snap as Ligne | undefined)?.raisonSociale) || (comptes.find((c) => c.id === uid) ? nomEntreprise(comptes.find((c) => c.id === uid)!) : 'Entreprise')
  const rdvs = messages.filter((m) => ids.has(s(m.offerId)) && s(m.rdvStatus) === 'accepted')
  const enContact = [...new Set([...rdvs.map((m) => s(m.entrepriseUserId))])]
  const devisSignes = tousDevis.filter((d) => ids.has(s(d.web_extras?.chantierOffreId)) && infosDevis(d).etat === 'signe')
  const suppression = ((db.accountDeletionRequests || []) as Ligne[]).find((r) => s(r.userId) === id)
  const nom = nomCourt(u.nom, u.email)

  const journal = [
    ...offres.map((o) => ({ quand: s(o.publishedAt || o.createdAt), texte: `demande publiée · ${libelleDemande(o).toLowerCase()}${prixRecommande(o) ? ` · prix recommandé ${euros(prixRecommande(o))}` : ''}` })),
    ...positions.filter((p) => ids.has(s(p.offerId))).map((p) => ({ quand: s(p.createdAt), texte: `proposition · ${nomDe(s(p.entrepriseUserId), p.entrepriseSnapshot)}${s(p.status) === 'Retiree' ? ' (retirée)' : ''}` })),
    ...rdvs.map((m) => ({ quand: s(m.createdAt), texte: `rendez-vous confirmé · ${nomDe(s(m.entrepriseUserId), m.entrepriseSnapshot)}` })),
    ...devisSignes.map((d) => { const i = infosDevis(d); return { quand: i.signeLe, texte: `devis ${i.numero} signé` } }),
    ...(suppression ? [{ quand: s(suppression.createdAt), texte: 'suppression du compte demandée' }] : [])
  ].filter((e) => e.quand).sort((a, b) => b.quand.localeCompare(a.quand)).slice(0, 15)

  const premiere = offres.at(-1)
  const depuisDemande = premiere && u.creeLe && Math.abs(Date.parse(s(premiere.createdAt)) - Date.parse(u.creeLe)) < 3600000
  const limite = suppression ? new Date(Date.parse(s(suppression.createdAt)) + JOURS_SUPPRESSION * 86400000).toISOString() : ''

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> <Link href="/dashboard/particuliers">Particuliers</Link> › {nom}</span><h1>{nom}</h1></div>
        <div className="bo-acts">{u.email ? <a className="bo-btn" href={`mailto:${u.email}`}>Écrire</a> : null}</div>
      </div>
      <div className="bo-g2 fiche">
        <div className="bo">
          <div className="bo-card">
            <h2>{u.nom || nom}</h2>
            <div className="bo-kv"><span>Téléphone</span><b>{u.telephone ? masque(u.telephone.replace(/\s/g, ''), 4) : '—'}</b></div>
            <div className="bo-kv"><span>E-mail</span><b>{u.email ? `${masque(u.email.split('@')[0], 2)}@${u.email.split('@')[1]}` : '—'}{u.email ? (u.emailVerifie ? ' · vérifié' : ' · non vérifié') : ''}</b></div>
            <div className="bo-kv"><span>Inscrit le</span><b>{date(u.creeLe)}{depuisDemande ? ' · depuis la demande' : ''} · {u.source === 'app' ? 'app Koji' : 'site'}{u.actif ? '' : ' · désactivé'}</b></div>
            <div className="bo-kv"><span>Projets</span><b>{offres.length ? offres.map((o) => `${libelleDemande(o).toLowerCase()} (${ETATS_DEMANDE[etatDemande(o, positions, messages).etat].toLowerCase()}, ${positionsActives(s(o.id), positions).length} proposition${positionsActives(s(o.id), positions).length > 1 ? 's' : ''})`).join(' · ') : 'aucun'}</b></div>
            <div className="bo-kv"><span>Entreprise en contact</span><b>{enContact.length ? enContact.map((eid) => { const m = rdvs.filter((x) => s(x.entrepriseUserId) === eid).at(-1)!; return `${nomDe(eid, m.entrepriseSnapshot)} · rendez-vous confirmé le ${date(s(m.createdAt))}` }).join(' · ') : 'aucune'}</b></div>
            <div className="bo-kv"><span>Données</span><b>suppression : {suppression ? `demandée le ${date(s(suppression.createdAt))}` : 'non'}</b></div>
          </div>
          <div className="bo-card">
            <h2>Actions</h2>
            <div className="bo-alerte"><div><b>Écrire</b><small>par e-mail, depuis l&apos;adresse du support Client</small></div>{u.email ? <a className="bo-btn" href={`mailto:${u.email}?subject=${encodeURIComponent('Votre compte Koji')}`}>Écrire</a> : <span className="bo-tag gris">pas d&apos;adresse</span>}</div>
            <div className="bo-alerte"><div><b>Exporter ses données</b><small>RGPD art. 20 · fichier · accès tracé</small></div><a className="bo-btn" href={`/api/admin/particuliers/${id}/export`}>Exporter</a></div>
            <div className="bo-alerte"><div><b>Supprimer le compte</b><small>{suppression ? `à sa demande du ${date(s(suppression.createdAt))} · à traiter avant le ${date(limite)} (${JOURS_SUPPRESSION} jours)` : `à sa demande seulement · ${JOURS_SUPPRESSION} jours`}</small></div><span className={`bo-tag ${suppression ? 'plein' : 'gris'}`}>{suppression ? 'demandée' : 'aucune demande'}</span></div>
            <p className="bo-note">L&apos;effacement reste traité à la main (décision du 30 septembre) : les documents que l&apos;entreprise doit conserver par la loi restent chez elle.</p>
          </div>
        </div>
        <div className="bo">
          <div className="bo-card">
            <h2>Journal</h2>
            <div className="bo-journal">{journal.length ? journal.map((e, i) => <div key={i}><time>{dateHeure(e.quand)}</time><span>{e.texte}</span></div>) : <p className="bo-note">Aucune action enregistrée.</p>}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
