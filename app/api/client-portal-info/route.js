import { ok, badRequest } from "../../../lib/http";
import { ADMIN_SCOPE, addHistory, getUserScope, readDb, writeDb } from "../../../lib/db";
import { fixText } from "../../../lib/text";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote, quoteToRow } from "../../../lib/quote-mapping";
import { ensureClientPortalAccess } from "../../../lib/client-portal-access";

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";

  if (!projectId || !userId) return ok({ access: null });

  const supabase = getSupabaseAdmin();
  const { data: quoteRows } = await supabase.from("quotes").select("*").eq("chantier_id", projectId);
  const quotes = (quoteRows || [])
    .map((row) => mapQuote(row))
    .filter((quote) => userId === ADMIN_SCOPE || quote.userId === userId);

  for (const quote of quotes) {
    const portalId = quote.clientPortalAccess?.portalIdentifier ||
      (quote.clientPortalUserId ? db.users.find((u) => u.id === quote.clientPortalUserId)?.portalIdentifier : null);
    const password = quote.clientPortalAccess?.password ||
      (quote.clientPortalUserId ? db.users.find((u) => u.id === quote.clientPortalUserId)?.password : null);

    if (portalId) {
      return ok({
        access: {
          portalIdentifier: fixText(portalId || ""),
          password: fixText(password || ""),
          email: fixText(quote.clientPortalEmail || quote.clientEmail || ""),
          loginUrl: fixText(quote.clientPortalLoginUrl || ""),
          quoteNumber: fixText(quote.quoteNumber || "")
        }
      });
    }
  }

  const notification = (db.notifications || []).find(
    (n) => n.projectId === projectId && n.type === "client.access.sent" && n.meta?.portalIdentifier &&
      (userId === ADMIN_SCOPE || n.userId === userId)
  );
  if (notification?.meta?.portalIdentifier) {
    return ok({
      access: {
        portalIdentifier: fixText(notification.meta.portalIdentifier || ""),
        password: fixText(notification.meta.password || ""),
        email: fixText(notification.meta.email || ""),
        loginUrl: fixText(notification.meta.loginUrl || ""),
        quoteNumber: fixText(notification.meta.quoteNumber || "")
      }
    });
  }

  return ok({ access: null });
}

// Manual fallback for a quote that was signed without an email or phone
// (both are optional on the public signature form — see
// app/signature/[token]/page.jsx), which means no client portal account was
// ever created at signing time. Lets the company add contact info after the
// fact and generate access now, reusing the exact same logic as the signing
// flow (lib/client-portal-access.js).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const projectId = String(body.projectId || "");
  const email = String(body.email || "").trim();
  const phone = String(body.phone || "").trim();
  if (!projectId) return badRequest("Chantier introuvable.");
  if (!email && !phone) return badRequest("Un email ou un numéro de téléphone est obligatoire.");

  const db = await readDb();
  const userId = await getUserScope(request, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const supabase = getSupabaseAdmin();
  const { data: quoteRows, error: fetchError } = await supabase.from("quotes").select("*").eq("chantier_id", projectId);
  if (fetchError) return badRequest(`Lecture du chantier impossible: ${fetchError.message}`, 500);

  const quotes = (quoteRows || [])
    .map((row) => mapQuote(row))
    .filter((quote) => userId === ADMIN_SCOPE || quote.userId === userId);

  const signedQuote = quotes.find((quote) => quote.signatureStatus === "Signe" || quote.status === "Signe");
  if (!signedQuote) return badRequest("Aucun devis signé pour ce chantier.");
  if (signedQuote.clientPortalAccess?.portalIdentifier || signedQuote.clientPortalUserId) {
    return badRequest("Un accès client existe déjà pour ce chantier.");
  }

  const now = new Date().toISOString();
  const clientAccess = await ensureClientPortalAccess(
    db,
    signedQuote,
    { signerEmail: email, signerPhone: phone },
    request,
    now
  );
  if (!clientAccess) return badRequest("Un email ou un numéro de téléphone est obligatoire.");

  const updated = {
    ...signedQuote,
    clientPortalUserId: clientAccess.userId,
    clientPortalEmail: clientAccess.email,
    clientPortalPhone: clientAccess.phone,
    clientPortalLoginUrl: clientAccess.loginUrl,
    clientPortalAccessSentAt: now,
    clientPortalAccess: clientAccess
  };

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
    label: `Acces client cree manuellement: ${updated.quoteNumber}`,
    entityId: updated.id,
    entityType: "quote",
    meta: { clientUserId: clientAccess.userId, email: clientAccess.email, phone: clientAccess.phone }
  });

  await writeDb(db);

  const row = quoteToRow(updated, updated.userId);
  const { error: updateError } = await supabase.from("quotes").update(row).eq("id", updated.id);
  if (updateError) return badRequest(`Enregistrement de l'accès impossible: ${updateError.message}`, 500);

  return ok({
    access: {
      portalIdentifier: fixText(clientAccess.portalIdentifier || ""),
      password: fixText(clientAccess.password || ""),
      email: fixText(clientAccess.email || ""),
      loginUrl: fixText(clientAccess.loginUrl || ""),
      quoteNumber: fixText(updated.quoteNumber || "")
    }
  }, 201);
}
