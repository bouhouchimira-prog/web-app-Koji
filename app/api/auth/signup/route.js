import { badRequest, ok } from "../../../../lib/http";
import { publicUser, readDb, writeDb } from "../../../../lib/db";
import { activationExpires, makeActivationToken, nowIso } from "../../../../lib/auth";
import { queueActivationEmail } from "../../../../lib/mailer";
import { hashPassword } from "../../../../lib/worker-auth";

export async function POST(request) {
  const body = await request.json();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim() || email.split("@")[0] || "Utilisateur";
  const accountType = body.accountType || "entreprise";

  if (!email || !password) return badRequest("Email et mot de passe obligatoires");
  if (password.length < 8) return badRequest("Le mot de passe doit contenir au moins 8 caractères");

  const db = await readDb();
  const existing = db.users.find((candidate) => candidate.email.toLowerCase() === email);
  if (existing) return badRequest("Un compte existe déjà avec cet e-mail", 409);

  const activationToken = makeActivationToken();
  const activationUrl = `${new URL(request.url).origin}/activate?token=${activationToken}`;
  const { passwordHash, passwordSalt } = hashPassword(password);

  const user = {
    id: `u-${Date.now()}`,
    email,
    passwordHash,
    passwordSalt,
    name,
    accountType,
    isActive: false,
    activationToken,
    activationExpiresAt: activationExpires(24),
    createdAt: nowIso(),
    lastLoginAt: nowIso(),
    businessInfoComplete: false,
    profileComplete: false,
    plan: "trial",
    trialStartedAt: nowIso(),
    business: {},
    personal: {},
    professions: []
  };

  db.users.push(user);
  await writeDb(db);
  const queued = await queueActivationEmail({ email, name, activationUrl, accountType });
  const emailSent = queued.sent || false;
  return ok({
    activationRequired: true,
    emailSent,
    message: emailSent
      ? "Compte créé. Vérifiez votre boîte mail pour activer votre compte."
      : "Compte créé. Utilisez le lien ci-dessous pour activer votre compte.",
    directActivationUrl: emailSent ? undefined : activationUrl
  }, 201);
}
