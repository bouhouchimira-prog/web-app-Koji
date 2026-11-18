import { badRequest, ok } from "../../../../lib/http";
import { clientConnecte, vueProjets } from "../../../../lib/projets-client-serveur";

// Koji Client · « Mes projets » (maquette CLI-01) : chantiers, demandes
// publiées avec leurs propositions, brouillons, et « Ce qui vous attend ».
// Les libellés sont fabriqués ici : le site et l'app affichent les mêmes.
export async function GET(request) {
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    return ok(await vueProjets(client));
  } catch (error) {
    return badRequest(error.message || "Lecture des projets impossible.", 500);
  }
}
