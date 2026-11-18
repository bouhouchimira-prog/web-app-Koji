import { getSupabaseAdmin } from "./supabase.js";
import { mapQuote } from "./quote-mapping.js";
import { fixObjectText } from "./text.js";
import { normalizeEmail, quoteBelongsToClient } from "./portal-acces.js";
import { avecProfil } from "./document-profil.js";
import { companyFromQuote } from "./document-generator/shared.js";
import { chargerDevis, devisDuClient } from "./projets-client-serveur.js";
import { paiementsDuClient, vueChantierClient } from "./chantier-client.js";

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
    business
  };
}

export async function vueChantierDuClient(client, quoteId, maintenant = new Date().toISOString()) {
  const trouve = await devisDuParticulier(client, quoteId);
  if (!trouve) return null;
  const { devis } = trouve;
  const { db } = client;
  const entreprise = await entrepriseDuDevis(db, trouve.quote);
  const cloture = devis.projectId ? (db.clotures || []).find((c) => c.projectId === devis.projectId && (!trouve.chantierRow || c.userId === trouve.chantierRow.user_id)) || null : null;
  return vueChantierClient(devis, {
    entreprise,
    factures: (db.invoices || []).filter((f) => f.userId === devis.userId || !f.userId),
    cloture,
    avenants: (db.avenants || []).filter((a) => a.quoteId === devis.id && a.status === "Signe"),
    decennaleFichier: fichierDecennale(entreprise.business) ? `/api/client/chantier/${encodeURIComponent(devis.id)}/decennale` : "",
    maintenant
  });
}

// « Paiements » : tous les devis signés du particulier.
export async function vuePaiementsDuClient({ db, user }, maintenant = new Date().toISOString()) {
  const devis = devisDuClient(db, user, await chargerDevis());
  return paiementsDuClient(devis, { factures: db.invoices || [], clotures: db.clotures || [], avenants: (db.avenants || []).filter((a) => a.status === "Signe"), maintenant });
}
