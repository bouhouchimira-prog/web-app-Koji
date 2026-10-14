import { badRequest, ok } from "../../../lib/http";
import { getAuth } from "../../../lib/server-auth";

// Suppliers live in the shared `fournisseurs` table used by the koji-main
// Flutter app. Contact fields (email/phone/address/website/notes) were
// added via ALTER TABLE for the web-only "Par fournisseur" detail view —
// see supabase_web_setup.sql.

function mapFournisseur(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || "Fournisseur",
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    website: row.website || "",
    notes: row.notes || "",
    logoUrl: row.logo_url || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || row.created_at || ""
  };
}

export async function GET(request) {
  const auth = getAuth(request);
  if (!auth) return ok({ suppliers: [] });

  const { data, error } = await auth.supabase
    .from("fournisseurs")
    .select("*")
    .order("name", { ascending: true });
  if (error) return badRequest(`Lecture des fournisseurs impossible: ${error.message}`, 500);
  return ok({ suppliers: (data || []).map(mapFournisseur) });
}

export async function POST(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data, error } = await auth.supabase
    .from("fournisseurs")
    .insert({
      user_id: auth.userId,
      name: body.name || "Nouveau fournisseur",
      logo_url: body.logoUrl || body.imageUrl || null,
      email: body.email || "",
      phone: body.phone || "",
      address: body.address || "",
      website: body.website || "",
      notes: body.notes || ""
    })
    .select()
    .single();
  if (error) return badRequest(`Ajout du fournisseur impossible: ${error.message}`, 500);
  return ok({ supplier: mapFournisseur(data) }, 201);
}

export async function PATCH(request) {
  const body = await request.json();
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!body.id) return badRequest("Identifiant du fournisseur manquant.");

  if (body.action === "delete") {
    const { data, error } = await auth.supabase
      .from("fournisseurs")
      .delete()
      .eq("id", body.id)
      .select()
      .maybeSingle();
    if (error) return badRequest(`Suppression impossible: ${error.message}`, 500);
    if (!data) return ok({ error: "Fournisseur introuvable." }, 404);
    return ok({ supplier: { ...mapFournisseur(data), deleted: true } });
  }

  const updates = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(body, "name")) updates.name = body.name;
  if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) updates.logo_url = body.logoUrl || null;
  if (Object.prototype.hasOwnProperty.call(body, "email")) updates.email = body.email || "";
  if (Object.prototype.hasOwnProperty.call(body, "phone")) updates.phone = body.phone || "";
  if (Object.prototype.hasOwnProperty.call(body, "address")) updates.address = body.address || "";
  if (Object.prototype.hasOwnProperty.call(body, "website")) updates.website = body.website || "";
  if (Object.prototype.hasOwnProperty.call(body, "notes")) updates.notes = body.notes || "";
  if (Object.keys(updates).length === 1) return badRequest("Aucune modification fournie.");

  const { data, error } = await auth.supabase
    .from("fournisseurs")
    .update(updates)
    .eq("id", body.id)
    .select()
    .maybeSingle();
  if (error) return badRequest(`Mise à jour impossible: ${error.message}`, 500);
  if (!data) return ok({ error: "Fournisseur introuvable." }, 404);
  return ok({ supplier: mapFournisseur(data) });
}
