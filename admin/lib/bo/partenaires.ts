// Fournisseurs partenaires et leur catalogue (maquettes PRO-24.5, 24.6) :
// règles pures sur db.partenaires de koji-web (fiche, mercuriale importée,
// publication). La création, l'import du fichier et la publication se font
// dans le back-office de koji-web (/admin/partenaires), qui écrit dans sa
// base sans risque de conflit ; ici, lecture seule.
import type { Ligne } from './client'

const s = (v: unknown) => String(v ?? '')
export const SITE_KOJI = process.env.KOJI_WEB_URL || 'https://getkoji.io'
export const GERER_PARTENAIRES = `${SITE_KOJI}/admin/partenaires`

export type EtatPartenaire = 'actif' | 'perime' | 'brouillon'
export const ETATS_PARTENAIRE: Record<EtatPartenaire, string> = { actif: 'Actif', perime: 'Prix à mettre à jour', brouillon: 'Non publié' }

export function etatPartenaire(p: Ligne, aujourdhui = new Date().toISOString().slice(0, 10)): EtatPartenaire {
  if (!p.publie || !Array.isArray(p.articles) || !p.articles.length) return 'brouillon'
  return s(p.validite) && s(p.validite) < aujourdhui ? 'perime' : 'actif'
}

export type EtatProduit = 'publie' | 'a_verifier' | 'sans_fournisseur' | 'doublon'
export const ETATS_PRODUIT: Record<EtatProduit, string> = { publie: 'Publié', a_verifier: 'Prix à vérifier', sans_fournisseur: 'Sans fournisseur actif', doublon: 'Doublon' }

const cle = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export type Produit = { id: string; designation: string; ref: string; partenaireId: string; partenaire: string; famille: string; unite: string; prixPublic: number; prixKoji: number; validite: string; etat: EtatProduit }

export function catalogue(partenaires: Ligne[], aujourdhui = new Date().toISOString().slice(0, 10)): Produit[] {
  const tous: Produit[] = []
  for (const p of partenaires) {
    const ep = etatPartenaire(p, aujourdhui)
    for (const a of (Array.isArray(p.articles) ? p.articles : []) as Ligne[]) {
      const validite = s(a.validite)
      tous.push({
        id: `${s(p.id)}~${s(a.ref)}`, designation: s(a.designation), ref: s(a.ref), partenaireId: s(p.id), partenaire: s(p.nom), famille: s(p.metiers), unite: s(a.unite) || 'u',
        prixPublic: Number(a.prixPublic) || 0, prixKoji: Number(a.prixKoji) || 0, validite,
        etat: ep === 'brouillon' ? 'sans_fournisseur' : (validite && validite < aujourdhui) || !Number(a.prixPublic) ? 'a_verifier' : 'publie'
      })
    }
  }
  // Doublon : même désignation chez un autre partenaire, ou même référence répétée.
  const parCle = new Map<string, number>()
  for (const x of tous) parCle.set(cle(x.designation), (parCle.get(cle(x.designation)) || 0) + 1)
  const refs = new Map<string, number>()
  for (const x of tous) refs.set(`${x.partenaireId}~${x.ref}`, (refs.get(`${x.partenaireId}~${x.ref}`) || 0) + 1)
  for (const x of tous) if (x.etat === 'publie' && ((parCle.get(cle(x.designation)) || 0) > 1 || (refs.get(`${x.partenaireId}~${x.ref}`) || 0) > 1)) x.etat = 'doublon'
  return tous
}
