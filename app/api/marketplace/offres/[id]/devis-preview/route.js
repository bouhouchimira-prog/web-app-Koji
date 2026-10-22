import { badRequest, ok } from "../../../../../../lib/http";
import { readDb } from "../../../../../../lib/db";
import { getVerifiedUserId } from "../../../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../../../lib/supabase";
import { buildWebUser } from "../../../../../../lib/user-profile";
import { mapQuote } from "../../../../../../lib/quote-mapping";
import { computeQuoteItem } from "../../../../../../lib/quote-calculations";
import { clearUnverifiedAiPrices } from "../../../../../../lib/ai-devis-shape";
import { fixText } from "../../../../../../lib/text";

// Apercu modifiable des lots/ouvrages AVANT de creer reellement le devis
// (30 sept, demande d'Amira : trop de lignes generees par l'IA — 10+ pour
// 4 points decrits — l'entreprise veut pouvoir fusionner/supprimer/ajuster
// les lots et les prix avant d'atterrir dans l'editeur complet). Memes
// donnees que app/api/estimer-devis, mais rien n'est ecrit en base ici :
// une simple lecture. "previewPriceHt" donne a chaque poste un prix de
// depart realiste (calcule avec le meme moteur que l'editeur, via le taux
// horaire reel de l'entreprise) — l'ecran de revue l'affiche comme un
// champ modifiable simple, jamais une formule a comprendre.
export async function GET(request, context) {
  // getAuth()'s userId is only decoded, not signature-verified — this route
  // reads the full expertise (prices, quantities) via the service-role
  // client below, bypassing RLS entirely, so the caller's identity AND
  // their positionnement on this specific offer must both be verified
  // before that read happens (mirrors the check in ../visite/route.js).
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre) return badRequest("Chantier introuvable.", 404);
  if (!offre.expertiseId) return badRequest("Aucune expertise n'est liée à ce chantier.", 404);

  const positionnement = (db.chantierPositionnements || []).find(
    (entry) => entry.offerId === id && entry.entrepriseUserId === userId && entry.status === "Active"
  );
  if (!positionnement) return badRequest("Vous devez d'abord vous positionner sur ce chantier.", 403);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: expertiseRow, error } = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", offre.expertiseId)
    .maybeSingle();
  if (error) return badRequest(`Lecture de l'expertise impossible: ${error.message}`, 500);
  const expertise = expertiseRow ? mapQuote(expertiseRow) : null;
  if (!expertise) return badRequest("Expertise introuvable.", 404);

  const { data: profile } = await supabaseAdmin.from("users").select("*").eq("id", userId).maybeSingle();
  const webUser = buildWebUser({ id: userId, email: profile?.email || "", profile });

  const { items: cleaned } = clearUnverifiedAiPrices(expertise.items || []);
  const items = cleaned.map((item) => {
    const computedItem = computeQuoteItem(item, { pricingProfile: webUser.business || {} });
    return {
      id: item.id,
      room: fixText(item.room || "Général"),
      label: fixText(item.label || "Prestation"),
      quantity: Number(item.quantity) || 1,
      unit: item.unit || "u",
      previewPriceHt: Math.round(computedItem.totalHt * 100) / 100,
      needsPrice: Boolean(item.needsPrice)
    };
  });

  return ok({
    rooms: expertise.rooms || [],
    items,
    description: fixText(offre.description || expertise.workDescription || "")
  });
}
