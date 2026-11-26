import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../../lib/http";
import { getVerifiedAuth } from "../../../../lib/server-auth";
import { getStripe, priceIdFor } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Uses getVerifiedAuth (Supabase Auth session cookie) on purpose: only entreprise
// accounts authenticate that way, so particulier/ouvrier sessions (which use
// separate cookies, see lib/portal-session.js / lib/worker-session.js) get a
// clean 401 here instead of being able to trigger a real charge for a plan
// that has no meaning on their account.
const VALID_INTERVALS = new Set(["month", "year"]);
// Start (gratuit) ne passe jamais par cette route — pas de Stripe.
const VALID_PLANS = new Set(["pro", "business"]);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = await getVerifiedAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const interval = VALID_INTERVALS.has(body.interval) ? body.interval : "month";
  const plan = VALID_PLANS.has(body.plan) ? body.plan : "pro";

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return badRequest("L'abonnement n'est pas encore configuré côté paiement. Réessayez plus tard.", 500);
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return badRequest(error.message, 500);
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from("users")
    .select("email, business_info")
    .eq("id", auth.userId)
    .maybeSingle();
  if (profileError) return badRequest(`Lecture du profil impossible: ${profileError.message}`, 500);

  const businessInfo = profile?.business_info || {};
  let customerId = businessInfo._stripeCustomerId || "";

  // CGV (article 6) : le client les accepte avant de payer. La case de la
  // page Abonnement envoie acceptedCgv ; sans elle, pas de paiement.
  if (body.acceptedCgv !== true) {
    return badRequest("Acceptez les conditions générales de vente pour continuer.", 400);
  }

  try {
    // Un abonné qui change de formule passe par le portail Stripe (prorata),
    // jamais par un nouveau Checkout : sinon il paierait deux abonnements.
    if (businessInfo._stripeSubscriptionId) {
      const existant = await stripe.subscriptions.retrieve(businessInfo._stripeSubscriptionId).catch(() => null);
      if (existant && !["canceled", "incomplete_expired"].includes(existant.status)) {
        return NextResponse.json({
          error: "Vous avez déjà un abonnement : le changement de formule se fait depuis la gestion de l'abonnement.",
          code: "abonnement_existant"
        }, { status: 409 });
      }
    }

    // Preuve de l'acceptation des CGV (date, formule, périodicité).
    const cgvAcceptedAt = new Date().toISOString();
    const { error: cgvError } = await getSupabaseAdmin()
      .from("users")
      .update({ business_info: { ...businessInfo, _cgvAcceptedAt: cgvAcceptedAt, _cgvAcceptedFor: `${plan}/${interval}` } })
      .eq("id", auth.userId);
    if (cgvError) return badRequest(`Enregistrement de l'acceptation des CGV impossible: ${cgvError.message}`, 500);
    businessInfo._cgvAcceptedAt = cgvAcceptedAt;
    businessInfo._cgvAcceptedFor = `${plan}/${interval}`;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || "",
        metadata: { kojiUserId: auth.userId }
      });
      customerId = customer.id;
      // Compte serveur : les champs de facturation (_stripeCustomerId,
      // _billingPlan…) sont protégés en base contre toute écriture faite avec
      // la session de l'utilisateur (supabase/migrations/0009).
      const { error: saveError } = await getSupabaseAdmin()
        .from("users")
        .update({ business_info: { ...businessInfo, _stripeCustomerId: customerId } })
        .eq("id", auth.userId);
      if (saveError) return badRequest(`Enregistrement du client de paiement impossible: ${saveError.message}`, 500);
    }

    const lineItems = [{ price: priceId, quantity: 1 }];

    const metadata = { kojiUserId: auth.userId, interval, plan, cgvAcceptedAt: businessInfo._cgvAcceptedAt };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${appUrl}/parametres/abonnement?checkout=success`,
      cancel_url: `${appUrl}/abonnement?checkout=cancel`,
      subscription_data: { metadata },
      metadata
    });

    return ok({ url: session.url });
  } catch (error) {
    return badRequest(`Impossible de démarrer le paiement: ${error.message}`, 500);
  }
}
