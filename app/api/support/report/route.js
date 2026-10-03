import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixText } from "../../../../lib/text";
import { sendTechnicalReportEmail } from "../../../../lib/mailer";
import { resolveAnySession, resolveIdentity } from "../../../../lib/account-identity";

// The report button is available from all 3 profiles (entreprise/particulier/
// ouvrier), each with its own session type — resolveAnySession tries each
// verifier in turn rather than assuming one (30 septembre : extrait dans
// lib/account-identity.js, reutilise aussi par la demande de suppression de
// compte).

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return badRequest("Message obligatoire.", 400);

  const session = await resolveAnySession(request, body);
  if (!session) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const identity = await resolveIdentity(session, db);
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
