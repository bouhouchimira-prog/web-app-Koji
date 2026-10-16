import Anthropic from "@anthropic-ai/sdk";
import { badRequest } from "../../../lib/http";
import { getAuth } from "../../../lib/server-auth";
import { readDb } from "../../../lib/db";
import { buildDevisChatPrompt } from "../../../lib/devis-chat-prompt";
import { DEVIS_CHAT_TOOLS, executeDevisChatTool } from "../../../lib/devis-chat-tools";

// Mode "Avec l'IA" cote devis entreprise (16 oct, maquette Artifact
// DevisCreerIA) — moteur SSE conversationnel calque sur
// app/api/radar-chat/route.js (meme boucle d'outils, meme streaming), mais
// adapte a un besoin different : ici l'IA modifie EN DIRECT le devis
// actuellement ouvert dans DevisEditor.jsx, pas un brouillon jetable cote
// serveur. Aucun etat n'est ecrit en base par cette route elle-meme —
// chaque appel d'outil renvoie un resultat structure (evenement SSE
// "action"), applique cote client par les memes fonctions que les boutons
// "Ajouter" manuels (addAiOuvrageToRoom, addCustomRoomAndFocus...) : la
// route ne fait jamais confiance a un prix propose par l'IA, uniquement a
// resolveOuvrageForLabel (bibliotheque koji, voir lib/devis-chat-tools.js).
const MAX_TOOL_ROUNDS = 6;

function toAnthropicMessages(turns) {
  return (Array.isArray(turns) ? turns : [])
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .map((t) => ({ role: t.role, content: t.text }));
}

function sseFrame(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const auth = getAuth(request, body);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("L'assistant IA n'est pas configuré (clé API manquante).", 500);

  const turns = Array.isArray(body.turns) ? body.turns : [];
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return badRequest("Message manquant.");
  }

  const db = await readDb();
  const ctx = { auth, db };
  const quoteSnapshot = body.quoteSnapshot || {};
  const messages = toAnthropicMessages(turns);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => controller.enqueue(encoder.encode(sseFrame(event, data)));
      let finished = false;
      let finalText = "";

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const system = buildDevisChatPrompt({ quoteSnapshot });
          const claudeStream = anthropic.messages.stream({
            model: "claude-sonnet-5",
            max_tokens: 1024,
            thinking: { type: "disabled" },
            system,
            tools: DEVIS_CHAT_TOOLS,
            messages
          });

          claudeStream.on("text", (delta) => send("delta", { text: delta }));

          const response = await claudeStream.finalMessage();

          const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");
          const textBlocks = response.content.filter((b) => b.type === "text");
          const roundText = textBlocks.map((b) => b.text).join("\n").trim();
          if (roundText) finalText = finalText ? `${finalText}\n\n${roundText}` : roundText;

          if (toolUseBlocks.length === 0) break;

          messages.push({ role: "assistant", content: response.content });
          const toolResults = [];
          for (const block of toolUseBlocks) {
            const { content, action, finished: didFinish } = await executeDevisChatTool(block.name, block.input, ctx);
            if (action) send("action", action);
            if (didFinish) finished = true;
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content });
          }
          messages.push({ role: "user", content: toolResults });

          if (finished) break;
          if (response.stop_reason !== "tool_use") break;
        }

        send("done", { finished, message: finalText || "D'accord." });
      } catch (error) {
        const message = error?.status === 401
          ? "Clé API Claude invalide."
          : error?.status === 429 || /credit/i.test(String(error?.message || ""))
            ? "Crédits API Claude épuisés."
            : "L'assistant n'a pas pu répondre. Réessayez dans quelques instants.";
        send("error", { message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }
  });
}
