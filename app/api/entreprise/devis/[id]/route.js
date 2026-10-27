import { resolveEntreprise } from "../../../../../lib/entreprise-auth";

// GET /api/entreprise/devis/:id — get quote detail
export async function GET(request, { params }) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const devisId = params.id;

    // TODO: Fetch quote from Supabase
    // Placeholder for now
    const quote = {
      id: devisId,
      enterpriseId: entreprise.userId,
      clientName: "Exemple Client",
      clientEmail: "client@example.com",
      items: [
        {
          description: "Rénovation salle de bain",
          quantity: 1,
          unitPrice: 5000,
          total: 5000,
        },
      ],
      totalAmount: 5000,
      status: "draft",
      createdAt: new Date(),
    };

    return Response.json(quote);
  } catch (err) {
    console.error("Error loading devis:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/entreprise/devis/:id — update quote
export async function PATCH(request, { params }) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const devisId = params.id;
    const body = await request.json();

    // TODO: Update quote in Supabase
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Error updating devis:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
