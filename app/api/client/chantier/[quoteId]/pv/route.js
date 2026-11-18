import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { devisDuParticulier } from "../../../../../../lib/chantier-client-serveur";
import { clotureDe, devisDuChantier, telechargerDataUrl } from "../../../../../../lib/cloture-db";
import { buildPvReceptionPdf, pvReceptionFilename } from "../../../../../../lib/document-generator";
import { avecProfil } from "../../../../../../lib/document-profil.js";

// Procès-verbal de réception dans Koji Client (maquette CLI-02, Documents) :
// le même PDF que GET /api/cloture?pdf=1 côté entreprise, pour le
// particulier connecté à qui appartient le devis du chantier.
export async function GET(request, context) {
  const { quoteId } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const trouve = await devisDuParticulier(client, String(quoteId || "")).catch(() => null);
  if (!trouve?.chantierRow) return badRequest("Chantier introuvable.", 404);
  const { chantierRow: chantier } = trouve;
  const { db } = client;
  const cloture = clotureDe(db, chantier.id, chantier.user_id);
  if (!cloture?.pv?.signeLe) return badRequest("Le procès-verbal n'est pas encore signé.", 404);
  await avecProfil(db, chantier.user_id);
  const pdf = buildPvReceptionPdf({
    pv: { ...cloture.pv, signatureClient: await telechargerDataUrl(cloture.pv.signatureClient), signaturePro: await telechargerDataUrl(cloture.pv.signaturePro) },
    chantier: { titre: chantier.reference || "Chantier", adresse: [chantier.street, chantier.postal_code, chantier.city].filter(Boolean).join(", ") },
    quote: await devisDuChantier(chantier.id),
    db,
    userId: chantier.user_id
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pvReceptionFilename(cloture.pv)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
