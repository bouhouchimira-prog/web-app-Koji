import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { mergedOuvrages } from "../../../lib/ouvrages";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { parsePhoto } from "../../../lib/ai-photo";
import { fixText } from "../../../lib/text";

// Devis pre-rempli par IA (cahier des charges Radar des Chantiers, module
// "Moteur de prix koji") — une entreprise consultant un chantier publie par
// un particulier peut demander a Claude de generer un premier jet de devis
// (lots/postes/prix) a partir de la photo + description du chantier et d'un
// extrait de notre bibliotheque d'ouvrages. Le devis cree reste un
// "Brouillon" (pas de statut "provisoire" distinct dans le schema actuel —
// voir chantierOffreId/aiGenerated dans web_extras pour le marquage), a
// ajuster et envoyer normalement par l'entreprise depuis /devis.
//
// Pas encore de mecanisme de "positionnement" (bouton dedie, plafond de
// chantiers simultanes) — ce bouton est autonome pour l'instant, cote
// Amira le choix explicite plutot que d'attendre que ce module existe.

const MAX_OUVRAGES_IN_PROMPT = 20;

function pickRelevantOuvrages(ouvrages, metier) {
  const needle = fixText(metier || "").toLowerCase();
  const matched = needle
    ? ouvrages.filter((o) => {
        const profession = (o.profession || "").toLowerCase();
        const family = (o.family || "").toLowerCase();
        return profession.includes(needle) || needle.includes(profession) ||
          family.includes(needle) || needle.includes(family);
      })
    : [];
  const pool = matched.length ? matched : ouvrages;
  return pool.slice(0, MAX_OUVRAGES_IN_PROMPT).map((o) => ({
    code: o.code,
    label: o.label,
    unit: o.unit,
    normativeTime: o.normativeTime,
    hourlyRate: o.hourlyRate
  }));
}

function fallbackHourlyRate(business) {
  const dailyRate = Number(business?.dailyRate || 0);
  const hoursPerDay = Number(business?.hoursPerDay || 0);
  if (dailyRate > 0 && hoursPerDay > 0) return Math.round((dailyRate / hoursPerDay) * 100) / 100;
  return 45; // valeur de secours raisonnable pour le BTP francais si l'entreprise n'a rien renseigne
}

function buildPrompt({ offre, ouvrages, hourlyRate }) {
  const catalogText = ouvrages.length
    ? ouvrages.map((o) => `- [${o.code}] ${o.label} (unite: ${o.unit}, temps normatif: ${o.normativeTime}h${o.hourlyRate ? `, taux: ${o.hourlyRate}€/h` : ""})`).join("\n")
    : "(aucun ouvrage correspondant trouvé dans le catalogue interne — estime avec ton propre jugement du marché BTP français)";

  return `Chantier à chiffrer :
- Métier concerné : ${offre.metier || "non précisé"}
- Description des travaux : ${offre.description}
- Ville / secteur : ${offre.address || "non précisé"}
- Taux horaire de référence de l'entreprise : ${hourlyRate}€/h HT

Extrait de notre bibliothèque de prix interne pour ce métier (base-toi dessus en priorité pour les temps et coûts unitaires) :
${catalogText}

Rédige un devis provisoire réaliste pour ces travaux, organisé en lots puis postes. Chaque poste doit avoir une désignation claire, une quantité, un prix unitaire HT et un prix total HT (quantité × prix unitaire, ou ton estimation directe du prix de la ligne). Les prix sont en euros HT. Réponds UNIQUEMENT avec un objet JSON de cette forme exacte, sans texte autour, sans balises markdown :

{"lots":[{"nom":"string","postes":[{"designation":"string","quantite":number,"prix_unitaire":number,"prix_total":number}]}],"prix_total_estime":number}`;
}

function validateAiQuote(parsed) {
  if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return false;
  return parsed.lots.every((lot) =>
    lot && typeof lot.nom === "string" && Array.isArray(lot.postes) && lot.postes.length > 0 &&
    lot.postes.every((poste) =>
      poste && typeof poste.designation === "string" &&
      Number.isFinite(Number(poste.quantite)) &&
      Number.isFinite(Number(poste.prix_total))
    )
  );
}

function buildItemsFromAiQuote(parsed) {
  const rooms = [];
  const items = [];
  let index = 0;
  for (const lot of parsed.lots) {
    const room = fixText(lot.nom || "Travaux");
    if (!rooms.includes(room)) rooms.push(room);
    for (const poste of lot.postes) {
      index += 1;
      items.push({
        id: `ai-${Date.now()}-${index}`,
        label: fixText(poste.designation || "Prestation"),
        room,
        quantity: Math.max(0, Number(poste.quantite) || 1),
        unit: poste.unite || "u",
        billingMode: "fixed",
        fixedAmountHt: Math.max(0, Number(poste.prix_total) || 0)
      });
    }
  }
  return { rooms, items };
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const chantierOffreId = String(body.chantierOffreId || "");
  if (!chantierOffreId) return badRequest("Chantier non précisé.");

  const db = await readDb();
  const offre = (db.chantierOffres || []).find((entry) => entry.id === chantierOffreId);
  if (!offre) return badRequest("Chantier introuvable.", 404);

  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest("La génération IA n'est pas configurée (clé API manquante).", 500);
  }

  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  const hourlyRate = fallbackHourlyRate(webUser.business);

  const ouvrages = pickRelevantOuvrages(mergedOuvrages(db), offre.metier);
  const promptText = buildPrompt({ offre, ouvrages, hourlyRate });
  const photo = offre.photos?.[0] ? parsePhoto(offre.photos[0]) : null;

  const content = [{ type: "text", text: promptText }];
  if (photo) {
    content.unshift({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let aiText;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system: "Tu es un assistant de chiffrage pour des artisans du bâtiment en France. Tu réponds uniquement en JSON strict, sans aucun texte ni balise markdown autour.",
      messages: [
        { role: "user", content },
        { role: "assistant", content: "{" }
      ]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    aiText = "{" + (textBlock?.text || "");
  } catch (error) {
    const message = error?.status === 401
      ? "Clé API Claude invalide."
      : error?.status === 429 || /credit/i.test(String(error?.message || ""))
        ? "Crédits API Claude épuisés."
        : "L'IA n'a pas pu répondre. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(aiText);
  } catch {
    return badRequest("Réponse de l'IA illisible (JSON invalide). Réessayez.", 502);
  }
  if (!validateAiQuote(parsed)) {
    return badRequest("Réponse de l'IA incomplète. Réessayez.", 502);
  }

  const { rooms, items } = buildItemsFromAiQuote(parsed);
  const now = new Date().toISOString();
  const quoteNumber = await nextQuoteNumberFor(auth);

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: "001",
    client: fixText(offre.clientName || "Particulier"),
    clientEmail: offre.clientEmail || "",
    clientPhone: fixText(offre.clientPhone || ""),
    project: fixText(offre.description || "Chantier").slice(0, 80),
    projectId: "",
    chantierAddress: fixText(offre.address || ""),
    workDescription: fixText(offre.description || ""),
    validityDays: 30,
    company: webUser.business || {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms,
    items,
    notes: [],
    surcharges: [],
    vatRate: 0.2,
    draftStep: 0,
    draftData: null,
    isCreationDraft: false,
    totalHt: 0,
    totalTtc: 0,
    createdAt: now.slice(0, 10),
    createdAtIso: now,
    updatedAt: now,
    chantierOffreId: offre.id,
    aiGenerated: true
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);

  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création du devis impossible: ${error.message}`, 500);

  const quote = mapQuote(inserted);

  addHistory(db, {
    userId: auth.userId,
    type: "quote.ai_generated",
    label: `Devis généré par IA pour le chantier : ${offre.description.slice(0, 60)}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { chantierOffreId: offre.id, totalTtc: quote.totalTtc }
  });
  await writeDb(db);

  return ok({ quote }, 201);
}
