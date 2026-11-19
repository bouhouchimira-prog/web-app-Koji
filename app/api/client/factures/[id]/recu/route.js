import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { buildRecuPdf, recuFilename } from "../../../../../../lib/document-generator";
import { avecProfil } from "../../../../../../lib/document-profil.js";
import { paiementsEnLigne } from "../../../../../../lib/paiement-en-ligne";
import { factureDuClient } from "../../../../../../lib/paiement-en-ligne-serveur";

// Koji Client · Documents : le reçu d'un paiement en ligne (« le reçu
// arrive dans Documents », maquette CLI-02), seulement pour le particulier
// à qui appartient la facture. GET ?paiement=<id> → PDF.
export async function GET(request, context) {
  const { id } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const trouve = await factureDuClient(client, id);
  if (!trouve) return badRequest("Reçu introuvable.", 404);
  const { invoice, quote, project } = trouve;
  const paiementId = new URL(request.url).searchParams.get("paiement") || "";
  const paiement = paiementsEnLigne(invoice).find((p) => p.id === paiementId);
  if (!paiement) return badRequest("Reçu introuvable.", 404);

  await avecProfil(client.db, invoice.userId);
  const pdf = buildRecuPdf({ invoice, paiement, resteFacture: Number(paiement.resteFacture) || 0, resteChantier: paiement.resteChantier ?? null, quote, project, db: client.db });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${recuFilename(invoice, paiement)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
