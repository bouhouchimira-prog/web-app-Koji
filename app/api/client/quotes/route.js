import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { fixObjectText, fixText } from "../../../../lib/text";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";

// The client (particulier) portal has no Supabase session of its own — quotes
// belong to the company's Supabase user_id, so RLS would hide them from a
// normal per-user client. This reads via the service_role key and filters in
// JS, mirroring the same "does this quote belong to this client" checks the
// local-JSON version used before the Supabase migration.

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function decorateQuote(quote, project, tasks) {
  return fixObjectText({
    ...quote,
    status: fixText(quote.status),
    project: project ? fixObjectText(project) : null,
    tasks: tasks.map((task) => fixObjectText(task)),
  });
}

function quoteBelongsToClient(quote, project, user, email) {
  const phone = normalizePhone(user?.phone || user?.personal?.phone);
  if (user?.id && quote.clientPortalUserId === user.id) return true;
  if (user?.clientAccess?.quoteIds?.includes(quote.id)) return true;
  if (user?.clientAccess?.projectIds?.includes(quote.projectId)) return true;
  if (email && (normalizeEmail(quote.clientEmail) === email || normalizeEmail(project?.clientEmail) === email)) return true;
  if (phone && (normalizePhone(quote.clientPhone) === phone || normalizePhone(project?.clientPhone) === phone)) return true;
  return false;
}

function mapChantierLite(row) {
  return {
    id: row.id,
    title: row.reference || "Chantier",
    reference: row.reference || "",
    clientEmail: row.client_email || "",
    clientPhone: "",
    address: [row.street, row.postal_code, row.city].filter(Boolean).join(", "),
    status: row.status || "En attente"
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";

  // This used to accept a plain ?email= with no proof of identity — anyone who
  // knew (or guessed) a client's email could read their quotes, including the
  // signature portal password embedded in them. Now it requires the signed
  // token issued at client-portal-login instead.
  const userId = getVerifiedPortalUserId(request);
  if (!userId) return ok({ quotes: [] });

  const db = await readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) return ok({ quotes: [] });
  const email = normalizeEmail(user.email);

  const supabase = getSupabaseAdmin();
  const { data: quoteRows, error } = await supabase.from("quotes").select("*");
  if (error) return badRequest(`Lecture des devis impossible: ${error.message}`, 500);
  const { data: chantierRows } = await supabase.from("chantiers").select("*");
  const projectsById = new Map((chantierRows || []).map((row) => [row.id, mapChantierLite(row)]));

  const clientQuotes = (quoteRows || [])
    .map((row) => mapQuote(row))
    .filter((quote) => quoteBelongsToClient(quote, projectsById.get(quote.projectId), user, email))
    .map((quote) => decorateQuote(
      quote,
      projectsById.get(quote.projectId),
      (db.tasks || []).filter((task) => task.quoteId === quote.id || task.projectId === quote.projectId),
    ));

  if (id) {
    const quote = clientQuotes.find((entry) => entry.id === id);
    if (!quote) return badRequest("Devis introuvable pour ce profil client.", 404);
    return ok({ quote });
  }

  return ok({ quotes: clientQuotes });
}
