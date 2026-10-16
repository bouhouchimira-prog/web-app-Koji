import { badRequest, ok } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { makeToken } from "../../../../lib/db";
import { sendEntrepriseVerificationEmail } from "../../../../lib/mailer";

const ACTIVATION_TTL_MS = 48 * 60 * 60 * 1000;

// Renvoie l'email d'activation d'un compte entreprise (16 oct) — pour le cas
// ou le premier email n'est jamais arrive (SMTP, filtre anti-spam...).
// Reponse volontairement identique que le compte existe ou non/soit deja
// actif, pour ne pas laisser deviner quels emails sont inscrits.
const GENERIC_MESSAGE = "Si un compte existe avec cet e-mail et n'est pas encore activé, un nouvel e-mail d'activation vient d'être envoyé.";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return badRequest("Adresse e-mail invalide.");

  try {
    const admin = getSupabaseAdmin();
    const { data: row } = await admin.from("users").select("id, email, email_verified").eq("email", email).maybeSingle();
    if (row && row.email_verified === false) {
      const activationToken = makeToken("activate");
      const activationExpiresAt = new Date(Date.now() + ACTIVATION_TTL_MS).toISOString();
      await admin.from("users").update({ email_verify_token: activationToken, email_verify_expires_at: activationExpiresAt }).eq("id", row.id);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const activationUrl = `${appUrl}/activate?token=${activationToken}&type=entreprise`;
      await sendEntrepriseVerificationEmail({ email: row.email, activationUrl });
    }
  } catch {
    // Degradation gracieuse — la reponse reste la meme generique.
  }

  return ok({ message: GENERIC_MESSAGE });
}
