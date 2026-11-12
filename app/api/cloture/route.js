import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedUserId } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { mapQuote } from "../../../lib/quote-mapping";
import { lotsDuDevis } from "../../../lib/planning-chantier";
import { reservesNonLevees } from "../../../lib/reserves";
import { TAUX_RETENUE, TYPE_FACTURE_SOLDE, euro, jourDeParis, montantsSolde, plusAns, travauxReceptionnes } from "../../../lib/cloture-chantier";
import { buildPvReceptionPdf, pvReceptionFilename } from "../../../lib/document-generator";

// Clôture d'un chantier (maquette PRO-02.4), site et app Koji Pro.
// GET ?projectId= → { cloture } · GET ?projectId=&pdf=1 → PV de réception.
// POST { projectId, signataire, signatureClient, signaturePro } : le client
// signe le procès-verbal sur place ; le serveur fige la date, le numéro, les
// réserves non levées et la retenue. PATCH { projectId, action: retenue
// (taux 0 | 5) | rappel | avis (programme) }. db.clotures ; signatures dans
// le bucket privé, comme les photos du chantier.

const BUCKET = "quote_attachments";
const FACTURES_ACTIVES = new Set(["Brouillon", "Emise", "Payee"]);

async function chantierAMoi(projectId, userId) {
  const { data } = await getSupabaseAdmin().from("chantiers").select("*").eq("id", projectId).maybeSingle();
  return data && data.user_id === userId ? data : null;
}

async function devisDuChantier(projectId) {
  const { data } = await getSupabaseAdmin().from("quotes").select("*").eq("chantier_id", projectId).order("created_at", { ascending: false });
  const devis = (data || []).map(mapQuote);
  return devis.find((q) => q.status === "Signe" || q.signatureStatus === "Signe") || devis[0] || null;
}

function texte(v, max) {
  return String(v || "").trim().slice(0, max);
}

function pngDe(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const octets = Buffer.from(m[1], "base64");
  if (octets.length < 100 || octets.length > 400 * 1024 || octets.readUInt32BE(0) !== 0x89504e47) return null;
  return octets;
}

function clotureDe(db, projectId, userId) {
  return (db.clotures || []).find((c) => c.projectId === projectId && c.userId === userId) || null;
}

function nouvelleCloture(userId, projectId) {
  return { id: randomUUID(), userId, projectId, pv: null, retenue: { taux: 0, rappelId: "", libereeLe: "" }, avis: { programme: false, demandeLe: "" }, dossier: { remisLe: "" }, creeLe: new Date().toISOString() };
}

function sansChemins(cloture) {
  if (!cloture?.pv) return cloture;
  const { signatureClient, signaturePro, ...pv } = cloture.pv;
  return { ...cloture, pv: { ...pv, signe: Boolean(signatureClient) } };
}

function factureSoldeExiste(db, projectId) {
  return (db.invoices || []).some((f) => f.projectId === projectId && f.type === TYPE_FACTURE_SOLDE && FACTURES_ACTIVES.has(f.status) && Number(f.amountTtc) > 0);
}

// Rappel dans le calendrier, un an après la réception (table partagée avec
// l'app Koji Pro).
async function creerRappel(cloture, chantier) {
  const jour = plusAns(jourDeParis(cloture.pv.signeLe), 1);
  const { data, error } = await getSupabaseAdmin().from("calendar_events").insert({
    user_id: cloture.userId,
    title: `Retenue de garantie à libérer · ${chantier.reference || "chantier"}`,
    event_type: "Rappel",
    client_name: cloture.pv.signataire || "",
    project_id: cloture.projectId,
    address: [chantier.street, chantier.postal_code, chantier.city].filter(Boolean).join(", "),
    start_at: `${jour}T08:00:00Z`,
    end_at: `${jour}T08:30:00Z`,
    all_day: true,
    status: "En attente",
    progress: 0,
    notes: `Retenue de garantie de ${euro(cloture.pv.retenue?.montantTtc || 0)} TTC (${cloture.pv.retenue?.taux || TAUX_RETENUE} %), libérable si aucune réserve n'est en cours. Facturez-la depuis la clôture du chantier.`
  }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function telecharger(chemin) {
  if (!chemin) return "";
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(chemin);
  if (error || !data) return "";
  return `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
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
  const cloture = clotureDe(db, projectId, userId);

  if (url.searchParams.get("pdf") !== "1") return ok({ cloture: sansChemins(cloture) });

  if (!cloture?.pv?.signeLe) return badRequest("Le procès-verbal n'est pas encore signé.", 404);
  const devis = await devisDuChantier(projectId);
  const pdf = buildPvReceptionPdf({
    pv: { ...cloture.pv, signatureClient: await telecharger(cloture.pv.signatureClient), signaturePro: await telecharger(cloture.pv.signaturePro) },
    chantier: { titre: chantier.reference || "Chantier", adresse: [chantier.street, chantier.postal_code, chantier.city].filter(Boolean).join(", ") },
    quote: devis,
    db,
    userId
  });
  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="${pvReceptionFilename(cloture.pv)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = texte(body.projectId, 80);
  const signataire = texte(body.signataire, 120);
  if (!projectId) return badRequest("Chantier manquant.");
  if (!signataire) return badRequest("Indiquez le nom de la personne qui signe pour le client.");
  const signatureClient = pngDe(body.signatureClient);
  const signaturePro = pngDe(body.signaturePro);
  if (!signatureClient) return badRequest("La signature du client manque.");
  if (!signaturePro) return badRequest("Votre signature manque.");
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  let cloture = clotureDe(db, projectId, userId);
  if (cloture?.pv?.signeLe) return badRequest("Le procès-verbal de ce chantier est déjà signé.", 409);
  if (!cloture) {
    cloture = nouvelleCloture(userId, projectId);
    db.clotures = [...(db.clotures || []), cloture];
  }

  const devis = await devisDuChantier(projectId);
  const avenants = (db.avenants || []).filter((a) => devis && a.quoteId === devis.id);
  const solde = montantsSolde({ devis, avenants, tauxRetenue: cloture.retenue?.taux || 0 });
  const reserves = (db.reserves || []).filter((r) => r.userId === userId && r.projectId === projectId);
  const maintenant = new Date();
  const annee = maintenant.getFullYear();
  const duMemeAn = (db.clotures || []).filter((c) => c.userId === userId && String(c.pv?.numero || "").startsWith(`PV-${annee}-`)).length;
  const id = randomUUID();

  const admin = getSupabaseAdmin();
  const chemin = (qui) => `chantier-pv/${userId}/${projectId}/${id}-${qui}.png`;
  for (const [qui, octets] of [["client", signatureClient], ["pro", signaturePro]]) {
    const { error } = await admin.storage.from(BUCKET).upload(chemin(qui), octets, { contentType: "image/png", upsert: false });
    if (error) return badRequest(`Signature non enregistrée : ${error.message}`, 500);
  }

  cloture.pv = {
    id,
    numero: `PV-${annee}-${String(duMemeAn + 1).padStart(3, "0")}`,
    signeLe: maintenant.toISOString(),
    signataire,
    entreprise: texte(body.signePar, 120),
    devisNumero: devis?.quoteNumber || "",
    avenants: solde.avenants,
    travaux: travauxReceptionnes(devis, lotsDuDevis(devis).length, solde.avenants),
    reserves: reservesNonLevees(reserves).map((r) => ({ numero: r.numero, titre: r.titre, lieu: r.lieu || "", attribueeNom: r.attribueeNom || "", pourLe: r.pourLe || "" })),
    levees: reserves.filter((r) => r.statut === "levee").map((r) => r.numero),
    retenue: solde.tauxRetenue ? { taux: solde.tauxRetenue, montantTtc: solde.retenueTtc } : null,
    signatureClient: chemin("client"),
    signaturePro: chemin("pro"),
    source: body.source === "app" ? "app" : "site"
  };
  cloture.majLe = maintenant.toISOString();

  if (cloture.retenue?.taux && !cloture.retenue.rappelId) {
    try { cloture.retenue.rappelId = await creerRappel(cloture, chantier); } catch { /* le rappel se reprogramme depuis la clôture */ }
  }

  addHistory(db, { userId, type: "chantier.reception", label: `Procès-verbal de réception signé : ${cloture.pv.numero}`, entityId: projectId, entityType: "project", meta: { projectId, reserves: cloture.pv.reserves.length } });
  await writeDb(db);
  return ok({ cloture: sansChemins(cloture) }, 201);
}

export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const projectId = texte(body.projectId, 80);
  if (!projectId) return badRequest("Chantier manquant.");
  const chantier = await chantierAMoi(projectId, userId);
  if (!chantier) return badRequest("Chantier introuvable.", 404);

  const db = await readDb();
  let cloture = clotureDe(db, projectId, userId);
  if (!cloture) {
    cloture = nouvelleCloture(userId, projectId);
    db.clotures = [...(db.clotures || []), cloture];
  }
  cloture.retenue = cloture.retenue || { taux: 0, rappelId: "", libereeLe: "" };
  cloture.avis = cloture.avis || { programme: false, demandeLe: "" };

  switch (body.action) {
    case "retenue": {
      if (factureSoldeExiste(db, projectId)) return badRequest("La facture de solde est déjà faite : la retenue ne se change plus ici.");
      if (cloture.pv?.signeLe) return badRequest("Le procès-verbal est signé : la retenue qui y figure ne se change plus.");
      cloture.retenue.taux = Number(body.taux) === TAUX_RETENUE ? TAUX_RETENUE : 0;
      break;
    }
    case "rappel": {
      if (!cloture.pv?.signeLe || !cloture.retenue.taux) return badRequest("Pas de retenue à rappeler.");
      if (!cloture.retenue.rappelId) {
        try { cloture.retenue.rappelId = await creerRappel(cloture, chantier); } catch (error) { return badRequest(`Rappel non créé : ${error.message}`, 500); }
      }
      break;
    }
    case "avis":
      cloture.avis.programme = Boolean(body.programme);
      break;
    default:
      return badRequest("Action inconnue.");
  }
  cloture.majLe = new Date().toISOString();
  await writeDb(db);
  return ok({ cloture: sansChemins(cloture) });
}
