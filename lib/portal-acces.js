import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";
import { getVerifiedPortalUserId } from "./portal-session.js";
import { fixObjectText } from "./text.js";

// Accès d'un client Koji Client à un devis : même contrôle que
// app/api/client/quotes/[id]/pdf/route.js (portail, accès donné, e-mail ou
// téléphone du devis).

// Client connecté, son devis et le chantier, ou { erreur, code }.
export async function chantierDuClient(request, db, quoteId) {
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return { erreur: "Session expirée. Reconnectez-vous.", code: 401 };
  const user = (db.users || []).find((u) => u.id === userId);
  if (!user) return { erreur: "Profil client introuvable.", code: 404 };
  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase.from("quotes").select("*").eq("id", String(quoteId || "")).maybeSingle();
  if (!row) return { erreur: "Devis introuvable.", code: 404 };
  const quote = fixObjectText(mapQuote(row));
  const { data: chantier } = quote.projectId ? await supabase.from("chantiers").select("*").eq("id", quote.projectId).maybeSingle() : { data: null };
  if (!chantier || !quoteBelongsToClient(quote, { clientEmail: chantier.client_email || "" }, user, normalizeEmail(user.email))) {
    return { erreur: "Chantier introuvable pour ce profil client.", code: 404 };
  }
  return { user, quote, chantier };
}

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

export function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}
