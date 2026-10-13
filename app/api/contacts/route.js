import { badRequest, ok } from "../../../lib/http";
import { addHistory, findScopedIndex, getUserScope, readDb, resolveUserId, scopedItems, writeDb } from "../../../lib/db";
import { fixObjectText, fixText } from "../../../lib/text";
import { CONTACT_ROLES, contactDisplayName, findSimilarContacts } from "../../../lib/contacts";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { createOrResetClientPortalAccount } from "../../../lib/client-portal-access";

function normalizeContact(item) {
  return fixObjectText(item);
}

function hasLinkedDocuments(db, contactId, quotes = []) {
  if (db.invoices.some((invoice) => invoice.contactId === contactId)) return true;
  if (db.interventions.some((intervention) => intervention.contactId === contactId)) return true;
  if (db.chantierContacts.some((link) => link.contactId === contactId)) return true;
  if (quotes.some((quote) => quote.contactId === contactId)) return true;
  return false;
}

export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const role = url.searchParams.get("role") || "";

  let items = scopedItems(db.contacts, userId);
  if (!includeArchived) items = items.filter((contact) => !contact.archived);
  if (role) items = items.filter((contact) => Array.isArray(contact.roles) && contact.roles.includes(role));
  // Note : les contacts de role "client" restent renvoyes ici sans filtre
  // explicite — necessaire pour DevisEditor.jsx (selecteur de contact a la
  // creation d'un devis, qui lit /api/contacts sans parametre). C'est
  // app/contacts/page.jsx qui les masque de SA liste (12 oct, demande
  // d'Amira : les clients ont leur propre page /clients), pas l'API.

  items = items.slice().sort((a, b) => contactDisplayName(a).localeCompare(contactDisplayName(b), "fr"));
  return ok({ contacts: items.map(normalizeContact) });
}

export async function POST(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const now = new Date().toISOString();

  const type = body.type === "societe" ? "societe" : "particulier";
  const roles = Array.isArray(body.roles) ? body.roles.filter((role) => CONTACT_ROLES.includes(role)) : [];

  const contact = {
    id: `contact-${Date.now()}`,
    userId,
    type,
    firstName: fixText(body.firstName || ""),
    lastName: fixText(body.lastName || ""),
    companyName: fixText(body.companyName || ""),
    siret: fixText(body.siret || ""),
    contactPerson: fixText(body.contactPerson || ""),
    phone: fixText(body.phone || ""),
    email: fixText(body.email || ""),
    address: fixText(body.address || ""),
    city: fixText(body.city || ""),
    postalCode: fixText(body.postalCode || ""),
    floor: fixText(body.floor || ""),
    accessCode: fixText(body.accessCode || ""),
    complement: fixText(body.complement || ""),
    accessInstructions: fixText(body.accessInstructions || ""),
    notes: fixText(body.notes || ""),
    roles,
    linkedUserId: body.linkedUserId || "",
    archived: false,
    archivedAt: "",
    createdAt: now,
    updatedAt: now
  };

  const displayName = contactDisplayName(contact);
  if (!displayName) return badRequest("Nom ou raison sociale obligatoire.", 400);

  const similar = findSimilarContacts(scopedItems(db.contacts, userId), contact);

  db.contacts.unshift(contact);
  addHistory(db, {
    userId,
    type: "contact.created",
    label: `Contact cree: ${displayName}`,
    entityId: contact.id,
    entityType: "contact"
  });
  await writeDb(db);

  return ok({ contact: normalizeContact(contact), similar: similar.map(normalizeContact) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  const index = findScopedIndex(db.contacts, body.id, userId);
  if (index === -1) return badRequest("Contact introuvable.", 404);

  const contact = db.contacts[index];
  const action = body.action || "update";

  if (action === "createAccess" || action === "resetCredentials") {
    const access = await createOrResetClientPortalAccount(db, contact, request);
    if (!access) return badRequest("Un email ou un téléphone est nécessaire pour créer l'accès.", 400);
    contact.linkedUserId = access.userId;
    contact.updatedAt = new Date().toISOString();
    db.contacts[index] = contact;
    addHistory(db, {
      userId: contact.userId || userId,
      type: action === "createAccess" ? "contact.access_created" : "contact.access_reset",
      label: `Accès client ${action === "createAccess" ? "créé" : "régénéré"}: ${contactDisplayName(contact)}`,
      entityId: contact.id,
      entityType: "contact"
    });
    await writeDb(db);
    return ok({ contact: normalizeContact(contact), access });
  }

  if (action === "delete") {
    const quotes = await readQuotesForUser(contact.userId || userId);
    if (hasLinkedDocuments(db, contact.id, quotes)) {
      return badRequest("Ce contact a des documents lies : archivez-le plutot que de le supprimer.", 400);
    }
    db.contacts.splice(index, 1);
    addHistory(db, {
      userId: contact.userId || userId,
      type: "contact.deleted",
      label: `Contact supprime: ${contactDisplayName(contact)}`,
      entityId: contact.id,
      entityType: "contact"
    });
    await writeDb(db);
    return ok({ contact: { ...normalizeContact(contact), deleted: true } });
  }

  if (action === "archive") {
    contact.archived = true;
    contact.archivedAt = new Date().toISOString();
  } else if (action === "restore") {
    contact.archived = false;
    contact.archivedAt = "";
  } else {
    for (const key of ["type", "firstName", "lastName", "companyName", "siret", "contactPerson", "phone", "email", "address", "city", "postalCode", "floor", "accessCode", "complement", "accessInstructions", "notes", "linkedUserId"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) contact[key] = fixObjectText(body[key]);
    }
    if (Object.prototype.hasOwnProperty.call(body, "roles") && Array.isArray(body.roles)) {
      contact.roles = body.roles.filter((role) => CONTACT_ROLES.includes(role));
    }
  }

  contact.updatedAt = new Date().toISOString();
  db.contacts[index] = contact;

  addHistory(db, {
    userId: contact.userId || userId,
    type: `contact.${action}`,
    label: `Contact ${action === "archive" ? "archive" : action === "restore" ? "restaure" : "mis a jour"}: ${contactDisplayName(contact)}`,
    entityId: contact.id,
    entityType: "contact"
  });

  await writeDb(db);
  return ok({ contact: normalizeContact(contact) });
}

// Quotes live in Supabase, not the koji_web_state blob — the delete-guard
// needs to check them too. Mirrors the same read app/api/contacts/[id]/history/route.js
// does.
async function readQuotesForUser(userId) {
  if (!userId) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("quotes").select("*").eq("user_id", userId);
  if (error || !data) return [];
  return data.map(mapQuote);
}
