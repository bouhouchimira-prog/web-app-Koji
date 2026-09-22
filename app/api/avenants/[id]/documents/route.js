import { NextResponse } from "next/server";
import { badRequest } from "../../../../../lib/http";
import { readDb, scopedItems } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/server-auth";
import { mapQuote } from "../../../../../lib/quote-mapping";
import { buildAvenantPdf, avenantDocumentFilename } from "../../../../../lib/document-generator";
import { fixObjectText } from "../../../../../lib/text";

export async function GET(request, context) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const inline = Boolean(url.searchParams.get("preview"));

  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const avenant = scopedItems(db.avenants, auth.userId).find((item) => item.id === id);
  if (!avenant) return badRequest("Avenant introuvable.", 404);

  const { data: quoteRow } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", avenant.quoteId)
    .maybeSingle();
  const quote = quoteRow ? fixObjectText(mapQuote(quoteRow)) : null;

  const buffer = buildAvenantPdf({ avenant: fixObjectText(avenant), quote, db });
  const filename = avenantDocumentFilename(avenant);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`
    }
  });
}
