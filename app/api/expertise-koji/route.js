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
// client, c'est koji qui chiffre. L'IA chiffre a partir de la conversation
// avec l'assistant (app/api/radar-assistant) + la bibliotheque de prix
// interne et cree un devis INTERNE, jamais montre au particulier ni a une
// entreprise (voir lib/quote-mapping.js
// `internalOnly`). Ce devis n'a pas encore d'entreprise associee : il
// appartient administrativement au compte admin (resolveAdminUserId),
// jusqu'a ce qu'une entreprise se positionne et en recoive une copie
// (app/api/estimer-devis/route.js). Ne publie plus de fourchette de prix au
// client depuis le 17 oct (decision d'Amira : chaque entreprise a son
// propre taux journalier, aucun prix ne peut etre annonce a l'avance) —
// seul le detail des pieces/ouvrages proposes (buildBreakdown, conseils)
// reste utilise par l'ecran client.
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
// Ajouts de derniere minute a la question de cloture (1er oct, demande
// d'Amira) — desormais une LISTE (plusieurs metiers/elements possibles, un
// par un), chacun avec sa propre precision chiffree si l'IA en a demande une.
function formatComplements(complements) {
  if (!Array.isArray(complements) || complements.length === 0) return "";
  return complements
    .filter((c) => c && c.item)
    .map((c) => (c.precision ? `${fixText(c.item)} (${fixText(c.precision)})` : fixText(c.item)))
    .join(" ; ");
}

// Decoupage par piece (1er oct, cahier des charges d'Amira) — quand le
// particulier a decrit son projet piece par piece (app/api/radar-assistant),
// cette liste structuree remplace avantageusement les champs globaux
// cotes/configuration/disposition/etat (non renseignes dans ce cas, voir
// skipIf sur ces SLOTS) : chaque piece porte deja sa propre description, les
// metiers detectes automatiquement, et un resume de ses reponses.
function formatRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) return "";
  return rooms
    .map((r) => {
      const metiers = Array.isArray(r.metiers) && r.metiers.length > 0 ? ` [métiers concernés : ${r.metiers.join(", ")}]` : "";
      const summary = r.summary ? ` — ${fixText(r.summary)}` : "";
      return `  * ${fixText(r.label)}${metiers}${summary}`;
    })
    .join("\n");
}

function buildPrompt({ answers, catalogText }) {
  const a = answers || {};
  const complementsText = formatComplements(a.complements);
  const roomsText = formatRooms(a.rooms);
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
- État actuel de la pièce/l'espace (meubles, vide...) : ${fixText(a.etat || "non précisé")}${a.metier ? `\n- Métier principal identifié : ${fixText(a.metier)}` : ""}${roomsText ? `\n- Projet décrit pièce par pièce par le client (utilise ces pièces comme base des lots du devis, un lot par pièce quand c'est pertinent) :\n${roomsText}` : ""}${a.equipements ? `\n- Équipements souhaités : ${fixText(a.equipements)}` : ""}${a.style ? `\n- Style / finitions souhaités : ${fixText(a.style)}` : ""}${a.etatGeneral ? `\n- État général actuel de l'espace : ${fixText(a.etatGeneral)}` : ""}${a.travauxDetail ? `\n- Travaux détaillés demandés : ${fixText(a.travauxDetail)}` : ""}${a.travauxPrecisions ? `\n- Précisions chiffrées sur les travaux (surfaces, quantités) : ${fixText(a.travauxPrecisions)}` : ""}${a.normes ? `\n- Normes de référence pour ce corps de métier (contexte, à respecter dans le chiffrage sans l'affirmer comme une certification) : ${fixText(a.normes)}` : ""}${a.cadragePrecisions ? `\n- Précisions sur la nature exacte des travaux (obtenues en début de conversation) : ${fixText(a.cadragePrecisions)}` : ""}${complementsText ? `\n- Éléments ajoutés par le client en fin de conversation (à chiffrer comme le reste du projet) : ${complementsText}` : ""}${a.photoPropositions ? `\n- Travaux choisis par le client suite à l'analyse de ses photos (à chiffrer comme le reste du projet) : ${fixText(a.photoPropositions)}` : ""}

Bibliothèque de prix interne Koji — SOURCE DE PRIX PRIORITAIRE, obligatoire quand un poste y correspond :
${catalogText}

À partir de ces informations (et des photos jointes s'il y en a), réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour, de cette forme exacte :

{"metier":"string (métier principal concerné, ex: Plomberie)","description":"string (résumé du projet en UNE seule phrase courte, façon titre d'annonce — ex: \"Rénovation complète d'une salle de bain de 5 m², style moderne\" — jamais un paragraphe détaillé, le détail des travaux est dans lots/postes)","lots":[{"nom":"string","postes":[{"designation":"string","codeCatalogue":"string ou null — le code EXACT (ex: CARMUR-001) d'un ouvrage de la bibliothèque ci-dessus si ce poste y correspond, sinon null","quantite":number,"prix_unitaire":number,"prix_total":number (uniquement si codeCatalogue est null ; si codeCatalogue est renseigné mets 0, le prix est calculé automatiquement à partir de la bibliothèque)}]}],"prix_total_estime":number,"conseils":[{"label":"string (conseil concret et réaliste pour réduire le coût, ex: vider la pièce soi-même)","discountPercent":number (impact estimé sur le total, ex: 8 pour -8%)}],"delaiEstimeJours":number}

Règle de chiffrage impérative : pour CHAQUE poste, cherche D'ABORD une correspondance dans la bibliothèque de prix ci-dessus et renseigne alors "codeCatalogue" — n'estime un "prix_total" toi-même QUE pour un poste qui n'existe vraiment dans aucun ouvrage de la bibliothèque.

Règle anti-faux-raccordement (critique, cause déjà constatée de prix très sous-évalués) : "codeCatalogue" ne doit JAMAIS être renseigné "par approximation" ou parce qu'un code du même métier existe vaguement à proximité — uniquement si le code correspond EXACTEMENT à la prestation décrite (même nature de travaux, même type d'ouvrage). En cas de doute, codeCatalogue doit être null. La bibliothèque ci-dessus est une bibliothèque de MAIN D'ŒUVRE UNIQUEMENT (temps de pose/intervention) — elle ne contient AUCUN prix d'achat de fournitures, meubles, électroménager ou matériaux. Tout poste qui est un ACHAT (ex: "achat d'un meuble de cuisine", "achat d'une chaudière", "achat de carrelage") doit TOUJOURS avoir codeCatalogue null, même si un poste de pose/installation de ce même élément existe dans la bibliothèque — ne confonds jamais le prix de la main d'œuvre de pose avec le prix d'achat de l'élément lui-même.

Fournis entre 2 et 4 conseils. Les prix sont en euros HT.`;
}

// Detail de la fourchette par lot (1er oct, demande d'Amira : "prix
// cliquable et detaille, le total de chaque metier") — les lots de
// l'expertise ("rooms") sont deja nommes par corps de metier par l'IA
// (buildItemsFromAiQuote), donc regrouper par room revient a regrouper par
// metier pour un projet multi-corps d'etat. Jamais le detail des postes
// eux-memes ici (reste interne), juste un sous-total par lot.
export function buildBreakdown(calculatedItems) {
  const byRoom = new Map();
  for (const item of calculatedItems || []) {
    const room = fixText(item.room || "Général");
    const current = byRoom.get(room) || 0;
    byRoom.set(room, current + (Number(item.totalTtc) || 0));
  }
  return Array.from(byRoom.entries()).map(([room, totalTtc]) => ({ room, totalTtc: Math.round(totalTtc) }));
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

  // trustAiPriceForUnmatched:false (1er oct, demande d'Amira) — le particulier
  // ne voit plus jamais un prix invente par l'IA pour un poste absent du
  // catalogue : il est averti explicitement ("on n'a pas ce prix dans notre
  // base") et peut en proposer un lui-meme sur l'ecran de resultat, sinon le
  // poste reste a 0€. Change le comportement precedent (repli IA automatique,
  // garde encore cote entreprise/devis-ia pour un motif different).
  const { rooms, items } = buildItemsFromAiQuote(parsed, catalog, { trustAiPriceForUnmatched: false });
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
  const { data: inserted, error } = await supabaseAdmin.from("quotes").insert(row).select().single();
  if (error) return badRequest(`Création de l'expertise impossible: ${error.message}`, 500);

  const missingPriceItems = computed.items
    .filter((it) => it.needsPrice)
    .map((it) => ({ id: it.id, room: it.room, label: it.label, quantity: it.quantity, unit: it.unit }));

  return ok({
    expertiseId: inserted.id,
    metier: fixText(parsed.metier || ""),
    description: fixText(parsed.description || ""),
    breakdown: buildBreakdown(computed.calculatedItems),
    delaiEstimeJours: Math.max(1, Math.round(Number(parsed.delaiEstimeJours) || 7)),
    conseils,
    missingPriceItems
  }, 201);
}
