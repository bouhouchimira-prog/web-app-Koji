import { readDb, writeDb } from "./db";

export async function queueActivationEmail({ email, name, activationUrl, accountType }) {
  const db = await readDb();
  const message = {
    id: `mail-${Date.now()}`,
    to: email,
    type: "activation",
    accountType,
    subject: "Activation de votre compte Koji",
    text: `Bonjour ${name}, activez votre compte: ${activationUrl}`,
    html: `<p>Bonjour ${name},</p><p>Activez votre compte en cliquant ici:</p><p><a href="${activationUrl}">${activationUrl}</a></p>`,
    createdAt: new Date().toISOString()
  };
  db.mailOutbox.unshift(message);
  await writeDb(db);
  return message;
}

export async function queueResetPasswordEmail({ email, name, resetUrl, accountType }) {
  const db = await readDb();
  const message = {
    id: `mail-${Date.now()}`,
    to: email,
    type: "reset-password",
    accountType,
    subject: "Reinitialisation de votre mot de passe Koji",
    text: `Bonjour ${name}, creez un nouveau mot de passe: ${resetUrl}`,
    html: `<p>Bonjour ${name},</p><p>Creez un nouveau mot de passe en cliquant ici:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    createdAt: new Date().toISOString()
  };
  db.mailOutbox.unshift(message);
  await writeDb(db);
  return message;
}
