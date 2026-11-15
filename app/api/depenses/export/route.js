import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { COLONNES, bornesPeriode, csv } from "../../../../lib/depenses";
import { contexteEntreprise, envoyerAuComptable, rangerCommandes, syntheseDe } from "../../../../lib/depenses-serveur";
import { buildReleveComptablePdf, companyFromWebUser, releveFilename } from "../../../../lib/document-generator";
import { fixText } from "../../../../lib/text";

// Export pour le comptable (maquette PRO-09.4, Business) : journaux du
// mois ou du trimestre (ventes, achats, encaissements), TVA indicative,
// contrôles avant envoi, téléchargement CSV / PDF, envoi par e-mail.
// Koji ne tient pas la comptabilité : ni liasse ni FEC.
export const maxDuration = 60;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ""));
const periodeDe = (v) => (bornesPeriode(String(v || "")) ? String(v) : new Date().toISOString().slice(0, 7));

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  const { business } = await contexteEntreprise(entreprise);
  return { entreprise, business };
}

export async function GET(request) {
  const { entreprise, business, erreur } = await contexte(request);
  if (erreur) return erreur;
  if (!business) return ok({ business: false });
  const url = new URL(request.url);
  const periode = periodeDe(url.searchParams.get("periode"));
  const db = await readDb();
  if (rangerCommandes(db, entreprise.userId)) await writeDb(db);
  let synthese;
  try { synthese = await syntheseDe(entreprise, db, periode); } catch (e) { return badRequest(e.message, 502); }
  const format = url.searchParams.get("format");
  if (format === "csv") {
    const journal = COLONNES[url.searchParams.get("journal")] ? url.searchParams.get("journal") : "achats";
    return new Response(csv(COLONNES[journal], synthese[journal]), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${journal[0].toUpperCase()}${journal.slice(1)}_${periode}.csv"`, "Cache-Control": "private, no-store" } });
  }
  if (format === "pdf") {
    const company = companyFromWebUser(await loadEntrepriseProfile(entreprise));
    return new Response(Buffer.from(buildReleveComptablePdf({ company, synthese })), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${releveFilename(periode)}"`, "Cache-Control": "private, no-store" } });
  }
  const reglages = { comptableEmail: "", envoiAuto: false, ...(db.reglagesDepenses?.[entreprise.userId] || {}) };
  const envois = (db.envoisComptable || []).filter((e) => e.userId === entreprise.userId).slice(0, 12);
  return ok({ business: true, synthese, reglages, envois });
}

// Envoi au comptable : CSV, relevé PDF et justificatifs par e-mail ;
// l'adresse est retenue pour les envois suivants.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { entreprise, business, erreur } = await contexte(request, body);
  if (erreur) return erreur;
  if (!business) return badRequest("L'export pour le comptable fait partie de l'offre Business.", 403);
  const db = await readDb();
  const reglages = { comptableEmail: "", envoiAuto: false, ...(db.reglagesDepenses?.[entreprise.userId] || {}) };
  const to = fixText(String(body.to || reglages.comptableEmail || "")).trim();
  if (!emailOk(to)) return badRequest("Indiquez l'adresse e-mail de votre comptable.");
  rangerCommandes(db, entreprise.userId);
  let envoi;
  try { envoi = await envoyerAuComptable(entreprise, db, { periode: periodeDe(body.periode), to }); } catch (e) { return badRequest(`Envoi impossible : ${e.message}`, 502); }
  db.reglagesDepenses = db.reglagesDepenses || {};
  db.reglagesDepenses[entreprise.userId] = { ...reglages, comptableEmail: to };
  await writeDb(db);
  return ok({ envoi });
}
