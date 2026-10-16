import { badRequest, ok } from "../../../lib/http";
import { getAuth } from "../../../lib/server-auth";
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

  const { data, error } = await auth.supabase
    .from("chantiers")
    .select(CHANTIER_SELECT)
    .order("created_at", { ascending: false });
  if (error) return badRequest(`Lecture des chantiers impossible: ${error.message}`, 500);
  return ok({ projects: (data || []).map(mapChantier) });
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
      client_email: body.clientEmail || "",
      status: fixText(body.status || "En attente")
    })
    .select(CHANTIER_SELECT)
    .single();
  if (error) return badRequest(`Création du chantier impossible: ${error.message}`, 500);

  const budget = budgetFromItems(body.budgetItems);
  if (!budget.main_oeuvre_estimated && body.budgetHt) budget.main_oeuvre_estimated = toAmount(body.budgetHt);
  const { data: budgetRow } = await auth.supabase
    .from("chantier_budgets")
    .insert({ chantier_id: chantier.id, ...budget })
    .select()
    .single();

  return ok({ project: mapChantier({ ...chantier, chantier_budgets: budgetRow ? [budgetRow] : [] }) }, 201);
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
