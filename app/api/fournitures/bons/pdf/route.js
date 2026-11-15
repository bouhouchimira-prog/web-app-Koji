import { badRequest } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../../lib/entreprise-auth";
import { bonCommandeFilename, buildBonCommandePdf, companyFromWebUser } from "../../../../../lib/document-generator";

// PDF d'un bon de commande de l'entreprise (maquette PRO-07.6).
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  const db = await readDb();
  const bon = (db.bonsCommande || []).find((b) => b.id === id && b.userId === entreprise.userId);
  if (!bon) return badRequest("Bon introuvable.", 404);
  const company = companyFromWebUser(await loadEntrepriseProfile(entreprise));
  let chantier = {};
  if (bon.projectId) {
    const { data } = await entreprise.supabase.from("chantiers").select("reference, street, postal_code, city").eq("id", bon.projectId).maybeSingle();
    if (data) chantier = { titre: data.reference || "", adresse: [data.street, data.postal_code, data.city].filter(Boolean).join(", ") };
  }
  const pdf = buildBonCommandePdf({ bon, company, chantier });
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${bonCommandeFilename(bon)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
