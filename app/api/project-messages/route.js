import { ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { fixObjectText } from "../../../lib/text";
import { getVerifiedAuth } from "../../../lib/server-auth";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { getSupabaseAdmin } from "../../../lib/supabase";

// Used to have no authentication at all, and returned every mail/SMS message
// across every company (including plaintext temporary passwords) whenever
// projectId/quoteId were omitted. Now a projectId is required, and the caller
// must be either the company that owns that project (their own Supabase
// session, subject to the chantiers RLS policy) or the particulier client
// attached to one of its quotes (their portal token).

async function companyCanSeeProject(request, projectId) {
  const auth = await getVerifiedAuth(request);
  if (!auth) return false;
  const { data } = await auth.supabase.from("chantiers").select("id").eq("id", projectId).maybeSingle();
  return Boolean(data);
}

async function portalClientCanSeeProject(request, projectId) {
  const portalUserId = getVerifiedPortalUserId(request);
  if (!portalUserId) return false;
  const db = await readDb();
  const user = db.users.find((entry) => entry.id === portalUserId);
  if (!user) return false;
  if (user.clientAccess?.projectIds?.includes(projectId)) return true;

  const email = String(user.email || "").trim().toLowerCase();
  const supabase = getSupabaseAdmin();
  const { data: quoteRows } = await supabase.from("quotes").select("client_email").eq("chantier_id", projectId);
  return (quoteRows || []).some((row) => {
    return Boolean(email && String(row.client_email || "").trim().toLowerCase() === email);
  });
}

// Le devis est-il celui de l'entreprise connectée ? La lecture passe par la
// session vérifiée : Supabase (RLS) ne renvoie un devis qu'à son entreprise.
async function companyOwnsQuote(request, quoteId) {
  const auth = await getVerifiedAuth(request);
  if (!auth) return false;
  const { data } = await auth.supabase.from("quotes").select("id").eq("id", quoteId).maybeSingle();
  return Boolean(data);
}

export async function GET(request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  const quoteId = url.searchParams.get("quoteId") || "";
  if (!projectId && !quoteId) return ok({ messages: [] });

  const authorized = projectId
    ? (await companyCanSeeProject(request, projectId)) || (await portalClientCanSeeProject(request, projectId))
    : Boolean(await getVerifiedAuth(request)); // quoteId-only callers are all internal/company today
  if (!authorized) return ok({ messages: [] });

  // Par quoteId seul, une session valide ne suffit pas : le devis doit être
  // celui de cette entreprise, car la suite lit la boîte d'envoi commune et
  // ses identifiants provisoires. (Contrôle écrit à part des lignes
  // ci-dessus, qui restent celles du lot « identité vérifiée ».)
  if (!projectId && !(await companyOwnsQuote(request, quoteId))) return ok({ messages: [] });

  const db = await readDb();
  const matches = (item) => (projectId && item.projectId === projectId) || (quoteId && item.quoteId === quoteId);

  const messages = [
    ...(db.mailOutbox || []).filter(matches).map((mail) => ({ ...fixObjectText(mail), channel: "email" })),
    ...(db.smsOutbox || []).filter(matches).map((sms) => ({ ...fixObjectText(sms), channel: "sms" }))
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return ok({ messages });
}
