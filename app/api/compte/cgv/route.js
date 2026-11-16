import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../../lib/http";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { fixText } from "../../../../lib/text";

// Conditions générales de vente de l'entreprise (maquette PRO-15.2) : un
// PDF déposé par elle, joint à chaque devis envoyé par e-mail. GET (relire)
// · POST multipart « cgv » · DELETE. Fichier dans le stockage privé ; seul
// son nom et sa date sont dans le profil.
const BUCKET = "quote_attachments";
const chemin = (userId) => `compte/${userId}/cgv.pdf`;

async function infoDe(entreprise) {
  const { data } = await entreprise.supabase.from("users").select("business_info").eq("id", entreprise.userId).maybeSingle();
  return data?.business_info || {};
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const info = await infoDe(entreprise);
  if (!info.cgv?.nom) return badRequest("Aucune CGV déposée.", 404);
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(chemin(entreprise.userId));
  if (error || !data) return badRequest("Fichier introuvable.", 404);
  return new NextResponse(Buffer.from(await data.arrayBuffer()), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="CGV.pdf"` } });
}

export async function POST(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const form = await request.formData().catch(() => null);
  const fichier = form?.get("cgv");
  if (!fichier || typeof fichier === "string") return badRequest("Fichier manquant.");
  if (fichier.type !== "application/pdf") return badRequest("Déposez vos CGV en PDF.");
  if (fichier.size > 3 * 1024 * 1024) return badRequest("PDF trop lourd (3 Mo au plus).");
  const buffer = Buffer.from(await fichier.arrayBuffer());
  if (buffer.subarray(0, 5).toString() !== "%PDF-") return badRequest("Ce fichier n'est pas un PDF.");
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(chemin(entreprise.userId), buffer, { contentType: "application/pdf", upsert: true });
  if (error) return badRequest("Dépôt impossible. Réessayez.", 500);
  const info = await infoDe(entreprise);
  const cgv = { nom: fixText(String(fichier.name || "CGV.pdf")).slice(0, 80), le: new Date().toISOString() };
  const { error: e2 } = await entreprise.supabase.from("users").update({ business_info: { ...info, cgv } }).eq("id", entreprise.userId);
  if (e2) return badRequest(`Enregistrement impossible : ${e2.message}`, 500);
  return ok({ cgv });
}

export async function DELETE(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const info = await infoDe(entreprise);
  const { cgv, ...reste } = info; // eslint-disable-line no-unused-vars
  await getSupabaseAdmin().storage.from(BUCKET).remove([chemin(entreprise.userId)]).catch(() => null);
  const { error } = await entreprise.supabase.from("users").update({ business_info: reste }).eq("id", entreprise.userId);
  if (error) return badRequest(`Enregistrement impossible : ${error.message}`, 500);
  return ok({ cgv: null });
}
