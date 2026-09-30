import { getSupabaseAdmin } from "./supabase";
import { writeDb } from "./db";
import { PRICE_RANGE_SPREAD } from "./ai-devis-shape";

// Auto-guerison de la fourchette de prix d'une offre Radar des Chantiers
// (30 sept, remonte par Amira : une offre continuait d'afficher "17 248€ -
// 23 336€" alors que l'expertise interne liee valait desormais bien plus,
// parce que la fourchette n'etait recalculee qu'a la creation d'un devis
// via app/api/estimer-devis, jamais quand l'offre elle-meme est relue). Sur
// chaque lecture de l'offre (cote particulier ET cote entreprise), on
// recalcule la fourchette a partir du VRAI total actuel de l'expertise
// interne liee, et on la reecrit si elle a change — l'offre ne peut alors
// plus jamais rester durablement desynchronisee de son propre chiffrage,
// peu importe la cause (expertise corrigee apres publication, ancien
// enregistrement cree avant ce correctif...).
export async function syncOfferPriceRange(db, offre) {
  if (!offre?.expertiseId) return offre;
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: expertiseRow } = await supabaseAdmin
      .from("quotes")
      .select("total_ttc")
      .eq("id", offre.expertiseId)
      .maybeSingle();
    const totalTtc = Number(expertiseRow?.total_ttc || 0);
    if (!(totalTtc > 0)) return offre;

    const freshMin = Math.round(totalTtc * (1 - PRICE_RANGE_SPREAD));
    const freshMax = Math.round(totalTtc * (1 + PRICE_RANGE_SPREAD));
    if (offre.priceRangeMin === freshMin && offre.priceRangeMax === freshMax) return offre;

    offre.priceRangeMin = freshMin;
    offre.priceRangeMax = freshMax;
    await writeDb(db);
  } catch {
    // Best-effort : une offre affichant temporairement son ancienne
    // fourchette (erreur reseau, ligne introuvable) ne doit jamais faire
    // echouer la lecture de l'offre elle-meme.
  }
  return offre;
}
