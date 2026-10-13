import { hasConfirmedRdv } from "./rdv";

// Regle de confidentialite Radar des Chantiers (decision du 4 septembre,
// reaffirmee le 12 octobre) : aucune coordonnee du particulier (adresse
// exacte, nom, email, telephone) n'est visible par une entreprise tant que
// le RDV n'est pas confirme sur l'offre dont elles proviennent — l'echange
// passe par la messagerie interne jusque-la. Un seul point d'entree pour
// cette verification (reutilise par les offres ET les devis/PDF qui en sont
// issus) afin de ne jamais la dupliquer/desynchroniser entre les deux.
export function isRdvUnlockedForOffer(db, offerId, entrepriseUserId) {
  if (!offerId || !entrepriseUserId) return false;
  return hasConfirmedRdv(db.chantierOffreMessages, offerId, entrepriseUserId);
}

// Repli affiche a la place de l'adresse exacte tant que le RDV n'est pas
// confirme — jamais vide, pour ne pas laisser croire a un bug d'affichage.
export function maskedCityPostal(offre) {
  const value = [offre?.postalCode, offre?.city].filter(Boolean).join(" ");
  return value || "Adresse communiquée après confirmation du RDV";
}
