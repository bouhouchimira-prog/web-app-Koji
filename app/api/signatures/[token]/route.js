import { ok, badRequest } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";
import { ensureChantierForQuote, generateTasksForSignedQuote } from "../../../../lib/quote-projects";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote, quoteToRow } from "../../../../lib/quote-mapping";
import { ensureClientPortalAccess, normalizeEmail } from "../../../../lib/client-portal-access";

// The signing client has no Koji session (they're not one of the company's
// Supabase-authenticated users), so this can't use a per-user token — it
// looks up the quote across all users via the service_role key, same as the
// client-portal routes.
async function findQuoteByToken(token) {
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("web_extras->>signatureToken", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return row ? mapQuote(row) : null;
}

export async function GET(_request, context) {
  const { token } = await context.params;
  const quote = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);

  return ok({
    quote: {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      client: fixText(quote.client),
      clientEmail: quote.clientEmail,
      project: fixText(quote.project),
      rooms: fixObjectText(quote.rooms || []),
      items: fixObjectText(quote.items || []),
      totalHt: quote.totalHt,
      totalTtc: quote.totalTtc,
      status: quote.status,
      signatureStatus: quote.signatureStatus,
      sentAt: quote.sentAt,
      signedAt: quote.signedAt,
      signerName: quote.signerName,
      clientPhone: fixText(quote.clientPhone || ""),
      clientPortalUserId: quote.clientPortalUserId || "",
      clientPortalAccessSentAt: quote.clientPortalAccessSentAt || "",
      signaturePlace: fixText(quote.signaturePlace || ""),
      signerMessage: fixText(quote.signerMessage || "")
    }
  });
}

export async function POST(request, context) {
  const { token } = await context.params;
  const body = await request.json();
  const quote = await findQuoteByToken(token);
  if (!quote) return badRequest("Lien de signature invalide.", 404);
  if (quote.signatureStatus === "Signe") return ok({ quote: fixObjectText(quote), clientAccess: quote.clientPortalAccess || null });
  if (!body.consent) return badRequest("La validation client est obligatoire.");

  const now = new Date().toISOString();
  const updated = {
    ...quote,
    status: "Signe",
    signatureStatus: "Signe",
    signerName: fixText(body.signerName || quote.client || "Client"),
    signerEmail: normalizeEmail(body.signerEmail || quote.clientEmail || ""),
    clientEmail: normalizeEmail(body.signerEmail || quote.clientEmail || ""),
    clientPhone: fixText(body.signerPhone || quote.clientPhone || ""),
    signaturePlace: fixText(body.signaturePlace || ""),
    signerMessage: fixText(body.signerMessage || ""),
    signedAt: now,
    updatedAt: now
  };

  const supabase = getSupabaseAdmin();
  const db = await readDb();
  updated.projectId = await ensureChantierForQuote(supabase, updated, now);
  generateTasksForSignedQuote(db, updated, now);
  if (updated.projectId) {
    await supabase.from("chantiers").update({ status: "Signe" }).eq("id", updated.projectId);
  }

  db.notifications.unshift({
    id: `notif-quote-signed-${updated.id}-${Date.now()}`,
    userId: updated.userId || "",
    type: "quote.signed",
    title: "Devis signé",
    message: `Votre devis N° : ${updated.quoteNumber} a été signé par ${updated.signerName || updated.client || "votre client"}.`,
    quoteId: updated.id,
    projectId: updated.projectId || "",
    actionUrl: `/devis?id=${updated.id}`,
    actionLabel: "Voir le devis",
    meta: { signerName: updated.signerName || "", quoteNumber: updated.quoteNumber || "" },
    read: false,
    createdAt: now
  });

  addHistory(db, {
    userId: updated.userId || "",
    type: "quote.signed",
    label: `Devis signé : ${updated.quoteNumber}`,
    entityId: updated.id,
    entityType: "quote",
    meta: { signerName: updated.signerName, signerEmail: updated.signerEmail }
  });

  const clientAccess = await ensureClientPortalAccess(db, updated, body, request, now);
  if (clientAccess) {
    updated.clientPortalUserId = clientAccess.userId;
    updated.clientPortalEmail = clientAccess.email;
    updated.clientPortalPhone = clientAccess.phone;
    updated.clientPortalLoginUrl = clientAccess.loginUrl;
    updated.clientPortalAccessSentAt = now;
    updated.clientPortalAccess = clientAccess;

    db.notifications.unshift({
      id: `notif-client-access-${updated.id}-${Date.now()}`,
      userId: updated.userId || "",
      type: "client.access.sent",
      title: "Accès espace particulier envoyé",
      message: `L'identifiant ${clientAccess.portalIdentifier || ""} a été envoyé au client pour suivre le chantier.`,
      quoteId: updated.id,
      projectId: updated.projectId || "",
      actionUrl: updated.projectId ? `/chantiers?project=${updated.projectId}` : "",
      actionLabel: "Voir le chantier",
      meta: {
        portalIdentifier: clientAccess.portalIdentifier || "",
        password: clientAccess.password || "",
        email: clientAccess.email || "",
        phone: clientAccess.phone || "",
        loginUrl: clientAccess.loginUrl || "",
        quoteNumber: updated.quoteNumber || ""
      },
      read: false,
      createdAt: now
    });

    addHistory(db, {
      userId: updated.userId || "",
      type: "client.access.sent",
      label: `Acces client envoye: ${updated.quoteNumber}`,
      entityId: updated.id,
      entityType: "quote",
      meta: { clientUserId: clientAccess.userId, email: clientAccess.email, phone: clientAccess.phone }
    });
  }

  await writeDb(db);

  const row = quoteToRow(updated, updated.userId);
  const { data: updatedRow, error } = await supabase.from("quotes").update(row).eq("id", updated.id).select().single();
  if (error) return badRequest(`Enregistrement de la signature impossible: ${error.message}`, 500);

  return ok({ quote: fixObjectText(mapQuote(updatedRow)), clientAccess });
}

