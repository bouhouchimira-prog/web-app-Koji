import { NextResponse } from "next/server";
import { getStripe } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";

// Endpoint separe pour les evenements Stripe Connect (recommandation Stripe
// standard — signe avec un secret different de celui des evenements
// plateforme, voir STRIPE_CONNECT_WEBHOOK_SECRET). A creer cote Dashboard
// Stripe (Connect > Webhooks) une fois Connect active.
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
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET);
  } catch (error) {
    return NextResponse.json({ error: `Signature invalide: ${error.message}` }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      const account = event.data.object;
      const userId = account.metadata?.kojiUserId;
      if (userId) {
        await updateUserBilling(userId, {
          _stripeConnectAccountId: account.id,
          _stripeConnectOnboarded: Boolean(account.charges_enabled && account.payouts_enabled)
        });
      }
    }
  } catch (error) {
    console.error("Stripe Connect webhook handling error:", error);
  }

  return NextResponse.json({ received: true });
}
