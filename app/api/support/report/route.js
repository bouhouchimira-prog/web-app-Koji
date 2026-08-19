import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { getVerifiedWorkerId } from "../../../../lib/worker-session";
import { fixText } from "../../../../lib/text";

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

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return badRequest("Message obligatoire.", 400);

  const session = await resolveSession(request, body);
  if (!session) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const now = new Date().toISOString();
  const report = {
    id: `report-${Date.now()}`,
    sessionKind: session.kind,
    userId: session.id,
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

  return ok({ report }, 201);
}
