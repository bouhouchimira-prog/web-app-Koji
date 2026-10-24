import Anthropic from "@anthropic-ai/sdk";
import { badRequest } from "../../../lib/http";
import { getAuth, getVerifiedUserId } from "../../../lib/server-auth";
import { readDb } from "../../../lib/db";
import { buildDevisChatPrompt } from "../../../lib/devis-chat-prompt";
import { DEVIS_CHAT_TOOLS, executeDevisChatTool } from "../../../lib/devis-chat-tools";
import { ADMIN_INSTRUCTION_TOOL, requesterIsAdmin } from "../../../lib/ai-assistant-instructions";
import { logConversationSafely } from "../../../lib/ai-chat-logs";

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
  // auth.userId is only decoded, not signature-verified — ctx.auth.userId
  // feeds resolveOuvrageForLabel -> mergedOuvrages directly against the
  // local price-library JSON, so a forged token could read another
  // company's private pricing. Verify before it's used for anything but
  // RLS-backed auth.supabase calls.
  const verifiedUserId = await getVerifiedUserId(request, body);
  if (!verifiedUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  auth.userId = verifiedUserId;
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("L'assistant IA n'est pas configuré (clé API manquante).", 500);

  const turns = Array.isArray(body.turns) ? body.turns : [];
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return badRequest("Message manquant.");
  }

  // Vitesse (25 oct, demande d'Amira) : readDb() et la verification admin
  // ci-dessous sont 2 appels reseau independants (base d'etat partagee vs
  // Supabase) — les lancer en parallele plutot que l'un apres l'autre
  // evite d'empiler leurs latences avant meme le premier appel a Claude.
  const [db, ownerProfileResult] = await Promise.all([
    readDb(),
    auth.supabase.from("users").select("email").eq("id", auth.userId).maybeSingle()
  ]);
  const ctx = { auth, db };
  const quoteSnapshot = body.quoteSnapshot || {};
  const messages = toAnthropicMessages(turns);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Consignes admin (17 oct) : seuls bouhouchimira@gmail.com et
  // ablexpertrenov@gmail.com (lib/auth.js::isAdminEmail) peuvent donner une
  // consigne permanente a cet assistant, verifie cote serveur a partir du
  // token authentifie — jamais d'une valeur envoyee par le client. L'outil
  // n'est meme pas propose a Claude pour un compte non-admin.
  const isAdmin = requesterIsAdmin(ownerProfileResult.data?.email);
  const tools = isAdmin ? [...DEVIS_CHAT_TOOLS, ADMIN_INSTRUCTION_TOOL] : DEVIS_CHAT_TOOLS;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => controller.enqueue(encoder.encode(sseFrame(event, data)));
      let finished = false;
      let finalText = "";

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const system = buildDevisChatPrompt({ quoteSnapshot, db, isAdmin });
          const claudeStream = anthropic.messages.stream({
            model: "claude-sonnet-5",
            max_tokens: 1024,
            thinking: { type: "disabled" },
            system,
            tools,
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

        const visibleReply = finalText || "D'accord.";
        send("done", { finished, message: visibleReply });
        // Journal admin (25 oct) — conversation lisible complete (jamais le
        // detail des outils ni les tours synthetiques "[RESULTAT_ECRITURE]",
        // deja marques hidden:true par DevisChatPanel.jsx), jamais bloquant
        // pour l'entreprise.
        if (body.conversationId) {
          await logConversationSafely({
            kind: "devis",
            conversationId: String(body.conversationId),
            entrepriseUserId: auth.userId,
            quoteId: quoteSnapshot?.id || null,
            turns: [...turns.filter((t) => !t.hidden), { role: "assistant", text: visibleReply }]
          });
        }
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
