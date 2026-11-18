import { badRequest, ok } from "../../../../../lib/http";
import { clientConnecte } from "../../../../../lib/projets-client-serveur";
import { vueChantierDuClient } from "../../../../../lib/chantier-client-serveur";

// Koji Client · un devis ou un chantier du particulier (maquette CLI-02) :
// onglets Devis, Chantier, Paiements, Documents, avec les libellés déjà
// fabriqués (lib/chantier-client.js). Le site et l'app Koji lisent la même
// réponse. Réservé au particulier connecté à qui le devis appartient.
export async function GET(request, context) {
  const { quoteId } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    const vue = await vueChantierDuClient(client, String(quoteId || ""));
    if (!vue) return badRequest("Devis introuvable.", 404);
    return ok(vue);
  } catch (error) {
    return badRequest(error.message || "Lecture du chantier impossible.", 500);
  }
}
