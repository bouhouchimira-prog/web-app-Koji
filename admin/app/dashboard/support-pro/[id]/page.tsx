import Link from 'next/link'
import { notFound } from 'next/navigation'
import { etatWeb, utilisateur } from '@/lib/bo/donnees'
import { DOCUMENTS, documentsDe, etatDocument, nomEntreprise, offreDe, separer } from '@/lib/bo/regles'
import type { Ligne } from '@/lib/bo/client'
import { categoriePro, estResolu, modelePro, similaires } from '@/lib/bo/support'
import { dateHeure } from '@/lib/bo/format'
import { exigerBackOffice } from '@/lib/require-admin'
import { journaliser } from '@/lib/bo/journal'

// Une demande du Support Pro (maquette PRO-24.8) : contexte automatique
// (compte, offre, documents, page), message, réponse par modèle, demandes
// similaires. L'ouverture est inscrite au journal des accès.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function DemandeSupport({ params }: { params: Promise<{ id: string }> }) {
  await exigerBackOffice()
  const id = decodeURIComponent((await params).id)
  const db = await etatWeb()
  const toutes = (db.technicalReports || []) as Ligne[]
  const r = toutes.find((x) => s(x.id) === id)
  if (!r) notFound()
  const u = r.userId ? await utilisateur(s(r.userId)) : null
  const compte = u ? nomEntreprise(u) : s(r.reporterCompany || r.reporterName) || 'Compte'
  const { categorie } = categoriePro(r)
  const email = s(r.reporterEmail || u?.email)
  const docs = u ? documentsDe(u) : {}
  const alertes = u ? Object.entries(DOCUMENTS).map(([cle, label]) => ({ label, e: etatDocument(cle, docs[cle]) })).filter((x) => x.e.etat !== 'ok') : []
  const pareilles = similaires(r, toutes)
  const admin = await exigerBackOffice()
  if (admin) await journaliser({ admin: s(admin.email), action: 'lecture d\'une demande de support', cibleType: 'entreprise', cibleId: s(r.userId) || id, motif: 'support' })
  const sujet = s(r.message).split(/[.\n?!]/)[0].slice(0, 80)

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> <Link href="/dashboard/support-pro">Support Pro</Link> › {compte}</span><h1>{sujet || 'Demande'}</h1></div>
        <div className="bo-acts">{u ? <Link className="bo-btn" href={`/dashboard/entreprises/${u.id}`}>Fiche entreprise</Link> : null}</div>
      </div>
      <div className="bo-g2 fiche">
        <div className="bo">
          <div className="bo-card">
            <h2>{compte} · « {sujet} »</h2>
            <div className="bo-kv"><span>Compte</span><b>{compte}{u ? ` · ${offreDe(u).label}` : ''}{u && (separer(u).business.city || separer(u).business.ville) ? ` · ${s(separer(u).business.city || separer(u).business.ville)}` : ''}</b></div>
            <div className="bo-kv"><span>Contexte</span><b>{alertes.length ? alertes.map((a) => `${a.label} : ${a.e.label.toLowerCase()}`).join(' · ') : 'documents à jour'}</b></div>
            <div className="bo-kv"><span>Page</span><b>{s(r.page) || '—'} · {s(r.sessionKind) || 'site'}</b></div>
            <div className="bo-kv"><span>Catégorie</span><b>{categorie}</b></div>
            <div className="bo-journal" style={{ marginTop: 10 }}>
              <div><time>{dateHeure(s(r.createdAt))}</time><span><b>{s(r.reporterName) || compte}</b> {s(r.message)}</span></div>
            </div>
            <div className="bo-acts" style={{ marginTop: 12 }}>
              {email ? <a className="bo-btn main" href={`mailto:${email}?subject=${encodeURIComponent(`Votre demande au support Koji : ${sujet}`)}&body=${encodeURIComponent(modelePro(categorie))}`}>Répondre ({categorie === 'autre' ? 'modèle général' : `modèle ${categorie}`})</a> : <span className="bo-tag gris">pas d&apos;adresse</span>}
              {email && categorie !== 'vérifications' ? <a className="bo-btn" href={`mailto:${email}?subject=${encodeURIComponent('Votre demande au support Koji')}&body=${encodeURIComponent(modelePro('vérifications'))}`}>Modèle vérifications</a> : null}
              {email ? <a className="bo-btn" href={`mailto:${email}?subject=${encodeURIComponent('Votre demande au support Koji')}&body=${encodeURIComponent(modelePro('suppression'))}`}>Modèle suppression</a> : null}
            </div>
            <p className="bo-note">État : {estResolu(s(r.status)) ? 'résolu' : 'ouvert'}. La réponse part de votre messagerie ; elle n&apos;est pas encore enregistrée dans Koji.</p>
          </div>
        </div>
        <div className="bo-card">
          <h2>Même sujet</h2>
          {pareilles.length ? (
            <>
              <p className="bo-note">{pareilles.length} demande{pareilles.length > 1 ? 's' : ''} ouverte{pareilles.length > 1 ? 's' : ''} sur la même page ou le même sujet{pareilles.length >= 2 ? ' : bug probable' : ''}.</p>
              {pareilles.slice(0, 6).map((x) => <div key={s(x.id)} className="bo-alerte"><div><b>« {s(x.message).slice(0, 60)} »</b><small>{dateHeure(s(x.createdAt))} · {s(x.page)}</small></div><Link href={`/dashboard/support-pro/${encodeURIComponent(s(x.id))}`}>Ouvrir</Link></div>)}
            </>
          ) : <p className="bo-note">Aucune demande semblable ouverte.</p>}
        </div>
      </div>
    </div>
  )
}
