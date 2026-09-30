import nodemailer from "nodemailer";

let transporter = null;

function buildTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const secure = port === 465;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: { user, pass },
  });
  return transporter;
}

const FROM = process.env.SMTP_FROM || `Koji <${process.env.SMTP_USER || "noreply@kojibuild.com"}>`;

async function sendMailVerbose({ to, subject, text, html, replyTo }) {
  const t = buildTransporter();
  if (!t) {
    console.warn("[mailer] SMTP non configuré — variables SMTP_HOST/SMTP_USER/SMTP_PASS manquantes");
    return { ok: false, error: "SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS manquants)" };
  }
  try {
    const info = await t.sendMail({ from: FROM, to, subject, text, html, replyTo: replyTo || undefined });
    console.log("[mailer] envoyé:", info.messageId, "→", to);
    return { ok: true, error: null };
  } catch (err) {
    console.error("[mailer] erreur envoi:", err.message, "| SMTP:", process.env.SMTP_HOST, process.env.SMTP_USER);
    transporter = null;
    return { ok: false, error: err.message };
  }
}

function clientAccessHtml({ identifier, password, loginUrl, quoteNumber }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#0a1538;padding:28px 36px;text-align:center">
          <span style="font-size:28px;font-weight:800;color:#f5c842;letter-spacing:2px">KOJI</span>
        </td></tr>
        <tr><td style="padding:36px 36px 20px">
          <h1 style="margin:0 0 12px;font-size:22px;color:#0a1538">Votre espace Koji Particulier</h1>
          <p style="margin:0 0 20px;color:#4a5568;line-height:1.6">
            Suivez l'avancement de votre chantier (devis ${quoteNumber || ""}) avec ces identifiants :
          </p>
          <table width="100%" cellpadding="8" cellspacing="0" style="background:#f4f6fb;border-radius:10px;margin-bottom:24px">
            <tr><td style="color:#4a5568;font-size:13px">Identifiant</td><td style="font-weight:700;color:#0a1538">${identifier || ""}</td></tr>
            <tr><td style="color:#4a5568;font-size:13px">Mot de passe</td><td style="font-weight:700;color:#0a1538">${password || ""}</td></tr>
          </table>
          <a href="${loginUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Accéder à mon espace
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendClientAccessEmail({ email, identifier, password, loginUrl, quoteNumber }) {
  const text = `Votre espace Koji Particulier — Identifiant: ${identifier}, Mot de passe: ${password}, Connexion: ${loginUrl}`;
  return sendMailVerbose({
    to: email,
    subject: "Votre espace Koji Particulier — Suivi de chantier",
    text,
    html: clientAccessHtml({ identifier, password, loginUrl, quoteNumber })
  });
}

// Boîte de réception des réclamations et demandes d'aide (bouton "Signaler
// un problème technique" dans Paramètres, les 3 profils).
const SUPPORT_INBOX = "contact@kojibuild.com";

export async function sendTechnicalReportEmail({ message, accountType, sessionKind, page, userId, name, email, company }) {
  const who = [name, company].filter(Boolean).join(" — ") || "Nom inconnu";
  const text = [
    `Nouveau signalement (${sessionKind || accountType || "compte inconnu"})`,
    `De: ${who}`,
    `Email: ${email || "inconnu"}`,
    `Identifiant compte: ${userId || "?"}`,
    `Page d'origine: ${page || "?"}`,
    "",
    message
  ].join("\n");
  return sendMailVerbose({
    to: SUPPORT_INBOX,
    replyTo: email || undefined,
    subject: `[Koji] Signalement technique — ${name || company || accountType || sessionKind || "compte"}`,
    text,
    html: `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`
  });
}

// Demande de suppression de compte (RGPD art. 17, 30 septembre) — traitee
// manuellement plutot qu'une suppression automatique instantanee : les
// devis/factures doivent rester consultables plusieurs annees (obligations
// comptables) et les donnees sont partagees avec l'app mobile (memes tables
// Supabase). Meme structure que sendTechnicalReportEmail ci-dessus.
export async function sendDeletionRequestEmail({ accountType, sessionKind, reason, userId, name, email, company }) {
  const who = [name, company].filter(Boolean).join(" — ") || "Nom inconnu";
  const text = [
    `Nouvelle demande de suppression de compte (${sessionKind || accountType || "compte inconnu"})`,
    `De: ${who}`,
    `Email: ${email || "inconnu"}`,
    `Identifiant compte: ${userId || "?"}`,
    "",
    reason ? `Precision de la personne: ${reason}` : "(aucune precision donnee)",
    "",
    "Rappel: ne pas supprimer les devis/factures deja emis avant d'avoir verifie le delai de conservation comptable legal."
  ].join("\n");
  return sendMailVerbose({
    to: SUPPORT_INBOX,
    replyTo: email || undefined,
    subject: `[Koji] Demande de suppression de compte — ${name || company || accountType || sessionKind || "compte"}`,
    text,
    html: `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`
  });
}

// Alerte a Amira a chaque expertise IA publiee (garde-fou beta, cahier des
// charges / decisions du 4 septembre) — lien vers le devis interne, encore
// corrigeable tant qu'aucune entreprise ne s'est positionnee sur l'offre.
export async function sendExpertiseAlertEmail({ to, offreId, expertiseId, priceRangeMin, priceRangeMax, description, devisUrl }) {
  const text = [
    "Nouvelle expertise Radar des Chantiers publiee",
    `Chantier: ${description || "(sans description)"}`,
    `Fourchette publiee: ${priceRangeMin}€ - ${priceRangeMax}€`,
    `Offre: ${offreId}`,
    `Devis interne (corrigeable tant qu'aucune entreprise ne s'est positionnee): ${devisUrl}`
  ].join("\n");
  return sendMailVerbose({
    to,
    subject: `[Koji] Expertise publiee — ${priceRangeMin}€-${priceRangeMax}€`,
    text,
    html: `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`
  });
}

// Compte "Koji" (particulier / Radar des Chantiers) — validation d'e-mail
// avant premiere connexion, via le meme /api/auth/activate deja utilise
// (generique sur db.users, pas specifique a un type de compte).
export async function sendParticulierVerificationEmail({ email, name, activationUrl }) {
  const text = [
    `Bonjour ${name || ""},`,
    "Bienvenue sur Koji !",
    "Confirmez votre e-mail pour activer votre compte et accéder à Radar des Chantiers :",
    activationUrl
  ].join("\n");
  return sendMailVerbose({
    to: email,
    subject: "Confirmez votre compte Koji",
    text,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:linear-gradient(135deg,#1d74ff,#6a2fd0);padding:28px 36px;text-align:center">
          <span style="font-size:26px;font-weight:800;color:white;letter-spacing:2px">KOJI</span>
        </td></tr>
        <tr><td style="padding:36px 36px 32px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0a1538">Bienvenue sur Koji${name ? ", " + name : ""} !</h1>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">
            Confirmez votre e-mail pour activer votre compte et publier vos premières offres sur Radar des Chantiers.
          </p>
          <a href="${activationUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Confirmer mon e-mail
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  });
}
