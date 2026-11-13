import { NextResponse } from "next/server";
import { badRequest } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { adresseChantier, chantierAMoi, devisDuChantier } from "../../../lib/cloture-db";
import { ligneTache, tachesParLot } from "../../../lib/taches-chantier";
import { buildFeuilleChantierPdf } from "../../../lib/document-generator";
import { sanitizeFilename } from "../../../lib/document-generator/shared";

// « Imprimer la liste » (maquette PRO-02.7) : feuille de chantier en PDF,
// les tâches par lot avec une case à cocher, pour les compagnons sans
// téléphone. GET ?projectId=

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  const chantier = projectId ? await chantierAMoi(projectId, userId) : null;
  if (!chantier) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();
  const devis = await devisDuChantier(projectId);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const taches = (db.tasks || []).filter((t) => t.userId === userId && t.projectId === projectId);
  const lots = tachesParLot(taches, devis).map((lot) => ({
    ...lot,
    taches: lot.taches.map((t) => ({ label: t.label || "Tâche", ligne: ligneTache(t, aujourdhui), fait: Boolean(t.done) }))
  }));
  const titre = chantier.reference || "Chantier";
  const pdf = buildFeuilleChantierPdf({ chantier: { titre, adresse: adresseChantier(chantier) }, lots, devis, db, userId });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Feuille_de_chantier_${sanitizeFilename(titre)}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}
