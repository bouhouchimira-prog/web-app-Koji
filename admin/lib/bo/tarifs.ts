// Prix et offres (maquette PRO-24.10) : les règles en vigueur dans koji-web,
// recopiées ici pour l'affichage (le back-office est une application
// séparée). Sources : lib/radar-jetons.js (JETONS_INCLUS, PRIX_JETON_HT,
// jetonsPourMontant), lib/plan.js (POSITION_LIMITS, START_POSITION_LIMIT),
// app/entreprise/SiteParts.jsx (comptes, devis IA de Start). Toute
// modification de ces règles se fait dans koji-web, puis ici.
export const OFFRES_KOJI = [
  { plan: 'start', label: 'Start', comptes: 1, jetonsInclus: 0, prixJetonHt: 15, positions: 2, inclus: "5 devis avec l'IA par mois, chantiers, page Koji, Radar avec jetons" },
  { plan: 'pro', label: 'Pro', comptes: 1, jetonsInclus: 3, prixJetonHt: 10, positions: 5, inclus: 'Tout Start, factures, facture électronique, fournitures et bibliothèque, réseau pro' },
  { plan: 'business', label: 'Business', comptes: 5, jetonsInclus: 10, prixJetonHt: 8, positions: 15, inclus: 'Tout Pro, dépenses par chantier, équipe, planning et heures' }
] as const

// Prix d'un chantier du Radar en jetons, d'après le budget estimé par Koji (TTC).
export const BAREME_JETONS = [
  { tranche: 'moins de 1 500 €', jetons: 1 },
  { tranche: '1 500 – 8 000 €', jetons: 3 },
  { tranche: 'plus de 8 000 €', jetons: 6 },
  { tranche: 'sans estimation', jetons: 3 }
]
