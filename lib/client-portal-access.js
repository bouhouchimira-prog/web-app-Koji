import { makeToken } from "./db";
import { fixText } from "./text";
import { sendClientAccessEmail } from "./mailer";
import { hashPassword } from "./password-hash";

// Shared by the signing flow (app/api/signatures/[token]/route.js, triggered
// automatically when a client signs) and the manual "create access" action
// (app/api/client-portal-info/route.js POST, for a quote that was signed
// without an email/phone — see lib/client-portal-access.js's ensureClientPortalAccess
// callers for why that can happen: both signerEmail and signerPhone are
// optional on the public signature form).

export function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function makeTemporaryPassword() {
  const left = Math.random().toString(36).slice(2, 6).toUpperCase();
  const right = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Koji-${left}-${right}`;
}

function makePortalIdentifier() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `Koji-CH${digits}`;
}

function queueClientAccessMessages(db, { user, password, quote, loginUrl, portalUrl, deliveryTarget, now }) {
  const name = fixText(user.name || quote.client || "Client");
  const identifier = user.portalIdentifier || deliveryTarget.email || user.email;
  const text = [
    `Bonjour ${name},`,
    `Votre devis ${quote.quoteNumber} est signé.`,
    "Votre espace Koji Particulier est prêt pour suivre l'avancement de vos travaux.",
    `Identifiant : ${identifier}`,
    `Mot de passe provisoire : ${password}`,
    `Connexion : ${loginUrl}`,
    `Espace particulier : ${portalUrl}`
  ].join("\n");

  if (deliveryTarget.email) {
    db.mailOutbox.unshift({
      id: `mail-client-${Date.now()}`,
      to: deliveryTarget.email,
      type: "client-access",
      accountType: "particulier",
      subject: "Votre espace Koji Particulier — Suivi de chantier",
      text,
      html: `<p>Bonjour ${name},</p><p>Votre devis <strong>${quote.quoteNumber}</strong> est signé. Merci pour votre confiance.</p><p>Votre espace Koji Particulier est prêt pour suivre l'avancement de vos travaux.</p><p><strong>Identifiant :</strong> ${identifier}<br/><strong>Mot de passe provisoire :</strong> ${password}</p><p><a href="${loginUrl}">Accéder à mon espace</a></p>`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }

  if (deliveryTarget.phone) {
    db.smsOutbox.unshift({
      id: `sms-client-${Date.now()}`,
      to: deliveryTarget.phone,
      type: "client-access",
      text: `Koji: votre devis ${quote.quoteNumber} est signé. Identifiant : ${identifier}. Mot de passe : ${password}. Connexion : ${loginUrl}`,
      quoteId: quote.id,
      projectId: quote.projectId || "",
      createdAt: now
    });
  }
}

export async function ensureClientPortalAccess(db, quote, body, request, now) {
  const signedEmail = normalizeEmail(body.signerEmail || quote.signerEmail || quote.clientEmail);
  const signedPhone = fixText(body.signerPhone || quote.clientPhone || "");
  const signedPhoneDigits = normalizePhone(signedPhone);
  if (!signedEmail && !signedPhoneDigits) return null;

  const syntheticEmail = signedEmail || `client-${signedPhoneDigits}@koji.local`;
  const userIndex = db.users.findIndex((candidate) => {
    const candidateType = candidate.accountType || "entreprise";
    const candidatePhone = normalizePhone(candidate.phone || candidate.personal?.phone);
    return candidateType === "particulier" && (
      normalizeEmail(candidate.email) === syntheticEmail ||
      (signedEmail && normalizeEmail(candidate.email) === signedEmail) ||
      (signedPhoneDigits && candidatePhone === signedPhoneDigits)
    );
  });

  // A fresh temporary password each time (rather than reusing/resending an old
  // one) means the account never needs its plaintext password kept around —
  // only the hash is stored (see lib/password-hash.js).
  const password = makeTemporaryPassword();
  const { salt: passwordSalt, hash: passwordHash } = hashPassword(password);
  const existing = userIndex === -1 ? null : db.users[userIndex];
  const clientAccess = {
    ...(existing?.clientAccess || {}),
    quoteIds: uniqueList([...(existing?.clientAccess?.quoteIds || []), quote.id]),
    projectIds: uniqueList([...(existing?.clientAccess?.projectIds || []), quote.projectId || ""]),
    lastQuoteId: quote.id,
    lastProjectId: quote.projectId || "",
    updatedAt: now
  };

  const user = {
    ...(existing || {}),
    id: existing?.id || makeToken("client"),
    email: existing?.email || syntheticEmail,
    password: undefined,
    passwordHash,
    passwordSalt,
    portalIdentifier: existing?.portalIdentifier || makePortalIdentifier(),
    name: fixText(body.signerName || quote.signerName || quote.client || existing?.name || "Client Koji"),
    accountType: "particulier",
    isActive: true,
    activationToken: existing?.activationToken || "",
    activationExpiresAt: existing?.activationExpiresAt || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastLoginAt: existing?.lastLoginAt || "",
    businessInfoComplete: existing?.businessInfoComplete || false,
    profileComplete: true,
    business: existing?.business || {},
    personal: {
      ...(existing?.personal || {}),
      phone: signedPhone || existing?.personal?.phone || "",
      sourceQuoteId: quote.id
    },
    professions: existing?.professions || [],
    clientAccess
  };

  if (userIndex === -1) db.users.push(user);
  else db.users[userIndex] = user;

  const origin = new URL(request.url).origin;
  const loginUrl = `${origin}/login?type=particulier`;
  const portalUrl = `${origin}/client`;
  const deliveryTarget = { email: signedEmail, phone: signedPhoneDigits ? signedPhone : "" };
  queueClientAccessMessages(db, { user, password, quote, loginUrl, portalUrl, deliveryTarget, now });
  if (signedEmail) {
    await sendClientAccessEmail({
      email: signedEmail,
      identifier: user.portalIdentifier,
      password,
      loginUrl,
      quoteNumber: quote.quoteNumber
    });
  }

  return {
    userId: user.id,
    identifier: signedEmail || signedPhone,
    portalIdentifier: user.portalIdentifier,
    password,
    email: signedEmail,
    phone: signedPhone,
    loginUrl,
    portalUrl,
    sentByEmail: Boolean(signedEmail),
    sentBySms: Boolean(signedPhoneDigits)
  };
}
