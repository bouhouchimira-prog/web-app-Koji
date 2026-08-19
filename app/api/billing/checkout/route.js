import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { getStripe, priceIdFor } from "../../../../lib/stripe";

// Uses getAuth (Supabase Auth session cookie) on purpose: only entreprise
// accounts authenticate that way, so particulier/ouvrier sessions (which use
// separate cookies, see lib/portal-session.js / lib/worker-session.js) get a
// clean 401 here instead of being able to trigger a real charge for a plan
// that has no meaning on their account.
const VALID_PLANS = new Set(["go", "premium", "business"]);
const VALID_INTERVALS = new Set(["month", "year"]);

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const plan = String(body.plan || "");
  const interval = VALID_INTERVALS.has(body.interval) ? body.interval : "month";
  if (!VALID_PLANS.has(plan)) return badRequest("Formule inconnue.");

  const priceId = priceIdFor(plan, interval);
  if (!priceId) {
    return badRequest("Cette formule n'est pas encore configurée côté paiement. Réessayez plus tard.", 500);
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

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile?.email || "",
        metadata: { kojiUserId: auth.userId }
      });
      customerId = customer.id;
      const { error: saveError } = await auth.supabase
        .from("users")
        .update({ business_info: { ...businessInfo, _stripeCustomerId: customerId } })
        .eq("id", auth.userId);
      if (saveError) return badRequest(`Enregistrement du client de paiement impossible: ${saveError.message}`, 500);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/parametres/abonnement?checkout=success`,
      cancel_url: `${appUrl}/abonnement?checkout=cancel`,
      subscription_data: {
        metadata: { kojiUserId: auth.userId, plan, interval }
      },
      metadata: { kojiUserId: auth.userId, plan, interval }
    });

    return ok({ url: session.url });
  } catch (error) {
    return badRequest(`Impossible de démarrer le paiement: ${error.message}`, 500);
  }
}
