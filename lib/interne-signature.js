import { createHmac, timingSafeEqual } from "node:crypto";

// Appels internes back-office → site (admin.getkoji.io → getkoji.io) :
// en-tête « x-koji-interne: <horodatage>.<signature> », HMAC-SHA256 de
// « <horodatage>.<corps> » avec une clé dérivée de la clé de service
// Supabase (déjà présente, la même, dans les deux projets Vercel). Valable
// 5 minutes. Le back-office calcule la même chose (admin/lib/bo/moderation.ts).
export const ENTETE_INTERNE = "x-koji-interne";
const FENETRE_MS = 5 * 60 * 1000;

export function cleInterne(secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "") {
  return secret ? createHmac("sha256", secret).update("koji-appels-internes-v1").digest() : null;
}

export function signerInterne(corps, cle, maintenant = Date.now()) {
  const t = String(maintenant);
  return `${t}.${createHmac("sha256", cle).update(`${t}.${corps}`).digest("base64url")}`;
}

export function verifierInterne(entete, corps, cle, maintenant = Date.now()) {
  if (!cle || !entete) return false;
  const [t, sig] = String(entete).split(".");
  const quand = Number(t);
  if (!Number.isFinite(quand) || Math.abs(maintenant - quand) > FENETRE_MS || !sig) return false;
  const attendu = Buffer.from(signerInterne(corps, cle, quand).split(".")[1]);
  const recu = Buffer.from(sig);
  return attendu.length === recu.length && timingSafeEqual(attendu, recu);
}
