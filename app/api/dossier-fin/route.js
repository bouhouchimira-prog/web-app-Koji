import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { BUCKET_CHANTIER, chantierAMoi, clotureDe, clotureOuNouvelle, sansChemins, telechargerOctets } from "../../../lib/cloture-db";
import { assemblerDossier, decennaleDe } from "../../../lib/dossier-fin-serveur";
import { buildInvoicePdf, invoiceDocumentFilename } from "../../../lib/document-generator";
import { loadInvoiceContext } from "../../../lib/invoice-context";
import { sendClientMessageEmail } from "../../../lib/mailer";

// Dossier de fin de chantier (maquette PRO-02.5), site et app Koji Pro.
// GET ?projectId= → { dossier, decennale } · GET ?projectId=&pdf=1 → PDF.
// POST multipart { file, projectId, kind: notice | plan, titre } ajoute une
// pièce (bucket privé) · POST { projectId, action: "envoyer" } envoie le
// dossier au client par e-mail (PDF, facture de solde, notices) et le rend
// visible dans Koji Client · PATCH { projectId, action: "retirer", pieceId }.

const DUREE_LIEN = 3600;
const TYPES = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const TAILLE_MAX = 10 * 1024 * 1024;
const PIECES_MAX = 12;
const PIECES_JOINTES_MAX = 15 * 1024 * 1024;

function texte(v, max) {
  return String(v || "").trim().slice(0, max);
}

async function avecLiens(pieces) {
  if (!pieces.length) return [];
  const { data } = await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).createSignedUrls(pieces.map((p) => p.path), DUREE_LIEN);
  return pieces.map(({ path, ...p }, i) => ({ ...p, url: data?.[i]?.signedUrl || "" }));
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";
  if (!projectId) return badRequest("Chantier manquant.");
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();

  if (url.searchParams.get("pdf") === "1") {
    const { pdf, filename } = await assemblerDossier(db, userId, chantier);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store"
      }
    });
  }

  const dossier = clotureDe(db, projectId, userId)?.dossier || {};
  return ok({
    dossier: { remisLe: dossier.remisLe || "", envoyeA: dossier.envoyeA || "", pieces: await avecLiens(dossier.pieces || []) },
    decennale: await decennaleDe(userId)
  });
}

export async function POST(request) {
  const multipart = (request.headers.get("content-type") || "").includes("multipart/form-data");
  if (multipart) return ajouterPiece(request);

  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (body.action !== "envoyer") return badRequest("Action inconnue.");
  const projectId = texte(body.projectId, 80);
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  const { pdf, filename, devis, pieces, factureSolde, titre, cloture } = await assemblerDossier(db, userId, chantier);
  const destinataire = texte(devis?.clientEmail || chantier.client_email, 160);
  if (!destinataire) return badRequest("Pas d'e-mail client sur ce chantier : ajoutez-le au devis.");

  const attachments = [{ filename, content: pdf, contentType: "application/pdf" }];
  if (factureSolde) {
    const { quote, project } = await loadInvoiceContext(factureSolde);
    attachments.push({ filename: invoiceDocumentFilename(factureSolde), content: buildInvoicePdf({ invoice: factureSolde, quote, project, db }), contentType: "application/pdf" });
  }
  let taille = attachments.reduce((n, a) => n + a.content.length, 0);
  for (const p of pieces) {
    if (p.taille && taille + p.taille > PIECES_JOINTES_MAX) continue;
    const octets = await telechargerOctets(p.path);
    if (!octets) continue;
    taille += octets.length;
    attachments.push({ filename: `${p.titre.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || p.kind}.${TYPES[p.type] || "pdf"}`, content: octets, contentType: p.type });
  }

  const entreprise = devis?.company?.name || "";
  const client = cloture?.pv?.signataire || devis?.client || "";
  const message = [
    `Bonjour${client ? ` ${client}` : ""},`,
    "",
    `Vos travaux « ${titre} » sont terminés. Vous trouverez ci-joint le dossier de fin de chantier : photos avant / après, conseils d'entretien, garanties et documents${factureSolde ? `, avec la facture de solde ${factureSolde.invoiceNumber}` : ""}.`,
    "",
    "Gardez-le précieusement : les garanties courent à partir de la réception. Vous le retrouvez aussi à tout moment dans votre espace Koji Client.",
    "",
    entreprise || "Votre artisan"
  ].join("\n");
  const envoi = await sendClientMessageEmail({ to: destinataire, subject: `Dossier de fin de chantier · ${titre}`, message, replyTo: devis?.company?.email || devis?.companyEmail || undefined, attachments });
  if (!envoi.ok) return badRequest(`Le dossier n'a pas pu partir : ${envoi.error}`, 502);

  const fiche = clotureOuNouvelle(db, projectId, userId);
  fiche.dossier.remisLe = new Date().toISOString();
  fiche.dossier.envoyeA = destinataire;
  fiche.majLe = fiche.dossier.remisLe;
  addHistory(db, { userId, type: "chantier.dossier_fin", label: `Dossier de fin de chantier envoyé à ${destinataire}`, entityId: projectId, entityType: "project", meta: { projectId, pieces: attachments.length } });
  await writeDb(db);
  return ok({ cloture: sansChemins(fiche) });
}

async function ajouterPiece(request) {
  let form;
  try { form = await request.formData(); } catch { return badRequest("Fichier illisible."); }
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = texte(form.get("projectId"), 80);
  const kind = form.get("kind") === "plan" ? "plan" : "notice";
  const file = form.get("file");
  if (!file || typeof file === "string") return badRequest("Choisissez un fichier.");
  if (!TYPES[file.type]) return badRequest("Formats acceptés : PDF, JPEG ou PNG.");
  if (file.size > TAILLE_MAX) return badRequest("Fichier trop lourd (10 Mo au plus).");
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  const cloture = clotureOuNouvelle(db, projectId, userId);
  if (cloture.dossier.pieces.length >= PIECES_MAX) return badRequest("Douze pièces au plus dans le dossier.");
  const id = randomUUID();
  const path = `chantier-dossier/${userId}/${projectId}/${id}.${TYPES[file.type]}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return badRequest(`Fichier non enregistré : ${error.message}`, 500);
  const titre = texte(form.get("titre"), 80) || texte(String(file.name || "").replace(/\.[a-z0-9]+$/i, ""), 80) || (kind === "plan" ? "Schéma des réseaux" : "Notice");
  cloture.dossier.pieces.push({ id, kind, titre, type: file.type, taille: file.size, path, ajouteLe: new Date().toISOString() });
  await writeDb(db);
  return ok({ dossier: { ...cloture.dossier, pieces: await avecLiens(cloture.dossier.pieces) } }, 201);
}

export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (body.action !== "retirer") return badRequest("Action inconnue.");
  const projectId = texte(body.projectId, 80);
  if (!(await chantierAMoi(projectId, userId))) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();
  const cloture = clotureDe(db, projectId, userId);
  const piece = cloture?.dossier?.pieces?.find((p) => p.id === body.pieceId);
  if (!piece) return badRequest("Pièce introuvable.", 404);
  cloture.dossier.pieces = cloture.dossier.pieces.filter((p) => p.id !== piece.id);
  await getSupabaseAdmin().storage.from(BUCKET_CHANTIER).remove([piece.path]).catch(() => {});
  await writeDb(db);
  return ok({ dossier: { ...cloture.dossier, pieces: await avecLiens(cloture.dossier.pieces) } });
}
