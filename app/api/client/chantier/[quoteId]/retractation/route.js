import { badRequest, ok } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { devisDuParticulier, vueChantierDuClient } from "../../../../../../lib/chantier-client-serveur";
import { retracterDevis } from "../../../../../../lib/retractation-devis";

// « Me rétracter » depuis l'onglet Devis de Koji Client (maquette PRO-03.7) :
// le particulier connecté annule un devis signé qui lui appartient, dans le
// délai. Même enregistrement que le lien de signature
// (lib/retractation-devis.js). POST sans corps → { ok:true, vue } (même forme
// que GET /api/client/chantier/[quoteId]) ; 409 si le délai est passé ou si
// le devis n'est pas signé.
export async function POST(request, context) {
  const { quoteId } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    const trouve = await devisDuParticulier(client, String(quoteId || ""));
    if (!trouve) return badRequest("Devis introuvable.", 404);
    const resultat = await retracterDevis(trouve.row, { origine: "espace" });
    if (resultat.erreur) return badRequest(resultat.erreur, resultat.code);
    return ok({ ok: true, vue: await vueChantierDuClient(client, trouve.quote.id) });
  } catch (error) {
    return badRequest(error.message || "La rétractation n'a pas pu être enregistrée.", 500);
  }
}
