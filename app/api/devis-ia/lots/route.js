import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { getAuth } from "../../../../lib/server-auth";
import { parseAiJson } from "../../../../lib/ai-json";
import { parsePhoto } from "../../../../lib/ai-photo";
import { fixText } from "../../../../lib/text";

// Premiere etape du devis "100% IA" (11 septembre) : avant de generer le
// devis complet, on identifie les pieces/lots probables du chantier a
// partir de la description/surface/photos, avec une estimation de duree
// initiale par lot — proposition que l'entreprise valide/ajuste ensuite,
// lot par lot, avant la generation finale (app/api/devis-ia/route.js).
// Rien n'est ecrit en base ici, c'est un simple appel de proposition.
function buildLotsPrompt({ metier, description, surface }) {
  return `Voici les informations d'un chantier BTP :

- Métier concerné : ${fixText(metier || "non précisé")}
- Description des travaux : ${fixText(description || "non précisée")}
- Surface ou pièce concernée : ${fixText(surface || "non précisée")}

À partir de ces informations (et des photos jointes s'il y en a), identifie les pièces ou lots de travaux distincts concernés, avec pour chacun une estimation grossière du nombre de jours de travail. Réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour, de cette forme exacte :

{"lots":[{"nom":"string (nom de la pièce ou du lot, court)","joursEstimes":number}]}

Entre 1 et 6 lots. Les jours estimés sont une proposition indicative, pas un chiffrage final.`;
}

function validateLots(parsed) {
  if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return false;
  return parsed.lots.every((lot) => lot && typeof lot.nom === "string" && lot.nom.trim() && Number.isFinite(Number(lot.joursEstimes)));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const description = fixText(body.description || "");
  if (!description) return badRequest("Décrivez les travaux à réaliser.");

  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest("La génération IA n'est pas configurée (clé API manquante).", 500);
  }

  const promptText = buildLotsPrompt({ metier: body.metier, description, surface: body.surface });
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
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system: "Tu es l'expert chiffrage BTP de koji. Tu réponds uniquement en JSON strict, sans aucun texte ni balise markdown autour.",
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
        : "L'identification des lots n'a pas pu se terminer. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  let parsed;
  try {
    parsed = parseAiJson(aiText);
  } catch {
    return badRequest("Réponse illisible. Réessayez.", 502);
  }
  if (!validateLots(parsed)) {
    return badRequest("Réponse incomplète. Réessayez.", 502);
  }

  const lots = parsed.lots.map((lot) => ({
    nom: fixText(lot.nom),
    joursEstimes: Math.max(1, Math.round(Number(lot.joursEstimes) || 1))
  }));

  return ok({ lots });
}
