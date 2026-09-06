import { badRequest, ok } from "../../../../../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../../../../../lib/portal-session";
import { getStripe } from "../../../../../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../../../../../lib/supabase";

// Le particulier valide une echeance apres avoir vu les photos envoyees par
// l'entreprise : les fonds, deja detenus par la plateforme depuis le
// paiement (voir checkout/route.js), sont alors transferes au compte
// Stripe Connect de l'entreprise. Aucun transfert automatique avant cette
// validation explicite (cahier des charges 3.6/4.6). Echeance identifiee
// par son id, voir checkout/route.js pour le pourquoi (etapes a libelle
// libre depuis le 4 septembre).
export async function POST(request, context) {
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id, step: paiementId } = await context.params;

  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre || offre.userId !== portalUserId) return badRequest("Offre introuvable.", 404);

  const paiement = (db.chantierPaiements || []).find((p) => p.offerId === id && p.id === paiementId);
  if (!paiement) return badRequest("Échéance introuvable.", 404);
  if (paiement.status !== "paid_platform") {
    return badRequest("Cette échéance n'est pas encore réglée, ou déjà débloquée.", 409);
  }
  if (!paiement.photos || paiement.photos.length === 0) {
    return badRequest("Attendez que l'entreprise ajoute des photos avant de valider.", 409);
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return badRequest(error.message, 500);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: entrepriseProfile, error: profileError } = await supabaseAdmin
    .from("users")
    .select("business_info")
    .eq("id", paiement.entrepriseUserId)
    .maybeSingle();
  if (profileError) return badRequest(`Lecture du profil entreprise impossible: ${profileError.message}`, 500);

  const connectAccountId = entrepriseProfile?.business_info?._stripeConnectAccountId || "";
  const onboarded = Boolean(entrepriseProfile?.business_info?._stripeConnectOnboarded);
  if (!connectAccountId || !onboarded) {
    return badRequest("L'entreprise n'a pas encore terminé la configuration de son compte de paiement.", 409);
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paiement.stripePaymentIntentId);
    const transfer = await stripe.transfers.create({
      amount: Math.round(paiement.amountTtc * 100),
      currency: "eur",
      destination: connectAccountId,
      source_transaction: paymentIntent.latest_charge
    });

    paiement.status = "released";
    paiement.stripeTransferId = transfer.id;
    paiement.validatedAt = new Date().toISOString();

    addHistory(db, {
      userId: "",
      type: "radar.paiement_valide",
      label: `Échéance ${paiement.step} validée et débloquée`,
      entityId: paiement.id,
      entityType: "chantier-paiement",
      meta: { offerId: id, step: paiement.step, amountTtc: paiement.amountTtc }
    });
    await writeDb(db);

    return ok({ paiement: { id: paiement.id, status: paiement.status, validatedAt: paiement.validatedAt } });
  } catch (error) {
    return badRequest(`Impossible de débloquer les fonds: ${error.message}`, 500);
  }
}
