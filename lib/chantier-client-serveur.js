import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";
import { fixObjectText } from "./text.js";
import { normalizeEmail, quoteBelongsToClient } from "./portal-acces.js";
import { avecProfil } from "./document-profil.js";
import { companyFromQuote } from "./document-generator/shared.js";
import { chargerDevis, devisDuClient } from "./projets-client-serveur.js";
import { paiementsDuClient, vueChantierClient } from "./chantier-client.js";
import { estSigne } from "./projets-client.js";
import { phaseDeLegende } from "./photos-chantier.js";
import { interrupteurActif, peutEncaisser } from "./paiement-en-ligne.js";

// Koji Client · page d'un devis ou d'un chantier (maquette CLI-02) : lectures
// côté serveur. Tout part de la session du particulier (clientConnecte) ;
// chaque devis est vérifié avec quoteBelongsToClient avant d'être lu.

function chantierCourt(row) {
  return {
    id: row.id,
    title: row.reference || "Chantier",
    reference: row.reference || "",
    clientEmail: row.client_email || "",
    clientPhone: "",
    address: [row.street, row.postal_code, row.city].filter(Boolean).join(", "),
    status: row.status || "En attente"
  };
}

// Le devis du particulier (avec chantier, tâches, fin de chantier), et la
// ligne Supabase du chantier ; null s'il n'est pas à lui.
export async function devisDuParticulier({ db, user }, quoteId) {
  const id = String(quoteId || "").trim();
  if (!id) return null;
  const supabase = getSupabaseAdmin();
  const { data: row, error } = await supabase.from("quotes").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Lecture du devis impossible: ${error.message}`);
  if (!row) return null;
  const quote = mapQuote(row);
  if (quote.internalOnly) return null;
  const { data: chantierRow } = quote.projectId ? await supabase.from("chantiers").select("*").eq("id", quote.projectId).maybeSingle() : { data: null };
  const chantiers = new Map(chantierRow ? [[chantierRow.id, chantierCourt(chantierRow)]] : []);
  if (!quoteBelongsToClient(quote, chantiers.get(quote.projectId), user, normalizeEmail(user.email))) return null;
  const [devis] = devisDuClient(db, user, { devis: [quote], chantiers });
  return devis ? { devis, quote, row, chantierRow } : null;
}

// Fichier de l'attestation décennale, s'il est dans le profil de l'entreprise
// sous un format servi tel quel (PDF, PNG, JPEG).
export function fichierDecennale(business = {}) {
  const fichier = String(business.documents?.decennale?.fileDataUrl || "");
  const m = /^data:(application\/pdf|image\/png|image\/jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(fichier);
  return m ? { type: m[1], octets: Buffer.from(m[2], "base64") } : null;
}

// Identité de l'entreprise du devis : ce que le particulier peut lire
// (jamais l'IBAN ni le reste du profil).
export async function entrepriseDuDevis(db, quote) {
  await avecProfil(db, quote.userId);
  const company = companyFromQuote(fixObjectText(quote), db);
  const business = db.profilsEntreprise?.[quote.userId]?.business_info || {};
  return {
    nom: company.name,
    forme: company.legalForm,
    siren: company.siren,
    siret: company.siret,
    decennale: company.decennale,
    email: company.email,
    // Adresse de l'entreprise : formulaire de rétractation (CLI-02).
    adresse: [company.addressLine1, company.addressLine2].filter(Boolean).join(" "),
    business
  };
}

// Photos « après » du chantier (PRO-02.2), avec un lien temporaire créé ici
// (1 h) : celles de l'entreprise (db.chantierPhotos, bucket privé) et celles
// des compagnons dont la légende commence par « Après » (worker_photos).
// Les photos avant, pendant et de réserve ne sortent jamais d'ici.
const DUREE_LIEN = 3600;
const prenomInitiale = (w) => `${w.first_name || ""} ${String(w.last_name || "").slice(0, 1)}${w.last_name ? "." : ""}`.trim();

async function liensSignes(supabase, bucket, chemins) {
  if (!chemins.length) return new Map();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(chemins, DUREE_LIEN);
  return new Map((data || []).filter((l) => l.signedUrl).map((l) => [l.path, l.signedUrl]));
}

export async function photosApresDuChantier(db, { projectId, entrepriseId }) {
  if (!projectId || !entrepriseId) return [];
  const supabase = getSupabaseAdmin();
  const propres = (db.chantierPhotos || []).filter((p) => p.userId === entrepriseId && p.projectId === projectId && p.phase === "apres" && p.path);
  const liens = await liensSignes(supabase, "quote_attachments", propres.map((p) => p.path));
  const photos = propres.map((p) => ({ id: p.id, phase: "apres", lot: p.lot || "", takenAt: p.takenAt, author: p.author || "", url: liens.get(p.path) || "" }));
  try {
    const { data: taches } = await supabase.from("scheduled_tasks").select("id,title").eq("chantier_id", projectId);
    const ids = (taches || []).map((t) => t.id);
    if (ids.length) {
      const { data: wp } = await supabase.from("worker_photos").select("id,scheduled_task_id,worker_id,storage_path,caption,created_at").in("scheduled_task_id", ids);
      const apres = (wp || []).filter((p) => phaseDeLegende(p.caption) === "apres" && p.storage_path);
      const workerIds = [...new Set(apres.map((p) => p.worker_id).filter(Boolean))];
      const { data: workers } = workerIds.length ? await supabase.from("workers").select("id,first_name,last_name").in("id", workerIds) : { data: [] };
      const nom = new Map((workers || []).map((w) => [w.id, prenomInitiale(w)]));
      const titre = new Map((taches || []).map((t) => [t.id, t.title]));
      const liensW = await liensSignes(supabase, "worker-uploads", apres.map((p) => p.storage_path));
      for (const p of apres) {
        photos.push({ id: `w-${p.id}`, phase: "apres", lot: titre.get(p.scheduled_task_id) || "", takenAt: p.created_at, author: nom.get(p.worker_id) || "", url: liensW.get(p.storage_path) || "" });
      }
    }
  } catch {
    // Les photos des compagnons sont un complément : leur absence ne bloque pas.
  }
  return photos;
}

export async function vueChantierDuClient(client, quoteId, maintenant = new Date().toISOString()) {
  const trouve = await devisDuParticulier(client, quoteId);
  if (!trouve) return null;
  const { devis } = trouve;
  const { db } = client;
  const entreprise = await entrepriseDuDevis(db, trouve.quote);
  // Photos seulement pour un chantier signé (la vue n'en montre pas avant).
  const photos = estSigne(devis) && !devis.retracteLe && devis.projectId
    ? await photosApresDuChantier(db, { projectId: devis.projectId, entrepriseId: trouve.chantierRow?.user_id || devis.userId }).catch(() => [])
    : [];
  const cloture = devis.projectId ? (db.clotures || []).find((c) => c.projectId === devis.projectId && (!trouve.chantierRow || c.userId === trouve.chantierRow.user_id)) || null : null;
  return vueChantierClient(devis, {
    entreprise,
    factures: (db.invoices || []).filter((f) => f.userId === devis.userId || !f.userId),
    cloture,
    avenants: (db.avenants || []).filter((a) => a.quoteId === devis.id && a.status === "Signe"),
    decennaleFichier: fichierDecennale(entreprise.business) ? `/api/client/chantier/${encodeURIComponent(devis.id)}/decennale` : "",
    photos,
    maintenant,
    paiementEnLigne: peutEncaisser(entreprise.business)
  });
}

// « Paiements » : tous les devis signés du particulier.
export async function vuePaiementsDuClient({ db, user }, maintenant = new Date().toISOString()) {
  const devis = devisDuClient(db, user, await chargerDevis());
  // Paiement en ligne : selon l'entreprise de chaque devis (état Stripe enregistré).
  const enLigne = new Map();
  if (interrupteurActif()) {
    for (const id of new Set(devis.filter((q) => estSigne(q) && q.userId).map((q) => q.userId))) {
      await avecProfil(db, id);
      enLigne.set(id, peutEncaisser(db.profilsEntreprise?.[id]?.business_info || {}));
    }
  }
  return paiementsDuClient(devis, { factures: db.invoices || [], clotures: db.clotures || [], avenants: (db.avenants || []).filter((a) => a.status === "Signe"), maintenant, enLigne: (q) => enLigne.get(q.userId) === true });
}
