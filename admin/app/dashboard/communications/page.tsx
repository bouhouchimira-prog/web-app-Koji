import { createAdminClient } from '@/lib/supabase-admin'
import { annuaire, etatWeb } from '@/lib/bo/donnees'
import { estEntreprise, offreDe } from '@/lib/bo/regles'
import { dateCourte } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import NouveauMessage from './NouveauMessage'

// Communications (maquette PRO-24.9) : messages envoyés depuis le
// back-office (admin_email_sends) et messages automatiques de koji-web,
// cibles séparées entreprises / particuliers. Vers les particuliers :
// messages de service seulement.
export const dynamic = 'force-dynamic'

type Envoi = { id: string; subject: string; recipients_count: number; segment: string | null; sent_at: string }

const AUTOMATIQUES = [
  { id: 'auto-docs', titre: 'Rappel : document qui expire', canal: 'notification + e-mail · entreprises', quand: '30 j, 7 j et le jour même', type: 'document.expire' },
  { id: 'auto-resume', titre: 'Votre semaine', canal: 'e-mail · entreprises qui l\'ont gardé', quand: 'chaque lundi', type: 'resume.semaine' },
  { id: 'auto-radar', titre: 'Nouveau chantier sur le Radar', canal: 'e-mail · entreprises', quand: 'à chaque demande publiée', type: '' },
  { id: 'auto-relance', titre: 'Relance de facture impayée', canal: 'e-mail · clients des entreprises', quand: 'à la demande de l\'entreprise', type: '' },
  { id: 'auto-devis', titre: 'Devis à signer', canal: 'e-mail · clients des entreprises', quand: 'à l\'envoi d\'un devis', type: '' },
  { id: 'auto-verif', titre: 'Vérification de l\'adresse e-mail', canal: 'e-mail · entreprises et particuliers', quand: 'à l\'inscription', type: '' }
]

export default async function Communications() {
  const [{ data: envois }, { comptes, particuliers }, db] = await Promise.all([
    createAdminClient().from('admin_email_sends').select('id,subject,recipients_count,segment,sent_at').order('sent_at', { ascending: false }).limit(200),
    annuaire(),
    etatWeb()
  ])
  const entreprises = comptes.filter(estEntreprise)
  const comptesCibles = {
    entreprises: entreprises.length,
    abonnes: entreprises.filter((u) => ['pro', 'business'].includes(offreDe(u).plan)).length,
    essai: entreprises.filter((u) => offreDe(u).essai).length,
    particuliers: particuliers.filter((p) => p.actif).length
  }
  const notifications = (db.notifications || []) as Record<string, unknown>[]

  const lignes: LigneListe[] = [
    ...((envois || []) as Envoi[]).map((e) => {
      const vers = /particulier/i.test(e.segment || '') ? 'particuliers' : 'entreprises'
      return {
        id: e.id,
        cellules: [{ b: e.subject }, `e-mail · ${e.segment || '—'}`, `${e.recipients_count} envoyé${e.recipients_count > 1 ? 's' : ''}`, dateCourte(e.sent_at), { tag: 'Envoyé' }],
        filtres: [vers],
        recherche: `${e.subject} ${e.segment || ''}`
      }
    }),
    ...AUTOMATIQUES.map((a) => {
      const n = a.type ? notifications.filter((x) => x.type === a.type).length : null
      return {
        id: a.id,
        cellules: [{ b: a.titre }, `automatique · ${a.canal}`, n !== null ? `${n} envoyé${n > 1 ? 's' : ''} (notifications gardées)` : 'en continu', a.quand, { tag: 'Actif', ton: 'gris' }],
        filtres: ['automatiques'],
        recherche: `${a.titre} ${a.canal}`
      }
    })
  ]

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Transversal</span> Communications · cibles séparées</span><h1>Communications</h1></div>
      </div>
      <NouveauMessage comptes={comptesCibles} />
      <Liste
        colonnes={['Message', 'Canal · cible', 'Résultat', 'Date', 'État']}
        lignes={lignes}
        placeholder="Sujet…"
        filtres={[{ id: 'tous', label: 'Tous' }, { id: 'entreprises', label: 'Entreprises' }, { id: 'particuliers', label: 'Particuliers' }, { id: 'automatiques', label: 'Automatiques' }]}
        vide="Aucun message."
      />
      <p className="bo-note">Règles fixes : messages de service seulement vers les particuliers ; toute communication commerciale demande un consentement séparé et un lien de désinscription. Le taux d&apos;ouverture n&apos;est pas mesuré (pas de pixel de suivi).</p>
    </div>
  )
}
