// Dépenses Koji Pro (PRO-09) côté serveur : chantiers et devis de
// l'entreprise (Supabase, même lecture que Fournitures), pièces rangées
// dans db.expenses, justificatifs dans le bucket privé, lecture par Koji.
import Anthropic from "@anthropic-ai/sdk";
import { mapQuote } from "./quote-mapping";
import { loadEntrepriseProfile } from "./entreprise-auth";
import { getSupabaseAdmin } from "./supabase";
import { chargerCatalogue, bonsDe } from "./fournitures-serveur";
import { besoinsChantier } from "./fournitures-chantier";
import { CATEGORIES, COLONNES, csv, doublonDe, normaliserPiece, proposerChantier, r2, syntheseExport } from "./depenses";
import { buildReleveComptablePdf, companyFromWebUser, releveFilename } from "./document-generator";
import { sendClientMessageEmail } from "./mailer";
import { fixText } from "./text";

export const BUCKET = "quote_attachments";
export const TYPES_FICHIER = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
// Vercel refuse les requêtes de plus de 4,5 Mo (base64 compris).
export const TAILLE_MAX = 3 * 1024 * 1024;
const texte = (v, max = 160) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const estSigne = (q) => q.status === "Signe" || q.signatureStatus === "Signe";

export async function contexteEntreprise(entreprise) {
  const webUser = await loadEntrepriseProfile(entreprise);
  return {
    business: Boolean(webUser.isAdmin) || webUser.plan === "business",
    coutHoraire: Number(webUser.business?.coutHoraire) || 0,
    company: { name: webUser.business?.raisonSociale || webUser.name || "Votre entreprise", email: webUser.email || "" }
  };
}

export function piecesDe(db, userId) {
  return (db.expenses || []).filter((e) => e.userId === userId).map(normaliserPiece);
}

// Chantiers de l'entreprise (non archivés, ou celui demandé) avec leur devis.
export async function chargerChantiers(entreprise, { projectId = "", archives = false } = {}) {
  let q = entreprise.supabase.from("chantiers").select("*").eq("user_id", entreprise.userId);
  if (projectId) q = q.eq("id", projectId);
  const [{ data: chantiers, error: e1 }, { data: devis, error: e2 }] = await Promise.all([
    q,
    entreprise.supabase.from("quotes").select("*").eq("user_id", entreprise.userId).order("created_at", { ascending: false })
  ]);
  if (e1) throw new Error(`Lecture des chantiers impossible : ${e1.message}`);
  if (e2) throw new Error(`Lecture des devis impossible : ${e2.message}`);
  const quotes = (devis || []).map(mapQuote).filter((x) => !x.internalOnly && x.status !== "Archive");
  return {
    quotes,
    chantiers: (chantiers || [])
      .filter((c) => projectId || archives || !(c.archived_at || /archiv/i.test(String(c.status || ""))))
      .map((c) => {
        const lies = quotes.filter((x) => x.projectId === c.id || (x.project && x.project === c.reference));
        const quote = lies.find(estSigne) || lies[0] || null;
        return { projectId: c.id, title: c.reference || "Chantier", address: [c.street, c.postal_code, c.city].filter(Boolean).join(", "), status: c.status || "", archive: Boolean(c.archived_at) || /archiv/i.test(String(c.status || "")), quote };
      })
  };
}

// Ce que Koji compare pour proposer un chantier : fournitures prévues aux
// devis et numéros des bons de commande.
export function chantiersPourProposition(chantiers, db, userId, articles) {
  const bons = bonsDe(db, userId);
  return chantiers.map((c) => ({
    projectId: c.projectId,
    title: c.title,
    besoins: c.quote ? besoinsChantier({ quote: c.quote, avenants: (db.avenants || []).filter((a) => a.userId === userId && a.quoteId === c.quote.id && a.status === "Signe"), articles }).map((b) => ({ name: b.name, lots: b.lots })) : [],
    bons: bons.filter((b) => b.projectId === c.projectId).flatMap((b) => [b.numero, b.numeroKoji]).filter(Boolean)
  }));
}

// Commandes Koji (bons rapprochés de leur facture, PRO-07.6) : rangées
// d'office sur leur chantier. TVA estimée à 20 % (la facture du
// fournisseur n'est pas dans Koji) et signalée comme telle.
export function rangerCommandes(db, userId) {
  db.expenses = db.expenses || [];
  let ajoutees = 0;
  for (const bon of bonsDe(db, userId)) {
    if (!bon.facture || !(Number(bon.facture.montantHt) > 0)) continue;
    const id = `exp-bc-${bon.id}`;
    if (db.expenses.some((e) => e.id === id)) continue;
    const ht = r2(bon.facture.montantHt);
    db.expenses.unshift({
      id, userId, statut: "rangee", type: "facture", source: "commande", categorie: "Fournitures",
      fournisseur: bon.supplierName || "", numero: bon.facture.numero || "", date: bon.facture.date || String(bon.envoyeLe || "").slice(0, 10),
      ht, tva: r2(ht * 0.2), ttc: r2(ht * 1.2), tauxTva: 20, tvaEstimee: true, bonId: bon.id, bonNumero: bon.numero, amount: ht, label: bon.supplierName || "",
      projectId: bon.projectId || "", fraisGeneraux: !bon.projectId, lot: "", lignes: (bon.lignes || []).map((l) => ({ designation: l.name, quantite: l.quantite, montantHt: r2(l.quantite * l.prixHt) })),
      rangeeLe: new Date().toISOString(), createdAt: new Date().toISOString()
    });
    ajoutees += 1;
  }
  return ajoutees;
}

// Propositions et doublons recalculés pour les pièces à ranger.
export async function rafraichirPropositions(entreprise, db, { chantiers, articles } = {}) {
  const pieces = piecesDe(db, entreprise.userId);
  const aRanger = pieces.filter((p) => p.statut === "a_ranger");
  if (!aRanger.length) return;
  const arts = articles || (await chargerCatalogue(entreprise, db)).articles || [];
  const chs = chantiers || (await chargerChantiers(entreprise)).chantiers;
  const pour = chantiersPourProposition(chs, db, entreprise.userId, arts);
  for (const p of aRanger) {
    const brut = db.expenses.find((e) => e.id === p.id);
    brut.proposition = proposerChantier(p, pour);
    brut.doublonDe = doublonDe(p, pieces)?.id || "";
  }
}

const OUTIL = {
  name: "lire_piece",
  description: "Lecture d'un ticket de caisse ou d'une facture fournisseur d'une entreprise du bâtiment.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["ticket", "facture"] },
      fournisseur: { type: "string", description: "Nom du fournisseur et ville ou agence s'ils sont écrits" },
      date: { type: "string", description: "Date de la pièce, AAAA-MM-JJ" },
      numero: { type: "string", description: "Numéro de facture ou de ticket" },
      lignes: { type: "array", items: { type: "object", properties: { designation: { type: "string" }, quantite: { type: "number" }, montant_ht: { type: "number" } }, required: ["designation"] } },
      total_ht: { type: "number" },
      tva: { type: "number", description: "Montant total de TVA ; 0 en autoliquidation" },
      total_ttc: { type: "number" },
      taux_tva: { type: "number", description: "Taux principal : 20, 10, 5.5 ou 0" },
      autoliquidation: { type: "boolean", description: "Mention « autoliquidation » ou « TVA due par le preneur » (sous-traitance)" },
      categorie: { type: "string", enum: CATEGORIES },
      bon_commande: { type: "string", description: "Référence de commande du client si elle est écrite (ex. BC-2026-031)" },
      lisible: { type: "boolean", description: "false si la pièce est floue ou coupée et que les montants sont incertains" }
    },
    required: ["type", "fournisseur", "total_ttc", "categorie", "lisible"]
  }
};

// Koji lit la pièce ; il recopie, n'invente rien, et ne garde aucune
// donnée personnelle hors du fournisseur.
export async function lirePiece({ mediaType, data, nom = "" }) {
  if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error("La lecture par Koji n'est pas disponible : saisissez la pièce à la main."), { status: 503 });
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const doc = mediaType === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "image", source: { type: "base64", media_type: mediaType, data } };
  let lu;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      thinking: { type: "disabled" },
      system: "Tu lis une pièce de dépense d'une entreprise du bâtiment (ticket de caisse, facture fournisseur, facture de sous-traitant, location). Recopie les montants tels qu'écrits, sans arrondir ni deviner. Une dépense de carburant, péage, restaurant ou assurance va en Carburant ou Frais généraux.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: [doc, { type: "text", text: `Pièce : ${nom || "sans nom"}` }] }]
    });
    lu = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    throw Object.assign(new Error(error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu lire cette pièce : saisissez-la à la main."), { status: 502 });
  }
  if (!lu || !(Number(lu.total_ttc) > 0)) throw Object.assign(new Error("Aucun montant lu sur cette pièce. Reprenez la photo bien à plat, ou saisissez-la à la main."), { status: 422 });
  const ttc = r2(lu.total_ttc);
  const auto = Boolean(lu.autoliquidation);
  const tva = auto ? 0 : r2(lu.tva ?? (Number(lu.total_ht) > 0 ? ttc - lu.total_ht : 0));
  const ht = r2(Number(lu.total_ht) > 0 ? lu.total_ht : ttc - tva);
  return {
    type: lu.type === "facture" ? "facture" : "ticket",
    fournisseur: texte(lu.fournisseur, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(lu.date || "")) ? lu.date : new Date().toISOString().slice(0, 10),
    numero: texte(lu.numero, 40),
    lignes: (lu.lignes || []).slice(0, 60).map((l) => ({ designation: texte(l.designation, 120), quantite: Number(l.quantite) || null, montantHt: Number(l.montant_ht) ? r2(l.montant_ht) : null })).filter((l) => l.designation),
    ht, tva, ttc,
    tauxTva: auto ? 0 : Number(lu.taux_tva) || (ht > 0 && tva > 0 ? Math.round((tva / ht) * 1000) / 10 : 0),
    autoliquidation: auto,
    categorie: CATEGORIES.includes(lu.categorie) ? lu.categorie : "Fournitures",
    bonCommande: texte(lu.bon_commande, 40),
    illisible: lu.lisible === false
  };
}

export async function enregistrerFichier(userId, id, { buffer, mediaType }) {
  const path = `depenses/${userId}/${id}.${TYPES_FICHIER[mediaType]}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, buffer, { contentType: mediaType, upsert: true });
  if (error) throw new Error(`Enregistrement du justificatif impossible : ${error.message}`);
  return { path, type: mediaType, taille: buffer.length };
}

export async function lienFichier(path, duree = 3600) {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrl(path, duree);
  if (error) throw new Error("Justificatif introuvable.");
  return data.signedUrl;
}

export async function lireFichier(path) {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(path);
  if (error) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function supprimerFichier(path) {
  if (path) await getSupabaseAdmin().storage.from(BUCKET).remove([path]).catch(() => {});
}

// --- Envoi au comptable (PRO-09.4) --------------------------------------

const ATTACHE_MAX = 15 * 1024 * 1024;

export async function syntheseDe(entreprise, db, periode) {
  const { quotes, chantiers } = await chargerChantiers(entreprise, { archives: true });
  const quotesParId = new Map(quotes.map((q) => [q.id, q]));
  const titres = new Map(chantiers.map((c) => [c.projectId, c.title]));
  const invoices = (db.invoices || []).filter((i) => i.userId === entreprise.userId);
  return syntheseExport({ invoices, quotesParId, pieces: piecesDe(db, entreprise.userId), periode, titres });
}

// Journaux CSV, relevé PDF et justificatifs (jusqu'à 15 Mo ; au-delà, la
// liste des pièces non jointes est dans le message).
export async function piecesJointes(entreprise, db, synthese, company) {
  const p = synthese.periode;
  const jointes = [
    { filename: `Ventes_${p}.csv`, content: Buffer.from(csv(COLONNES.ventes, synthese.ventes), "utf8"), contentType: "text/csv; charset=utf-8" },
    { filename: `Achats_${p}.csv`, content: Buffer.from(csv(COLONNES.achats, synthese.achats), "utf8"), contentType: "text/csv; charset=utf-8" },
    { filename: `Encaissements_${p}.csv`, content: Buffer.from(csv(COLONNES.encaissements, synthese.encaissements), "utf8"), contentType: "text/csv; charset=utf-8" },
    { filename: releveFilename(p), content: Buffer.from(buildReleveComptablePdf({ company, synthese })), contentType: "application/pdf" }
  ];
  let taille = jointes.reduce((s, a) => s + a.content.length, 0);
  const nonJointes = [];
  const pieces = piecesDe(db, entreprise.userId);
  for (const a of synthese.achats) {
    const piece = pieces.find((x) => x.id === a.id);
    if (!piece?.fichier?.path) continue;
    const buffer = await lireFichier(piece.fichier.path);
    if (!buffer) continue;
    if (taille + buffer.length > ATTACHE_MAX) { nonJointes.push(`${a.date} ${a.fournisseur} ${a.numero}`.trim()); continue; }
    taille += buffer.length;
    const ext = TYPES_FICHIER[piece.fichier.type] || "pdf";
    jointes.push({ filename: `${a.date}_${String(a.fournisseur || "piece").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 30)}_${String(a.numero || a.id).replace(/[^A-Za-z0-9-]+/g, "_").slice(0, 20)}.${ext}`, content: buffer, contentType: piece.fichier.type });
  }
  return { jointes, nonJointes };
}

export async function envoyerAuComptable(entreprise, db, { periode, to, auto = false }) {
  const webUser = await loadEntrepriseProfile(entreprise);
  const company = companyFromWebUser(webUser);
  const synthese = await syntheseDe(entreprise, db, periode);
  const { jointes, nonJointes } = await piecesJointes(entreprise, db, synthese, company);
  const t = synthese.totaux;
  const message = [
    "Bonjour,",
    "",
    `Voici les pièces de ${company.name} pour ${synthese.libelle.toLowerCase()} :`,
    `- ventes : ${t.ventes.factures} facture(s), ${t.ventes.avoirs} avoir(s), ${String(t.ventes.ht).replace(".", ",")} € HT ;`,
    `- achats : ${t.achats.factures} facture(s) fournisseurs, ${t.achats.tickets} ticket(s), ${String(t.achats.ht).replace(".", ",")} € HT ;`,
    `- encaissements : ${t.encaissements.nombre} paiement(s), ${String(t.encaissements.ttc).replace(".", ",")} € TTC.`,
    "",
    "Journaux en CSV, relevé en PDF (achats rangés par chantier) et justificatifs en pièces jointes. Montants de TVA indicatifs.",
    nonJointes.length ? `Trop lourds pour cet e-mail, à demander : ${nonJointes.join(" ; ")}.` : "",
    "",
    "Bien cordialement,",
    company.name
  ].filter((l, i, arr) => l !== "" || arr[i - 1] !== "").join("\n");
  await sendClientMessageEmail({ to, subject: `${company.name} · pièces de ${synthese.libelle.toLowerCase()}`, message, replyTo: company.email || undefined, attachments: jointes });
  db.envoisComptable = db.envoisComptable || [];
  const envoi = { id: `env-${Date.now()}`, userId: entreprise.userId, periode, to, le: new Date().toISOString(), auto, pieces: jointes.length, nonJointes: nonJointes.length };
  db.envoisComptable.unshift(envoi);
  return envoi;
}
