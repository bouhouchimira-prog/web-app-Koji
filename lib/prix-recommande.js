// Prix recommandé d'un chantier du Radar, côté Koji Pro uniquement (10 nov,
// demande d'Amira). Le particulier (Koji) ne voit jamais de prix ni de
// fourchette ; l'entreprise voit un prix calculé avec SES prix :
// - chaque poste de l'expertise porte le code de l'ouvrage trouvé dans la
//   bibliothèque (catalogCode, voir lib/ai-devis-shape.js) et sa quantité ;
// - le prix vient de la bibliothèque de l'entreprise (ses ouvrages modifiés
//   et ses copies perso l'emportent sur le socle Koji) et de son taux de
//   main-d'œuvre (Bibliothèque › Mes prix) ;
// - un poste sans ouvrage correspondant, ou sans taux pour le calculer, reste
//   sans prix : Koji n'invente rien, il le compte dans `manquants`.
// Affichage (maquette PRO-04 / PRO-13.5) : un seul montant TTC, arrondi à la
// centaine, avec la TVA par défaut de l'entreprise.

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function tauxHoraireEntreprise(business = {}) {
  const daily = Number(business.dailyRate || 0);
  const heures = Number(business.hoursPerDay || 7) || 7;
  return daily > 0 ? round2(daily / heures) : 0;
}

export function tvaParDefaut(business = {}) {
  const tva = Number(business.defaultVatRate);
  return Number.isFinite(tva) && tva >= 0 ? tva : 20;
}

// Prix HT d'une unité d'ouvrage, 0 si on ne peut pas le calculer.
export function prixUnitaireOuvrage(ouvrage, tauxHoraire = 0) {
  if (ouvrage.billingMode === "fixed") return Math.max(0, Number(ouvrage.fixedAmountHt) || 0);
  const temps = Math.max(0, Number(ouvrage.normativeTime) || 0);
  const taux = Number(ouvrage.hourlyRate) > 0 ? Number(ouvrage.hourlyRate) : tauxHoraire;
  if (temps > 0 && !(taux > 0)) return 0;
  const coefficient = Number(ouvrage.coefficient) > 0 ? Number(ouvrage.coefficient) : 1;
  const fournitures = Math.max(0, Number(ouvrage.suppliesCost) || 0);
  return temps * coefficient * taux + fournitures;
}

// code (majuscules) → ouvrage de l'entreprise. Une copie perso d'un ouvrage
// Koji (copiedFromCode) remplace l'original : c'est le prix de l'entreprise.
export function indexBibliotheque(bibliotheque = []) {
  const parCode = new Map();
  for (const ouvrage of bibliotheque) {
    if (ouvrage?.code) parCode.set(String(ouvrage.code).toUpperCase(), ouvrage);
  }
  for (const ouvrage of bibliotheque) {
    if (ouvrage?.copiedFromCode && ouvrage.userId) parCode.set(String(ouvrage.copiedFromCode).toUpperCase(), ouvrage);
  }
  return parCode;
}

export function prixRecommande(items = [], parCode = new Map(), { tauxHoraire = 0, tva = 20 } = {}) {
  let ht = 0;
  let chiffres = 0;
  let manquants = 0;
  for (const item of items) {
    const ouvrage = item?.catalogCode ? parCode.get(String(item.catalogCode).toUpperCase()) : null;
    const unitaire = ouvrage ? prixUnitaireOuvrage(ouvrage, tauxHoraire) : 0;
    if (!(unitaire > 0)) {
      manquants += 1;
      continue;
    }
    const quantite = Math.max(0, Number(item.quantity) || 0);
    ht += unitaire * quantite;
    chiffres += 1;
  }
  // Sans taux de main-d'œuvre, les ouvrages au temps ne se chiffrent pas :
  // la phrase sous le prix le dit plutôt que d'afficher « rien trouvé ».
  const tauxManquant = !(tauxHoraire > 0);
  if (!chiffres || ht <= 0) return { ttc: null, ht: 0, chiffres: 0, manquants, postes: items.length, tauxManquant };
  const ttc = ht * (1 + tva / 100);
  return {
    ttc: Math.max(100, Math.round(ttc / 100) * 100),
    ht: round2(ht),
    chiffres,
    manquants,
    postes: items.length,
    tauxManquant
  };
}
