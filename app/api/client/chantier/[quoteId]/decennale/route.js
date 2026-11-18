import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { devisDuParticulier, entrepriseDuDevis, fichierDecennale } from "../../../../../../lib/chantier-client-serveur";

// Attestation décennale de l'entreprise (maquette CLI-02, Documents) : le
// fichier déposé dans son profil, seulement pour un particulier dont elle
// a établi le devis. Aucun autre élément du profil n'est servi.
export async function GET(request, context) {
  const { quoteId } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const trouve = await devisDuParticulier(client, String(quoteId || "")).catch(() => null);
  if (!trouve) return badRequest("Devis introuvable.", 404);
  const entreprise = await entrepriseDuDevis(client.db, trouve.quote);
  const fichier = fichierDecennale(entreprise.business);
  if (!fichier) return badRequest("Attestation non disponible.", 404);
  const extension = fichier.type === "application/pdf" ? "pdf" : fichier.type === "image/png" ? "png" : "jpg";
  return new NextResponse(fichier.octets, {
    headers: {
      "Content-Type": fichier.type,
      "Content-Disposition": `attachment; filename="attestation-decennale.${extension}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store"
    }
  });
}
