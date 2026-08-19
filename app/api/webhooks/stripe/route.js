import { NextResponse } from "next/server";
import { getStripe, planFromPriceId } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";

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
            _billingPlan: session.metadata.plan || null,
            _billingInterval: session.metadata.interval || null,
            _billingStatus: "active"
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.kojiUserId;
        if (userId) {
          const priceId = subscription.items?.data?.[0]?.price?.id || "";
          const { plan, interval } = planFromPriceId(priceId);
          // Only overwrite plan/interval when the price resolves to a known
          // one — an unrecognized price (e.g. a price edited by hand in the
          // Stripe dashboard) should never blank out the current plan.
          const patch = {
            _stripeSubscriptionId: subscription.id,
            _billingStatus: subscription.status
          };
          if (plan) patch._billingPlan = plan;
          if (interval) patch._billingInterval = interval;
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
            _billingStatus: "canceled"
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
