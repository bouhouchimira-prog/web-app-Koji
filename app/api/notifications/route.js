import { ok, badRequest } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";
import { sendClientAccessEmail } from "../../../lib/mailer";

function normalizeNotification(notification) {
  return {
    ...fixObjectText(notification),
    read: Boolean(notification.read),
    archived: Boolean(notification.archived)
  };
}

// A company/entreprise account must only see notifications addressed to itself.
// Worker- and client-audience notifications share the company's userId for
// multi-tenant scoping, so without this filter they'd leak into the owner's
// own notification center even though they were sent BY that owner, not TO them.
function isCompanyAccount(db, requesterId) {
  const user = db.users.find((u) => u.id === requesterId);
  return !user || user.accountType !== "particulier";
}

function forRequester(items, db, requesterId) {
  if (!isCompanyAccount(db, requesterId)) return items;
  return items.filter((n) => n.audience !== "worker" && n.accountType !== "particulier");
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  const requesterId = new URL(request.url).searchParams.get("userId") || "";
  const items = forRequester(scopedItems(db.notifications, userId), db, requesterId);
  return ok({ notifications: items.map(normalizeNotification) });
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const now = new Date().toISOString();

  if (body.action === "read-all") {
    const items = forRequester(scopedItems(db.notifications, userId), db, body.userId || "");
    items.forEach((n) => { n.read = true; n.updatedAt = now; });
    await writeDb(db);
    return ok({ updated: true });
  }

  const index = findScopedIndex(db.notifications, body.id, userId);
  if (index === -1) return ok({ error: "Notification introuvable." }, 404);

  const notification = db.notifications[index];

  if (body.action === "resend-email") {
    const meta = notification.meta || {};
    const email = body.email || meta.email;
    if (!email) return badRequest("Aucune adresse email disponible pour ce destinataire.");
    const sent = await sendClientAccessEmail({
      email,
      identifier: meta.portalIdentifier,
      password: meta.password,
      loginUrl: meta.loginUrl,
      quoteNumber: meta.quoteNumber
    });
    if (!sent) return badRequest("Envoi impossible — configuration email (SMTP) manquante ou invalide.", 502);
    return ok({ sent: true });
  }

  if (body.action === "read")    { notification.read = true;  notification.updatedAt = now; }
  if (body.action === "unread")  { notification.read = false; notification.updatedAt = now; }
  if (body.action === "archive") { notification.archived = true; notification.read = true; notification.updatedAt = now; }
  if (body.action === "unarchive") { notification.archived = false; notification.updatedAt = now; }
  if (body.action === "delete")  {
    db.notifications.splice(index, 1);
    await writeDb(db);
    return ok({ deleted: true });
  }

  db.notifications[index] = notification;
  await writeDb(db);
  return ok({ notification: normalizeNotification(notification) });
}
