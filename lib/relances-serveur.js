import { getSupabaseAdmin } from "./supabase";
import { splitBusinessInfo } from "./user-profile";
import { loadInvoiceContext } from "./invoice-context";
import { buildInvoicePdf, invoiceDocumentFilename } from "./document-generator";
import { sendInvoiceReminderEmail } from "./mailer";
import { makeToken } from "./db";
import { passerRelances } from "./relances-passe";

export { changerReglageRelances, reglageRelances } from "./relances-passe";

async function entreprise(userId) {
  try {
    const { data } = await getSupabaseAdmin().from("users").select("email, business_info").eq("id", userId).maybeSingle();
    return { nom: splitBusinessInfo(data?.business_info).business.raisonSociale || "", email: data?.email || "" };
  } catch {
    return { nom: "", email: "" }; // e-mail sans signature plutôt que pas de relance
  }
}

// Relances automatiques avec les vrais envois (tâche quotidienne).
export function passerRelancesServeur(db) {
  return passerRelances(db, {
    envoyer: sendInvoiceReminderEmail,
    contexte: loadInvoiceContext,
    entreprise,
    pdf: buildInvoicePdf,
    nomPdf: invoiceDocumentFilename,
    nouvelId: () => makeToken("notif")
  });
}
