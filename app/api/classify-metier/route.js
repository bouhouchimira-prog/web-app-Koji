import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { getVerifiedPortalUserId } from "../../../lib/portal-session";
import { parseAiJson } from "../../../lib/ai-json";
import { fixText } from "../../../lib/text";
import { RENOVATION_METIERS } from "../../../lib/renovation-question-bank";

// Classification etroite (24 septembre) : determine UNIQUEMENT le metier
// principal parmi la liste fixe deja utilisee ailleurs dans l'app (voir
// METIERS, app/devis-ia/new/page.jsx) a partir de la description libre du
// client, une fois la conversation /api/radar-assistant terminee — sert a
// choisir le bon jeu de cartes equipements/styles/travaux
// (lib/renovation-question-bank.js), jamais a inventer un prix ni une
// question. Meme modele leger (Haiku, reflexion desactivee) que le reste
// des classifications rapides de cette app.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const description = fixText(body.description || "").trim();
  if (!description) return ok({ metier: "Tout corps d'état" });

  if (!process.env.ANTHROPIC_API_KEY) return ok({ metier: "Tout corps d'état" });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      thinking: { type: "disabled" },
      system: "Tu classes une description de travaux de renovation/BTP dans un metier. Reponds uniquement en JSON strict, sans texte ni balise markdown autour.",
      messages: [{
        role: "user",
        content: `Métiers possibles : ${RENOVATION_METIERS.join(", ")}.\n\nDescription du client : "${description}"\n\nRéponds avec : {"metier": "un des métiers ci-dessus, celui qui correspond le mieux — \\"Tout corps d'état\\" si plusieurs corps de métier sont mélangés ou si ce n'est pas clair"}`
      }]
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseAiJson(textBlock?.text);
    const metier = RENOVATION_METIERS.includes(parsed.metier) ? parsed.metier : "Tout corps d'état";
    return ok({ metier });
  } catch {
    return ok({ metier: "Tout corps d'état" });
  }
}
