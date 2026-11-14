import { loadEntrepriseProfile } from "./entreprise-auth";
import { offreExpiree, palierJetons, PLACES_MAX, placesPrises, positionsAvecEtat, soldeJetons, jetonsPourMontant } from "./radar-jetons";

// Ce que chaque route du Radar côté entreprise partage (PRO-04) : palier
// de jetons, positions avec leur état, solde.
export async function contexteRadar(db, entreprise, maintenant = new Date().toISOString()) {
  const webUser = await loadEntrepriseProfile(entreprise);
  const palier = palierJetons(webUser.plan, webUser.isAdmin);
  const positions = positionsAvecEtat(db, entreprise.userId, maintenant);
  const achats = (db.jetonsAchats || []).filter((a) => a.userId === entreprise.userId);
  const solde = soldeJetons({ palier, positions, achats, maintenant });
  const masques = new Map((db.radarMasques || []).filter((m) => m.userId === entreprise.userId).map((m) => [m.offerId, m]));
  return { webUser, business: webUser.business || {}, palier, positions, solde, masques };
}

// Jetons, places et position de l'entreprise sur une offre.
export function decorerOffre(db, offre, ctx, budget, maintenant = new Date().toISOString()) {
  const mienne = ctx.positions.filter((p) => p.pos.offerId === offre.id).sort((a, b) => String(b.pos.createdAt).localeCompare(String(a.pos.createdAt)))[0] || null;
  const prises = placesPrises(db, offre, maintenant);
  const enCours = mienne && (mienne.etat === "attente" || mienne.etat === "rdv");
  return {
    jetons: mienne?.jetons?.n || jetonsPourMontant(budget),
    places: { prises, max: PLACES_MAX, complet: prises >= PLACES_MAX && !enCours },
    expiree: offreExpiree(offre, maintenant),
    retiree: offre.status === "Retiree",
    masque: ctx.masques.has(offre.id),
    maPosition: mienne ? { etat: mienne.etat, libelle: mienne.libelle, etape: mienne.etape, jetons: mienne.jetons, rdvDate: mienne.rdvDate || "", termine: mienne.termine } : null
  };
}
