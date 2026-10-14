import { badRequest, ok } from "../../../lib/http";
import { getAuth, isUuid } from "../../../lib/server-auth";

// Commandes fournisseurs (12 oct, nouvelle page tableau de bord de l'outil
// Fournitures) — table dediee, liee a fournisseurs/chantiers (tables deja
// partagees avec l'app Flutter). Meme pattern que app/api/supplies/route.js
// (getAuth, mapping snake_case <-> camelCase).

const COMMANDE_SELECT = "*, fournisseurs(name), chantiers(reference)";

const VALID_STATUTS = ["a_commander", "confirmee", "expediee", "livree", "en_retard"];

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function mapCommande(row) {
  return {
    id: row.id,
    userId: row.user_id,
    supplierId: row.fournisseur_id || "",
    supplierName: row.fournisseurs?.name || "",
    projectId: row.chantier_id || "",
    projectTitle: row.chantiers?.reference || "",
    items: Array.isArray(row.items) ? row.items : [],
    montantHt: toNumber(row.montant_ht),
    deliveryDate: row.date_livraison || "",
    status: VALID_STATUTS.includes(row.statut) ? row.statut : "a_commander",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ commandes: [] });

  const { data, error } = await auth.supabase
    .from("commandes")
    .select(COMMANDE_SELECT)
    .order("created_at", { ascending: false });
  if (error) return badRequest(`Lecture des commandes impossible: ${error.message}`, 500);
  return ok({ commandes: (data || []).map(mapCommande) });
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const items = Array.isArray(body.items) ? body.items.filter((item) => item && item.name) : [];
  const statut = VALID_STATUTS.includes(body.status) ? body.status : "a_commander";

  const { data, error } = await auth.supabase
    .from("commandes")
    .insert({
      user_id: auth.userId,
      fournisseur_id: isUuid(body.supplierId) ? body.supplierId : null,
      chantier_id: isUuid(body.projectId) ? body.projectId : null,
      items,
      montant_ht: toNumber(body.montantHt),
      date_livraison: body.deliveryDate || null,
      statut,
      notes: body.notes || ""
    })
    .select(COMMANDE_SELECT)
    .single();
  if (error) return badRequest(`Création de la commande impossible: ${error.message}`, 500);
  return ok({ commande: mapCommande(data) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant de la commande manquant.");

  if (body.action === "delete") {
    const { data, error } = await auth.supabase
      .from("commandes")
      .delete()
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return badRequest(`Suppression impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Commande introuvable." }, 404);
    return ok({ commande: { ...mapCommande(data), deleted: true } });
  }

  const updates = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (!VALID_STATUTS.includes(body.status)) return badRequest("Statut invalide.");
    updates.statut = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, "supplierId")) updates.fournisseur_id = isUuid(body.supplierId) ? body.supplierId : null;
  if (Object.prototype.hasOwnProperty.call(body, "projectId")) updates.chantier_id = isUuid(body.projectId) ? body.projectId : null;
  if (Object.prototype.hasOwnProperty.call(body, "items")) updates.items = Array.isArray(body.items) ? body.items : [];
  if (Object.prototype.hasOwnProperty.call(body, "montantHt")) updates.montant_ht = toNumber(body.montantHt);
  if (Object.prototype.hasOwnProperty.call(body, "deliveryDate")) updates.date_livraison = body.deliveryDate || null;
  if (Object.prototype.hasOwnProperty.call(body, "notes")) updates.notes = body.notes || "";
  if (Object.keys(updates).length === 1) return badRequest("Aucune modification fournie.");

  const { data, error } = await auth.supabase
    .from("commandes")
    .update(updates)
    .eq("id", body.id)
    .select(COMMANDE_SELECT)
    .maybeSingle();
  if (error) return badRequest(`Mise à jour impossible: ${error.message}`, 500);
  if (!data) return ok({ error: "Commande introuvable." }, 404);
  return ok({ commande: mapCommande(data) });
}
