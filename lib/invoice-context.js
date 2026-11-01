import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";

// Devis et chantier vivent dans Supabase, les factures dans koji_web_state :
// enrichit le PDF quand la facture (ou l'avoir) est rattachée à un vrai devis
// et/ou chantier.
function mapChantierLite(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.reference || "Chantier",
    reference: row.reference || "",
    address: row.street || "",
    client: row.client_email ? row.client_email.split("@")[0] : "Client",
    clientEmail: row.client_email || "",
    budgetHt: 0
  };
}

export async function loadInvoiceContext(invoice) {
  let quote = null;
  let project = null;
  if (!invoice.quoteId && !invoice.projectId) return { quote, project };
  const supabase = getSupabaseAdmin();
  if (invoice.quoteId) {
    const { data: quoteRow } = await supabase.from("quotes").select("*").eq("id", invoice.quoteId).maybeSingle();
    if (quoteRow) quote = mapQuote(quoteRow);
  }
  if (invoice.projectId) {
    const { data: projectRow } = await supabase.from("chantiers").select("*").eq("id", invoice.projectId).maybeSingle();
    if (projectRow) project = mapChantierLite(projectRow);
  }
  return { quote, project };
}
