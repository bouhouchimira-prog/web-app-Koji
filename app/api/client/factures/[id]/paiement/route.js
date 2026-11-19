import { badRequest, ok } from "../../../../../../lib/http";
import { writeDb } from "../../../../../../lib/db";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { getStripe } from "../../../../../../lib/stripe";
import { commissionCentimes, etatDepuisStripe, interrupteurActif, montantAPayer, parametresCheckout, peutEncaisser, sessionReutilisable, urlsRetour } from "../../../../../../lib/paiement-en-ligne";
import { compteStripe, factureDuClient, lireProfil, nomEntreprise } from "../../../../../../lib/paiement-en-ligne-serveur";

// Koji Client · « Payer » (maquette CLI-02) : ouvre une session Stripe
// Checkout pour le reste dû d'une facture, en charge directe sur le compte
// Stripe de l'entreprise (l'argent va à l'entreprise, jamais à Koji).
// POST { retour?: "chantier"|"paiements"|"app" } → { url }
// Le montant est toujours calculé ici (reste dû), jamais reçu du navigateur.
const INDISPONIBLE = "Le paiement en ligne n'est pas disponible pour cette facture : réglez par virement avec les coordonnées indiquées sur la facture.";

export async function POST(request, context) {
  if (!interrupteurActif()) return badRequest(INDISPONIBLE, 404);
  const body = await request.json().catch(() => ({}));
  const { id } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);

  const trouve = await factureDuClient(client, id);
  if (!trouve) return badRequest("Facture introuvable.", 404);
  const { invoice, quote } = trouve;
  const { db, user } = client;

  const montant = montantAPayer(invoice, db.invoices || []);
  if (!montant.ok) return badRequest(montant.erreur, montant.code);
  // Double clic : la session créée il y a moins de 15 s, sans rappeler Stripe.
  const recente = invoice.paiementEnLigne;
  if (recente?.url && recente.par === user.id && Number(recente.centimes) === montant.centimes && Date.now() - Date.parse(recente.creeLe || 0) < 15000) return ok({ url: recente.url });

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return badRequest(INDISPONIBLE, 503);
  }

  try {
    // État relu chez Stripe juste avant : jamais de paiement vers un compte
    // qui ne peut pas encaisser, ni vers un compte d'une autre entreprise.
    const profil = await lireProfil(invoice.userId);
    const business = profil?.business_info || {};
    const accountId = String(business._stripeConnectAccountId || "");
    const compte = await compteStripe(stripe, accountId);
    if (!compte || compte.metadata?.kojiUserId !== invoice.userId) return badRequest(INDISPONIBLE, 409);
    if (!peutEncaisser({ ...business, ...etatDepuisStripe(compte) }, { actif: true })) return badRequest(INDISPONIBLE, 409);

    // Session encore ouverte pour le même montant : on la rouvre.
    const ouverte = sessionReutilisable(invoice, montant.centimes);
    if (ouverte && ouverte.par === user.id) {
      const s = await stripe.checkout.sessions.retrieve(ouverte.sessionId, {}, { stripeAccount: accountId }).catch(() => null);
      if (s?.status === "open" && s.url) return ok({ url: s.url });
    }

    const retour = ["chantier", "paiements", "app"].includes(body.retour) ? body.retour : "chantier";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const expireLe = new Date(Date.now() + 40 * 60 * 1000).toISOString();
    const params = parametresCheckout({
      invoice,
      entrepriseNom: nomEntreprise(profil) || String(quote?.company?.name || "").trim(),
      montantCentimes: montant.centimes,
      commission: commissionCentimes(montant.centimes),
      urls: urlsRetour(appUrl, { retour, quoteId: quote?.id || invoice.quoteId || "" }),
      email: user.email,
      clientId: user.id,
      expireLe
    });
    const session = await stripe.checkout.sessions.create(params, { stripeAccount: accountId });

    invoice.paiementEnLigne = { sessionId: session.id, url: session.url, centimes: montant.centimes, expireLe, creeLe: new Date().toISOString(), par: user.id };
    await writeDb(db);
    return ok({ url: session.url });
  } catch (error) {
    console.error("paiement client:", error?.message);
    return badRequest("Le paiement n'a pas pu démarrer. Réessayez dans un instant ou réglez par virement.", 502);
  }
}
