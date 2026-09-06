import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { getStripe } from "../../../../lib/stripe";

// Onboarding Stripe Connect (comptes Standard) pour recevoir les paiements
// echelonnes Radar des Chantiers (cahier des charges 5.5/§7). Meme pattern
// que app/api/billing/checkout/route.js pour la creation/persistance du
// customer, applique ici a un compte connecte plutot qu'un customer.
//
// Prealable cote Amira (ne peut pas etre fait par du code) : activer Stripe
// Connect dans son Dashboard Stripe avant que stripe.accounts.create ne
// fonctionne.
export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data: profile, error } = await auth.supabase
    .from("users")
    .select("business_info")
    .eq("id", auth.userId)
    .maybeSingle();
  if (error) return badRequest(`Lecture du profil impossible: ${error.message}`, 500);

  const businessInfo = profile?.business_info || {};
  return ok({
    hasAccount: Boolean(businessInfo._stripeConnectAccountId),
    onboarded: Boolean(businessInfo._stripeConnectOnboarded)
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

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
  let accountId = businessInfo._stripeConnectAccountId || "";

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "standard",
        email: profile?.email || "",
        metadata: { kojiUserId: auth.userId }
      });
      accountId = account.id;
      const { error: saveError } = await auth.supabase
        .from("users")
        .update({ business_info: { ...businessInfo, _stripeConnectAccountId: accountId } })
        .eq("id", auth.userId);
      if (saveError) return badRequest(`Enregistrement du compte de paiement impossible: ${saveError.message}`, 500);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/parametres?connect=refresh`,
      return_url: `${appUrl}/parametres?connect=success`,
      type: "account_onboarding"
    });

    return ok({ url: accountLink.url });
  } catch (error) {
    return badRequest(`Impossible de démarrer la configuration du paiement: ${error.message}`, 500);
  }
}
