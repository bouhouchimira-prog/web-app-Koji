import { ok } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";

function normalizeNotification(notification) {
  return {
    ...fixObjectText(notification),
    read: Boolean(notification.read)
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
  const index = findScopedIndex(db.notifications, body.id, userId);
  if (index === -1) return ok({ error: "Notification introuvable." }, 404);

  const notification = db.notifications[index];
  if (body.action === "read") notification.read = true;
  if (body.action === "unread") notification.read = false;
  notification.updatedAt = new Date().toISOString();
  db.notifications[index] = notification;
  await writeDb(db);
  return ok({ notification: normalizeNotification(notification) });
}
