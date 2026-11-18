import { badRequest, ok } from "../../../../lib/http";
import { clientConnecte } from "../../../../lib/projets-client-serveur";
import { vuePaiementsDuClient } from "../../../../lib/chantier-client-serveur";

// Koji Client · « Paiements » (maquette CLI-02) : les factures de tous les
// chantiers du particulier, regroupées par chantier, avec les mêmes
// libellés que l'onglet Paiements d'un chantier. Pas de paiement en ligne.
export async function GET(request) {
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  try {
    return ok(await vuePaiementsDuClient(client));
  } catch (error) {
    return badRequest(error.message || "Lecture des paiements impossible.", 500);
  }
}
