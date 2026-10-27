import { resolveEntreprise } from "../../../../lib/entreprise-auth";

export async function GET(request) {
  try {
    const enterprise = await resolveEntreprise(request);
    if (!enterprise) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    // TODO: query published projects from Supabase
    return new Response(JSON.stringify({ projects: [] }), { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}

export async function POST(request) {
  try {
    const enterprise = await resolveEntreprise(request);
    if (!enterprise) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const { title, description, budget } = await request.json();
    // TODO: insert into projects table and broadcast on marketplace
    return new Response(JSON.stringify({ success: true }), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}
