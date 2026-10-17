import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { resolveAdminUserId } from "../../../../lib/admin-account";
import { mapQuote, quoteToRow } from "../../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../../lib/quote-calculations";
import { buildBreakdown } from "../route";

// Completer un ou plusieurs prix manquants sur une expertise deja creee (1er
// oct, demande d'Amira) : depuis que l'expertise ne fait plus confiance au
// prix invente par l'IA pour un poste hors catalogue (trustAiPriceForUnmatched
// false, voir app/api/expertise-koji/route.js), le particulier peut
// desormais proposer lui-meme un prix pour ces postes-la, directement sur
// l'ecran de resultat — jamais obligatoire, un poste non complete reste a 0€.
export async function PATCH(request, context) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id } = await context.params;
  const prices = Array.isArray(body.prices) ? body.prices : [];
  if (prices.length === 0) return badRequest("Aucun prix fourni.");

  const adminUserId = await resolveAdminUserId();
  if (!adminUserId) return badRequest("Configuration interne manquante (compte admin introuvable).", 500);

  const supabaseAdmin = getSupabaseAdmin();
  const { data: row, error: fetchError } = await supabaseAdmin.from("quotes").select("*").eq("id", id).maybeSingle();
  if (fetchError) return badRequest(`Lecture de l'expertise impossible: ${fetchError.message}`, 500);
  if (!row) return badRequest("Expertise introuvable.", 404);

  const quote = mapQuote(row);
  if (quote.userId !== adminUserId || !quote.internalOnly) return badRequest("Expertise introuvable.", 404);
  const byId = new Map(prices.map((p) => [String(p.itemId || ""), Math.max(0, Number(p.amountHt) || 0)]));
  const items = (quote.items || []).map((item) => {
    if (!byId.has(String(item.id))) return item;
    return { ...item, billingMode: "fixed", fixedAmountHt: byId.get(String(item.id)), priceSource: "client", needsPrice: false };
  });

  const computed = applyQuoteTotals({ ...quote, items });
  const updatedRow = quoteToRow(computed, adminUserId);
  const { error: updateError } = await supabaseAdmin.from("quotes").update(updatedRow).eq("id", id);
  if (updateError) return badRequest(`Mise à jour de l'expertise impossible: ${updateError.message}`, 500);

  const missingPriceItems = computed.items
    .filter((it) => it.needsPrice)
    .map((it) => ({ id: it.id, room: it.room, label: it.label, quantity: it.quantity, unit: it.unit }));

  return ok({
    breakdown: buildBreakdown(computed.calculatedItems),
    missingPriceItems
  });
}
