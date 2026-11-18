import { resolveEntreprise } from "../../../../lib/entreprise-auth";

// GET /api/entreprise/devis — list all quotes (sent + received)
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all, pending, signed

    // TODO: Query quotes table when schema is finalized
    // For now, return placeholder
    let query = entreprise.supabase.from("quotes").select("*");

    if (filter === "pending") {
      query = query.neq("status", "signed");
    } else if (filter === "signed") {
      query = query.eq("status", "signed");
    }

    const { data: quotes, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return Response.json({
      devis: quotes || [],
    });
  } catch (err) {
    console.error("Error loading devis:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/entreprise/devis — create new quote
export async function POST(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { clientName, clientEmail, items, totalAmount, description } = body;

    // TODO: Create quote in Supabase
    // For now, return placeholder
    const newQuote = {
      id: "quote-" + Date.now(),
      enterpriseId: entreprise.userId,
      clientName,
      clientEmail,
      items: items || [],
      totalAmount,
      description,
      status: "draft",
      createdAt: new Date(),
    };

    return Response.json(newQuote, { status: 201 });
  } catch (err) {
    console.error("Error creating devis:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
