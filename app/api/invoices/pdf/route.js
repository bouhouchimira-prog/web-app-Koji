import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../../lib/db";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../../lib/document-generator";

// Same lightweight chantier shape used by /api/invoices — quotes/chantiers
// live in Supabase, invoices stay local, so this just enriches the PDF when
// the invoice is tied to a real quote and/or chantier (quote-based invoices
// always are; intervention-based invoices may or may not be).
function mapChantierLite(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.reference || "Chantier",
    reference: row.reference || "",
    address: row.street || "",
    client: row.client_email ? row.client_email.split("@")[0] : "Client",
    clientEmail: row.client_email || "",
    budgetHt: 0
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  const invoice = scopedItems(db.invoices, userId).find((item) => item.id === id);
  if (!invoice) return badRequest("Facture introuvable.", 404);

  let quote = null;
  let project = null;
  if (invoice.quoteId || invoice.projectId) {
    const supabase = getSupabaseAdmin();
    if (invoice.quoteId) {
      const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", invoice.quoteId).maybeSingle();
      if (quoteRow) quote = mapQuote(quoteRow);
    }
    if (invoice.projectId) {
      const { data: projectRow } = await supabase.from("chantiers").select("*").eq("id", invoice.projectId).maybeSingle();
      if (projectRow) project = mapChantierLite(projectRow);
    }
  }

  const pdfBuffer = buildInvoicePdf({ invoice, quote, project, db });
  const filename = invoiceDocumentFilename(invoice);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
