import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { clientConnecte } from "../../../../../../lib/projets-client-serveur";
import { loadInvoiceContext } from "../../../../../../lib/invoice-context";
import { normalizeEmail, quoteBelongsToClient } from "../../../../../../lib/portal-acces";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../../../../lib/document-generator";
import { avecProfil } from "../../../../../../lib/document-profil.js";

// « Télécharger la facture » dans Koji Client (maquette CLI-02, Paiements et
// Documents) : le PDF d'une facture ou d'un avoir envoyé, seulement pour le
// particulier à qui appartient le devis (ou le chantier) facturé. Les
// brouillons ne sont jamais servis. Équivalent client de /api/invoices/pdf.
export async function GET(request, context) {
  const { id } = await context.params;
  const client = await clientConnecte(request);
  if (client.erreur) return badRequest(client.erreur, client.code);
  const { db, user } = client;
  const invoice = (db.invoices || []).find((f) => f.id === String(id || ""));
  if (!invoice || invoice.status === "Brouillon" || invoice.archived) return badRequest("Facture introuvable.", 404);

  const { quote, project } = await loadInvoiceContext(invoice);
  const email = normalizeEmail(user.email);
  const aLui = quote
    ? (!invoice.userId || !quote.userId || quote.userId === invoice.userId) && quoteBelongsToClient(quote, project, user, email)
    : Boolean(project && (project.userId === invoice.userId || !invoice.userId)
      && (user.clientAccess?.projectIds?.includes(project.id) || (email && normalizeEmail(project.clientEmail) === email)));
  if (!aLui) return badRequest("Facture introuvable.", 404);

  await avecProfil(db, invoice.userId);
  const pdf = buildInvoicePdf({ invoice, quote, project, db });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceDocumentFilename(invoice)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
