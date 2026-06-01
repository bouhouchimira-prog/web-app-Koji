import { badRequest, ok } from "../../../../lib/http";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { activationExpires, makeActivationToken, nowIso } from "../../../../lib/auth";
import { queueActivationEmail } from "../../../../lib/mailer";

export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0] || "Utilisateur";
  const accountType = body.accountType || "entreprise";

  if (!email || !password) return badRequest("Email et mot de passe obligatoires");

  const db = await readDb();
  const existing = db.users.find((candidate) => candidate.email.toLowerCase() === email);
  if (existing) return badRequest("Un compte existe déjà avec cet e-mail", 409);

  const activationToken = makeActivationToken();
  const activationUrl = `${new URL(request.url).origin}/activate?token=${activationToken}`;

  const user = {
    id: `u-${Date.now()}`,
    email,
    password,
    name,
    accountType,
    isActive: true,
    activationToken,
    activationExpiresAt: activationExpires(24),
    createdAt: nowIso(),
    lastLoginAt: nowIso(),
    businessInfoComplete: false,
    profileComplete: false,
    business: {},
    professions: []
  };

  db.users.push(user);
  await writeDb(db);
  const queued = await queueActivationEmail({ email, name, activationUrl, accountType });
  return ok({
    user: publicUser(user),
    token: `demo-token-${user.id}`,
    activationRequired: false,
    message: "Compte cree et connexion directe activee.",
    devActivationUrl: activationUrl,
    mailQueued: queued.id
  }, 201);
}
