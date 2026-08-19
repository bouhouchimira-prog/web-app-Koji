import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { getStripe } from "../../../../lib/stripe";

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
    .select("business_info")
    .eq("id", auth.userId)
    .maybeSingle();
  if (profileError) return badRequest(`Lecture du profil impossible: ${profileError.message}`, 500);

  const customerId = profile?.business_info?._stripeCustomerId || "";
  if (!customerId) return badRequest("Aucun abonnement actif pour ce compte.");

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/parametres/abonnement`
    });
    return ok({ url: session.url });
  } catch (error) {
    return badRequest(`Impossible d'ouvrir la gestion de l'abonnement: ${error.message}`, 500);
  }
}
