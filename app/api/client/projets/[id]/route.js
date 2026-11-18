import { badRequest, ok } from "../../../../../lib/http";
import { clientConnecte, vueComparaison } from "../../../../../lib/projets-client-serveur";

// Koji Client · « Comparer les propositions » d'une demande (maquette
// CLI-01). Réservé au particulier qui a publié la demande. Aucun prix
// calculé par Koji : seulement ceux des entreprises.
export async function GET(request, context) {
  const { id } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    const vue = await vueComparaison(client, String(id || ""));
    if (!vue) return badRequest("Projet introuvable.", 404);
    return ok(vue);
  } catch (error) {
    return badRequest(error.message || "Lecture des propositions impossible.", 500);
  }
}
