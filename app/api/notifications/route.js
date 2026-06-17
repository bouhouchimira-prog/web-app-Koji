import { ok } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";

function normalizeNotification(notification) {
  return {
    ...fixObjectText(notification),
    read: Boolean(notification.read),
    archived: Boolean(notification.archived)
  };
}

export async function GET(request) {
  const db = await readDb();
  const userId = getUserScope(request, db);
  return ok({ notifications: scopedItems(db.notifications, userId).map(normalizeNotification) });
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = resolveUserId(body.userId || "", db);
  const now = new Date().toISOString();

  if (body.action === "read-all") {
    const items = scopedItems(db.notifications, userId);
    items.forEach((n) => { n.read = true; n.updatedAt = now; });
    await writeDb(db);
    return ok({ updated: true });
  }

  const index = findScopedIndex(db.notifications, body.id, userId);
  if (index === -1) return ok({ error: "Notification introuvable." }, 404);

  const notification = db.notifications[index];

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
