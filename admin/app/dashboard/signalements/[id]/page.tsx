import Link from 'next/link'
import { notFound } from 'next/navigation'
import { appelerSite, appli, cibleLabel, DELAI_MS, estTraite, natureLabel } from '@/lib/bo/moderation'
import { dateHeure, maintenant } from '@/lib/bo/format'
import { exigerBackOffice } from '@/lib/require-admin'
import { journaliser } from '@/lib/bo/journal'
import ActionsSignalement from './ActionsSignalement'

// Un signalement : qui signale, ce qui est signalé (les contenus de
// l'auteur dans ce fil), l'auteur et son compte, puis les décisions :
// retirer le contenu, suspendre ou réactiver le compte, classer. La
// lecture est inscrite au journal des accès (contenus privés).
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')
const TYPES_AUTEUR: Record<string, string> = { entreprise: 'Entreprise (Koji Pro)', particulier: 'Particulier (Koji)', visiteur: 'Visiteur sans compte' }

export default async function Signalement({ params }: { params: Promise<{ id: string }> }) {
  const admin = await exigerBackOffice()
  const id = decodeURIComponent((await params).id)
  const r = await appelerSite('examiner', id, s(admin?.email))
  if (!r.ok && r.status === 404) notFound()
  if (!r.ok) {
    return (
      <div className="bo">
        <div className="bo-h"><div><span className="bo-eyebrow"><Link href="/dashboard/signalements">Signalements</Link></span><h1>Signalement</h1></div></div>
        <p className="bo-err">{r.erreur}</p>
      </div>
    )
  }
  const { report, examen } = r.data
  await journaliser({ admin: s(admin?.email), action: 'lecture d\'un signalement', cibleType: examen.auteur?.type || 'signalement', cibleId: examen.auteur?.id || id, motif: 'signalement' })

  const traite = estTraite(report)
  const depuis = maintenant() - Date.parse(s(report.createdAt))
  const auteur = examen.auteur
  const lignes = s(report.message).split('\n')
  const titre = lignes[0].replace(/^\[(Signalement contenu|Blocage)\]\s*/, '')
  const details = lignes.slice(1).filter((l) => !/^Type : /.test(l))
  const historique = ((report.moderation as { historique?: { action: string; le: string; par: string; detail: string }[] } | undefined)?.historique) || []

  const actions = [
    ...(examen.peutRetirer ? [{ id: 'retirer', label: 'Retirer le contenu', principal: true, confirmation: 'Retirer ce contenu ? Il sera remplacé par « Message retiré par l’équipe Koji. » (une demande du Radar est retirée du Radar).' }] : []),
    ...(examen.peutSuspendre && auteur && !auteur.suspendu ? [{ id: 'suspendre', label: 'Suspendre le compte de l’auteur', confirmation: `Suspendre le compte de ${auteur.nom || auteur.email} ? Il ne pourra plus se connecter ni rien publier.` }] : []),
    ...(examen.peutSuspendre && auteur?.suspendu ? [{ id: 'reactiver', label: 'Réactiver le compte', confirmation: `Réactiver le compte de ${auteur.nom || auteur.email} ?` }] : []),
    traite
      ? { id: 'rouvrir', label: 'Rouvrir', confirmation: 'Rouvrir ce signalement ?' }
      : { id: 'classer', label: 'Classer (traité)', confirmation: 'Classer ce signalement comme traité ?' }
  ]

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><Link href="/dashboard/signalements">Signalements</Link> › {natureLabel(report)} · {appli(report)}</span><h1>{titre || 'Signalement'}</h1></div>
        <div className="bo-acts"><span className={`bo-tag ${traite ? 'gris' : depuis > DELAI_MS ? 'plein' : ''}`}>{traite ? 'Traité' : depuis > DELAI_MS ? 'Plus de 24 h' : 'À traiter'}</span></div>
      </div>
      <div className="bo-g2 fiche">
        <div className="bo">
          <div className="bo-card">
            <h2>Ce qui est signalé</h2>
            <div className="bo-kv"><span>Type</span><b>{natureLabel(report)} · {cibleLabel(report)}</b></div>
            <div className="bo-kv"><span>Signalé par</span><b>{s(report.reporterCompany || report.reporterName) || 'Compte'}{report.reporterEmail ? ` · ${s(report.reporterEmail)}` : ''} ({appli(report)})</b></div>
            <div className="bo-kv"><span>Reçu</span><b>{dateHeure(s(report.createdAt))}</b></div>
            {details.length ? <p className="bo-note" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{details.join('\n')}</p> : null}
            <h2 style={{ marginTop: 18 }}>Contenus de l&apos;auteur dans ce fil</h2>
            {examen.contenus.length ? (
              <div className="bo-journal">
                {examen.contenus.map((c) => <div key={c.id}><time>{dateHeure(c.le)}</time><span>{c.retire ? <i>{c.texte || 'retiré'}</i> : c.texte}</span></div>)}
              </div>
            ) : <p className="bo-note">Aucun contenu retrouvé (déjà supprimé, ou fil introuvable). Le message du signalement ci-dessus garde un extrait.</p>}
            <ActionsSignalement reportId={s(report.id)} actions={actions} />
          </div>
        </div>
        <div className="bo">
          <div className="bo-card">
            <h2>Auteur</h2>
            {auteur ? (
              <>
                <div className="bo-kv"><span>Nom</span><b>{auteur.nom || '—'}</b></div>
                <div className="bo-kv"><span>E-mail</span><b>{auteur.email || '—'}</b></div>
                <div className="bo-kv"><span>Compte</span><b>{TYPES_AUTEUR[auteur.type] || auteur.type}{auteur.compte ? '' : ' · aucun compte Koji'}</b></div>
                <div className="bo-kv"><span>État</span><b>{auteur.compte ? (auteur.suspendu ? 'Suspendu' : 'Actif') : '—'}</b></div>
                {auteur.type === 'entreprise' && auteur.id ? <p className="bo-note"><Link href={`/dashboard/entreprises/${auteur.id}`}>Fiche entreprise</Link></p> : null}
              </>
            ) : <p className="bo-note">Auteur introuvable.</p>}
            <p className="bo-note">Suspendre : la personne ne peut plus se connecter (site et apps) ni publier. Réactiver annule la suspension.</p>
          </div>
          <div className="bo-card">
            <h2>Décisions</h2>
            {historique.length ? (
              <div className="bo-journal">
                {historique.map((h, i) => <div key={i}><time>{dateHeure(h.le)}</time><span><b>{h.detail}</b> · {h.par || '—'}</span></div>)}
              </div>
            ) : <p className="bo-note">Aucune décision pour l&apos;instant.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
