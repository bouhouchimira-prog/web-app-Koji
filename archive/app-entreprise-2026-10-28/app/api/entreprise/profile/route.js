import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";

// GET /api/entreprise/profile — load entreprise profile
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const profile = await loadEntrepriseProfile(entreprise);
    return Response.json(profile);
  } catch (err) {
    console.error("Error loading profile:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/entreprise/profile — update entreprise profile
export async function PATCH(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { raisonSociale, siret, address, phone, website } = body;

    // Update user record with business info
    const { error } = await entreprise.supabase
      .from("users")
      .update({
        business: {
          raisonSociale: raisonSociale || null,
          siret: siret || null,
          address: address || null,
          phone: phone || null,
          website: website || null,
        },
      })
      .eq("id", entreprise.userId);

    if (error) throw error;

    const profile = await loadEntrepriseProfile(entreprise);
    return Response.json(profile);
  } catch (err) {
    console.error("Error updating profile:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
