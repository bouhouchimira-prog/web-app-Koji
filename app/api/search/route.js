import { ok } from "../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../lib/server-auth";
import { readDb, scopedItems } from "../../../lib/db";
import { contactDisplayName } from "../../../lib/contacts";

// Recherche globale de la barre du haut (12 oct, demande d'Amira) — chantiers
// et devis (tables Supabase, deja scopees par RLS via auth.supabase, meme
// pattern que app/api/projects|quotes/route.js) + contacts (blob JSON local,
// scope verifie explicitement via getVerifiedUserId — pas le simple decodage
// JWT de getAuth, qui ne suffit pas a lui seul pour filtrer des donnees qui
// ne passent pas par les policies RLS de Supabase).

function matches(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(needle);
}

export async function GET(request) {
  const auth = getAuth(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!auth || q.length < 2) return ok({ chantiers: [], devis: [], contacts: [] });
  const needle = q.toLowerCase();

  const [chantiersResult, quotesResult, verifiedUserId] = await Promise.all([
    auth.supabase
      .from("chantiers")
      .select("id, reference, street, city")
      .ilike("reference", `%${q}%`)
      .order("created_at", { ascending: false })
      .limit(5),
    auth.supabase
      .from("quotes")
      .select("id, reference, metadata")
      .order("created_at", { ascending: false })
      .limit(200),
    getVerifiedUserId(request)
  ]);

  const chantiers = (chantiersResult.data || []).map((row) => ({
    id: row.id,
    title: row.reference || "Chantier",
    sub: [row.street, row.city].filter(Boolean).join(", "),
    href: `/chantiers?project=${row.id}`
  }));

  const devis = (quotesResult.data || [])
    .filter((row) => matches(row.reference, needle) || matches(row.metadata?.client?.name, needle))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      title: row.reference || "Devis",
      sub: row.metadata?.client?.name || "",
      href: `/devis?id=${row.id}`
    }));

  let contacts = [];
  if (verifiedUserId) {
    const db = await readDb();
    contacts = scopedItems(db.contacts, verifiedUserId)
      .filter((c) => !c.archived)
      .filter((c) => matches(contactDisplayName(c), needle) || matches(c.phone, needle) || matches(c.email, needle))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: contactDisplayName(c),
        sub: c.phone || c.email || "",
        href: "/contacts"
      }));
  }

  return ok({ chantiers, devis, contacts });
}
