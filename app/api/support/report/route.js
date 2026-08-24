import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { getVerifiedWorkerId } from "../../../../lib/worker-session";
import { fixText } from "../../../../lib/text";
import { sendTechnicalReportEmail } from "../../../../lib/mailer";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { splitBusinessInfo } from "../../../../lib/user-profile";

// The report button is available from all 3 profiles (entreprise/particulier/
// ouvrier), each with its own session type — try each verifier in turn rather
// than assuming one.
async function resolveSession(request, body) {
  const companyId = await getVerifiedUserId(request, body);
  if (companyId) return { kind: "entreprise", id: companyId };
  const portalId = getVerifiedPortalUserId(request, body);
  if (portalId) return { kind: "particulier", id: portalId };
  const workerId = getVerifiedWorkerId(request, body);
  if (workerId) return { kind: "ouvrier", id: workerId };
  return null;
}

async function companyDisplayName(companyId) {
  try {
    const { data } = await getSupabaseAdmin()
      .from("users")
      .select("business_info")
      .eq("id", companyId)
      .maybeSingle();
    const { business } = splitBusinessInfo(data?.business_info);
    return business.raisonSociale || "";
  } catch {
    return "";
  }
}

// So the notification email says *who* is reporting (name, email, which
// company) instead of just a bare account id she'd have to look up herself.
async function resolveReporterIdentity(session, db) {
  if (session.kind === "entreprise") {
    try {
      const { data } = await getSupabaseAdmin()
        .from("users")
        .select("email, business_info")
        .eq("id", session.id)
        .maybeSingle();
      const { business, extras } = splitBusinessInfo(data?.business_info);
      const personal = extras._personal || {};
      const personalName = [personal.firstName, personal.lastName].filter(Boolean).join(" ").trim();
      return {
        name: extras._name || personalName || business.raisonSociale || "",
        email: data?.email || "",
        company: business.raisonSociale || ""
      };
    } catch {
      return { name: "", email: "", company: "" };
    }
  }
  if (session.kind === "particulier") {
    const user = (db.users || []).find((u) => u.id === session.id);
    return { name: user?.name || "", email: user?.email || "", company: "" };
  }
  if (session.kind === "ouvrier") {
    const worker = (db.workers || []).find((w) => w.id === session.id);
    const company = worker?.userId ? await companyDisplayName(worker.userId) : "";
    return { name: worker?.name || "", email: worker?.email || "", company };
  }
  return { name: "", email: "", company: "" };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return badRequest("Message obligatoire.", 400);

  const session = await resolveSession(request, body);
  if (!session) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const identity = await resolveReporterIdentity(session, db);
  const now = new Date().toISOString();
  const report = {
    id: `report-${Date.now()}`,
    sessionKind: session.kind,
    userId: session.id,
    reporterName: identity.name,
    reporterEmail: identity.email,
    reporterCompany: identity.company,
    accountType: fixText(body.accountType || session.kind),
    page: fixText(body.page || ""),
    message: fixText(message),
    status: "nouveau",
    createdAt: now
  };

  db.technicalReports.unshift(report);
  addHistory(db, {
    userId: session.kind === "entreprise" ? session.id : "",
    type: "support.report",
    label: `Signalement technique (${session.kind}): ${message.slice(0, 80)}`,
    entityId: report.id,
    entityType: "technicalReport"
  });
  await writeDb(db);

  // Best-effort: the report is already saved above regardless of whether
  // the notification email succeeds (SMTP may be unconfigured locally).
  sendTechnicalReportEmail({
    message: report.message,
    accountType: report.accountType,
    sessionKind: report.sessionKind,
    page: report.page,
    userId: report.userId,
    name: report.reporterName,
    email: report.reporterEmail,
    company: report.reporterCompany
  }).catch(() => {});

  return ok({ report }, 201);
}
