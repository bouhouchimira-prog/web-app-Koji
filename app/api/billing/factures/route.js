import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { getStripe, hasStripe, planAndIntervalFromPriceId } from "../../../../lib/stripe";

// Abonnement et factures Koji (maquette PRO-15.3) : lecture seule chez
// Stripe. Prochain prélèvement, moyen de paiement, factures d'abonnement
// (PDF Stripe) et achats de jetons (reçu Stripe). Rien n'est modifié ici :
// changer d'offre et résilier passent par le portail Stripe.
const euros = (centimes) => Math.round(Number(centimes) || 0) / 100;
const iso = (s) => (s ? new Date(s * 1000).toISOString() : "");

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const { data: profile } = await entreprise.supabase.from("users").select("business_info").eq("id", entreprise.userId).maybeSingle();
  const customerId = profile?.business_info?._stripeCustomerId || "";
  const db = await readDb();
  const achats = (db.jetonsAchats || []).filter((a) => a.userId === entreprise.userId).sort((a, b) => String(b.le).localeCompare(String(a.le))).slice(0, 12);
  const vide = { abonnement: null, factures: [], jetons: achats.map((a) => ({ id: a.id, le: a.le, quantite: a.quantite, ttc: a.montantTtc, recu: "" })) };
  if (!hasStripe || !customerId) return ok(vide);
  let stripe;
  try { stripe = getStripe(); } catch { return ok(vide); }
  try {
    const [subs, invoices] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 3, expand: ["data.default_payment_method"] }),
      stripe.invoices.list({ customer: customerId, limit: 12 })
    ]);
    const sub = subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status)) || null;
    let abonnement = null;
    if (sub) {
      const item = sub.items?.data?.[0];
      const prix = item?.price;
      const fin = item?.current_period_end || sub.current_period_end;
      const pm = sub.default_payment_method && typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
      const derniere = invoices.data.find((i) => i.status === "paid" && (i.subscription === sub.id || i.parent?.subscription_details?.subscription === sub.id)) || invoices.data.find((i) => i.status === "paid");
      abonnement = {
        ...planAndIntervalFromPriceId(prix?.id || ""),
        statut: sub.status,
        prochainLe: iso(fin),
        seTermine: Boolean(sub.cancel_at_period_end || sub.cancel_at),
        montantHt: euros(prix?.unit_amount),
        montantTtc: derniere ? euros(derniere.total) : 0,
        paiement: pm?.card ? `carte ${pm.card.brand} •••• ${pm.card.last4}` : pm?.sepa_debit ? `prélèvement •••• ${pm.sepa_debit.last4}` : ""
      };
    }
    const factures = invoices.data.filter((i) => i.status === "paid" || i.status === "open").map((i) => ({
      numero: i.number || i.id, le: iso(i.created), libelle: i.lines?.data?.[0]?.description || "Abonnement Koji Pro", ttc: euros(i.total), payee: i.status === "paid", pdf: i.invoice_pdf || i.hosted_invoice_url || ""
    }));
    // Reçus des achats de jetons (paiements Stripe Checkout).
    const jetons = await Promise.all(achats.map(async (a) => {
      let recu = "";
      try {
        const session = await stripe.checkout.sessions.retrieve(a.sessionId, { expand: ["payment_intent.latest_charge"] });
        recu = session.payment_intent?.latest_charge?.receipt_url || "";
      } catch { /* reçu indisponible */ }
      return { id: a.id, le: a.le, quantite: a.quantite, ttc: a.montantTtc, recu };
    }));
    return ok({ abonnement, factures, jetons });
  } catch (error) {
    return badRequest(`Factures indisponibles : ${error.message}`, 502);
  }
}
