import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { mapQuote } from "../../../../lib/quote-mapping";
import { buildWebUser } from "../../../../lib/user-profile";
import { computeQuoteItem } from "../../../../lib/quote-calculations";
import { mergedOuvragesAsync } from "../../../../lib/ouvrages";
import { indexBibliotheque, prixUnitaireOuvrage, tauxHoraireEntreprise } from "../../../../lib/prix-recommande";
import { construireLignes, messageAvenant } from "../../../../lib/avenant-koji";
import { fixText } from "../../../../lib/text";

// Avenant préparé par Koji (maquette PRO-05) : à partir des notes de
// chantier (dictée), Koji propose des lignes d'avenant en s'appuyant sur
// les lignes du devis signé et la bibliothèque de l'entreprise. Rien n'est
// enregistré ici. Les prix ne viennent jamais du modèle : devis signé pour
// une modification ou un retrait, bibliothèque pour un ajout, sinon « à
// chiffrer » (lib/avenant-koji.js).
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mots = (t) => new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((m) => m.length > 3));

const OUTIL = {
  name: "proposer_avenant",
  description: "Propose les lignes de l'avenant au devis signé, à partir des notes de chantier de l'entreprise.",
  input_schema: {
    type: "object",
    properties: {
      lignes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["ajout", "modification", "suppression"], description: "ajout : travaux nouveaux ; modification : nouvelle quantité totale d'une ligne du devis ; suppression : ligne du devis retirée." },
            ref: { type: "string", description: "Référence de la ligne du devis concernée (modification, suppression)." },
            code: { type: "string", description: "Code de l'ouvrage de la bibliothèque pour un ajout, s'il existe dans la liste fournie." },
            libelle: { type: "string", description: "Intitulé de la ligne, à l'infinitif, comme dans un devis (ajout)." },
            lot: { type: "string", description: "Lot du devis où ranger un ajout (nom exact d'un lot existant si possible)." },
            quantite: { type: "number", description: "Quantité : nouvelle quantité totale pour une modification ; quantité de l'ajout." },
            unite: { type: "string" },
            justification: { type: "string", description: "Pourquoi, en une phrase courte lisible par le client (constat, demande du client)." }
          },
          required: ["type", "justification"]
        }
      },
      impact_jours: { type: "integer", description: "Jours ouvrés ajoutés (ou retirés, négatif) au planning." },
      message_client: { type: "string", description: "Message court au client, vouvoiement, sans prix." }
    },
    required: ["lignes", "impact_jours", "message_client"]
  }
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const notes = fixText(String(body.notes || "")).trim().slice(0, 2000);
  if (!notes) return badRequest("Dictez ou écrivez ce qui change sur le chantier.");
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("Koji n'est pas configuré (clé API manquante).", 500);

  const admin = getSupabaseAdmin();
  const { data: row } = await admin.from("quotes").select("*").eq("id", String(body.quoteId || "")).maybeSingle();
  if (!row || row.user_id !== userId) return badRequest("Devis introuvable.", 404);
  const quote = mapQuote(row);

  // Lignes du devis signé (site : items ; app : envoyées par l'app).
  const depuisApp = Array.isArray(body.lignesDevis) ? body.lignesDevis : [];
  const lignesDevis = (quote.items || []).length
    ? quote.items.map((item, i) => {
      const c = computeQuoteItem(item, quote);
      const q = Number(c.quantity) || 1;
      return { ref: String(item.id || `L${i + 1}`), label: fixText(item.label || ""), lot: fixText(item.room || ""), quantity: q, unit: item.unit || "u", unitPriceHt: r2(Number(c.totalHt || 0) / q) };
    })
    : depuisApp.slice(0, 300).map((l, i) => ({ ref: String(l.ref || l.id || `L${i + 1}`), label: fixText(String(l.label || "")), lot: fixText(String(l.lot || l.room || "")), quantity: Number(l.quantity) || 1, unit: String(l.unit || "u"), unitPriceHt: r2(l.unitPriceHt) }));
  const lots = [...new Set(lignesDevis.map((l) => l.lot).filter(Boolean))];

  // Bibliothèque de l'entreprise : les ouvrages proches des notes.
  const db = await readDb();
  const { data: profile } = await admin.from("users").select("*").eq("id", userId).maybeSingle();
  const business = buildWebUser({ id: userId, email: profile?.email || "", profile }).business || {};
  const taux = tauxHoraireEntreprise(business);
  const bibliotheque = await mergedOuvragesAsync(db, userId).catch(() => []);
  const parCode = indexBibliotheque(bibliotheque);
  const cles = mots(notes);
  const proches = bibliotheque
    .filter((o) => o?.code && o?.label)
    .map((o) => ({ o, score: [...mots(o.label)].filter((m) => cles.has(m)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map(({ o }) => `${o.code} · ${o.label} (${o.unit || "u"})`);

  const contexte = [
    `Devis ${quote.quoteNumber} signé, client ${quote.client || "particulier"}.`,
    "Lignes du devis (référence · lot · intitulé · quantité unité) :",
    ...lignesDevis.map((l) => `${l.ref} · ${l.lot} · ${l.label} · ${l.quantity} ${l.unit}`),
    "",
    "Ouvrages de la bibliothèque qui peuvent servir pour un ajout (code · intitulé (unité)) :",
    ...(proches.length ? proches : ["(aucun ouvrage proche)"]),
    "",
    `Notes de chantier de l'entreprise : « ${notes} »`
  ].join("\n");

  let proposition;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      thinking: { type: "disabled" },
      system: "Tu es Koji, l'assistant d'une entreprise du bâtiment. Tu prépares un avenant à un devis signé à partir des notes de chantier. Une ligne par changement : modification (nouvelle quantité totale d'une ligne existante), suppression (ligne retirée), ajout (travaux nouveaux, avec le code d'un ouvrage de la liste quand il correspond). Ne donne jamais de prix. N'invente pas de travaux absents des notes. Justifications courtes, compréhensibles par le client.",
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: contexte }]
    });
    proposition = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    const message = error?.status === 401 ? "Clé API Claude invalide." : error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu préparer l'avenant. Réessayez.";
    return badRequest(message, 502);
  }
  if (!proposition || !Array.isArray(proposition.lignes)) return badRequest("Koji n'a pas pu préparer l'avenant. Réessayez.", 502);

  const lignes = construireLignes(proposition.lignes, lignesDevis, (code) => {
    const o = parCode.get(String(code).toUpperCase());
    if (!o) return null;
    return { label: fixText(o.label || ""), unit: o.unit || "u", prixHt: r2(prixUnitaireOuvrage(o, taux)) };
  });
  const impactJours = Math.max(-30, Math.min(30, Math.round(Number(proposition.impact_jours) || 0)));
  const message = fixText(String(proposition.message_client || "")).replace(/\d[\d\s,.]*\s?€/g, "").trim() || messageAvenant({ client: quote.client, lignes, impactJours });
  return ok({ lignes, impactJours, message, lots });
}
