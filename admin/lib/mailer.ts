import nodemailer from 'nodemailer'

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null

function buildTransporter() {
  if (transporter) return transporter
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  const secure = port === 465
  transporter = nodemailer.createTransport({ host, port, secure, requireTLS: !secure, auth: { user, pass } })
  return transporter
}

const FROM = process.env.SMTP_FROM || `Koji <${process.env.SMTP_USER || 'noreply@kojibuild.com'}>`

// Version simplifiee de lib/mailer.js cote koji-web (meme SMTP, memes
// variables d'env) — sans les templates HTML specifiques a koji-web
// (bienvenue, devis signe, etc.), juste l'envoi brut utilise par la page
// Communications.
export async function sendMail({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) {
  const t = buildTransporter()
  if (!t) {
    return { ok: false, error: 'SMTP non configuré (SMTP_HOST/SMTP_USER/SMTP_PASS manquants)' }
  }
  try {
    await t.sendMail({ from: FROM, to, subject, text, html })
    return { ok: true, error: null }
  } catch (err) {
    transporter = null
    return { ok: false, error: (err as Error).message }
  }
}
