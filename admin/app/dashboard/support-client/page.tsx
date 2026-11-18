import { etatWeb } from '@/lib/bo/donnees'
import { categorieSupport, estParticulierRapport, type Ligne } from '@/lib/bo/client'
import { dateHeure, nomCourt } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'

// Support Client (maquette PRO-24.12) : file des particuliers, séparée du
// support Pro. Sources : les signalements envoyés depuis un compte
// particulier et les demandes de suppression de compte. Réponse par
// e-mail depuis contact@getkoji.io avec un modèle propre au particulier
// (jamais de jargon métier) ; un litige avec une entreprise part vers
// Conversations.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')
const MODELES: Record<string, string> = {
  connexion: "Bonjour,\n\nMerci pour votre message. Pour vous reconnecter, utilisez « Mot de passe oublié » sur la page de connexion : un lien vous est envoyé par e-mail. S'il n'arrive pas, regardez dans les courriers indésirables, puis répondez-nous et nous vous aiderons.\n\nL'équipe Koji",
  'données': "Bonjour,\n\nNous avons bien reçu votre demande au sujet de vos données. Elle est traitée sous 30 jours et nous vous confirmerons par e-mail. Les documents que l'entreprise doit garder par la loi (devis signés, factures) restent chez elle.\n\nL'équipe Koji",
  paiements: "Bonjour,\n\nMerci pour votre message. Nous regardons votre paiement et revenons vers vous rapidement.\n\nL'équipe Koji",
  'rétractation': "Bonjour,\n\nMerci pour votre message. Nous regardons votre demande avec l'entreprise et revenons vers vous rapidement.\n\nL'équipe Koji",
  'suivi de demande': "Bonjour,\n\nMerci pour votre message. Nous relançons l'entreprise et revenons vers vous. Si besoin, nous pouvons aussi prévenir d'autres entreprises de votre secteur.\n\nL'équipe Koji",
  autre: "Bonjour,\n\nMerci pour votre message. Nous revenons vers vous rapidement.\n\nL'équipe Koji"
}
const resolu = (statut: string) => /trait|resolu|résolu|ferm|clos/i.test(statut)

export default async function SupportClient() {
  const db = await etatWeb()
  const rapports = ((db.technicalReports || []) as Ligne[]).filter(estParticulierRapport).map((r) => ({ id: s(r.id), quand: s(r.createdAt), nom: s(r.reporterName), email: s(r.reporterEmail), message: s(r.message), statut: s(r.status) }))
  const suppressions = ((db.accountDeletionRequests || []) as Ligne[]).filter(estParticulierRapport).map((r) => ({ id: s(r.id), quand: s(r.createdAt), nom: s(r.requesterName), email: s(r.requesterEmail), message: `Suppression de mon compte${r.reason ? ` : ${s(r.reason)}` : ''}`, statut: s(r.status) }))
  const tickets = [...rapports, ...suppressions].sort((a, b) => b.quand.localeCompare(a.quand))
  const ouverts = tickets.filter((t) => !resolu(t.statut))

  const lignes: LigneListe[] = tickets.map((t) => {
    const { categorie, urgent } = categorieSupport(t.message)
    const fini = resolu(t.statut)
    const etat = fini ? 'Résolu' : urgent ? 'Urgent' : 'Ouvert'
    const sujet = t.message.length > 70 ? `${t.message.slice(0, 69)}…` : t.message
    return {
      id: t.id,
      cellules: [nomCourt(t.nom, t.email), `« ${sujet} »`, categorie, dateHeure(t.quand), { tag: etat, ton: etat === 'Urgent' ? 'plein' : etat === 'Résolu' ? 'gris' : '' }],
      filtres: [fini ? 'resolus' : 'ouverts', !fini && urgent ? 'urgents' : ''].filter(Boolean),
      recherche: `${t.nom} ${t.email} ${t.message} ${categorie}`,
      lien: t.email ? { href: `mailto:${t.email}?subject=${encodeURIComponent('Votre demande au support Koji')}&body=${encodeURIComponent(MODELES[categorie] || MODELES.autre)}`, label: 'Répondre' } : undefined
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u client">Koji Client</span> Support Client · {ouverts.length} ouvert{ouverts.length > 1 ? 's' : ''}</span><h1>Support Client</h1></div>
      </div>
      <Liste
        colonnes={['Particulier', 'Sujet', 'Catégorie', 'Depuis', 'État']}
        lignes={lignes}
        placeholder="Particulier, sujet…"
        filtres={[{ id: 'ouverts', label: 'Ouverts', compte: true }, { id: 'urgents', label: 'Urgents', compte: true }, { id: 'resolus', label: 'Résolus' }, { id: 'tous', label: 'Tous' }]}
        initial="ouverts"
        vide="Aucune demande de particulier."
      />
      <p className="bo-note">File distincte du support Pro : modèles de réponse propres au particulier (connexion, données, paiements, rétractation, suivi de demande), ton Client, jamais de jargon métier. Un litige avec une entreprise part vers Conversations ; le support ne tranche pas.</p>
    </div>
  )
}
