import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixText } from "../../../lib/text";

function normalizeLink(item) {
  return item;
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const contactId = url.searchParams.get("contactId") || "";

  let items = scopedItems(db.chantierContacts, userId);
  if (projectId) items = items.filter((link) => link.projectId === projectId);
  if (contactId) items = items.filter((link) => link.contactId === contactId);

  return ok({ chantierContacts: items.map(normalizeLink) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.contactId || !body.projectId) return badRequest("Contact et chantier obligatoires.", 400);

  const now = new Date().toISOString();

  // Avoid duplicating the same contact/chantier/role combination if the
  // originating quote is re-saved multiple times (e.g. DevisEditor autosave).
  const existing = db.chantierContacts.find((link) =>
    link.userId === userId
    && link.contactId === body.contactId
    && link.projectId === body.projectId
    && (link.roleOnSite || "") === fixText(body.roleOnSite || ""));
  if (existing) return ok({ chantierContact: normalizeLink(existing) }, 200);

  const link = {
    id: `cc-${Date.now()}`,
    userId,
    contactId: body.contactId,
    projectId: body.projectId,
    roleOnSite: fixText(body.roleOnSite || ""),
    addedAt: now
  };

  db.chantierContacts.unshift(link);
  addHistory(db, {
    userId,
    type: "chantierContact.created",
    label: `Intervenant ajoute au chantier (${link.roleOnSite || "role non precise"})`,
    entityId: link.id,
    entityType: "chantierContact",
    meta: { contactId: link.contactId, projectId: link.projectId }
  });
  await writeDb(db);

  return ok({ chantierContact: normalizeLink(link) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.chantierContacts, body.id, userId);
  if (index === -1) return badRequest("Lien introuvable.", 404);

  const link = db.chantierContacts[index];

  if (body.action === "delete") {
    db.chantierContacts.splice(index, 1);
    addHistory(db, {
      userId: link.userId || userId,
      type: "chantierContact.deleted",
      label: "Intervenant retire du chantier",
      entityId: link.id,
      entityType: "chantierContact"
    });
    await writeDb(db);
    return ok({ chantierContact: { ...normalizeLink(link), deleted: true } });
  }

  if (Object.prototype.hasOwnProperty.call(body, "roleOnSite")) link.roleOnSite = fixText(body.roleOnSite || "");
  db.chantierContacts[index] = link;
  await writeDb(db);
  return ok({ chantierContact: normalizeLink(link) });
}
