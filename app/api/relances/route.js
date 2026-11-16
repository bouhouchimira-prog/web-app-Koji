import { badRequest, ok } from "../../../lib/http";
import { ADMIN_SCOPE, getUserScope, readDb, resolveUserId, writeDb } from "../../../lib/db";
import { changerReglageRelances, reglageRelances } from "../../../lib/relances-serveur";

// Réglage des relances automatiques de l'entreprise (maquette PRO-06.2).
// Désactivées tant que l'entrepreneur ne les a pas activées.
export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  if (!userId || userId === ADMIN_SCOPE) return ok({ actif: false });
  return ok({ actif: reglageRelances(db, userId) });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Connexion requise.", 401);
  if (userId === ADMIN_SCOPE) return badRequest("Réglage propre à chaque entreprise.", 400);
  const reglage = changerReglageRelances(db, userId, body.actif === true);
  await writeDb(db);
  return ok({ actif: reglage.actif });
}
