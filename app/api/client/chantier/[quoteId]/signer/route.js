import { badRequest, ok } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { devisDuParticulier, vueChantierDuClient } from "../../../../../../lib/chantier-client-serveur";
import { estASigner } from "../../../../../../lib/projets-client";
import { signatureAccessExpired } from "../../../../../../lib/signature-session";
import { signerDevisEnLigne } from "../../../../../../lib/signature-en-ligne";

// Signer un devis depuis l'onglet Devis de Koji Client (maquette CLI-02) :
// le particulier connecté signe un devis envoyé qui lui appartient. Même
// enregistrement et mêmes preuves que le lien de signature (CLI-07) :
// lib/signature-en-ligne.js.
// POST { signerName, mentionTva, demandeExpresse, consent, signature (PNG) }
// → la vue complète de la page (comme GET /api/client/chantier/[quoteId]).
export async function POST(request, context) {
  const { quoteId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    const trouve = await devisDuParticulier(client, String(quoteId || ""));
    if (!trouve) return badRequest("Devis introuvable.", 404);
    const { quote } = trouve;
    if (!estASigner(quote) || quote.signatureStatus === "Signe") return badRequest("Ce devis n'est pas à signer.", 409);
    if (signatureAccessExpired(quote)) return badRequest("Ce devis a expiré. Demandez une nouvelle version à l'entreprise.", 410);
    // L'exemplaire part à l'adresse du compte (sinon celle du devis) ; le nom
    // vient du formulaire.
    const compte = String(client.user.email || "").trim();
    const resultat = await signerDevisEnLigne({
      quote,
      body: {
        signerName: body.signerName,
        signerEmail: compte && !compte.endsWith("@koji.local") ? compte : quote.clientEmail,
        mentionTva: body.mentionTva === true,
        demandeExpresse: body.demandeExpresse === true,
        consent: body.consent === true,
        signature: body.signature
      },
      request,
      origine: "espace"
    });
    if (resultat.erreur) return badRequest(resultat.erreur, resultat.code);
    return ok({ ok: true, exemplaire: resultat.exemplaire, vue: await vueChantierDuClient(client, quote.id) });
  } catch (error) {
    return badRequest(error.message || "La signature n'a pas pu être enregistrée.", 500);
  }
}
