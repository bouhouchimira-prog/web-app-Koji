import { etatWeb } from '@/lib/bo/donnees'
import type { Ligne } from '@/lib/bo/client'
import { appli, cibleLabel, DELAI_MS, estModeration, estTraite, natureLabel } from '@/lib/bo/moderation'
import { dateHeure, maintenant as horloge } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'

// Signalements (App Store, règle 1.2) : ce que les utilisateurs signalent
// ou bloquent dans Koji et Koji Pro. Chaque signalement est examiné sous
// 24 heures (promesse affichée dans les apps) : retirer le contenu,
// suspendre l'auteur, ou classer.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

export default async function Signalements() {
  await exigerBackOffice()
  const db = await etatWeb()
  const maintenant = horloge()
  const liste = ((db.technicalReports || []) as Ligne[]).filter(estModeration).sort((a, b) => s(b.createdAt).localeCompare(s(a.createdAt)))
  const ouverts = liste.filter((r) => !estTraite(r))
  const enRetard = ouverts.filter((r) => maintenant - Date.parse(s(r.createdAt)) > DELAI_MS)

  const lignes: LigneListe[] = liste.map((r) => {
    const fini = estTraite(r)
    const retard = !fini && maintenant - Date.parse(s(r.createdAt)) > DELAI_MS
    const etat = fini ? 'Traité' : retard ? 'Plus de 24 h' : 'À traiter'
    const premiere = s(r.message).split('\n')[0].replace(/^\[(Signalement contenu|Blocage)\]\s*/, '')
    const motif = (/Motif : (.+)/.exec(s(r.message)) || [])[1] || ''
    return {
      id: s(r.id),
      cellules: [
        { b: s(r.reporterCompany || r.reporterName) || 'Compte', small: appli(r) },
        { b: premiere.length > 70 ? `${premiere.slice(0, 69)}…` : premiere, small: motif },
        `${natureLabel(r)} · ${cibleLabel(r)}`,
        dateHeure(s(r.createdAt)),
        { tag: etat, ton: retard ? 'plein' : fini ? 'gris' : '' }
      ],
      filtres: [fini ? 'traites' : 'ouverts', retard ? 'retard' : ''].filter(Boolean),
      recherche: `${s(r.reporterName)} ${s(r.reporterCompany)} ${s(r.reporterEmail)} ${s(r.message)}`,
      lien: { href: `/dashboard/signalements/${encodeURIComponent(s(r.id))}`, label: fini ? 'Voir' : 'Examiner' }
    }
  })

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow">Transversal · {ouverts.length} à traiter{enRetard.length ? ` · ${enRetard.length} depuis plus de 24 h` : ''}</span><h1>Signalements</h1></div>
      </div>
      <Liste
        colonnes={['Signalé par', 'Contenu', 'Type', 'Reçu', 'État']}
        lignes={lignes}
        placeholder="Nom, e-mail, contenu…"
        filtres={[{ id: 'ouverts', label: 'À traiter', compte: true }, { id: 'retard', label: 'Plus de 24 h', compte: true }, { id: 'traites', label: 'Traités' }, { id: 'tous', label: 'Tous' }]}
        initial="ouverts"
        vide="Aucun signalement."
      />
      <p className="bo-note">Les apps promettent un examen sous 24 heures. Chaque signalement est aussi envoyé par e-mail à entreprise@getkoji.io et ablexpertrenov@gmail.com. Un blocage masque le contenu sur le téléphone de la personne ; il est listé ici pour examiner son auteur.</p>
    </div>
  )
}
