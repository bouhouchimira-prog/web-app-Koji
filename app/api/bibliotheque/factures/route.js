import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { makeToken, readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { mergedOuvragesAsync } from "../../../../lib/ouvrages";
import { chargerCatalogue } from "../../../../lib/fournitures-serveur";
import { calculerLignes, ligneExemple, syntheseMetiers } from "../../../../lib/bibliotheque-factures";
import { METIERS_DEMARRAGE, tauxParFamille, tauxParMetier } from "../../../../lib/demarrage";
import { fixText } from "../../../../lib/text";
import familles from "../../../../data/ouvrage-families.json";

// Taux d'après mes factures (maquette PRO-08.3) : factures de travaux de
// l'entreprise (PDF, photo, export CSV) lues par Koji ; noms, adresses et
// coordonnées des clients ne sont jamais gardés, seulement les lignes. Les
// taux proposés ne s'appliquent qu'après validation, métier par métier.
const OUTIL = {
  name: "lignes_facture",
  description: "Lignes de travaux lues sur une facture de l'entreprise, sans aucune donnée sur le client.",
  input_schema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date de la facture AAAA-MM-JJ, vide si absente." },
      lignes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            designation: { type: "string", description: "Désignation de la ligne, sans nom ni adresse de personne." },
            unite: { type: "string" },
            quantite: { type: "number", description: "0 si forfait sans quantité." },
            total_ht: { type: "number", description: "Montant HT de la ligne." },
            fourni: { type: "boolean", description: "Vrai si la ligne comprend la fourniture (« fourni et posé »), faux si pose seule." },
            code_ouvrage: { type: "string", description: "Code de l'ouvrage de la liste qui correspond, vide si aucun ne correspond." }
          },
          required: ["designation", "total_ht"]
        }
      }
    },
    required: ["lignes"]
  }
};

// Vercel refuse les requêtes de plus de 4,5 Mo (base64 compris).
const MAX_FICHIER = 3 * 1024 * 1024;
const texte = (v, max = 200) => fixText(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, max);
const today = () => new Date().toISOString().slice(0, 10);

function analyseDe(db, userId) {
  if (!db.analysesFactures || typeof db.analysesFactures !== "object") db.analysesFactures = {};
  if (!db.analysesFactures[userId]) db.analysesFactures[userId] = { fichiers: [], lignes: [], garder: false, partage: false, majLe: "" };
  return db.analysesFactures[userId];
}

async function contexte(entreprise, db) {
  const [ouvrages, catalogue] = await Promise.all([mergedOuvragesAsync(db, entreprise.userId), chargerCatalogue(entreprise, db).catch(() => ({ articles: [] }))]);
  return { ouvrages, articles: catalogue.articles || [] };
}

function vue(db, userId) {
  const a = analyseDe(db, userId);
  const reglage = db.tauxParFamille?.[userId] || {};
  const parMetier = tauxParMetier(reglage.taux || {});
  const defauts = Object.fromEntries(METIERS_DEMARRAGE.map((m) => [m.metier, familles.find((f) => m.familles.includes(f.code))?.hourlyRateDefault || 0]));
  const comprises = a.lignes.filter((l) => l.statut === "ok");
  return {
    fichiers: a.fichiers.map(({ data, ...f }) => ({ ...f, garde: Boolean(data) })),
    lignes: { total: a.lignes.length, comprises: comprises.length, aVerifier: a.lignes.filter((l) => l.statut === "a_verifier").length, ecartees: a.lignes.filter((l) => l.statut === "ecartee").length },
    questions: a.lignes.filter((l) => l.statut === "a_verifier").map((l) => ({ id: l.id, designation: l.designation, quantite: l.quantite, total: l.total, unite: l.unite, question: l.question, motif: l.motif })),
    metiers: syntheseMetiers(a.lignes, { tauxParMetier: parMetier, valides: reglage.valides || {}, defauts }),
    exemple: ligneExemple(a.lignes),
    periode: [...new Set(a.fichiers.map((f) => String(f.date || "").slice(0, 4)).filter(Boolean))].sort().join(" et "),
    garder: Boolean(a.garder),
    partage: Boolean(a.partage),
    majLe: a.majLe
  };
}

export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const id = new URL(request.url).searchParams.get("fichier") || "";
  if (id) {
    const f = analyseDe(db, entreprise.userId).fichiers.find((x) => x.id === id && x.data);
    if (!f) return badRequest("Fichier non gardé.", 404);
    const [meta, b64] = f.data.split(",");
    return new Response(Buffer.from(b64, "base64"), { headers: { "Content-Type": meta.replace(/^data:|;base64$/g, "") || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(f.nom)}"`, "Cache-Control": "private, no-store" } });
  }
  return ok(vue(db, entreprise.userId));
}

// Dépôt d'une facture : Koji lit les lignes et les rattache aux ouvrages.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("La lecture par Koji n'est pas disponible pour le moment.", 503);
  const nom = texte(body.nom, 120) || "Facture";
  const data = String(body.data || "");
  const m = data.match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  const csv = typeof body.texte === "string" ? body.texte.slice(0, 80_000) : "";
  if (!m && !csv) return badRequest("Déposez un PDF, une photo ou un export CSV.");
  if (m && m[2].length > MAX_FICHIER * 1.37) return badRequest("Fichier trop lourd (3 Mo au plus).");
  const type = m ? m[1].toLowerCase() : "text/csv";
  if (m && !/^(application\/pdf|image\/(jpeg|png|webp))$/.test(type)) return badRequest("Format non lu : PDF, photo (JPEG, PNG) ou CSV.");

  const db = await readDb();
  const { ouvrages, articles } = await contexte(entreprise, db);
  const liste = ouvrages.slice(0, 900).map((o) => `${o.code} | ${o.label} | ${o.unit}`).join("\n");
  const contenu = [];
  if (type === "application/pdf") contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: m[2] } });
  else if (m) contenu.push({ type: "image", source: { type: "base64", media_type: type, data: m[2] } });
  else contenu.push({ type: "text", text: `Export de factures (CSV) :\n${csv}` });
  contenu.push({ type: "text", text: `Ouvrages de la bibliothèque (code | libellé | unité) :\n${liste}` });

  let lu;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      thinking: { type: "disabled" },
      system: "Tu lis des factures de travaux d'une entreprise du bâtiment pour en extraire les lignes de travaux. Ne recopie jamais le nom, l'adresse, le téléphone ou l'e-mail d'un client, ni aucune donnée personnelle. Rattache chaque ligne au code d'ouvrage de la liste qui correspond vraiment, sinon laisse vide. Ignore les lignes de total, d'acompte et de TVA.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: contenu }]
    });
    lu = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    return badRequest(error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu lire ce fichier.", 502);
  }
  const brutes = (lu?.lignes || []).slice(0, 300).map((l) => ({
    designation: texte(l.designation, 160),
    unite: texte(l.unite, 12),
    quantite: Math.max(0, Number(l.quantite) || 0),
    total: Math.round((Number(l.total_ht) || 0) * 100) / 100,
    fourni: Boolean(l.fourni),
    code: texte(l.code_ouvrage, 30).toUpperCase()
  })).filter((l) => l.designation && l.total > 0);
  if (!brutes.length) return badRequest("Aucune ligne de travaux lue dans ce fichier.", 422);

  const a = analyseDe(db, entreprise.userId);
  const fichierId = makeToken("fac");
  const dejaPosees = a.lignes.filter((l) => l.statut === "a_verifier").length;
  const calculees = calculerLignes(brutes, ouvrages, articles, { questionsDejaPosees: dejaPosees }).map((l, i) => ({ ...l, id: `${fichierId}-${i}`, fichierId }));
  a.fichiers.unshift({
    id: fichierId,
    nom,
    type: type === "text/csv" ? "csv" : type === "application/pdf" ? "pdf" : "photo",
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(lu.date || "")) ? lu.date : today(),
    lignes: calculees.length,
    statut: "lue",
    deposeLe: new Date().toISOString(),
    // Original gardé seulement si l'entreprise l'a choisi (PDF ou photo).
    ...(a.garder && m ? { data } : {})
  });
  a.lignes.push(...calculees);
  a.majLe = new Date().toISOString();
  await writeDb(db);
  return ok({ lues: calculees.length, comprises: calculees.filter((l) => l.statut === "ok").length, ...vue(db, entreprise.userId) }, 201);
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const db = await readDb();
  const a = analyseDe(db, entreprise.userId);

  if (body.action === "repondre") {
    const l = a.lignes.find((x) => x.id === body.ligneId);
    if (!l) return badRequest("Ligne introuvable.", 404);
    if (body.ecarter) {
      l.statut = "ecartee";
    } else {
      const { ouvrages, articles } = await contexte(entreprise, db);
      const [maj] = calculerLignes([{ ...l, code: texte(body.code, 30).toUpperCase(), quantite: Math.max(0, Number(body.quantite ?? l.quantite) || 0), fourni: body.fourni ?? l.fourni }], ouvrages, articles, { questionsDejaPosees: 3 });
      Object.assign(l, maj, { id: l.id, fichierId: l.fichierId });
      if (l.statut !== "ok") return badRequest(`${l.motif} : vérifiez l'ouvrage et la quantité.`);
    }
  } else if (body.action === "appliquer") {
    // Validation explicite, métier par métier.
    const metiers = Array.isArray(body.metiers) ? body.metiers : [];
    const reglage = db.tauxParFamille?.[entreprise.userId] || { taux: {} };
    const actuels = tauxParMetier(reglage.taux || {});
    const valides = { ...(reglage.valides || {}) };
    for (const x of metiers) {
      const taux = Number(x.taux);
      if (!METIERS_DEMARRAGE.some((m) => m.metier === x.metier) || !(taux > 0) || taux > 500) continue;
      actuels[x.metier] = Math.round(taux * 100) / 100;
      valides[x.metier] = today();
    }
    db.tauxParFamille = db.tauxParFamille || {};
    db.tauxParFamille[entreprise.userId] = { taux: tauxParFamille(actuels), valides, updatedAt: new Date().toISOString() };
  } else if (body.action === "supprimer") {
    a.fichiers = a.fichiers.filter((f) => f.id !== body.fichierId);
    a.lignes = a.lignes.filter((l) => l.fichierId !== body.fichierId);
  } else if (body.action === "reglages") {
    if (body.garder !== undefined) {
      a.garder = Boolean(body.garder);
      if (!a.garder) a.fichiers.forEach((f) => { delete f.data; });
    }
    if (body.partage !== undefined) { a.partage = Boolean(body.partage); a.partageLe = new Date().toISOString(); }
  } else {
    return badRequest("Action inconnue.");
  }
  a.majLe = new Date().toISOString();
  await writeDb(db);
  return ok(vue(db, entreprise.userId));
}
