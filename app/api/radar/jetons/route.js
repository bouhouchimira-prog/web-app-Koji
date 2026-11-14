import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getAuth } from "../../../../lib/server-auth";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { getStripe } from "../../../../lib/stripe";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { contexteRadar } from "../../../../lib/radar-server";
import { PRIX_JETON_HT } from "../../../../lib/radar-jetons";

// Jetons du Radar (maquette PRO-04, décision du 14 novembre) : GET le
// solde ; POST { quantite } ouvre un paiement Stripe (argent réel) au prix
// du jeton de la page Tarifs selon l'offre (15 / 10 / 8 € HT, TVA 20 %).
// Les jetons sont crédités par le webhook Stripe une fois le paiement fait.
const QUANTITES = [5, 10, 20, 50];
const TVA = 0.2;
const NOMS = { start: "Start", pro: "Pro", business: "Business" };

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const db = await readDb();
  const ctx = await contexteRadar(db, entreprise);
  return ok({ jetons: { ...ctx.solde, prixHt: PRIX_JETON_HT[ctx.palier], quantites: QUANTITES } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  const entreprise = await resolveEntreprise(request, body);
  if (!auth || !entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const quantite = QUANTITES.includes(Number(body.quantite)) ? Number(body.quantite) : 0;
  if (!quantite) return badRequest("Choisissez 5, 10, 20 ou 50 jetons.");

  const db = await readDb();
  const ctx = await contexteRadar(db, entreprise);
  const prixHt = PRIX_JETON_HT[ctx.palier];
  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return badRequest(error.message, 500);
  }
  const admin = getSupabaseAdmin();
  const { data: profile } = await admin.from("users").select("email, business_info").eq("id", entreprise.userId).maybeSingle();
  const info = profile?.business_info || {};
  let customerId = info._stripeCustomerId || "";
  try {
    if (!customerId) {
      const customer = await stripe.customers.create({ email: profile?.email || "", metadata: { kojiUserId: entreprise.userId } });
      customerId = customer.id;
      await admin.from("users").update({ business_info: { ...info, _stripeCustomerId: customerId } }).eq("id", entreprise.userId);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const demande = String(body.retour || "/marketplace");
    const retour = demande.startsWith("/") && !demande.startsWith("//") ? demande : "/marketplace";
    const metadata = { kojiUserId: entreprise.userId, radarJetons: String(quantite), palier: ctx.palier };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{
        quantity: quantite,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(prixHt * (1 + TVA) * 100),
          product_data: { name: "Jeton Radar des chantiers", description: `${prixHt} € HT le jeton + TVA 20 %, offre ${NOMS[ctx.palier]}` }
        }
      }],
      success_url: `${appUrl}${retour}${retour.includes("?") ? "&" : "?"}jetons=ok`,
      cancel_url: `${appUrl}${retour}`,
      payment_intent_data: { metadata },
      metadata
    });
    return ok({ url: session.url });
  } catch (error) {
    return badRequest(`Impossible de démarrer le paiement : ${error.message}`, 500);
  }
}
