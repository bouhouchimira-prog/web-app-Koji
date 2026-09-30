import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth } from "../../../lib/server-auth";
import { buildWebUser } from "../../../lib/user-profile";
import { mergedOuvrages } from "../../../lib/ouvrages";
import { validateAiQuote, buildItemsFromAiQuote, buildMissingPriceNotes } from "../../../lib/ai-devis-shape";
import { parseAiJson } from "../../../lib/ai-json";
import { parsePhoto } from "../../../lib/ai-photo";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { fixText } from "../../../lib/text";

// Devis "100% IA" — deuxieme chemin de creation de devis, en parallele du
// chemin manuel existant (app/devis/DevisEditor.jsx, /devis?new=1), a la
// demande d'Amira (9 septembre). C'est l'ENTREPRISE qui demarre : elle
// repond a quelques questions rapides + ajoute des photos, l'IA genere le
// devis complet (tous les lots/postes/prix) en un seul appel, en
// s'appuyant sur la bibliotheque de prix interne (comme
// app/api/expertise-koji/route.js). Le devis reste ensuite "Brouillon",
// modifiable normalement dans /devis?id=..., avec validation finale et
// envoi par l'entreprise comme n'importe quel autre devis — aucune
// modification du chemin manuel ni de DevisEditor.jsx.
// Niveau de main d'oeuvre choisi par l'entreprise pour CHAQUE lot (question
// posee cote client avant la generation, jamais deduit par l'IA elle-meme —
// meme principe que PRICE_RANGE_SPREAD dans expertise-koji : un coefficient
// de prix reste une decision du code, applique de facon deterministe apres
// generation (voir applyLaborLevelCoefficients), jamais laisse au jugement
// libre de l'IA. Valeurs de depart a ajuster avec Amira si besoin.
const LABOR_LEVEL_COEFFICIENTS = { "Standard": 1, "Qualifié": 1.15, "Expert": 1.3 };

function buildLotDetailsText(lotDetails) {
  if (!Array.isArray(lotDetails) || lotDetails.length === 0) return "";
  const lines = lotDetails.map((lot) => {
    const fournitures = lot.fournitures === "sans"
      ? "à la charge du CLIENT (ne pas facturer les matériaux dans les postes — les lister séparément dans \"materiaux\")"
      : "à la charge de l'ENTREPRISE (intègre les matériaux comme postes normaux, chiffrés, dans \"postes\")";
    return `- "${fixText(lot.nom)}" — main d'oeuvre : ${fixText(lot.laborLevel || "Standard")} — durée estimée : ${Math.max(1, Math.round(Number(lot.joursEstimes) || 1))} jour(s) — fournitures : ${fournitures}`;
  }).join("\n");
  return `\n\nLots identifiés et validés par l'entreprise — utilise EXACTEMENT ces noms de lots dans "lots[].nom" (un lot par entrée ci-dessous, pas d'autre lot ajouté), et garde les quantités générées cohérentes avec la durée indiquée pour chacun :\n${lines}`;
}

function buildPrompt({ metier, clientName, address, description, surface, finition, catalogText, lotDetails }) {
  return `Voici les informations fournies par une entreprise du BTP pour generer un devis complet a un client :

- Metier concerne : ${fixText(metier || "non précisé")}
- Nom du client : ${fixText(clientName || "non précisé")}
- Adresse du chantier : ${fixText(address || "non précisée")}
- Description des travaux : ${fixText(description || "non précisée")}
- Surface ou pièce concernée : ${fixText(surface || "non précisée")}
- Niveau de finition souhaité : ${fixText(finition || "standard")}${buildLotDetailsText(lotDetails)}

Bibliothèque de prix interne koji — SOURCE DE PRIX PRIORITAIRE, obligatoire quand un poste y correspond :
${catalogText}

À partir de ces informations (et des photos jointes s'il y en a), réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour, de cette forme exacte :

{"metier":"string","description":"string (description claire et complète des travaux, à la 3e personne, prête à être insérée dans un devis)","lots":[{"nom":"string (nom de la pièce ou du lot)","postes":[{"designation":"string","codeCatalogue":"string ou null — le code EXACT (ex: CARMUR-001) d'un ouvrage de la bibliothèque ci-dessus si ce poste y correspond, sinon null","quantite":number,"unite":"string (ex: m², ml, u, h)","prix_unitaire":number,"prix_total":number (uniquement si codeCatalogue est null ; si codeCatalogue est renseigné mets 0, le prix est calculé automatiquement à partir de la bibliothèque)}],"materiaux":[{"nom":"string","quantite":number,"unite":"string","prix_estime":number}]}]}

Règle de chiffrage impérative : pour CHAQUE poste, cherche D'ABORD une correspondance dans la bibliothèque de prix ci-dessus et renseigne alors "codeCatalogue" — n'estime un "prix_total" toi-même QUE pour un poste qui n'existe vraiment dans aucun ouvrage de la bibliothèque. Les prix sont en euros HT. Adapte le niveau de gamme des matériaux/prestations hors catalogue au niveau de finition indiqué.

Pour le champ "materiaux" de chaque lot : laisse-le vide ([]) pour un lot dont les fournitures sont à la charge de l'entreprise (matériaux déjà intégrés aux postes). Pour un lot dont les fournitures sont à la charge du client, liste dans "materiaux" ce que le client doit acheter lui-même (nom, quantité, unité, prix estimatif) — ces matériaux ne doivent JAMAIS apparaître dans "postes" pour ce lot, uniquement dans "materiaux".`;
}

function validateGeneratedQuote(parsed) {
  if (!validateAiQuote(parsed)) return false;
  return typeof parsed.metier === "string" && typeof parsed.description === "string";
}

// Applique le coefficient de main d'oeuvre choisi pour chaque lot,
// deterministe (pas decide par l'IA) — voir LABOR_LEVEL_COEFFICIENTS. Un
// poste chiffre depuis la bibliotheque de prix (billingMode "time") n'a pas
// de fixedAmountHt a multiplier : on multiplie plutot son "coefficient"
// (deja utilise par le moteur de calcul, lib/quote-calculations.js) — meme
// resultat final, sans jamais toucher au prix "fixed" propose par l'IA pour
// un poste hors catalogue.
function applyLaborLevelCoefficients(items, lotDetails) {
  if (!Array.isArray(lotDetails) || lotDetails.length === 0) return items;
  const levelByRoom = new Map(
    lotDetails.map((lot) => [fixText(lot.nom).trim().toLowerCase(), lot.laborLevel])
  );
  return items.map((item) => {
    const level = levelByRoom.get(String(item.room || "").trim().toLowerCase());
    const coefficient = LABOR_LEVEL_COEFFICIENTS[level];
    if (!coefficient || coefficient === 1) return item;
    if (item.billingMode === "time") {
      return { ...item, coefficient: Math.round(Number(item.coefficient || 1) * coefficient * 1000) / 1000 };
    }
    return {
      ...item,
      fixedAmountHt: Math.round(Number(item.fixedAmountHt || 0) * coefficient * 100) / 100
    };
  });
}

function sanitizeLotDetails(rawLotDetails) {
  if (!Array.isArray(rawLotDetails)) return [];
  return rawLotDetails
    .filter((lot) => lot && fixText(lot.nom || "").trim())
    .map((lot) => ({
      nom: fixText(lot.nom),
      laborLevel: Object.keys(LABOR_LEVEL_COEFFICIENTS).includes(lot.laborLevel) ? lot.laborLevel : "Standard",
      joursEstimes: Math.max(1, Math.round(Number(lot.joursEstimes) || 1)),
      fournitures: lot.fournitures === "sans" ? "sans" : "avec"
    }));
}

// Pour un lot "sans fournitures", les materiaux proposes par l'IA
// (parsed.lots[].materiaux) ne sont jamais factures — juste listes en note
// sous le lot correspondant (mecanisme de note existant de DevisEditor.jsx,
// roomNotes, jamais compte dans applyQuoteTotals/lib/quote-calculations.js).
// Ca evite de toucher au calcul de prix partage avec le chemin manuel.
function buildMaterialNotes(parsedLots, lotDetails) {
  const sansFournitures = new Set(
    lotDetails.filter((lot) => lot.fournitures === "sans").map((lot) => lot.nom.trim().toLowerCase())
  );
  if (sansFournitures.size === 0) return [];

  const notes = [];
  for (const lot of parsedLots || []) {
    const nom = fixText(lot.nom || "");
    if (!sansFournitures.has(nom.trim().toLowerCase())) continue;
    const materiaux = Array.isArray(lot.materiaux) ? lot.materiaux : [];
    if (materiaux.length === 0) continue;

    let total = 0;
    const lines = materiaux.map((m) => {
      const prix = Math.max(0, Number(m.prix_estime) || 0);
      total += prix;
      const quantite = Number(m.quantite) || 1;
      const unite = fixText(m.unite || "u");
      return `- ${fixText(m.nom || "Matériau")} : ${quantite} ${unite} — environ ${Math.round(prix)}€ HT`;
    });

    notes.push({
      id: `ia-material-note-${Date.now()}-${notes.length}`,
      room: nom,
      type: "message",
      message: `Fournitures à la charge du client pour ce lot (non facturées dans ce devis) :\n${lines.join("\n")}\nTotal estimatif : environ ${Math.round(total)}€ HT — estimation indicative, à faire valider par le client avant achat.`
    });
  }
  return notes;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const clientName = fixText(body.clientName || "");
  const description = fixText(body.description || "");
  if (!clientName) return badRequest("Le nom du client est obligatoire.");
  if (!description) return badRequest("Décrivez les travaux à réaliser.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest("La génération IA n'est pas configurée (clé API manquante).", 500);
  }

  const db = await readDb();
  const catalog = mergedOuvrages(db).map((o) => ({
    code: o.code, label: o.label, unit: o.unit, normativeTime: o.normativeTime, hourlyRate: o.hourlyRate, coefficient: o.coefficient
  }));
  const catalogText = catalog.length
    ? catalog.map((o) => `- [${o.code}] ${o.label} (unite: ${o.unit}, temps normatif: ${o.normativeTime}h${o.hourlyRate ? `, taux: ${o.hourlyRate}€/h` : ""})`).join("\n")
    : "(catalogue vide — estime avec ton propre jugement du marché BTP français)";

  const lotDetails = sanitizeLotDetails(body.lotDetails);

  const promptText = buildPrompt({
    metier: body.metier,
    clientName,
    address: body.address,
    description,
    surface: body.surface,
    finition: body.finition,
    catalogText,
    lotDetails
  });

  const photos = Array.isArray(body.photos) ? body.photos : [];
  const content = [];
  for (const dataUrl of photos.slice(0, 8)) {
    const photo = parsePhoto(dataUrl);
    if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }
  content.push({ type: "text", text: promptText });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let aiText;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      // Sans ça, le modele peut consommer tout son budget de tokens en
      // "reflexion" interne et ne rien ecrire du tout (stop_reason:
      // "max_tokens", output_tokens_details.thinking_tokens === max_tokens,
      // aucun texte) — observe en test le 11 septembre sur un devis a
      // fort perimetre (renovation complete d'un appartement). Une tache
      // de generation JSON structuree n'a pas besoin de raisonnement etendu.
      thinking: { type: "disabled" },
      system: "Tu es l'expert chiffrage BTP de koji. Tu réponds uniquement en JSON strict, sans aucun texte ni balise markdown autour.",
      // claude-sonnet-5 refuse le prefill du tour assistant — un seul
      // message utilisateur, on compte sur la consigne du system prompt +
      // parseAiJson (meme pattern que expertise-koji).
      messages: [
        { role: "user", content }
      ]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    aiText = textBlock?.text || "";
  } catch (error) {
    const message = error?.status === 401
      ? "Clé API Claude invalide."
      : error?.status === 429 || /credit/i.test(String(error?.message || ""))
        ? "Crédits API Claude épuisés."
        : "La génération n'a pas pu se terminer. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  let parsed;
  try {
    parsed = parseAiJson(aiText);
  } catch {
    return badRequest("Réponse de génération illisible. Réessayez.", 502);
  }
  if (!validateGeneratedQuote(parsed)) {
    return badRequest("Réponse de génération incomplète. Réessayez.", 502);
  }

  // trustAiPriceForUnmatched: false (30 sept) — cote entreprise, un poste
  // hors bibliotheque ne recoit jamais un prix invente par l'IA : il est
  // cree a 0€ avec une note visible demandant a l'entreprise de le
  // completer elle-meme, jamais un chiffre IA non verifie affiche comme
  // fiable sur un devis reel.
  const { rooms, items: rawItems, missingPriceNotes } = buildItemsFromAiQuote(parsed, catalog, { trustAiPriceForUnmatched: false });
  const items = applyLaborLevelCoefficients(rawItems, lotDetails);
  const materialNotes = buildMaterialNotes(parsed.lots, lotDetails);
  const missingPriceRoomNotes = buildMissingPriceNotes(missingPriceNotes);

  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });

  const now = new Date().toISOString();
  const quoteNumber = await nextQuoteNumberFor(auth);

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: "001",
    client: clientName,
    project: fixText(parsed.description || description).slice(0, 80),
    projectId: "",
    chantierAddress: fixText(body.address || ""),
    workDescription: fixText(parsed.description || description),
    validityDays: 30,
    company: webUser.business || {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms,
    items,
    notes: [...materialNotes, ...missingPriceRoomNotes],
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
    mode: "ia_complet",
    iaLotDetails: lotDetails.length ? lotDetails : null
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);

  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) {
    return badRequest(`Création du devis impossible: ${error.message}`, 500);
  }

  const quote = mapQuote(inserted);

  addHistory(db, {
    userId: auth.userId,
    type: "quote.ai_generated",
    label: `Devis 100% IA généré pour ${clientName}`,
    entityId: quote.id,
    entityType: "quote",
    meta: { totalTtc: quote.totalTtc }
  });
  await writeDb(db);

  return ok({ quote }, 201);
}
