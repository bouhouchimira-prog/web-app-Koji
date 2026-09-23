import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { getStripe, addonPriceIdFor, addonPremiumPriceIdFor, isWebsitePriceId, isPremiumPriceId } from "../../../../lib/stripe";

// Adds or removes the "Site web Koji" or "Koji Premium" add-on on an
// already-active subscription, via the Subscription Items API — no
// Checkout redirect needed since a payment method is already on file.
// Two independent, cumulative add-ons (23 septembre) — same duplicated
// pattern per addon rather than a generic abstraction, matching the rest
// of the billing code.
const ADDONS = {
  website: { priceIdFor: addonPriceIdFor, isPriceId: isWebsitePriceId, field: "_addonWebsite" },
  premium: { priceIdFor: addonPremiumPriceIdFor, isPriceId: isPremiumPriceId, field: "_addonPremium" }
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const addonKey = ADDONS[body.addon] ? body.addon : "website";
  const addon = ADDONS[addonKey];
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
    // La ligne "Koji Pro" est celle qui n'est ni le prix Site web ni le prix
    // Premium — jamais deviner l'intervalle a partir d'une ligne add-on.
    const proItem = subscription.items.data.find((item) => !isWebsitePriceId(item.price?.id) && !isPremiumPriceId(item.price?.id));
    const interval = proItem?.price?.recurring?.interval === "year" ? "year" : "month";
    const addonPriceId = addon.priceIdFor(interval);
    if (!addonPriceId) return badRequest("Cette option n'est pas encore configurée.", 500);

    const existingItem = subscription.items.data.find((item) => item.price?.id === addonPriceId);

    if (enable && !existingItem) {
      await stripe.subscriptionItems.create({ subscription: subscriptionId, price: addonPriceId });
    } else if (!enable && existingItem) {
      await stripe.subscriptionItems.del(existingItem.id);
    }

    const { error: saveError } = await auth.supabase
      .from("users")
      .update({ business_info: { ...info, [addon.field]: enable } })
      .eq("id", auth.userId);
    if (saveError) return badRequest(`Enregistrement impossible: ${saveError.message}`, 500);

    return ok({ [addonKey === "website" ? "addonWebsite" : "addonPremium"]: enable });
  } catch (error) {
    return badRequest(`Impossible de mettre à jour l'option: ${error.message}`, 500);
  }
}
