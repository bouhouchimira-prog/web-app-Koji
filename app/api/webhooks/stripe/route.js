import { NextResponse } from "next/server";
import { getStripe, intervalFromProPriceId, isWebsitePriceId } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { readDb, writeDb } from "../../../../lib/db";

// Called by Stripe, never by the browser — no session cookie to check here.
// Authenticity comes entirely from the signature verified below, so this
// route must read the raw request body (no request.json() before this).
async function updateUserBilling(userId, patch) {
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase
    .from("users")
    .select("business_info")
    .eq("id", userId)
    .maybeSingle();
  if (error || !profile) return;
  const businessInfo = { ...(profile.business_info || {}), ...patch };
  await supabase.from("users").update({ business_info: businessInfo }).eq("id", userId);
}

export async function POST(request) {
  const signature = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: `Signature invalide: ${error.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.metadata?.kojiUserId) {
          await updateUserBilling(session.metadata.kojiUserId, {
            _stripeCustomerId: session.customer,
            _stripeSubscriptionId: session.subscription,
            _billingPlan: "pro",
            _billingInterval: session.metadata.interval || null,
            _billingStatus: "active",
            _addonWebsite: session.metadata.website === "1"
          });
        }
        if (session.mode === "payment" && session.metadata?.chantierPaiementId) {
          const db = await readDb();
          const paiement = (db.chantierPaiements || []).find((p) => p.id === session.metadata.chantierPaiementId);
          if (paiement && paiement.status === "pending") {
            paiement.status = "paid_platform";
            paiement.stripePaymentIntentId = session.payment_intent || "";
            await writeDb(db);
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.kojiUserId;
        if (userId) {
          const items = subscription.items?.data || [];
          const proItem = items.find((item) => !isWebsitePriceId(item.price?.id));
          const addonWebsite = items.some((item) => isWebsitePriceId(item.price?.id));
          const patch = {
            _stripeSubscriptionId: subscription.id,
            _billingStatus: subscription.status,
            _addonWebsite: addonWebsite
          };
          const interval = intervalFromProPriceId(proItem?.price?.id);
          if (interval) {
            patch._billingPlan = "pro";
            patch._billingInterval = interval;
          }
          await updateUserBilling(userId, patch);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.kojiUserId;
        if (userId) {
          await updateUserBilling(userId, {
            _billingPlan: null,
            _billingStatus: "canceled",
            _addonWebsite: false
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook handling error:", error);
  }

  return NextResponse.json({ received: true });
}
