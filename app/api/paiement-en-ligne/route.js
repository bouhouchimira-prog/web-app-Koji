import { badRequest, ok } from "../../../lib/http";
import { getVerifiedAuth } from "../../../lib/server-auth";
import { getStripe } from "../../../lib/stripe";
import { interrupteurActif, vueComptePro } from "../../../lib/paiement-en-ligne";
import { compteDeLEntreprise, compteStripe, lienInscription, lireProfil, majBusiness, nomEntreprise, synchroniserCompte } from "../../../lib/paiement-en-ligne-serveur";

// Paiement en ligne des factures, côté entreprise (maquettes PRO-15.2 et
// PRO-06.3) : compte Stripe Connect Express de l'entreprise.
// GET → { disponible, etat, actif, detail, action, compte, encaissements, virements, tableau }
//   (état relu chez Stripe à chaque ouverture).
// POST { action: "inscription", depuis: "profil"|"encaissements"|"app" } → { url } (lien d'inscription Stripe)
// POST { action: "tableau" } → { url } (tableau de bord Express du prestataire)
// POST { action: "pause"|"reprendre" } → la vue.
// Rien n'est actif tant que Stripe n'a pas confirmé charges_enabled et payouts_enabled.

const INDISPONIBLE = "Le paiement en ligne n'est pas encore ouvert.";

async function contexte(request, body = null) {
  const auth = await getVerifiedAuth(request, body);
  if (!auth) return { erreur: badRequest("Session expirée. Reconnectez-vous.", 401) };
  const profil = await lireProfil(auth.userId);
  const type = profil?.business_info?._accountType || (profil?.is_pro === false ? "particulier" : "entreprise");
  if (!profil || type === "particulier") return { erreur: badRequest("Réservé aux comptes entreprise.", 403) };
  return { userId: auth.userId, profil, business: profil.business_info || {} };
}

export async function GET(request) {
  const cx = await contexte(request);
  if (cx.erreur) return cx.erreur;
  const actif = interrupteurActif();
  if (!actif) return ok(vueComptePro(cx.business, { actif }));
  try {
    const business = await synchroniserCompte(getStripe(), cx.userId, cx.business);
    return ok(vueComptePro(business, { actif }));
  } catch (error) {
    // Stripe injoignable : l'état enregistré, jamais « actif » par défaut.
    console.error("paiement-en-ligne GET:", error?.message);
    return ok({ ...vueComptePro(cx.business, { actif }), avertissement: "État du prestataire momentanément illisible." });
  }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const cx = await contexte(request, body);
  if (cx.erreur) return cx.erreur;
  if (!interrupteurActif()) return badRequest(INDISPONIBLE, 404);
  const action = String(body.action || "");
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return badRequest(INDISPONIBLE, 503);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

  try {
    if (action === "inscription") {
      const depuis = ["profil", "encaissements", "app"].includes(body.depuis) ? body.depuis : "profil";
      const accountId = await compteDeLEntreprise(stripe, { userId: cx.userId, email: cx.profil.email || "", nom: nomEntreprise(cx.profil), business: cx.business });
      return ok({ url: await lienInscription(stripe, accountId, appUrl, depuis) });
    }
    if (action === "tableau") {
      const compte = await compteStripe(stripe, cx.business._stripeConnectAccountId);
      if (!compte || !compte.details_submitted) return badRequest("Terminez d'abord l'inscription chez le prestataire.", 409);
      // Compte Standard créé avant le 19 nov. (échéancier du Radar) : tableau de bord Stripe complet.
      if (compte.type === "standard") return ok({ url: "https://dashboard.stripe.com/" });
      const lien = await stripe.accounts.createLoginLink(compte.id);
      return ok({ url: lien.url });
    }
    if (action === "pause" || action === "reprendre") {
      const business = await majBusiness(cx.userId, { _paiementEnLigneSuspendu: action === "pause" });
      return ok(vueComptePro(await synchroniserCompte(stripe, cx.userId, business || cx.business), { actif: true }));
    }
    return badRequest("Action inconnue.");
  } catch (error) {
    console.error("paiement-en-ligne POST:", error?.message);
    return badRequest("Le prestataire de paiement ne répond pas. Réessayez dans un instant.", 502);
  }
}
