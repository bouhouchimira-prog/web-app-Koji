import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { issueWorkerToken } from "../../../../lib/worker-session";
import { clearSessionCookie, setSessionCookie } from "../../../../lib/session-cookies";
import { checkRateLimit, clearRateLimit, rateLimitMessage, recordFailedAttempt } from "../../../../lib/rate-limit";
import { workerParCode } from "../../../../lib/equipe-serveur";

// Connexion d'un compagnon avec le code de son invitation (PRO-16.3) :
// pas de mot de passe. Le site pose le cookie ; l'app garde le jeton
// renvoyé et l'envoie en « Authorization: Bearer ».
const SCOPE = "compagnon-code";

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "inconnue";
  const limit = await checkRateLimit(SCOPE, ip);
  if (!limit.allowed) return ok({ error: rateLimitMessage(limit.retryAfterSeconds) }, 429);
  const db = await readDb();
  const worker = workerParCode(db, body.code);
  if (!worker) {
    await recordFailedAttempt(SCOPE, ip);
    return ok({ error: "Code inconnu ou expiré. Demandez à votre entreprise de renvoyer l'invitation." }, 401);
  }
  await clearRateLimit(SCOPE, ip);
  worker.invitation.utiliseLe = new Date().toISOString();
  worker.lastLoginAt = worker.invitation.utiliseLe;
  await writeDb(db);
  const token = issueWorkerToken(worker.id);
  const response = ok({ workerToken: token, compagnon: { id: worker.id, nom: worker.name, langue: worker.langue || "fr" } });
  setSessionCookie(response, "worker", token);
  return response;
}

export async function DELETE() {
  const response = ok({ ok: true });
  clearSessionCookie(response, "worker");
  return response;
}
