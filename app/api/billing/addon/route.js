import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { getStripe, addonPriceIdFor, isWebsitePriceId } from "../../../../lib/stripe";

// Adds or removes the "Site web Koji" add-on on an already-active
// subscription, via the Subscription Items API — no Checkout redirect
// needed since a payment method is already on file.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const enable = Boolean(body.enable);

  const { data: profile, error: profileError } = await auth.supabase
    .from("users")
    .select("business_info")
    .eq("id", auth.userId)
    .maybeSingle();
  if (profileError) return badRequest(`Lecture du profil impossible: ${profileError.message}`, 500);

  const info = profile?.business_info || {};
  const subscriptionId = info._stripeSubscriptionId || "";
  if (!subscriptionId) return badRequest("Aucun abonnement actif pour ce compte.");

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return badRequest(error.message, 500);
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const interval = subscription.items.data.find((item) => !isWebsitePriceId(item.price?.id))
      ?.price?.recurring?.interval === "year" ? "year" : "month";
    const websitePriceId = addonPriceIdFor(interval);
    if (!websitePriceId) return badRequest("Cette option n'est pas encore configurée.", 500);

    const existingItem = subscription.items.data.find((item) => item.price?.id === websitePriceId);

    if (enable && !existingItem) {
      await stripe.subscriptionItems.create({ subscription: subscriptionId, price: websitePriceId });
    } else if (!enable && existingItem) {
      await stripe.subscriptionItems.del(existingItem.id);
    }

    const { error: saveError } = await auth.supabase
      .from("users")
      .update({ business_info: { ...info, _addonWebsite: enable } })
      .eq("id", auth.userId);
    if (saveError) return badRequest(`Enregistrement impossible: ${saveError.message}`, 500);

    return ok({ addonWebsite: enable });
  } catch (error) {
    return badRequest(`Impossible de mettre à jour l'option: ${error.message}`, 500);
  }
}
