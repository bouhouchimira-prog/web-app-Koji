import { readDb, writeDb } from "./db";

// ── SMTP transport (optional — works without env vars, falls back to queue only) ──
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodemailer = require("nodemailer");
    transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    return transporter;
  } catch {
    return null;
  }
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM = process.env.SMTP_FROM || `Kôji <${process.env.SMTP_USER || "noreply@koji.app"}>`;

async function sendMail({ to, subject, text, html }) {
  const t = await getTransporter();
  if (!t) return false;
  try {
    await t.sendMail({ from: FROM, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[mailer] sendMail error:", err.message);
    return false;
  }
}

function activationHtml(name, activationUrl) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#0a1538;padding:28px 36px;text-align:center">
          <span style="font-size:28px;font-weight:800;color:#f5c842;letter-spacing:2px">KÔJI</span>
        </td></tr>
        <tr><td style="padding:36px 36px 20px">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0a1538">Bonjour ${name} 👋</h1>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">
            Merci de vous être inscrit sur Kôji. Cliquez sur le bouton ci-dessous pour activer votre compte et commencer à gérer vos devis et chantiers.
          </p>
          <a href="${activationUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Activer mon compte
          </a>
          <p style="margin:24px 0 0;color:#9aa5b4;font-size:13px">
            Ce lien expire dans <strong>24 heures</strong>. Si vous n'avez pas créé de compte Kôji, ignorez cet email.
          </p>
        </td></tr>
        <tr><td style="padding:16px 36px 32px;border-top:1px solid #edf2f7">
          <p style="margin:0;color:#9aa5b4;font-size:12px">
            Lien direct : <a href="${activationUrl}" style="color:#3b6fdb">${activationUrl}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function resetHtml(name, resetUrl) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#0a1538;padding:28px 36px;text-align:center">
          <span style="font-size:28px;font-weight:800;color:#f5c842;letter-spacing:2px">KÔJI</span>
        </td></tr>
        <tr><td style="padding:36px 36px 20px">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0a1538">Réinitialisation du mot de passe</h1>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">
            Bonjour ${name}, vous avez demandé à réinitialiser votre mot de passe Kôji. Cliquez sur le bouton ci-dessous.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Nouveau mot de passe
          </a>
          <p style="margin:24px 0 0;color:#9aa5b4;font-size:13px">Ce lien expire dans 2 heures.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function queueActivationEmail({ email, name, activationUrl, accountType }) {
  const db = await readDb();
  const message = {
    id: `mail-${Date.now()}`,
    to: email,
    type: "activation",
    accountType,
    subject: "Activez votre compte Kôji",
    text: `Bonjour ${name}, activez votre compte ici : ${activationUrl}`,
    html: activationHtml(name, activationUrl),
    createdAt: new Date().toISOString()
  };
  db.mailOutbox.unshift(message);
  await writeDb(db);
  const sent = await sendMail({ to: email, subject: message.subject, text: message.text, html: message.html });
  return { ...message, sent };
}

export async function queueResetPasswordEmail({ email, name, resetUrl, accountType }) {
  const db = await readDb();
  const message = {
    id: `mail-${Date.now()}`,
    to: email,
    type: "reset-password",
    accountType,
    subject: "Réinitialisation de votre mot de passe Kôji",
    text: `Bonjour ${name}, créez un nouveau mot de passe : ${resetUrl}`,
    html: resetHtml(name, resetUrl),
    createdAt: new Date().toISOString()
  };
  db.mailOutbox.unshift(message);
  await writeDb(db);
  const sent = await sendMail({ to: email, subject: message.subject, text: message.text, html: message.html });
  return { ...message, sent };
}
