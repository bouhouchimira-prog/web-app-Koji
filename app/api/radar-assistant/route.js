import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { parsePhoto } from "../../../lib/ai-photo";
import { fixText } from "../../../lib/text";

// Assistant IA conversationnel, cote particulier, a l'etape "Photos" du
// parcours de creation d'offre (/client/radar/new). Aide a decrire les
// travaux (metier, description, fournitures) et propose une fourchette de
// budget INDICATIVE, non engageante.
//
// Ecart assume par rapport au cahier des charges (section 6, qui prevoit de
// ne PAS montrer d'estimation chiffree au particulier en V1, faute de
// donnees reelles) — decision explicite d'Amira, prise en connaissance de
// cause. La fourchette est toujours presentee comme indicative.
//
// Stateless : aucune conversation n'est persistee cote serveur, le client
// renvoie l'historique complet a chaque tour (comme le reste du wizard, qui
// garde son propre state en memoire jusqu'a publication).

const MAX_USER_TURNS_BEFORE_FORCED_SUMMARY = 6;

const SYSTEM_PROMPT = `Tu es l'assistant koji qui aide un particulier à décrire des travaux de rénovation/BTP avant de publier une demande sur Radar des Chantiers.

Pose UNE question courte et simple à la fois, dans l'ordre qui te semble naturel, pour couvrir : le type de travaux/métier concerné (plomberie, électricité, peinture, carrelage, etc.), la surface ou l'unité concernée (m², nombre de pièces, longueur...), si les fournitures sont déjà prévues ou à la charge de l'entreprise, et un budget approximatif si le particulier en a un en tête.

Dès que tu as assez d'éléments (généralement après 3 à 5 échanges), conclus par un résumé.

Réponds TOUJOURS avec un objet JSON strict, sans aucun texte ni balise markdown autour, sous l'une de ces deux formes exactes :
- Tant qu'il manque des informations : {"type":"question","message":"ta question, en français, ton amical et court"}
- Une fois prêt à conclure : {"type":"summary","message":"un court message de synthèse pour l'utilisateur, en français","metier":"le métier concerné (ex: Plomberie)","description":"une description claire et complète des travaux, rédigée à la 3e personne, prête à être publiée","budgetMin":nombre en euros,"budgetMax":nombre en euros,"withSupplies":true ou false}

Le budget est une fourchette indicative basée sur ton expérience générale du marché BTP français — elle sera toujours présentée à l'utilisateur comme une estimation non engageante, jamais comme un prix ferme.`;

function buildAnthropicMessages(turns, photos) {
  const messages = [];
  let firstUserSeen = false;
  for (const turn of turns) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    if (role === "user" && !firstUserSeen) {
      firstUserSeen = true;
      const content = [];
      for (const dataUrl of photos || []) {
        const photo = parsePhoto(dataUrl);
        if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
      }
      content.push({ type: "text", text: fixText(turn.text || "") });
      messages.push({ role: "user", content });
    } else {
      messages.push({ role, content: fixText(turn.text || "") });
    }
  }
  return messages;
}

function validateReply(parsed) {
  if (!parsed || typeof parsed.message !== "string") return false;
  if (parsed.type === "question") return true;
  if (parsed.type === "summary") {
    return typeof parsed.metier === "string" &&
      typeof parsed.description === "string" &&
      Number.isFinite(Number(parsed.budgetMin)) &&
      Number.isFinite(Number(parsed.budgetMax));
  }
  return false;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const turns = Array.isArray(body.turns) ? body.turns : [];
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return badRequest("Message manquant.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return badRequest("L'assistant IA n'est pas configuré (clé API manquante).", 500);
  }

  const userTurnCount = turns.filter((t) => t.role === "user").length;
  const system = userTurnCount >= MAX_USER_TURNS_BEFORE_FORCED_SUMMARY
    ? `${SYSTEM_PROMPT}\n\nTu as déjà posé assez de questions : conclus obligatoirement maintenant avec une réponse de type "summary", en estimant au mieux avec ce que tu sais déjà.`
    : SYSTEM_PROMPT;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = buildAnthropicMessages(turns, body.photos);

  let replyText;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system,
      messages: [...messages, { role: "assistant", content: "{" }]
    });
    const textBlock = response.content.find((block) => block.type === "text");
    replyText = "{" + (textBlock?.text || "");
  } catch (error) {
    const message = error?.status === 401
      ? "Clé API Claude invalide."
      : error?.status === 429 || /credit/i.test(String(error?.message || ""))
        ? "Crédits API Claude épuisés."
        : "L'assistant n'a pas pu répondre. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(replyText);
  } catch {
    return badRequest("Réponse de l'assistant illisible. Réessayez.", 502);
  }
  if (!validateReply(parsed)) {
    return badRequest("Réponse de l'assistant incomplète. Réessayez.", 502);
  }

  if (parsed.type === "summary") {
    return ok({
      type: "summary",
      message: fixText(parsed.message),
      metier: fixText(parsed.metier || ""),
      description: fixText(parsed.description || ""),
      budgetMin: Math.max(0, Math.round(Number(parsed.budgetMin))),
      budgetMax: Math.max(0, Math.round(Number(parsed.budgetMax))),
      withSupplies: Boolean(parsed.withSupplies)
    });
  }

  return ok({ type: "question", message: fixText(parsed.message) });
}
