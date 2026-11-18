import Link from 'next/link'
import { notFound } from 'next/navigation'
import { annuaire, etatWeb } from '@/lib/bo/donnees'
import { cleFil, fils, libelleDemande, type Ligne } from '@/lib/bo/client'
import { dateHeure, nomCourt } from '@/lib/bo/format'
import { requireAdminSession } from '@/lib/require-admin'
import { journaliser, lireJournal } from '@/lib/bo/journal'
import DecisionFil from '@/components/bo/DecisionFil'

// Lecture d'un fil (maquette PRO-24.7) : contenu ouvert seulement sur
// motif (mot-clé détecté), lecture seule, accès tracé ; décision : aucune
// suite ou rappel des règles aux deux parties.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')
const TEXTES: Record<string, string> = { photo_request: 'demande de photos', photo_grant: 'photos partagées', rdv_proposal: 'proposition de visite', rdv_response: 'réponse à la visite' }

export default async function LectureFil({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const db = await etatWeb()
  const tous = (db.chantierOffreMessages || []) as Ligne[]
  const fil = fils(tous).find((f) => f.id === id)
  if (!fil) notFound()
  const messages = tous.filter((m) => cleFil(s(m.offerId), s(m.entrepriseUserId)) === id).sort((a, b) => s(a.createdAt).localeCompare(s(b.createdAt)))
  const offre = ((db.chantierOffres || []) as Ligne[]).find((o) => s(o.id) === fil.offreId)
  const { qui } = await annuaire()
  const p = qui(fil.particulierUserId || s(offre?.userId))
  const particulier = nomCourt(s(p?.nom || offre?.clientName), s(p?.email))
  const entreprise = qui(fil.entrepriseUserId)?.nom || 'Entreprise'
  const admin = await requireAdminSession()
  const ouvert = Boolean(fil.motif)
  const trace = ouvert && admin ? await journaliser({ admin: s(admin.email), action: 'lecture d\'un fil', cibleType: 'conversation', cibleId: id, motif: fil.motif }) : false
  const { actif, lignes: journal } = await lireJournal(20, id)
  const decisions = journal.filter((j) => j.action.startsWith('décision'))

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> <Link href="/dashboard/conversations">Conversations client ↔ entreprise</Link> › {ouvert ? 'à lire' : 'métadonnées'}</span><h1>{particulier} ↔ {entreprise}</h1></div>
      </div>
      <div className="bo-g2 fiche">
        <div className="bo-card">
          <h2>{ouvert ? 'Fil à lire' : 'Fil'} · {particulier} ↔ {entreprise}</h2>
          <p className="bo-note">{offre ? `${libelleDemande(offre)}${offre.city ? ` · ${s(offre.city)}` : ''} · ` : ''}{fil.nb} message{fil.nb > 1 ? 's' : ''}{fil.motif ? ` · ${fil.motif}` : ''}</p>
          {ouvert ? (
            <div className="bo-journal">
              {messages.map((m) => (
                <div key={s(m.id)}><time>{dateHeure(s(m.createdAt))}</time><span><b>{s(m.senderType) === 'entreprise' ? entreprise : particulier}</b> {s(m.message) || TEXTES[s(m.kind)] || ''}{m.kind && TEXTES[s(m.kind)] && m.message ? <small> · {TEXTES[s(m.kind)]}</small> : null}</span></div>
              ))}
            </div>
          ) : (
            <div className="bo-journal">
              {messages.map((m) => <div key={s(m.id)}><time>{dateHeure(s(m.createdAt))}</time><span>{s(m.senderType) === 'entreprise' ? entreprise : particulier} · {TEXTES[s(m.kind)] || 'message'}</span></div>)}
            </div>
          )}
          <p className="bo-note">{ouvert ? `Lecture seule, accès tracé (qui, quand, motif)${actif ? (trace ? ' : cette lecture est inscrite au journal.' : '.') : ' : le journal des accès n\'est pas encore créé (BO_JOURNAL_ACCES.sql).'}` : 'Aucun motif (mot-clé) : le contenu reste fermé, seules les métadonnées sont visibles.'}</p>
        </div>
        <div className="bo-card">
          <h2>Décision</h2>
          {decisions.length ? <div className="bo-journal">{decisions.map((d) => <div key={d.id}><time>{dateHeure(d.created_at)}</time><span>{d.action.replace('décision : ', '')}</span></div>)}</div> : null}
          <DecisionFil fil={id} />
          <p className="bo-note">Rappel des règles : le même message de service part aux deux parties. La suspension d&apos;une entreprise n&apos;existe pas encore.</p>
        </div>
      </div>
    </div>
  )
}
