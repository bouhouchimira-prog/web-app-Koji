import { NextResponse } from "next/server";
import { getStripe, planAndIntervalFromPriceId } from "../../../../lib/stripe";
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

// Unifie l'abonnement dans la table `subscriptions` (Option B, voir
// docs/BILLING_DECISION.md). Ecriture additive : l'ancien stockage dans
// business_info (_billingPlan, etc.) reste inchange pour compatibilite.
async function upsertSubscription(userId, { plan, status, interval, externalId, currentPeriodEnd }) {
  if (!userId) return;
  const supabase = getSupabaseAdmin();
  const row = {
    user_id: userId,
    plan: plan || "pro",
    status: status || "active",
    source: "stripe",
    interval: interval || null,
    external_id: externalId || null,
    current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString()
  };
  await supabase.from("subscriptions").upsert(row, { onConflict: "user_id,source" });
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
            _billingPlan: session.metadata.plan || "pro",
            _billingInterval: session.metadata.interval || null,
            _billingStatus: "active"
          });
          await upsertSubscription(session.metadata.kojiUserId, {
            plan: session.metadata.plan || "pro",
            status: "active",
            interval: session.metadata.interval || null,
            externalId: session.subscription,
            currentPeriodEnd: null
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
          const resolved = planAndIntervalFromPriceId(items[0]?.price?.id);
          const patch = {
            _stripeSubscriptionId: subscription.id,
            _billingStatus: subscription.status
          };
          if (resolved) {
            patch._billingPlan = resolved.plan;
            patch._billingInterval = resolved.interval;
          }
          await updateUserBilling(userId, patch);
          await upsertSubscription(userId, {
            plan: resolved?.plan || patch._billingPlan || "pro",
            status: subscription.status,
            interval: resolved?.interval || patch._billingInterval || null,
            externalId: subscription.id,
            currentPeriodEnd: subscription.current_period_end
          });
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
          await upsertSubscription(userId, {
            plan: "pro",
            status: "canceled",
            interval: null,
            externalId: subscription.id,
            currentPeriodEnd: subscription.current_period_end
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
