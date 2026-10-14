import { ok } from "../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../lib/server-auth";
import { readDb, scopedItems } from "../../../lib/db";
import { contactDisplayName } from "../../../lib/contacts";

// Recherche globale de la barre du haut (12 oct, demande d'Amira : "liee a
// tous les outils, et tous les details") — couvre deux choses distinctes :
// 1) les OUTILS eux-memes (ex: taper "four" retrouve l'outil "Fournitures"),
//    liste statique ci-dessous, aucun appel base necessaire.
// 2) le CONTENU de chaque outil : chantiers/devis (Supabase, deja scopes
//    par RLS via auth.supabase, meme pattern que app/api/projects|quotes),
//    fournitures/fournisseurs (Supabase), contacts/ouvriers/factures (blob
//    JSON local, scope verifie explicitement via getVerifiedUserId — pas le
//    simple decodage JWT de getAuth, qui ne protege que les requetes
//    passant par les policies RLS de Supabase).

const TOOLS = [
  { title: "Accueil", href: "/" },
  { title: "Chantiers", href: "/chantiers" },
  { title: "Devis", href: "/devis" },
  { title: "Avenant", href: "/avenant" },
  { title: "Factures", href: "/facturation" },
  { title: "Fournitures", href: "/fournitures" },
  { title: "Bibliothèque koji", href: "/bibliotheque-ouvrages" },
  { title: "Comptabilités", href: "/comptabilite" },
  { title: "Contacts", href: "/contacts" },
  { title: "Clients", href: "/clients" },
  { title: "Équipe", href: "/equipe" },
  { title: "Calendrier", href: "/calendrier" },
  { title: "Archives", href: "/archives" },
  { title: "Corbeille", href: "/corbeille" },
  { title: "Interventions", href: "/interventions" },
  { title: "Marketplace", href: "/marketplace" }
];

function matches(haystack, needle) {
  return String(haystack || "").toLowerCase().includes(needle);
}

export async function GET(request) {
  const auth = getAuth(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) return ok({ tools: [], chantiers: [], devis: [], fournitures: [], fournisseurs: [], contacts: [], equipe: [], factures: [] });
  const needle = q.toLowerCase();

  const tools = TOOLS.filter((t) => matches(t.title, needle)).slice(0, 5);

  if (!auth) return ok({ tools, chantiers: [], devis: [], fournitures: [], fournisseurs: [], contacts: [], equipe: [], factures: [] });

  const [chantiersResult, quotesResult, fournituresResult, fournisseursResult, verifiedUserId] = await Promise.all([
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
    auth.supabase
      .from("fournitures")
      .select("id, name, category")
      .ilike("name", `%${q}%`)
      .limit(5),
    auth.supabase
      .from("fournisseurs")
      .select("id, name")
      .ilike("name", `%${q}%`)
      .limit(5),
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

  const fournitures = (fournituresResult.data || []).map((row) => ({
    id: row.id,
    title: row.name || "Fourniture",
    sub: row.category || "",
    href: `/fournitures/catalogue?supply=${row.id}`
  }));

  const fournisseurs = (fournisseursResult.data || []).map((row) => ({
    id: row.id,
    title: row.name || "Fournisseur",
    sub: "Fournisseur",
    href: "/fournitures/catalogue"
  }));

  let contacts = [];
  let equipe = [];
  let factures = [];
  if (verifiedUserId) {
    const db = await readDb();
    contacts = scopedItems(db.contacts, verifiedUserId)
      .filter((c) => !c.archived)
      .filter((c) => matches(contactDisplayName(c), needle) || matches(c.phone, needle) || matches(c.email, needle))
      .slice(0, 5)
      .map((c) => ({ id: c.id, title: contactDisplayName(c), sub: c.phone || c.email || "", href: "/contacts" }));

    equipe = scopedItems(db.workers || [], verifiedUserId)
      .filter((w) => matches(w.name, needle))
      .slice(0, 5)
      .map((w) => ({ id: w.id, title: w.name, sub: w.profession || w.type || "", href: "/equipe" }));

    factures = scopedItems(db.invoices || [], verifiedUserId)
      .filter((inv) => matches(inv.invoiceNumber, needle))
      .slice(0, 5)
      .map((inv) => ({ id: inv.id, title: inv.invoiceNumber, sub: "Facture", href: "/facturation" }));
  }

  return ok({ tools, chantiers, devis, fournitures, fournisseurs, contacts, equipe, factures });
}
