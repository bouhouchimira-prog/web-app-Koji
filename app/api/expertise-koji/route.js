import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { mergedOuvrages } from "../../../lib/ouvrages";
import { validateAiQuote, buildItemsFromAiQuote } from "../../../lib/ai-devis-shape";
import { quoteToRow, nextQuoteNumberFor } from "../../../lib/quote-mapping";
import { applyQuoteTotals } from "../../../lib/quote-calculations";
import { parsePhoto } from "../../../lib/ai-photo";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { resolveAdminUserId } from "../../../lib/admin-account";
import { fixText } from "../../../lib/text";
import { parseAiJson } from "../../../lib/ai-json";

// "Expertise koji" — decisions du 4 septembre : plus de budget demande au
// client, c'est koji qui fixe le prix. L'IA chiffre a partir de la
// conversation avec l'assistant (app/api/radar-assistant) + la bibliotheque
// de prix interne, publie une fourchette large (+/-15%, garde-fou beta —
// jamais decidee par l'IA elle-meme) et cree un devis INTERNE, jamais
// montre au particulier ni a une entreprise (voir lib/quote-mapping.js
// `internalOnly`). Ce devis n'a pas encore d'entreprise associee : il
// appartient administrativement au compte admin (resolveAdminUserId),
// jusqu'a ce qu'une entreprise se positionne et en recoive une copie
// (app/api/estimer-devis/route.js).
const PRICE_RANGE_SPREAD = 0.15;

// Fake auth wrapper: no entreprise Supabase Auth token exists for a
// particulier session, so this route writes to `quotes` via the
// service-role client rather than a per-user RLS-scoped one — the row's
// owner (user_id) is the admin account, not the caller.
async function nextQuoteNumberForAdmin(supabase, adminUserId) {
  return nextQuoteNumberFor({ supabase, userId: adminUserId });
}

// Les reponses viennent du parcours a liste fixe de app/api/radar-assistant
// (garde-fou du 6 septembre) : chaque champ n'a pu etre rempli que par une
// reponse classifiee "on_topic" a SA question dediee — aucun hors-sujet, ni
// tentative d'injection de consignes glissee dans la conversation, ne peut
// donc atteindre ce prompt. On construit un recapitulatif structure plutot
// que de rejouer la conversation brute.
function buildPrompt({ answers, catalogText }) {
  const a = answers || {};
  return `Voici les informations recueillies aupres d'un particulier au sujet de travaux de rénovation/BTP :

- Description initiale du projet : ${fixText(a.intro || "non précisée")}
- Adresse du chantier : ${fixText(a.adresse || "non précisée")}
- Dimensions / surface concernées : ${fixText(a.cotes || "non précisées")}
- Configuration de la pièce : ${fixText(a.configuration || "non précisée")}
- Disposition souhaitée : ${fixText(a.disposition || "non précisée")}
- Fournitures : ${fixText(a.fournitures || "non précisé")}
- Étage : ${fixText(a.etage || "non précisé")}
- Ascenseur : ${fixText(a.ascenseur || "non précisé")}
- Accès pour les artisans : ${fixText(a.acces || "non précisé")}
- Stationnement pour les artisans : ${fixText(a.stationnement || "non précisé")}
- Nettoyage de fin de chantier : ${fixText(a.nettoyage || "non précisé")}
- État actuel de la pièce/l'espace (meubles, vide...) : ${fixText(a.etat || "non précisé")}${a.metier ? `\n- Métier principal identifié : ${fixText(a.metier)}` : ""}${a.equipements ? `\n- Équipements souhaités : ${fixText(a.equipements)}` : ""}${a.style ? `\n- Style / finitions souhaités : ${fixText(a.style)}` : ""}${a.gamme ? `\n- Gamme souhaitée : ${fixText(a.gamme)}` : ""}${a.etatGeneral ? `\n- État général actuel de l'espace : ${fixText(a.etatGeneral)}` : ""}${a.travauxDetail ? `\n- Travaux détaillés demandés : ${fixText(a.travauxDetail)}` : ""}${a.travauxPrecisions ? `\n- Précisions chiffrées sur les travaux (surfaces, quantités) : ${fixText(a.travauxPrecisions)}` : ""}${a.normes ? `\n- Normes de référence pour ce corps de métier (contexte, à respecter dans le chiffrage sans l'affirmer comme une certification) : ${fixText(a.normes)}` : ""}${a.cadragePrecisions ? `\n- Précisions sur la nature exacte des travaux (obtenues en début de conversation) : ${fixText(a.cadragePrecisions)}` : ""}

Bibliothèque de prix interne Koji — SOURCE DE PRIX PRIORITAIRE, obligatoire quand un poste y correspond :
${catalogText}

À partir de ces informations (et des photos jointes s'il y en a), réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour, de cette forme exacte :

{"metier":"string (métier principal concerné, ex: Plomberie)","description":"string (résumé du projet en UNE seule phrase courte, façon titre d'annonce — ex: \"Rénovation complète d'une salle de bain de 5 m², style moderne\" — jamais un paragraphe détaillé, le détail des travaux est dans lots/postes)","lots":[{"nom":"string","postes":[{"designation":"string","codeCatalogue":"string ou null — le code EXACT (ex: CARMUR-001) d'un ouvrage de la bibliothèque ci-dessus si ce poste y correspond, sinon null","quantite":number,"prix_unitaire":number,"prix_total":number (uniquement si codeCatalogue est null ; si codeCatalogue est renseigné mets 0, le prix est calculé automatiquement à partir de la bibliothèque)}]}],"prix_total_estime":number,"conseils":[{"label":"string (conseil concret et réaliste pour réduire le coût, ex: vider la pièce soi-même)","discountPercent":number (impact estimé sur le total, ex: 8 pour -8%)}],"delaiEstimeJours":number}

Règle de chiffrage impérative : pour CHAQUE poste, cherche D'ABORD une correspondance dans la bibliothèque de prix ci-dessus et renseigne alors "codeCatalogue" — n'estime un "prix_total" toi-même QUE pour un poste qui n'existe vraiment dans aucun ouvrage de la bibliothèque. Fournis entre 2 et 4 conseils. Les prix sont en euros HT.`;
}

function validateExpertiseResponse(parsed) {
  if (!validateAiQuote(parsed)) return false;
  if (typeof parsed.metier !== "string" || typeof parsed.description !== "string") return false;
  if (!Number.isFinite(Number(parsed.delaiEstimeJours))) return false;
  if (!Array.isArray(parsed.conseils)) return false;
  return parsed.conseils.every((c) => c && typeof c.label === "string" && Number.isFinite(Number(c.discountPercent)));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};
  if (!answers.intro) return badRequest("Pas assez d'informations pour lancer l'expertise.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest("L'expertise IA n'est pas configurée (clé API manquante).", 500);
  }

  const db = await readDb();
  const catalog = mergedOuvrages(db).map((o) => ({
    code: o.code, label: o.label, unit: o.unit, normativeTime: o.normativeTime, hourlyRate: o.hourlyRate, coefficient: o.coefficient
  }));
  const catalogText = catalog.length
    ? catalog.map((o) => `- [${o.code}] ${o.label} (unite: ${o.unit}, temps normatif: ${o.normativeTime}h${o.hourlyRate ? `, taux: ${o.hourlyRate}€/h` : ""})`).join("\n")
    : "(catalogue vide — estime avec ton propre jugement du marché BTP français)";

  const promptText = buildPrompt({ answers, catalogText });
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
      // "reflexion" interne et ne rien ecrire du tout (observe le 11
      // septembre sur un devis-ia a fort perimetre — meme risque ici).
      thinking: { type: "disabled" },
      system: "Tu es l'expert chiffrage BTP de koji. Tu réponds uniquement en JSON strict, sans aucun texte ni balise markdown autour.",
      // claude-sonnet-5 refuse le prefill du tour assistant ("This model
      // does not support assistant message prefill") — plus de "{"
      // pre-rempli, on compte sur la consigne du system prompt + parseAiJson.
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
        : "L'expertise n'a pas pu se terminer. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  let parsed;
  try {
    parsed = parseAiJson(aiText);
  } catch {
    return badRequest("Réponse de l'expertise illisible. Réessayez.", 502);
  }
  if (!validateExpertiseResponse(parsed)) {
    return badRequest("Réponse de l'expertise incomplète. Réessayez.", 502);
  }

  const adminUserId = await resolveAdminUserId();
  if (!adminUserId) return badRequest("Configuration interne manquante (compte admin introuvable).", 500);

  const { rooms, items } = buildItemsFromAiQuote(parsed, catalog);
  const total = Math.max(0, Number(parsed.prix_total_estime) || 0);
  const conseils = parsed.conseils.map((c, index) => ({
    id: `conseil-${index}`,
    label: fixText(c.label),
    discountPercent: Math.max(0, Number(c.discountPercent) || 0)
  }));

  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const quoteNumber = await nextQuoteNumberForAdmin(supabaseAdmin, adminUserId);

  const draft = {
    id: "",
    userId: adminUserId,
    quoteNumber,
    versionNumber: "001",
    client: "Particulier Radar des Chantiers",
    project: fixText(parsed.description || "Chantier").slice(0, 80),
    projectId: "",
    workDescription: fixText(parsed.description || ""),
    validityDays: 30,
    company: {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms,
    items,
    notes: [],
    surcharges: [],
    // vatRate est un pourcentage ENTIER (20, pas 0.2) — c'est ce que lit
    // DevisEditor.jsx directement (Number(quote.vatRate)), comme le fait
    // deja la creation manuelle d'un devis (app/api/quotes/route.js,
    // "Number(body.vatRate ?? 20)"). lib/quote-calculations.js normalise
    // les deux formes cote calcul serveur, DevisEditor non (30 sept, bug
    // remonte par Amira : TVA affichee "0,2 %" au lieu de "20 %").
    vatRate: 20,
    draftStep: 0,
    draftData: null,
    isCreationDraft: false,
    totalHt: 0,
    totalTtc: 0,
    createdAt: now.slice(0, 10),
    createdAtIso: now,
    updatedAt: now,
    internalOnly: true,
    expertiseConseils: conseils,
    expertiseDelaiJours: Math.max(1, Math.round(Number(parsed.delaiEstimeJours) || 7))
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, adminUserId);
  // L'IA fournit un total indicatif ; le vrai total facturable vient du
  // calcul des lignes (applyQuoteTotals) — coherent avec le reste de l'app.
  const finalTotal = computed.totalTtc || total;

  const { data: inserted, error } = await supabaseAdmin.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création de l'expertise impossible: ${error.message}`, 500);

  const priceRangeMin = Math.round(finalTotal * (1 - PRICE_RANGE_SPREAD));
  const priceRangeMax = Math.round(finalTotal * (1 + PRICE_RANGE_SPREAD));

  return ok({
    expertiseId: inserted.id,
    metier: fixText(parsed.metier || ""),
    description: fixText(parsed.description || ""),
    priceRangeMin,
    priceRangeMax,
    delaiEstimeJours: Math.max(1, Math.round(Number(parsed.delaiEstimeJours) || 7)),
    conseils
  }, 201);
}
