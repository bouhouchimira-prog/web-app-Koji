import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { parsePhoto } from "../../../lib/ai-photo";
import { fixText } from "../../../lib/text";
import { createDraft, getDraft } from "../../../lib/radar-offer-draft";
import { RADAR_TOOLS, executeRadarTool } from "../../../lib/radar-assistant-tools";
import { buildRadarSystemPrompt } from "../../../lib/radar-chat-prompt";

// Nouveau moteur conversationnel Radar des Chantiers (9 oct) — PAS ENCORE
// branche a l'ecran client (app/client/radar/new/page.jsx), qui continue
// d'utiliser /api/radar-assistant pour l'instant. Construit et teste ici en
// isolation, comme convenu avec Amira, avant de toucher a l'UI existante.
//
// Contrairement a /api/radar-assistant (SLOTS fixes + un appel IA etroit
// par etape), ce moteur tient toute la conversation : un seul system prompt
// (lib/radar-chat-prompt.js) decrit le role, les regles, et l'etat deja
// connu du projet ; Claude pose lui-meme la question suivante et appelle
// ses outils (lib/radar-assistant-tools.js) au fil de l'eau. Sans streaming
// pour l'instant (etape suivante du plan) — un appel complet par tour, avec
// une boucle d'outils cote serveur, invisible pour le client.
const MAX_TOOL_ROUNDS = 6;

// Outils "ecriture seule" (9 oct) : leur resultat n'apporte rien de nouveau
// que Claude doive lire avant de repondre (juste une confirmation
// d'enregistrement) — rappeler Claude apres coup, alors qu'il a deja donne
// sa reponse au client dans le meme tour, le poussait a redire/reformuler
// la meme question (observe en test, aucune vraie valeur ajoutee). Seul un
// outil dont le RESULTAT compte pour la suite (consulter_bibliotheque_prix)
// justifie de rappeler Claude.
const NON_REACTIVE_TOOLS = new Set(["update_offer_draft"]);

function toAnthropicMessages(turns, photos) {
  const messages = (Array.isArray(turns) ? turns : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .map((t) => ({ role: t.role, content: t.text }));

  if (photos && photos.length > 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      const imageBlocks = [];
      for (const dataUrl of photos.slice(0, 8)) {
        const photo = parsePhoto(dataUrl);
        if (photo) imageBlocks.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
      }
      if (imageBlocks.length > 0) {
        last.content = [...imageBlocks, { type: "text", text: last.content }];
      }
    }
  }
  return messages;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("L'assistant IA n'est pas configuré (clé API manquante).", 500);

  const turns = Array.isArray(body.turns) ? body.turns : [];
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return badRequest("Message manquant.");
  }

  const conversationId = String(body.conversationId || "") || `radarchat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let draft;
  try {
    draft = body.draftId ? await getDraft(body.draftId) : null;
    if (!draft) draft = await createDraft({ userId: portalUserId, conversationId });
  } catch (err) {
    return badRequest(err.message, 500);
  }

  if (draft.status === "termine") {
    return ok({ message: "Cette demande est déjà complète — direction le récapitulatif.", conversationId, draftId: draft.id, finished: true });
  }

  const prenom = fixText(body.prenom || "").trim();
  const messages = toAnthropicMessages(turns, body.photos);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let finished = false;
  let finalText = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const system = buildRadarSystemPrompt({ draft, prenom });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        thinking: { type: "disabled" },
        system,
        tools: RADAR_TOOLS,
        messages
      });

      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
      const textBlocks = response.content.filter((b) => b.type === "text");
      // Accumule le texte de CHAQUE aller-retour (6 oct : ne garder que le
      // dernier faisait parfois perdre la vraie question posee avant un
      // appel d'outil, Claude melangeant texte et outil dans la meme
      // reponse) — jamais de message perdu, quitte a etre un peu redondant.
      const roundText = textBlocks.map((b) => b.text).join("\n").trim();
      if (roundText) finalText = finalText ? `${finalText}\n\n${roundText}` : roundText;

      if (toolUseBlocks.length === 0) break;

      const allNonReactive = toolUseBlocks.every((b) => NON_REACTIVE_TOOLS.has(b.name));

      messages.push({ role: "assistant", content: response.content });
      const toolResults = [];
      for (const block of toolUseBlocks) {
        const { content, finished: didFinish } = await executeRadarTool(block.name, block.input, { draftId: draft.id });
        if (didFinish) finished = true;
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
      }
      messages.push({ role: "user", content: toolResults });

      // Relit le brouillon pour que le prochain tour (si la boucle continue)
      // voie bien les champs qui viennent d'etre enregistres, jamais un etat
      // perime.
      draft = await getDraft(draft.id);

      if (finished) break;
      // Deja une reponse pour le client ET rien de nouveau a apprendre d'un
      // outil ecriture-seule : inutile (et contre-productif) de rappeler
      // Claude pour ce tour.
      if (roundText && allNonReactive) break;
      if (response.stop_reason !== "tool_use") break;
    }
  } catch (error) {
    const message = error?.status === 401
      ? "Clé API Claude invalide."
      : error?.status === 429 || /credit/i.test(String(error?.message || ""))
        ? "Crédits API Claude épuisés."
        : "L'assistant n'a pas pu répondre. Réessayez dans quelques instants.";
    return badRequest(message, 502);
  }

  return ok({
    message: finalText || "D'accord.",
    conversationId,
    draftId: draft.id,
    finished
  });
}
