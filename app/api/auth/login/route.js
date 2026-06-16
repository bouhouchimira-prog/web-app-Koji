import { badRequest, ok } from "../../../../lib/http";
import { nowIso } from "../../../../lib/auth";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { verifyUserPassword } from "../../../../lib/worker-auth";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function matchesIdentifier(candidate, identifier) {
  const email = normalizeEmail(identifier);
  const phone = normalizePhone(identifier);
  const candidateEmail = normalizeEmail(candidate.email);
  const candidatePhone = normalizePhone(candidate.phone || candidate.personal?.phone);
  return candidateEmail === email || (phone && candidatePhone === phone);
}

export async function POST(request) {
  const body = await request.json();
  const email = normalizeEmail(body.email || body.identifier || "");
  const password = String(body.password || "");
  const accountType = body.accountType === "particulier" ? "particulier" : "entreprise";

  const db = await readDb();
  const userByType = db.users.find(
    (candidate) =>
      matchesIdentifier(candidate, email) &&
      (candidate.accountType || "entreprise") === accountType
  );
  const user = userByType || db.users.find((candidate) => matchesIdentifier(candidate, email));

  if (!user) return badRequest("Compte introuvable. Creez un compte d'abord.", 404);
  if (!verifyUserPassword(user, password)) return badRequest("Email ou mot de passe incorrect", 401);

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
