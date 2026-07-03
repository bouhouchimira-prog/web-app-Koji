import { ok } from "../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../lib/db";
import { fixText } from "../../../lib/text";

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";

  if (!projectId) return ok({ access: null });

  const quotes = scopedItems(db.quotes, userId).filter(
    (quote) => quote.projectId === projectId || quote.status === "Signe" || quote.signatureStatus === "Signe"
  );

  for (const quote of quotes) {
    if (quote.projectId !== projectId) continue;

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
    (n) => n.projectId === projectId && n.type === "client.access.sent" && n.meta?.portalIdentifier
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
