import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixText } from "../../../../lib/text";
import { sendModerationEmail, sendTechnicalReportEmail } from "../../../../lib/mailer";
import { resolveAnySession, resolveIdentity } from "../../../../lib/account-identity";
import { cibleSignalement, natureSignalement } from "../../../../lib/moderation";

// The report button is available from all 3 profiles (entreprise/particulier/
// ouvrier), each with its own session type — resolveAnySession tries each
// verifier in turn rather than assuming one (30 septembre : extrait dans
// lib/account-identity.js, reutilise aussi par la demande de suppression de
// compte).
//
// 20 novembre : les apps envoient aussi ici « Signaler » et « Bloquer »
// (App Store, règle 1.2). Ces signalements de contenu gardent leur cible
// (fil, demande) pour la page Signalements du back-office et partent aux
// adresses de modération (lib/moderation.js), à traiter sous 24 heures.

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim();
  if (!message) return badRequest("Message obligatoire.", 400);

  const session = await resolveAnySession(request, body);
  if (!session) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const identity = await resolveIdentity(session, db);
  const now = new Date().toISOString();
  const nature = natureSignalement(body, message);
  const cible = nature === "technique" ? null : cibleSignalement(body, message);
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
    nature,
    ...(cible ? { cible } : {}),
    status: "nouveau",
    createdAt: now
  };

  db.technicalReports.unshift(report);
  addHistory(db, {
    userId: session.kind === "entreprise" ? session.id : "",
    type: "support.report",
    label: `${nature === "technique" ? "Signalement technique" : nature === "blocage" ? "Blocage" : "Signalement de contenu"} (${session.kind}): ${message.slice(0, 80)}`,
    entityId: report.id,
    entityType: "technicalReport"
  });
  await writeDb(db);

  // Le signalement est déjà enregistré ; l'e-mail est attendu (sur Vercel,
  // un envoi lancé sans attendre peut être coupé avec la fonction) mais son
  // échec ne fait pas échouer la demande (SMTP absent en local).
  const mail = {
    message: report.message,
    accountType: report.accountType,
    sessionKind: report.sessionKind,
    page: report.page,
    userId: report.userId,
    name: report.reporterName,
    email: report.reporterEmail,
    company: report.reporterCompany
  };
  try {
    await (nature === "technique" ? sendTechnicalReportEmail(mail) : sendModerationEmail({ ...mail, nature, reportId: report.id }));
  } catch {
    /* enregistré quand même : visible dans le back-office */
  }

  return ok({ report }, 201);
}
