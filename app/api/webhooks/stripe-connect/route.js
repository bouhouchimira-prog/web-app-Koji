import { NextResponse } from "next/server";
import { getStripe } from "../../../../lib/stripe";
import { compteDeconnecte, enregistrerPaiementConfirme, majCompteDepuisEvenement } from "../../../../lib/paiement-en-ligne-serveur";

// Événements des comptes connectés (Stripe Connect), sur un point d'entrée
// à part, signé avec son propre secret : STRIPE_CONNECT_WEBHOOK_SECRET
// (Dashboard Stripe › Développeurs › Webhooks › « Événements des comptes
// connectés », URL https://<domaine>/api/webhooks/stripe-connect).
// Appelé par Stripe, jamais par le navigateur : l'authenticité vient de la
// signature, donc le corps brut est lu avant tout.
//
// - account.updated : état réel du compte de l'entreprise (encaissements,
//   virements) ;
// - account.application.deauthorized : accès retiré, plus de « Payer » ;
// - checkout.session.completed (payé) et checkout.session.async_payment_succeeded :
//   paiement d'une facture par le particulier (lib/paiement-en-ligne.js),
//   enregistré une seule fois par PaymentIntent.
export async function POST(request) {
  const signature = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || "";
  if (!secret) return NextResponse.json({ error: "Webhook Connect non configuré." }, { status: 503 });

  let event;
  let stripe;
  try {
    stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    return NextResponse.json({ error: `Signature invalide: ${error.message}` }, { status: 400 });
  }

  try {
    if (event.type === "account.updated") {
      await majCompteDepuisEvenement(event.data.object);
    } else if (event.type === "account.application.deauthorized") {
      if (event.account) await compteDeconnecte(event.account);
    } else if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      await enregistrerPaiementConfirme(stripe, event);
    }
  } catch (error) {
    // 500 : Stripe renvoie l'événement plus tard (traitement sans doublon).
    console.error("Stripe Connect webhook:", event.type, error?.message);
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
