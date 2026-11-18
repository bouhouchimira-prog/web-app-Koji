import { devis as lireDevis, utilisateurs } from '@/lib/bo/donnees'
import { estEntreprise, etatEntreprise, fileVerifications, nomEntreprise, offreDe, separer } from '@/lib/bo/regles'
import ListeEntreprises, { type LigneEntreprise } from './ListeEntreprises'
import { exigerBackOffice } from '@/lib/require-admin'

// Entreprises (maquette PRO-24, gabarit liste) : recherche, onglets de
// filtre, tableau avec état en tag, pagination, export.
export const dynamic = 'force-dynamic'

export default async function Entreprises() {
  await exigerBackOffice()
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const [comptes, tousDevis] = await Promise.all([utilisateurs(), lireDevis()])
  const dernierDevis = new Map<string, string>()
  for (const d of tousDevis) if (d.created_at && (!dernierDevis.get(d.user_id) || d.created_at > dernierDevis.get(d.user_id)!)) dernierDevis.set(d.user_id, d.created_at)
  const aVerifier = new Set(fileVerifications(comptes, aujourdhui).filter((l) => ['a_valider', 'expire'].includes(l.etat)).map((l) => l.userId))
  const lignes: LigneEntreprise[] = comptes.filter(estEntreprise).map((u) => {
    const { business } = separer(u)
    const o = offreDe(u, aujourdhui)
    const e = etatEntreprise(u, aujourdhui)
    const activite = [dernierDevis.get(u.id), u.updated_at].filter(Boolean).sort().at(-1) || u.created_at || ''
    return {
      id: u.id, nom: nomEntreprise(u), siret: String(business.siret || ''), ville: String(business.city || business.ville || ''), email: u.email || '',
      offre: o.plan, offreLabel: o.label, activite, etat: e.label, ton: e.ton, aVerifier: aVerifier.has(u.id)
    }
  })
  return <ListeEntreprises lignes={lignes} />
}
