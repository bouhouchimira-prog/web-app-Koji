import { getSupabaseAdmin } from "./supabase";
import { mapQuote } from "./quote-mapping";
import { mergedOuvragesAsync } from "./ouvrages";
import { indexBibliotheque, prixRecommande, tauxHoraireEntreprise, tvaParDefaut } from "./prix-recommande";

// Prix recommandé de chaque offre pour UNE entreprise (voir
// lib/prix-recommande.js). Les postes de l'expertise (codes, quantités)
// restent côté serveur : seul le résultat chiffré est renvoyé.
// Map offreId → { ttc, ht, chiffres, manquants, postes } | null (pas
// d'expertise lisible).
export async function prixRecommandesPour({ db, userId, business = {}, offres = [] }) {
  const resultat = new Map();
  const ids = [...new Set(offres.map((offre) => offre.expertiseId).filter(Boolean))];
  if (!ids.length) return resultat;

  const { data, error } = await getSupabaseAdmin().from("quotes").select("*").in("id", ids);
  if (error || !Array.isArray(data)) return resultat;
  const itemsParExpertise = new Map(data.map((row) => [row.id, mapQuote(row)?.items || []]));

  const parCode = indexBibliotheque(await mergedOuvragesAsync(db, userId));
  const options = { tauxHoraire: tauxHoraireEntreprise(business), tva: tvaParDefaut(business) };
  for (const offre of offres) {
    const items = itemsParExpertise.get(offre.expertiseId);
    resultat.set(offre.id, items ? prixRecommande(items, parCode, options) : null);
  }
  return resultat;
}
