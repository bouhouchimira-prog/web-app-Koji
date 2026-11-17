import { lireJournal } from '@/lib/bo/journal'
import { dateHeure, ilYa30Jours } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'

// Journal des accès (maquette PRO-24.15) : chaque ouverture d'une donnée
// personnelle ou d'une conversation, avec qui, quand et le motif. Lecture
// seule. Alimenté par lib/bo/journal.ts (lecture d'un fil, d'un devis,
// export des données d'un particulier, décisions de modération).
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { conversation: 'conversation', devis: 'devis', particulier: 'particulier', entreprise: 'entreprise' }

function famille(action: string) {
  if (action.startsWith('lecture d\'un fil')) return 'conversations'
  if (action.startsWith('export')) return 'exports'
  if (action.startsWith('décision')) return 'decisions'
  if (action.startsWith('lecture')) return 'lectures'
  if (action.includes('prix')) return 'prix'
  return ''
}

export default async function Journal() {
  const { actif, lignes: entrees } = await lireJournal(500)
  const lignes: LigneListe[] = entrees.map((e) => ({
    id: e.id,
    cellules: [dateHeure(e.created_at), e.admin_email, { b: e.action, small: `${TYPES[e.cible_type] || e.cible_type} · ${e.cible_id.slice(0, 24)}` }, e.motif || '—', { tag: 'Clos', ton: 'gris' }],
    filtres: [famille(e.action)].filter(Boolean),
    recherche: `${e.admin_email} ${e.action} ${e.cible_type} ${e.cible_id} ${e.motif}`
  }))
  const depuis = ilYa30Jours()
  const recentes = entrees.filter((e) => e.created_at >= depuis).length

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Transversal</span> Journal des accès · {recentes} sur 30 derniers jours</span><h1>Journal des accès</h1></div>
      </div>
      {!actif ? <p className="bo-ok">Le journal n&apos;est pas encore créé : exécuter <b>admin/BO_JOURNAL_ACCES.sql</b> dans l&apos;éditeur SQL de Supabase. Jusque-là, les accès ne sont pas inscrits.</p> : null}
      <Liste
        colonnes={['Quand', 'Qui', 'Action', 'Motif', 'État']}
        lignes={lignes}
        placeholder="Personne, compte, action…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'conversations', label: 'Lectures de conversations' }, { id: 'lectures', label: 'Lectures de devis' }, { id: 'exports', label: 'Exports' }, { id: 'decisions', label: 'Décisions' }]}
        vide="Aucun accès inscrit."
      />
      <p className="bo-note">Chaque accès à une donnée personnelle ou à une conversation est inscrit ici, avec le motif. Le journal est en lecture seule et conservé (durée à fixer avec l&apos;avocat).</p>
    </div>
  )
}
