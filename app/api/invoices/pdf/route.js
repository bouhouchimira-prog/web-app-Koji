import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../../lib/db";
import { loadInvoiceContext } from "../../../../lib/invoice-context";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../../lib/document-generator";

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  const invoice = scopedItems(db.invoices, userId).find((item) => item.id === id);
  if (!invoice) return badRequest("Facture introuvable.", 404);

  const { quote, project } = await loadInvoiceContext(invoice);
  const pdfBuffer = buildInvoicePdf({ invoice, quote, project, db });
  const filename = invoiceDocumentFilename(invoice);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
