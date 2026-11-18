import { resolveEntreprise } from "../../../../lib/entreprise-auth";

export async function GET(request) {
  try {
    const enterprise = await resolveEntreprise(request);
    if (!enterprise) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    // TODO: query invoices from Supabase
    return new Response(JSON.stringify({ invoices: [] }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}
