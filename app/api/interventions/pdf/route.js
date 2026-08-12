import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../../lib/db";
import { buildInterventionPdf, interventionDocumentFilename } from "../../../../lib/document-generator";

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  const intervention = scopedItems(db.interventions, userId).find((item) => item.id === id);
  if (!intervention) return badRequest("Intervention introuvable.", 404);

  const pdfBuffer = buildInterventionPdf({ intervention, db });
  const filename = interventionDocumentFilename(intervention);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
