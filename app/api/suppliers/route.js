import { badRequest, ok } from "../../../lib/http";
import { getAuth } from "../../../lib/server-auth";

// Suppliers live in the shared `fournisseurs` table used by the koji-main
// Flutter app. The table only stores name + logo; the web-only contact fields
// are returned empty for backward compatibility with the UI.

function mapFournisseur(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || "Fournisseur",
    email: "",
    phone: "",
    address: "",
    website: "",
    notes: "",
    logoUrl: row.logo_url || "",
    createdAt: row.created_at || "",
    updatedAt: row.created_at || ""
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
      logo_url: body.logoUrl || body.imageUrl || null
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

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body, "name")) updates.name = body.name;
  if (Object.prototype.hasOwnProperty.call(body, "logoUrl")) updates.logo_url = body.logoUrl || null;
  if (Object.keys(updates).length === 0) return badRequest("Aucune modification fournie.");

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
