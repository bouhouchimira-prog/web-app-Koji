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

// Lien kojibuild.com dans chaque email envoye (1er oct, demande d'Amira) —
// ajoute systematiquement a la fin du texte brut et comme pied de page HTML,
// quel que soit l'email (interne ou destine a un utilisateur).
const SITE_URL = "https://kojibuild.com";
const FOOTER_TEXT = `\n\n—\nKoji — ${SITE_URL}`;
const FOOTER_HTML = `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr><td style="padding:18px 36px;border-top:1px solid #e5e7eb;text-align:center">
  <a href="${SITE_URL}" style="color:#8890a8;text-decoration:none;font-size:12px;font-family:Inter,Arial,sans-serif">${SITE_URL.replace("https://", "")}</a>
</td></tr></table>`;

function appendFooterHtml(html) {
  if (typeof html !== "string" || !html) return html;
  if (html.includes("</body>")) return html.replace("</body>", `${FOOTER_HTML}</body>`);
  return `${html}${FOOTER_HTML}`;
}

async function sendMailVerbose({ to, subject, text, html, replyTo, attachments }) {
  const t = buildTransporter();
  if (!t) {
    console.warn("[mailer] SMTP non configuré — variables SMTP_HOST/SMTP_USER/SMTP_PASS manquantes");
    return { ok: false, error: "SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS manquants)" };
  }
  const finalText = typeof text === "string" && text ? `${text}${FOOTER_TEXT}` : text;
  const finalHtml = appendFooterHtml(html);
  try {
    const info = await t.sendMail({ from: FROM, to, subject, text: finalText, html: finalHtml, replyTo: replyTo || undefined, attachments: attachments || undefined });
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

// Envoi reel du devis au client (16 oct, fenetre "Envoyer le devis",
// maquette Artifact DevisEnvoi) — jusque-la, "Envoyer" ne faisait que
// generer les acces de signature pour que l'entreprise les copie-colle
// elle-meme (voir app/api/quotes/route.js::buildSignatureAccess, qui
// pousse un brouillon dans db.mailOutbox mais sans jamais rien envoyer).
function quoteEmailHtml({ clientName, message, signatureUrl, identifier, password, includeSignatureLink, includeCredentials }) {
  const messageHtml = (message || "").split("\n").map((line) => `<p style="margin:0 0 10px;color:#1E2430;line-height:1.6">${line}</p>`).join("");
  const linkBlock = includeSignatureLink && signatureUrl
    ? `<a href="${signatureUrl}" style="display:inline-block;background:#16233F;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;margin-top:12px">Consulter et signer le devis</a>`
    : "";
  const credsBlock = includeCredentials && identifier
    ? `<table width="100%" cellpadding="8" cellspacing="0" style="background:#f4f6fb;border-radius:10px;margin:16px 0">
        <tr><td style="color:#4a5568;font-size:13px">Identifiant</td><td style="font-weight:700;color:#0a1538">${identifier}</td></tr>
        <tr><td style="color:#4a5568;font-size:13px">Mot de passe</td><td style="font-weight:700;color:#0a1538">${password || ""}</td></tr>
      </table>`
    : "";
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
          ${messageHtml}
          ${credsBlock}
          ${linkBlock}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendQuoteToClientEmail({
  to, subject, message, quoteNumber, pdfBuffer, pdfFilename,
  signatureUrl, identifier, password, includePdf, includeSignatureLink, includeCredentials
}) {
  const textLines = [message || `Votre devis ${quoteNumber || ""} est prêt.`];
  if (includeSignatureLink && signatureUrl) textLines.push(`Lien de signature : ${signatureUrl}`);
  if (includeCredentials && identifier) textLines.push(`Identifiant : ${identifier}`, `Mot de passe : ${password || ""}`);
  const attachments = includePdf && pdfBuffer
    ? [{ filename: pdfFilename || `devis-${quoteNumber || ""}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
    : undefined;
  return sendMailVerbose({
    to,
    subject: subject || `Votre devis ${quoteNumber || ""}`,
    text: textLines.join("\n"),
    html: quoteEmailHtml({ message, signatureUrl, identifier, password, includeSignatureLink, includeCredentials }),
    attachments
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

// Alerte a TOUTES les entreprises inscrites a chaque nouvelle offre Radar
// des Chantiers publiee (1er oct, demande d'Amira) — sans filtrage par
// metier (choix explicite d'Amira). Distinct de sendExpertiseAlertEmail
// ci-dessous, qui reste l'alerte interne a l'administrateur uniquement.
export async function sendNewOfferEmailToEntreprises({ emails, metier, description, offreId, marketplaceUrl }) {
  const text = [
    "Nouvelle offre disponible sur le Marketplace Koji",
    `Métier : ${metier || "non précisé"}`,
    `Chantier : ${description || "(sans description)"}`,
    `Voir l'offre : ${marketplaceUrl}`
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:#0a1538;padding:28px 36px;text-align:center">
          <span style="font-size:26px;font-weight:800;color:#f5c842;letter-spacing:2px">KOJI</span>
        </td></tr>
        <tr><td style="padding:36px 36px 20px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0a1538">Nouvelle offre sur le Marketplace</h1>
          <p style="margin:0 0 4px;color:#4a5568;font-size:13px;text-transform:uppercase;letter-spacing:.03em;font-weight:700">${(metier || "Non précisé").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">${(description || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</p>
          <a href="${marketplaceUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Voir l'offre
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const list = Array.isArray(emails) ? emails.filter(Boolean) : [];
  const results = await Promise.allSettled(
    list.map((to) => sendMailVerbose({ to, subject: `[Koji] Nouvelle offre — ${metier || "Marketplace"}`, text, html }))
  );
  return { sent: results.filter((r) => r.status === "fulfilled" && r.value?.ok).length, total: list.length };
}

// Alerte a Amira a chaque expertise IA publiee (garde-fou beta, cahier des
// charges / decisions du 4 septembre) — lien vers le devis interne, encore
// corrigeable tant qu'aucune entreprise ne s'est positionnee sur l'offre.
export async function sendExpertiseAlertEmail({ to, offreId, expertiseId, description, devisUrl }) {
  const text = [
    "Nouvelle expertise Radar des Chantiers publiee",
    `Chantier: ${description || "(sans description)"}`,
    `Offre: ${offreId}`,
    `Devis interne (corrigeable tant qu'aucune entreprise ne s'est positionnee): ${devisUrl}`
  ].join("\n");
  return sendMailVerbose({
    to,
    subject: "[Koji] Expertise publiee",
    text,
    html: `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]))}</pre>`
  });
}

// Compte "Koji" (particulier / Radar des Chantiers) — validation d'e-mail
// avant premiere connexion, via le meme /api/auth/activate deja utilise
// (generique sur db.users, pas specifique a un type de compte).
// Verification d'email pour les comptes entreprise (16 oct, demande
// d'Amira suite a un signup teste sans email reçu) — meme gabarit que
// sendParticulierVerificationEmail, texte adapte au compte Koji Pro.
export async function sendEntrepriseVerificationEmail({ email, name, activationUrl }) {
  const text = [
    `Bonjour ${name || ""},`,
    "Bienvenue sur Koji Pro !",
    "Confirmez votre e-mail pour activer votre compte entreprise et accéder à votre espace koji :",
    activationUrl
  ].join("\n");
  return sendMailVerbose({
    to: email,
    subject: "Confirmez votre compte Koji Pro",
    text,
    html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr><td style="background:linear-gradient(135deg,#1d74ff,#6a2fd0);padding:28px 36px;text-align:center">
          <span style="font-size:26px;font-weight:800;color:white;letter-spacing:2px">KOJI PRO</span>
        </td></tr>
        <tr><td style="padding:36px 36px 32px">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0a1538">Bienvenue sur Koji Pro${name ? ", " + name : ""} !</h1>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">
            Confirmez votre e-mail pour activer votre compte entreprise et commencer à créer vos devis, suivre vos chantiers et facturer vos clients.
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

// Reinitialisation de mot de passe (16 oct, demande d'Amira apres le bug de
// l'email d'activation) — meme constat : app/api/auth/forgot-password
// s'appuyait sur supabase.auth.resetPasswordForEmail(), le meme mecanisme
// Supabase peu fiable que l'ancien email d'activation. Remplace par un email
// maison via le SMTP Hostinger, pour les comptes entreprise comme
// particulier (voir app/api/auth/forgot-password/route.js).
export async function sendPasswordResetEmail({ email, name, resetUrl }) {
  const text = [
    `Bonjour ${name || ""},`,
    "Vous avez demandé à réinitialiser votre mot de passe Koji.",
    "Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 2 heures) :",
    resetUrl,
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail."
  ].join("\n");
  return sendMailVerbose({
    to: email,
    subject: "Réinitialisez votre mot de passe Koji",
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
          <h1 style="margin:0 0 12px;font-size:20px;color:#0a1538">Réinitialisez votre mot de passe</h1>
          <p style="margin:0 0 24px;color:#4a5568;line-height:1.6">
            Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable 2 heures.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#0a1538;color:white;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
            Choisir un nouveau mot de passe
          </a>
          <p style="margin:24px 0 0;color:#9ca3af;font-size:12.5px;line-height:1.6">
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail — votre mot de passe actuel reste inchangé.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  });
}

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
