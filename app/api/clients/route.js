import { badRequest, ok } from "../../../lib/http";
import { findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { fixObjectText, fixText } from "../../../lib/text";

function normalizeClient(client) {
  return fixObjectText(client);
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const clients = scopedItems(db.clients || [], userId)
    .map(normalizeClient)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr"));
  return ok({ clients });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.name || !String(body.name).trim()) return badRequest("Le nom du client est requis.");

  if (!Array.isArray(db.clients)) db.clients = [];

  const client = {
    id: `cli-${Date.now()}`,
    userId,
    name: fixText(body.name),
    email: fixText(body.email || ""),
    phone: fixText(body.phone || ""),
    address: fixText(body.address || ""),
    notes: fixText(body.notes || ""),
    createdAt: new Date().toISOString()
  };

  db.clients.unshift(client);
  await writeDb(db);
  return ok({ client: normalizeClient(client) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!Array.isArray(db.clients)) return badRequest("Client introuvable.", 404);

  if (body.action === "delete") {
    const index = findScopedIndex(db.clients, body.id, userId);
    if (index === -1) return badRequest("Client introuvable.", 404);
    db.clients.splice(index, 1);
    await writeDb(db);
    return ok({ success: true });
  }

  const index = findScopedIndex(db.clients, body.id, userId);
  if (index === -1) return badRequest("Client introuvable.", 404);

  if (body.name !== undefined) db.clients[index].name = fixText(body.name);
  if (body.email !== undefined) db.clients[index].email = fixText(body.email);
  if (body.phone !== undefined) db.clients[index].phone = fixText(body.phone);
  if (body.address !== undefined) db.clients[index].address = fixText(body.address);
  if (body.notes !== undefined) db.clients[index].notes = fixText(body.notes);
  db.clients[index].updatedAt = new Date().toISOString();

  await writeDb(db);
  return ok({ client: normalizeClient(db.clients[index]) });
}
