import { createAdminClient } from '@/lib/supabase-admin'
import { etatWeb, utilisateurs } from '@/lib/bo/donnees'
import { nomEntreprise } from '@/lib/bo/regles'
import type { Ligne } from '@/lib/bo/client'
import { dateCourte, ilYa30Jours, maintenant, pourcent } from '@/lib/bo/format'
import Liste, { type LigneListe } from '@/components/bo/Liste'
import { exigerBackOffice } from '@/lib/require-admin'

// Réseau pro (maquette PRO-24.14) : échanges entre entreprises, jamais
// mélangés aux conversations avec les particuliers. Besoins publiés
// (reseau_besoins), réponses (reseau_echanges), contrats de sous-traitance
// (PRO-14.1, db.contratsSousTraitance) et signalements (db.reseauSignalements).
// Koji n'arbitre pas les litiges.
export const dynamic = 'force-dynamic'

const s = (v: unknown) => String(v ?? '')

function etatContrat(c: Ligne) {
  if (c.refuseLe) return { cle: 'refuse', label: 'Refusé' }
  if (c.accepteLe) return { cle: 'accepte', label: 'Accepté' }
  if (c.presenteLe) return { cle: 'presente', label: 'Présenté au client' }
  if (c.envoyeLe) return { cle: 'envoye', label: 'Envoyé' }
  return { cle: 'prepare', label: 'Préparé' }
}

export default async function Reseau() {
  await exigerBackOffice()
  const supa = createAdminClient()
  const [{ data: besoinsRaw }, { data: echangesRaw }, db, comptes] = await Promise.all([
    supa.from('reseau_besoins').select('id,user_id,company_name,title,metier,city,status,created_at,start_date,end_date').order('created_at', { ascending: false }),
    supa.from('reseau_echanges').select('id,besoin_id,user_a,user_b,name_a,name_b,status,created_at'),
    etatWeb(),
    utilisateurs()
  ])
  const besoins = (besoinsRaw || []) as Ligne[]
  const echanges = (echangesRaw || []) as Ligne[]
  const contrats = (db.contratsSousTraitance || []) as Ligne[]
  const signalements = (db.reseauSignalements || []) as Ligne[]
  const nom = new Map(comptes.map((u) => [u.id, nomEntreprise(u)]))
  const depuis = ilYa30Jours()
  const recents = besoins.filter((b) => s(b.created_at) >= depuis)
  const pourvus = recents.filter((b) => s(b.status) === 'pourvu').length
  const acceptes = contrats.filter((c) => etatContrat(c).cle === 'accepte').length

  const lignesBesoins: LigneListe[] = besoins.map((b) => {
    const reps = echanges.filter((e) => s(e.besoin_id) === s(b.id))
    const ids = new Set(reps.map((e) => s(e.id)))
    const contrat = contrats.find((c) => ids.has(s(c.echangeId)))
    const pourvu = s(b.status) === 'pourvu'
    const jours = Math.floor((maintenant() - Date.parse(s(b.created_at))) / 86400000)
    return {
      id: s(b.id),
      cellules: [{ b: `Besoin : ${s(b.metier || b.title)}${b.city ? `, ${s(b.city)}` : ''}`, small: s(b.title) }, s(b.company_name) || nom.get(s(b.user_id)) || '—', `${reps.length} réponse${reps.length > 1 ? 's' : ''}${contrat ? ` · contrat ${etatContrat(contrat).label.toLowerCase()}` : !pourvu ? ` · ${jours} j` : ''}`, dateCourte(s(b.created_at)), { tag: pourvu ? 'Pourvu' : s(b.status) === 'ouvert' ? 'Ouvert' : s(b.status) || '—', ton: pourvu ? '' : 'gris' }],
      filtres: ['besoins'],
      recherche: `${s(b.company_name)} ${s(b.metier)} ${s(b.title)} ${s(b.city)}`,
      lien: { href: `/dashboard/entreprises/${s(b.user_id)}`, label: 'Ouvrir' }
    }
  })
  const lignesContrats: LigneListe[] = contrats.map((c) => ({
    id: s(c.id),
    cellules: [{ b: `Contrat : ${s(c.lot) || 'sous-traitance'}`, small: s(c.chantier) }, `${nom.get(s(c.userId)) || 'Entreprise'} ↔ ${s(c.sousTraitant) || 'sous-traitant'}`, `contrat Koji${c.prixHt ? ` · ${new Intl.NumberFormat('fr-FR').format(Number(c.prixHt))} € HT` : ''}`, dateCourte(s(c.creeLe)), { tag: etatContrat(c).label, ton: etatContrat(c).cle === 'accepte' ? '' : 'gris' }],
    filtres: ['contrats'],
    recherche: `${nom.get(s(c.userId)) || ''} ${s(c.sousTraitant)} ${s(c.lot)} ${s(c.chantier)}`,
    lien: { href: `/dashboard/entreprises/${s(c.userId)}`, label: 'Ouvrir' }
  }))
  const lignesLitiges: LigneListe[] = signalements.map((r) => ({
    id: s(r.id),
    cellules: [{ b: `Signalement : ${s(r.motif).slice(0, 60) || 'sans motif'}` }, `${nom.get(s(r.parUserId)) || 'Entreprise'} ↔ ${nom.get(s(r.contreUserId)) || 'Entreprise'}`, 'échange du réseau', dateCourte(s(r.le)), { tag: 'Signalé', ton: 'plein' }],
    filtres: ['litiges'],
    recherche: `${nom.get(s(r.parUserId)) || ''} ${nom.get(s(r.contreUserId)) || ''} ${s(r.motif)}`,
    lien: { href: `/dashboard/entreprises/${s(r.contreUserId)}`, label: 'Ouvrir' }
  }))

  return (
    <div className="bo">
      <div className="bo-h">
        <div><span className="bo-eyebrow"><span className="bo-u">Koji Pro</span> Réseau pro · entre entreprises</span><h1>Réseau pro</h1></div>
      </div>
      <div className="bo-kpis quatre">
        <div><span>Besoins publiés · 30 j</span><b>{recents.length}</b></div>
        <div><span>Pourvus</span><b>{pourvus}</b><small>{pourcent(pourvus, recents.length)}</small></div>
        <div><span>Contrats acceptés</span><b>{acceptes}</b><small>sur {contrats.length} préparé{contrats.length > 1 ? 's' : ''}</small></div>
        <div><span>Signalements</span><b>{signalements.length}</b></div>
      </div>
      <Liste
        colonnes={['Objet', 'Entreprises', 'Résultat', 'Date', 'État']}
        lignes={[...lignesBesoins, ...lignesContrats, ...lignesLitiges]}
        placeholder="Entreprise, métier…"
        filtres={[{ id: 'besoins', label: 'Besoins' }, { id: 'contrats', label: 'Contrats' }, { id: 'litiges', label: 'Litiges', compte: true }, { id: 'tous', label: 'Tous' }]}
        initial="tous"
        vide="Rien pour l'instant : aucun besoin publié sur le réseau."
      />
      <p className="bo-note">Les échanges entre entreprises ne se mélangent jamais aux conversations avec les particuliers : outil, règles et modération distincts (pas de particulier ici, aucune commission, contrat de sous-traitance PRO-14.1). Koji n&apos;arbitre pas un litige de sous-traitance : renvoi au contrat et aux voies de recours.</p>
    </div>
  )
}
