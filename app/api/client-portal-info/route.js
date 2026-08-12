import { ok } from "../../../lib/http";
import { ADMIN_SCOPE, getUserScope, readDb } from "../../../lib/db";
import { fixText } from "../../../lib/text";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";

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
