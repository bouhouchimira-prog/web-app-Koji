import { badRequest, ok } from "../../../lib/http";
import { getAuth, isUuid } from "../../../lib/server-auth";
import { importSupplyFromUrl } from "../../../lib/supply-import";

// Supplies live in the shared `fournitures` table used by the koji-main
// Flutter app (joined with `fournisseurs` for the supplier name).

const SUPPLY_SELECT = "*, fournisseurs(name), chantiers(reference)";

function toNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function mapFourniture(row) {
  const salePriceHt = toNumber(row.prix_vente_ht);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || "Fourniture",
    category: row.category || "general",
    subcategory: "",
    unit: row.unite || "unite",
    purchasePriceHt: toNumber(row.prix_achat_ht),
    salePriceHt,
    priceHt: salePriceHt,
    stock: toNumber(row.quantite),
    quantity: toNumber(row.quantite),
    packaging: row.conditionnement || "",
    supplierId: row.fournisseur_id || "",
    supplierName: row.fournisseurs?.name || "",
    // Seuil de stock bas (12 oct, page tableau de bord Fournitures) — 0 =
    // jamais signale (article pas encore configure).
    reorderThreshold: toNumber(row.seuil_alerte),
    barcode: row.barcode || "",
    imageUrl: row.image_url || "",
    sourceUrl: row.source_url || "",
    // Achats "Divers" (14 oct, onglet Divers du catalogue) — magasin/achat
    // ponctuel sans fournisseur au catalogue, rattache optionnellement a un
    // chantier, avec un montant TTC (vs prix HT du catalogue) et une photo
    // de ticket (stockee en data URL, pas de stockage fichier dans l'app).
    storeName: row.magasin || "",
    projectId: row.chantier_id || "",
    projectTitle: row.chantiers?.reference || "",
    amountTtc: toNumber(row.montant_ttc),
    ticketPhoto: row.ticket_photo || "",
    createdAt: row.created_at || ""
  };
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ supplies: [] });

  const { data, error } = await auth.supabase
    .from("fournitures")
    .select(SUPPLY_SELECT)
    .order("created_at", { ascending: false });
  if (error) return badRequest(`Lecture des fournitures impossible: ${error.message}`, 500);
  return ok({ supplies: (data || []).map(mapFourniture) });
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const imported = body.importUrl || body.sourceUrl ? await importSupplyFromUrl(body.importUrl || body.sourceUrl) : {};
  const purchasePriceHt = toNumber(body.purchasePriceHt ?? body.priceHt ?? imported.purchasePriceHt ?? imported.priceHt ?? 0);
  const salePriceHt = toNumber(body.salePriceHt ?? body.priceHt ?? imported.salePriceHt ?? imported.priceHt ?? purchasePriceHt);

  const { data, error } = await auth.supabase
    .from("fournitures")
    .insert({
      user_id: auth.userId,
      fournisseur_id: isUuid(body.supplierId) ? body.supplierId : null,
      name: body.name || imported.name || "Fourniture",
      category: body.category || imported.category || "Autre",
      prix_achat_ht: purchasePriceHt,
      prix_vente_ht: salePriceHt,
      conditionnement: body.packaging || imported.packaging || null,
      quantite: toNumber(body.quantity || body.stock || imported.quantity || 0),
      seuil_alerte: toNumber(body.reorderThreshold || 0),
      unite: body.unit || imported.unit || "unite",
      barcode: body.barcode || null,
      image_url: body.imageUrl || imported.imageUrl || null,
      source_url: body.sourceUrl || body.importUrl || imported.sourceUrl || null,
      magasin: body.storeName || null,
      chantier_id: isUuid(body.projectId) ? body.projectId : null,
      montant_ttc: toNumber(body.amountTtc || 0),
      ticket_photo: body.ticketPhoto || null
    })
    .select(SUPPLY_SELECT)
    .single();
  if (error) return badRequest(`Ajout de la fourniture impossible: ${error.message}`, 500);
  return ok({ supply: mapFourniture(data) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant de la fourniture manquant.");

  if (body.action === "delete") {
    const { data, error } = await auth.supabase
      .from("fournitures")
      .delete()
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return badRequest(`Suppression impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Fourniture introuvable." }, 404);
    return ok({ supply: { ...mapFourniture(data), deleted: true } });
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) updates.name = body.name;
  if (Object.prototype.hasOwnProperty.call(body, "category")) updates.category = body.category;
  if (Object.prototype.hasOwnProperty.call(body, "unit")) updates.unite = body.unit;
  if (Object.prototype.hasOwnProperty.call(body, "purchasePriceHt")) updates.prix_achat_ht = toNumber(body.purchasePriceHt);
  if (Object.prototype.hasOwnProperty.call(body, "salePriceHt")) updates.prix_vente_ht = toNumber(body.salePriceHt);
  if (Object.prototype.hasOwnProperty.call(body, "priceHt") && !Object.prototype.hasOwnProperty.call(body, "salePriceHt")) {
    updates.prix_vente_ht = toNumber(body.priceHt);
  }
  if (Object.prototype.hasOwnProperty.call(body, "stock")) updates.quantite = toNumber(body.stock);
  if (Object.prototype.hasOwnProperty.call(body, "quantity")) updates.quantite = toNumber(body.quantity);
  if (Object.prototype.hasOwnProperty.call(body, "reorderThreshold")) updates.seuil_alerte = toNumber(body.reorderThreshold);
  if (Object.prototype.hasOwnProperty.call(body, "packaging")) updates.conditionnement = body.packaging || null;
  if (Object.prototype.hasOwnProperty.call(body, "supplierId")) {
    updates.fournisseur_id = isUuid(body.supplierId) ? body.supplierId : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "barcode")) updates.barcode = body.barcode || null;
  if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) updates.image_url = body.imageUrl || null;
  if (Object.prototype.hasOwnProperty.call(body, "sourceUrl")) updates.source_url = body.sourceUrl || null;
  if (Object.prototype.hasOwnProperty.call(body, "storeName")) updates.magasin = body.storeName || null;
  if (Object.prototype.hasOwnProperty.call(body, "projectId")) updates.chantier_id = isUuid(body.projectId) ? body.projectId : null;
  if (Object.prototype.hasOwnProperty.call(body, "amountTtc")) updates.montant_ttc = toNumber(body.amountTtc);
  if (Object.prototype.hasOwnProperty.call(body, "ticketPhoto")) updates.ticket_photo = body.ticketPhoto || null;
  if (Object.keys(updates).length === 0) return badRequest("Aucune modification fournie.");

  const { data, error } = await auth.supabase
    .from("fournitures")
    .update(updates)
    .eq("id", body.id)
    .select(SUPPLY_SELECT)
    .maybeSingle();
  if (error) return badRequest(`Mise à jour impossible: ${error.message}`, 500);
  if (!data) return ok({ error: "Fourniture introuvable." }, 404);
  return ok({ supply: mapFourniture(data) });
}
