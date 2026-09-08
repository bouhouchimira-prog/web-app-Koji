import { badRequest, ok } from "../../../../lib/http";
import { addHistory, makeToken, readDb, writeDb } from "../../../../lib/db";
import { hashPassword } from "../../../../lib/password-hash";
import { makePortalIdentifier, normalizeEmail } from "../../../../lib/client-portal-access";
import { sendParticulierVerificationEmail } from "../../../../lib/mailer";
import { fixText } from "../../../../lib/text";

const ACTIVATION_TTL_MS = 48 * 60 * 60 * 1000; // 48h, matches the signature-link convention elsewhere

// Seul endpoint de ce repo appele en cross-origin depuis un navigateur : la
// landing marketing koji-landing-particulier.vercel.app (repo separe) veut
// creer le compte particulier directement depuis son propre formulaire,
// plutot que de rediriger vers /signup. Sans ces en-tetes, le navigateur
// bloque la requete avant meme qu'elle n'atteigne ce handler (erreur CORS,
// pas une erreur applicative) — restreint a cette seule origine et ce seul
// endpoint, pas un CORS global sur /api/*.
const LANDING_ORIGIN = "https://koji-landing-particulier.vercel.app";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": LANDING_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function withCors(response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
  return response;
}

export async function OPTIONS() {
  return withCors(ok({}));
}

// Self-service signup for a "Koji" (particulier) account — the entry point
// for Radar des Chantiers. Distinct from /api/auth/signup, which only ever
// creates Supabase Auth accounts (entreprise side, shared with the mobile
// app): a particulier logging in goes through /api/auth/particulier-login,
// which checks db.users for accountType "particulier" with a
// portalIdentifier/passwordHash — a Supabase Auth account would never match
// that lookup, so signing up as "particulier" through the old route silently
// created an account nobody could ever log into. This creates the account in
// the same shape ensureClientPortalAccess already produces when a company
// signs a devis, so both paths log in identically afterward.
//
// The account starts inactive (isActive: false) until the e-mail link is
// clicked — reuses /api/auth/activate as-is, which already looks up
// db.users by activationToken regardless of account type.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email || "");
  const password = String(body.password || "");
  const name = fixText(body.name || "") || email.split("@")[0] || "Particulier";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return withCors(badRequest("Adresse e-mail invalide."));
  if (password.length < 8) return withCors(badRequest("Le mot de passe doit contenir au moins 8 caractères."));

  const db = await readDb();
  const existing = db.users.find((u) => u.accountType === "particulier" && normalizeEmail(u.email) === email);
  if (existing) return withCors(badRequest("Un compte particulier existe déjà avec cet e-mail.", 409));

  const { salt: passwordSalt, hash: passwordHash } = hashPassword(password);
  const now = new Date().toISOString();
  const activationToken = makeToken("activate");
  const user = {
    id: makeToken("client"),
    email,
    name,
    passwordHash,
    passwordSalt,
    portalIdentifier: makePortalIdentifier(),
    accountType: "particulier",
    isActive: false,
    activationToken,
    activationExpiresAt: new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(),
    createdAt: now,
    updatedAt: now,
    personal: {},
    clientAccess: { quoteIds: [], projectIds: [] }
  };

  db.users.push(user);
  addHistory(db, {
    userId: "",
    type: "particulier.signup",
    label: `Nouveau compte Koji (particulier) : ${email}`,
    entityId: user.id,
    entityType: "user",
    meta: { email }
  });
  await writeDb(db);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const activationUrl = `${appUrl}/activate?token=${activationToken}&type=particulier`;
  const mailResult = await sendParticulierVerificationEmail({ email, name, activationUrl });

  return withCors(ok(
    {
      activationRequired: true,
      emailSent: mailResult.ok,
      // SMTP non configure en local: permet quand meme de tester le parcours.
      directActivationUrl: mailResult.ok ? undefined : activationUrl,
      message: "Compte créé. Vérifiez votre boîte mail pour activer votre compte."
    },
    201
  ));
}
