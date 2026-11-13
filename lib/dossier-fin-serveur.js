import { getSupabaseAdmin } from "./supabase.js";
import { splitBusinessInfo } from "./user-profile.js";
import { adresseChantier, clotureDe, devisDuChantier, telechargerDataUrl } from "./cloture-db.js";
import { factureDeSolde, facturesDuChantier, garanties } from "./cloture-chantier.js";
import { conseilsEntretien, photosChoisies } from "./dossier-fin.js";
import { buildDossierFinPdf, dossierFinFilename } from "./document-generator/index.js";

// Assemblage du dossier de fin de chantier (PRO-02.5) côté serveur :
// utilisé par /api/dossier-fin (entreprise) et par l'espace Koji Client.

const MIME_PHOTO = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

export async function decennaleDe(userId) {
  const { data } = await getSupabaseAdmin().from("users").select("business_info").eq("id", userId).maybeSingle();
  const { business } = splitBusinessInfo(data?.business_info || {});
  return { insurer: business.decennaleInsurer || "", policy: business.decennalePolicy || "", until: business.decennaleUntil || "" };
}

async function photoDataUrl(photo) {
  if (!photo?.path) return photo ? { ...photo, dataUrl: "" } : null;
  const ext = String(photo.path).split(".").pop().toLowerCase();
  const mime = MIME_PHOTO[ext];
  return { ...photo, dataUrl: mime ? await telechargerDataUrl(photo.path, mime) : "" };
}

// Tout ce qu'il faut pour le PDF et l'envoi.
export async function assemblerDossier(db, userId, chantier) {
  const projectId = chantier.id;
  const cloture = clotureDe(db, projectId, userId);
  const devis = await devisDuChantier(projectId);
  const ids = { projectId, quoteId: devis?.id };
  const factures = facturesDuChantier(db.invoices || [], ids).filter((f) => Number(f.amountTtc) > 0).sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  const pieces = cloture?.dossier?.pieces || [];
  const photos = (db.chantierPhotos || []).filter((p) => p.userId === userId && p.projectId === projectId);
  const choix = photosChoisies(photos);
  const paires = await Promise.all(choix.paires.map(async (p) => ({ lot: p.lot, avant: await photoDataUrl(p.avant), apres: await photoDataUrl(p.apres) })));
  const plans = await Promise.all(pieces.filter((p) => p.kind === "plan").map(async (p) => ({ titre: p.titre, dataUrl: p.type === "application/pdf" ? "" : await telechargerDataUrl(p.path, p.type) })));
  const avenants = (db.avenants || []).filter((a) => devis && a.quoteId === devis.id && a.status === "Signe").map((a) => a.numero);
  const pv = cloture?.pv || null;
  const titre = chantier.reference || "Chantier";
  const pdf = buildDossierFinPdf({
    chantier: { titre, adresse: adresseChantier(chantier) },
    client: pv?.signataire || devis?.client || "",
    db,
    userId,
    pv,
    paires,
    couverture: await photoDataUrl(choix.couverture),
    conseils: conseilsEntretien(devis?.items || []),
    notices: pieces.filter((p) => p.kind === "notice").map((p) => p.titre),
    plans,
    factures,
    devis,
    avenants,
    decennale: await decennaleDe(userId),
    garanties: garanties(pv?.signeLe || "")
  });
  return { pdf, filename: dossierFinFilename({ titre }), devis, cloture, pieces, factureSolde: factureDeSolde(db.invoices || [], ids), titre };
}

