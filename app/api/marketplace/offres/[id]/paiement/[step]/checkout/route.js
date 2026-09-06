import { badRequest, ok } from "../../../../../../../../lib/http";
import { readDb } from "../../../../../../../../lib/db";
import { getVerifiedPortalUserId } from "../../../../../../../../lib/portal-session";
import { getStripe } from "../../../../../../../../lib/stripe";

// Le particulier paie une echeance — les fonds vont sur le compte
// plateforme Koji (pas de transfer_data ici), et ne sont reverses a
// l'entreprise qu'a la validation du client sur photos (voir la route
// valider/route.js). Jamais de transfert automatique.
//
// L'echeance est identifiee par son id (chantierPaiements[].id), pas par un
// nom d'etape fixe : depuis les decisions du 4 septembre, l'entreprise peut
// definir des etapes a libelle libre (lib/chantier-paiements.js), qui ne
// feraient pas de segments d'URL surs ni une cle stable.
export async function POST(request, context) {
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { id, step: paiementId } = await context.params;

  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === id);
  if (!offre || offre.userId !== portalUserId) return badRequest("Offre introuvable.", 404);

  const paiement = (db.chantierPaiements || []).find((p) => p.offerId === id && p.id === paiementId);
  if (!paiement) return badRequest("Échéance introuvable.", 404);
  if (paiement.status !== "pending") return badRequest("Cette échéance a déjà été réglée.", 409);

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return badRequest(error.message, 500);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: offre.clientEmail || undefined,
      line_items: [{
        price_data: {
          currency: "eur",
          unit_amount: Math.round(paiement.amountTtc * 100),
          product_data: { name: `${paiement.step} — ${offre.description.slice(0, 80)}` }
        },
        quantity: 1
      }],
      success_url: `${appUrl}/client/radar/${id}?paiement=success`,
      cancel_url: `${appUrl}/client/radar/${id}?paiement=cancel`,
      metadata: { chantierPaiementId: paiement.id }
    });
    return ok({ url: session.url });
  } catch (error) {
    return badRequest(`Impossible de démarrer le paiement: ${error.message}`, 500);
  }
}
