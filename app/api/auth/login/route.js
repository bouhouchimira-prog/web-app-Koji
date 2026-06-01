import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";

export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  const db = await readDb();
  const userByType = db.users.find(
    (candidate) =>
      candidate.email.toLowerCase() === email &&
      (candidate.accountType || "entreprise") === accountType
  );
  const user = userByType || db.users.find((candidate) => candidate.email.toLowerCase() === email);

  if (!user) return badRequest("Compte introuvable. Creez un compte d'abord.", 404);
  if (user.password !== password) return badRequest("Email ou mot de passe incorrect", 401);

  if ((user.accountType || "entreprise") !== accountType) {
    return badRequest("Ce compte appartient a l'autre profil. Changez de profil puis reconnectez-vous.", 403);
  }

  if (!user.isActive) {
    return badRequest("Compte non active. Verifiez votre e-mail d'activation.", 403);
  }

  user.lastLoginAt = nowIso();
  await writeDb(db);

  return ok({ user: publicUser(user), token: `demo-token-${user.id}` });
}
