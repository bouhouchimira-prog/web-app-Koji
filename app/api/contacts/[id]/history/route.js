import { ok } from "../../../../../lib/http";
import { getUserScope, readDb, scopedItems } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/server-auth";
import { mapQuote } from "../../../../../lib/quote-mapping";
import { mapChantier } from "../../../projects/route";

// Every list below is fetched in full for the user and filtered in memory by
// contactId, same as the rest of the app already does (no exotic JSONB
// Postgres querying) — fine at this app's scale (a single company's data).
export async function GET(request, context) {
  const { id } = await context.params;
  const db = await readDb();
  const userId = await getUserScope(request, db);
  const auth = getAuth(request);

  const invoices = scopedItems(db.invoices, userId).filter((invoice) => invoice.contactId === id);
  const interventions = scopedItems(db.interventions, userId).filter((intervention) => intervention.contactId === id);

  let quotes = [];
  let chantiers = [];

  if (auth) {
    const { data: quoteRows } = await auth.supabase.from("quotes").select("*");
    quotes = (quoteRows || []).map(mapQuote).filter((quote) => quote.contactId === id);

    const links = scopedItems(db.chantierContacts, userId).filter((link) => link.contactId === id);
    const projectIds = [...new Set(links.map((link) => link.projectId))];
    if (projectIds.length) {
      const { data: chantierRows } = await auth.supabase.from("chantiers").select("*, chantier_budgets(*)").in("id", projectIds);
      chantiers = (chantierRows || []).map((row) => {
        const chantier = mapChantier(row);
        const link = links.find((l) => l.projectId === chantier.id);
        return { ...chantier, roleOnSite: link?.roleOnSite || "" };
      });
    }
  }

  return ok({ quotes, chantiers, invoices, interventions });
}
