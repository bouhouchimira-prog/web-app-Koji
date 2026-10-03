import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { fixText } from "../../../../lib/text";
import { sendDeletionRequestEmail } from "../../../../lib/mailer";
import { resolveAnySession, resolveIdentity } from "../../../../lib/account-identity";

// Droit a l'effacement (RGPD art. 17, 30 septembre) — demande traitee
// MANUELLEMENT plutot qu'une suppression automatique et instantanee :
// - les devis/factures doivent legalement rester consultables plusieurs
//   annees (obligations comptables), donc "tout supprimer" n'est pas
//   forcement la bonne reponse a chaque demande ;
// - les donnees vivent en partie dans des tables Supabase partagees avec
//   l'app mobile (koji-main/koji-admin), une suppression en cascade mal
//   ciblee cote web risquerait de casser des donnees encore utilisees
//   ailleurs.
// Cette route se contente donc d'enregistrer la demande et de prevenir
// l'equipe par email (meme mecanisme que "Signaler un probleme technique",
// app/api/support/report/route.js) — le RGPD impose de repondre sous 1 mois,
// pas une suppression en un clic.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  const session = await resolveAnySession(request, body);
  if (!session) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const db = await readDb();
  const identity = await resolveIdentity(session, db);
  const reason = fixText(body.reason || "");
  const now = new Date().toISOString();
  const deletionRequest = {
    id: `del-req-${Date.now()}`,
    sessionKind: session.kind,
    userId: session.id,
    requesterName: identity.name,
    requesterEmail: identity.email,
    requesterCompany: identity.company,
    accountType: fixText(body.accountType || session.kind),
    reason,
    status: "nouveau",
    createdAt: now
  };

  db.accountDeletionRequests.unshift(deletionRequest);
  addHistory(db, {
    userId: session.kind === "entreprise" ? session.id : "",
    type: "account.deletion_requested",
    label: `Demande de suppression de compte (${session.kind})`,
    entityId: deletionRequest.id,
    entityType: "accountDeletionRequest"
  });
  await writeDb(db);

  // Best-effort: la demande est deja enregistree ci-dessus, meme si l'envoi
  // de l'email echoue (SMTP non configure en local, par exemple).
  sendDeletionRequestEmail({
    accountType: deletionRequest.accountType,
    sessionKind: deletionRequest.sessionKind,
    reason: deletionRequest.reason,
    userId: deletionRequest.userId,
    name: deletionRequest.requesterName,
    email: deletionRequest.requesterEmail,
    company: deletionRequest.requesterCompany
  }).catch(() => {});

  return ok({ deletionRequest }, 201);
}
