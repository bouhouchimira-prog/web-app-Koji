import { NextResponse } from "next/server";
import { badRequest } from "../../../../../../lib/http";
import { readDb } from "../../../../../../lib/db";
import { getSupabaseAdmin } from "../../../../../../lib/supabase";
import { mapQuote } from "../../../../../../lib/quote-mapping";
import { getVerifiedPortalUserId } from "../../../../../../lib/portal-session";
import { buildQuotePdf, quoteDocumentFilename } from "../../../../../../lib/document-generator";
import { fixObjectText } from "../../../../../../lib/text";

// Client-portal equivalent of app/api/quotes/[id]/documents/route.js: that
// route requires a company Supabase session (getAuth), which a particulier
// portal session never has, so a client downloading their own signed devis
// needs its own auth path — reads via service_role like app/api/client/quotes
// does, and applies the same ownership check before generating anything.

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}

export async function GET(request, context) {
  const { id } = await context.params;
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return badRequest("Profil client introuvable.", 404);
  const email = normalizeEmail(user.email);

  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (error || !row) return badRequest("Devis introuvable.", 404);
  const quote = fixObjectText(mapQuote(row));

  let project = {};
  if (quote.projectId) {
    const { data: chantierRow } = await supabase.from("chantiers").select("*").eq("id", quote.projectId).maybeSingle();
    if (chantierRow) {
      project = {
        title: chantierRow.reference || "Chantier",
        reference: chantierRow.reference || "",
        client: chantierRow.client_email ? chantierRow.client_email.split("@")[0] : "",
        address: [chantierRow.street, chantierRow.postal_code, chantierRow.city].filter(Boolean).join(", "),
        city: chantierRow.city || ""
      };
    }
  }
  project = fixObjectText(project);

  if (!quoteBelongsToClient(quote, project, user, email)) {
    return badRequest("Devis introuvable pour ce profil client.", 404);
  }

  const filename = quoteDocumentFilename(quote, "quote", "pdf");
  const buffer = buildQuotePdf({ quote, project, db, documentType: "devis" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
