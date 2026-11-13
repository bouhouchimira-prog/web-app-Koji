import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { chantierAMoi, devisDuChantier, sansChemins, telechargerDataUrl } from "../../../lib/cloture-db";
import { avisDuChantier, demanderAvis } from "../../../lib/avis-serveur";
import { statsAvis } from "../../../lib/avis";
import { photosChoisies } from "../../../lib/dossier-fin";
import { normalizeRealisations } from "../../../lib/company-sites";

// Avis et réalisation d'un chantier (maquette PRO-02.6), côté entreprise.
// GET ?projectId= → { avis, stats, site, accesClient } · POST { projectId,
// action: demander | repondre (texte) | realisation (titre, texte) }.
// L'avis lui-même est écrit par le client (/api/client/avis) ; l'entreprise
// répond mais ne peut ni le modifier ni le supprimer.

const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

function texte(v, max) {
  return String(v || "").trim().slice(0, max);
}

function siteDe(db, userId) {
  return (db.companySites || []).find((s) => s.userId === userId) || null;
}

async function dataUrlPhoto(photo) {
  const ext = String(photo?.path || "").split(".").pop().toLowerCase();
  return MIME[ext] ? telechargerDataUrl(photo.path, MIME[ext]) : "";
}

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = new URL(request.url).searchParams.get("projectId") || "";
  if (!projectId) return badRequest("Chantier manquant.");
  if (!(await chantierAMoi(projectId, userId))) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();
  const devis = await devisDuChantier(projectId);
  const site = siteDe(db, userId);
  return ok({
    avis: avisDuChantier(db, projectId),
    stats: statsAvis((db.avis || []).filter((a) => a.userId === userId)),
    site: site ? { slug: site.slug, publie: Boolean(site.published) } : null,
    accesClient: Boolean(devis?.clientPortalUserId || devis?.clientPortalAccess?.portalIdentifier)
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = texte(body.projectId, 80);
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);
  const db = await readDb();

  if (body.action === "demander") {
    const r = await demanderAvis(db, { projectId, userId });
    if (!r.ok) return badRequest(r.raison);
    addHistory(db, { userId, type: "chantier.avis_demande", label: "Avis demandé au client", entityId: projectId, entityType: "project", meta: { projectId } });
    await writeDb(db);
    return ok({ cloture: sansChemins(r.cloture) });
  }

  const avis = avisDuChantier(db, projectId);
  if (!avis || avis.userId !== userId) return badRequest("Pas encore d'avis sur ce chantier.", 404);

  if (body.action === "repondre") {
    const reponse = texte(body.texte, 1500);
    if (!reponse) return badRequest("Écrivez votre réponse.");
    avis.reponse = { texte: reponse, publieeLe: avis.reponse?.publieeLe || new Date().toISOString(), modifieeLe: avis.reponse ? new Date().toISOString() : "" };
    await writeDb(db);
    return ok({ avis });
  }

  if (body.action === "realisation") {
    if (!avis.accordPhotos) return badRequest("Le client n'a pas donné son accord pour publier les photos.");
    const site = siteDe(db, userId);
    if (!site) return badRequest("Créez d'abord votre KojiPage (Profil › KojiPage).");
    const titre = texte(body.titre, 120);
    if (!titre) return badRequest("Donnez un titre à la réalisation.");
    const photos = (db.chantierPhotos || []).filter((p) => p.userId === userId && p.projectId === projectId);
    const choix = photosChoisies(photos);
    const paire = choix.paires.find((p) => p.avant && p.apres) || choix.paires[0] || {};
    const images = (await Promise.all([paire.avant, paire.apres || choix.couverture].filter(Boolean).map(dataUrlPhoto))).filter(Boolean);
    if (!images.length) return badRequest("Pas de photo avant / après lisible (JPEG ou PNG) sur ce chantier.");
    const id = `real-avis-${avis.id}`;
    const realisation = { id, name: titre, photos: images, texte: texte(body.texte, 300), avisId: avis.id };
    site.realisations = normalizeRealisations([realisation, ...(site.realisations || []).filter((r) => r.id !== id)]);
    site.updatedAt = new Date().toISOString();
    avis.realisation = { titre, texte: realisation.texte, publieeLe: new Date().toISOString() };
    addHistory(db, { userId, type: "site.realisation", label: `Réalisation publiée sur la KojiPage : ${titre}`, entityId: projectId, entityType: "project", meta: { projectId } });
    await writeDb(db);
    return ok({ avis, site: { slug: site.slug, publie: Boolean(site.published) } });
  }

  return badRequest("Action inconnue.");
}
