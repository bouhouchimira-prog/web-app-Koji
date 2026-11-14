import { getSupabaseAdmin } from "./supabase";
import { mapQuote } from "./quote-mapping";
import { mergedOuvragesAsync } from "./ouvrages";
import { indexBibliotheque, prixRecommande, tauxHoraireEntreprise, tvaParDefaut } from "./prix-recommande";

// Prix recommandé de chaque offre pour UNE entreprise (voir
// lib/prix-recommande.js). Les postes de l'expertise (codes, quantités)
// restent côté serveur : seul le résultat chiffré est renvoyé.
// Map offreId → { ttc, ht, chiffres, manquants, postes } | null (pas
// d'expertise lisible).
// budgets (Map, facultatif) : reçoit le budget estimé par Koji (TTC de
// l'expertise) de chaque offre, pour le barème des jetons (PRO-04) ; jamais
// renvoyé à l'entreprise.
export async function prixRecommandesPour({ db, userId, business = {}, offres = [], budgets = null }) {
  const resultat = new Map();
  const ids = [...new Set(offres.map((offre) => offre.expertiseId).filter(Boolean))];
  if (!ids.length) return resultat;

  const { data, error } = await getSupabaseAdmin().from("quotes").select("*").in("id", ids);
  if (error || !Array.isArray(data)) return resultat;
  const parExpertise = new Map(data.map((row) => [row.id, mapQuote(row)]));
  const itemsParExpertise = new Map([...parExpertise].map(([id, q]) => [id, q?.items || []]));
  if (budgets) for (const offre of offres) budgets.set(offre.id, Number(parExpertise.get(offre.expertiseId)?.totalTtc) || 0);

  const parCode = indexBibliotheque(await mergedOuvragesAsync(db, userId));
  const options = { tauxHoraire: tauxHoraireEntreprise(business), tva: tvaParDefaut(business) };
  for (const offre of offres) {
    const items = itemsParExpertise.get(offre.expertiseId);
    resultat.set(offre.id, items ? prixRecommande(items, parCode, options) : null);
  }
  return resultat;
}
