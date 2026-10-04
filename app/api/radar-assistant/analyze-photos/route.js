import Anthropic from "@anthropic-ai/sdk";
import { ok } from "../../../../lib/http";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { parseAiJson } from "../../../../lib/ai-json";
import { fixText } from "../../../../lib/text";
import { parsePhoto } from "../../../../lib/ai-photo";

// Commentaire de photos en plein milieu de la conversation (4 oct, demande
// d'Amira) — jusqu'ici les photos etaient stockees en silence et seulement
// lues par l'IA a la toute fin, au moment de chiffrer (voir parsePhoto deja
// utilise par app/api/expertise-koji/route.js). Ici, koji regarde les photos
// des qu'elles sont envoyees et les commente dans la conversation.
//
// Volontairement JAMAIS bloquant (contrairement au reste du parcours garde-
// fou, ex. classifyReply) : c'est un bonus conversationnel, pas une etape de
// collecte d'information necessaire — toute erreur renvoie un message vide
// plutot qu'un statut d'erreur, pour que le client puisse passer directement
// a la question suivante sans jamais rester bloque (voir continueAfterPhotos
// dans app/client/radar/new/page.jsx).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return ok({ message: "" });

  const metier = fixText(body.metier || "").trim();
  const intro = fixText(body.intro || "").trim();
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length === 0 || !process.env.ANTHROPIC_API_KEY) return ok({ message: "" });

  const content = [];
  for (const dataUrl of photos.slice(0, 8)) {
    const photo = parsePhoto(dataUrl);
    if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }
  if (content.length === 0) return ok({ message: "" });
  content.push({
    type: "text",
    text: `Projet de ${metier || "rénovation/BTP"} : "${intro || "non précisé"}". Décris ce que tu observes sur ces photos.`
  });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 400,
      thinking: { type: "disabled" },
      system: `Tu es koji, conseiller rénovation/BTP. Le client vient d'envoyer des photos de l'existant pour son projet.

Decris en 2 a 4 phrases ce que tu observes sur ces photos qui est pertinent pour ce chantier (etat actuel, elements visibles, points d'attention), puis propose brievement 1 a 2 suggestions concretes et realistes.

Regle absolue (anti-invention) : ne decris QUE ce qui est clairement visible sur les photos — jamais une supposition presentee comme un fait, jamais un element que tu ne peux pas vraiment voir. Jamais de prix, jamais de delai ferme, jamais un avis juridique/assurance.

Reponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour :
{"message":"string"}`,
      messages: [{ role: "user", content }]
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseAiJson(textBlock?.text);
    const message = typeof parsed?.message === "string" ? fixText(parsed.message).trim().slice(0, 600) : "";
    return ok({ message });
  } catch {
    return ok({ message: "" });
  }
}
