import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";

// Fiche de clôture d'un chantier dans db.clotures (PRO-02.4 / 02.5) : PV,
// retenue, avis, dossier de fin. Partagé par /api/cloture et
// /api/dossier-fin.

export const BUCKET_CHANTIER = "quote_attachments";

export async function chantierAMoi(projectId, userId) {
  const { data } = await getSupabaseAdmin().from("chantiers").select("*").eq("id", projectId).maybeSingle();
  return data && data.user_id === userId ? data : null;
}

export async function devisDuChantier(projectId) {
  const { data } = await getSupabaseAdmin().from("quotes").select("*").eq("chantier_id", projectId).order("created_at", { ascending: false });
  const devis = (data || []).map(mapQuote);
  return devis.find((q) => q.status === "Signe" || q.signatureStatus === "Signe") || devis[0] || null;
}

export function adresseChantier(chantier) {
  return [chantier?.street, chantier?.postal_code, chantier?.city].filter(Boolean).join(", ");
}

export function clotureDe(db, projectId, userId) {
  return (db.clotures || []).find((c) => c.projectId === projectId && c.userId === userId) || null;
}

export function nouvelleCloture(userId, projectId) {
  return { id: randomUUID(), userId, projectId, pv: null, retenue: { taux: 0, rappelId: "", libereeLe: "" }, avis: { programme: false, demandeLe: "" }, dossier: { remisLe: "", envoyeA: "", pieces: [] }, creeLe: new Date().toISOString() };
}

export function clotureOuNouvelle(db, projectId, userId) {
  let cloture = clotureDe(db, projectId, userId);
  if (!cloture) {
    cloture = nouvelleCloture(userId, projectId);
    db.clotures = [...(db.clotures || []), cloture];
  }
  cloture.dossier = { remisLe: "", envoyeA: "", pieces: [], ...(cloture.dossier || {}) };
  return cloture;
}

// Ce que le navigateur reçoit : sans les chemins de stockage.
export function sansChemins(cloture) {
  if (!cloture) return cloture;
  const out = { ...cloture };
  if (cloture.pv) {
    const { signatureClient, signaturePro, ...pv } = cloture.pv;
    out.pv = { ...pv, signe: Boolean(signatureClient) };
  }
  if (cloture.dossier) out.dossier = { ...cloture.dossier, pieces: (cloture.dossier.pieces || []).map(({ path, ...p }) => p) };
  return out;
}

export async function telechargerDataUrl(chemin, type = "image/png") {
  if (!chemin) return "";
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).download(chemin);
  if (error || !data) return "";
  return `data:${type};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
}

export async function telechargerOctets(chemin) {
  if (!chemin) return null;
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).download(chemin);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
