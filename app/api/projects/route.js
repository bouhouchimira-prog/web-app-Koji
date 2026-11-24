import { badRequest, ok } from "../../../lib/http";
import { readDb, updateDb } from "../../../lib/db";
import { getAuth, getVerifiedUserId } from "../../../lib/server-auth";
import { clientDuChantier, rattacherClient, resumeClient } from "../../../lib/client-du-chantier";
import { fixText } from "../../../lib/text";

// Projects live in the shared `chantiers` (+ `chantier_budgets`) tables used
// by the koji-main Flutter app, so both apps see the same chantiers.
// Mapping: title ↔ reference, address ↔ street, budgetItems ↔ chantier_budgets
// (labor = main_oeuvre, supplies = fourniture).

const CHANTIER_SELECT = "*, chantier_budgets(*)";

function toAmount(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function budgetFromItems(items = []) {
  const find = (id) => (Array.isArray(items) ? items.find((item) => item.id === id) : null) || {};
  const labor = find("labor");
  const supplies = find("supplies");
  const global = find("global");
  return {
    main_oeuvre_estimated: toAmount(labor.estimated ?? global.estimated ?? 0),
    main_oeuvre_real: toAmount(labor.real ?? 0),
    fourniture_estimated: toAmount(supplies.estimated ?? 0),
    fourniture_real: toAmount(supplies.real ?? 0)
  };
}

export function mapChantier(row) {
  const budget = Array.isArray(row.chantier_budgets) ? row.chantier_budgets[0] : row.chantier_budgets;
  const laborEstimated = toAmount(budget?.main_oeuvre_estimated);
  const laborReal = toAmount(budget?.main_oeuvre_real);
  const suppliesEstimated = toAmount(budget?.fourniture_estimated);
  const suppliesReal = toAmount(budget?.fourniture_real);
  const createdAt = row.created_at || new Date().toISOString();
  const address = [row.street, row.postal_code, row.city].filter(Boolean).join(", ");
  const title = row.reference || "Chantier";
  return {
    id: row.id,
    userId: row.user_id,
    reference: row.reference || `KOJI-${String(row.id).slice(0, 8).toUpperCase()}`,
    title,
    client: row.client_email ? row.client_email.split("@")[0] : "Client",
    clientEmail: row.client_email || "",
    address,
    // L'adresse telle qu'elle a été saisie, champ par champ.
    street: row.street || "",
    postalCode: row.postal_code || "",
    city: row.city || "",
    propertyType: row.property_type || "",
    status: row.status || "En attente",
    progress: 0,
    budgetHt: toAmount(laborEstimated + suppliesEstimated),
    budgetItems: [
      { id: "labor", label: "Main d'oeuvre", estimated: laborEstimated, real: laborReal },
      { id: "supplies", label: "Fournitures", estimated: suppliesEstimated, real: suppliesReal },
      { id: "global", label: "Budget global", estimated: toAmount(laborEstimated + suppliesEstimated), real: toAmount(laborReal + suppliesReal) }
    ],
    notes: "",
    source: "",
    dueDate: "",
    startDate: "",
    endDate: "",
    // Corbeille (16 oct) : date d'archivage, posee par l'action "archive"
    // ci-dessous, effacee par "restore" — permet un vrai compte a rebours
    // avant suppression definitive (voir supabase_web_setup.sql).
    archivedAt: row.archived_at || "",
    createdAt,
    createdDate: String(createdAt).slice(0, 10),
    createdTime: String(createdAt).slice(11, 16)
  };
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ projects: [] });

  const [{ data, error }, db] = await Promise.all([
    auth.supabase
      .from("chantiers")
      .select(CHANTIER_SELECT)
      .order("created_at", { ascending: false }),
    readDb().catch(() => null)
  ]);
  if (error) return badRequest(`Lecture des chantiers impossible: ${error.message}`, 500);
  return ok({ projects: (data || []).map((row) => ({ ...mapChantier(row), ...complements(db, row) })) });
}

// Ce que le chantier ne porte pas lui-même, lu dans le bloc partagé :
// - receptionLe : date de signature du procès-verbal de réception. C'est
//   elle qui fait passer un chantier dans « Clôturés » (lib/chantiers-liste.js,
//   site et app) ;
// - clientName, clientPhone : le client, contact du carnet rattaché au
//   chantier (lib/client-du-chantier.js).
// Une lecture impossible ne bloque pas la liste : aucun chantier n'est alors
// montré comme clôturé, et le client reste celui de l'e-mail.
function complements(db, row) {
  if (!db) return { receptionLe: "", clientName: "", clientPhone: "" };
  const cloture = (db.clotures || []).find((c) => c.userId === row.user_id && c.projectId === row.id && c.pv?.signeLe);
  const { clientName, clientPhone } = resumeClient(clientDuChantier(db, row.user_id, row.id));
  return { receptionLe: cloture?.pv?.signeLe || "", clientName, clientPhone };
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data: chantier, error } = await auth.supabase
    .from("chantiers")
    .insert({
      user_id: auth.userId,
      reference: fixText(body.title || "Nouveau chantier"),
      street: fixText(body.address || ""),
      // Code postal, ville et type de bien : saisis dans l'app (Nouveau
      // chantier), absents des créations plus anciennes.
      ...(body.postalCode ? { postal_code: fixText(String(body.postalCode)).slice(0, 12) } : {}),
      ...(body.city ? { city: fixText(String(body.city)).slice(0, 120) } : {}),
      ...(body.propertyType ? { property_type: fixText(String(body.propertyType)).slice(0, 40) } : {}),
      client_email: body.clientEmail || "",
      status: fixText(body.status || "En attente")
    })
    .select(CHANTIER_SELECT)
    .single();
  if (error) return badRequest(`Création du chantier impossible: ${error.message}`, 500);

  // Le client (nom, téléphone, e-mail) entre dans le carnet de contacts,
  // rattaché à ce chantier. Écrit dans le bloc partagé : l'identité est donc
  // vérifiée (un jeton seulement décodé ne suffit pas), et elle doit être
  // celle du propriétaire du chantier qui vient d'être créé. Un échec ici ne
  // défait pas le chantier.
  let client = { clientName: "", clientPhone: "" };
  if (body.clientName || body.clientPhone || body.clientEmail) {
    try {
      const userId = await getVerifiedUserId(request, body);
      if (userId && userId === chantier.user_id) {
        await updateDb((db) => {
          const adresse = [chantier.street, chantier.postal_code, chantier.city].filter(Boolean).join(", ");
          client = resumeClient(rattacherClient(db, userId, chantier.id, { nom: body.clientName, email: body.clientEmail, telephone: body.clientPhone, adresse }));
        });
      }
    } catch { /* le chantier existe ; le client se rattachera depuis les contacts */ }
  }

  const budget = budgetFromItems(body.budgetItems);
  if (!budget.main_oeuvre_estimated && body.budgetHt) budget.main_oeuvre_estimated = toAmount(body.budgetHt);
  const { data: budgetRow } = await auth.supabase
    .from("chantier_budgets")
    .insert({ chantier_id: chantier.id, ...budget })
    .select()
    .single();

  return ok({ project: { ...mapChantier({ ...chantier, chantier_budgets: budgetRow ? [budgetRow] : [] }), receptionLe: "", clientName: client.clientName, clientPhone: client.clientPhone } }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant du chantier manquant.");

  const action = body.action || "update";

  if (action === "delete") {
    const { data, error } = await auth.supabase
      .from("chantiers")
      .delete()
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return badRequest(`Suppression impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Chantier introuvable." }, 404);
    return ok({ project: { ...mapChantier(data), deleted: true } });
  }

  const updates = {};
  if (action === "archive") { updates.status = "Archive"; updates.archived_at = new Date().toISOString(); }
  else if (action === "finish") updates.status = "Termine";
  else if (action === "restore") { updates.status = fixText(body.status || "A planifier"); updates.archived_at = null; }
  else {
    if (Object.prototype.hasOwnProperty.call(body, "title")) updates.reference = fixText(body.title);
    if (Object.prototype.hasOwnProperty.call(body, "address")) updates.street = fixText(body.address);
    if (Object.prototype.hasOwnProperty.call(body, "clientEmail")) updates.client_email = body.clientEmail || "";
    if (Object.prototype.hasOwnProperty.call(body, "status")) updates.status = fixText(body.status);
  }

  let chantier;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await auth.supabase
      .from("chantiers")
      .update(updates)
      .eq("id", body.id)
      .select(CHANTIER_SELECT)
      .maybeSingle();
    if (error) return badRequest(`Mise à jour impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Chantier introuvable." }, 404);
    chantier = data;
  } else {
    const { data, error } = await auth.supabase
      .from("chantiers")
      .select(CHANTIER_SELECT)
      .eq("id", body.id)
      .maybeSingle();
    if (error) return badRequest(`Lecture impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Chantier introuvable." }, 404);
    chantier = data;
  }

  if (Object.prototype.hasOwnProperty.call(body, "budgetItems") || Object.prototype.hasOwnProperty.call(body, "budgetHt")) {
    const budget = budgetFromItems(body.budgetItems);
    if (!budget.main_oeuvre_estimated && body.budgetHt) budget.main_oeuvre_estimated = toAmount(body.budgetHt);
    const existing = Array.isArray(chantier.chantier_budgets) ? chantier.chantier_budgets[0] : null;
    if (existing) {
      const { data: updated } = await auth.supabase
        .from("chantier_budgets")
        .update(budget)
        .eq("id", existing.id)
        .select()
        .single();
      chantier.chantier_budgets = [updated || { ...existing, ...budget }];
    } else {
      const { data: inserted } = await auth.supabase
        .from("chantier_budgets")
        .insert({ chantier_id: chantier.id, ...budget })
        .select()
        .single();
      chantier.chantier_budgets = inserted ? [inserted] : [];
    }
  }

  return ok({ project: mapChantier(chantier) });
}
