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
// Etendu le 6 oct (demande d'Amira, remplace la generation d'image
// Replicate jamais branchee) : plutot qu'un simple texte, koji identifie
// les elements visibles sur la photo et propose, pour chacun, des travaux
// possibles que le client peut cocher (un ou plusieurs a la fois) — voir
// PROPOSITIONS_POSSIBLES ci-dessous, repris tel quel de sa demande.
//
// Volontairement JAMAIS bloquant (contrairement au reste du parcours garde-
// fou, ex. classifyReply) : c'est un bonus conversationnel, pas une etape de
// collecte d'information necessaire — toute erreur renvoie une reponse vide
// plutot qu'un statut d'erreur, pour que le client puisse passer directement
// a la question suivante sans jamais rester bloque (voir continueAfterPhotos
// dans app/client/radar/new/page.jsx).
const PROPOSITIONS_POSSIBLES = [
  "Déposer l'élément existant",
  "Conserver l'élément existant",
  "Remplacer par un élément neuf",
  "Réparer",
  "Repeindre",
  "Modifier",
  "Ajouter un nouvel élément"
];

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return ok({ description: "", elements: [] });

  const metier = fixText(body.metier || "").trim();
  const intro = fixText(body.intro || "").trim();
  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length === 0 || !process.env.ANTHROPIC_API_KEY) return ok({ description: "", elements: [] });

  const content = [];
  for (const dataUrl of photos.slice(0, 8)) {
    const photo = parsePhoto(dataUrl);
    if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }
  if (content.length === 0) return ok({ description: "", elements: [] });
  content.push({
    type: "text",
    text: `Projet de ${metier || "rénovation/BTP"} : "${intro || "non précisé"}". Analyse ces photos.`
  });

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      thinking: { type: "disabled" },
      system: `Tu es koji, conseiller rénovation/BTP. Le client vient d'envoyer des photos de l'existant pour son projet.

1) Décris en 2 à 3 phrases ce que tu observes sur ces photos qui est pertinent pour ce chantier (état actuel, éléments visibles, points d'attention).
2) Identifie jusqu'à 5 éléments distincts et clairement visibles sur la photo (ex: "Carrelage mural", "Baignoire", "Fenêtre", "Plafond") qui pourraient faire l'objet de travaux. Pour CHAQUE élément, choisis 2 à 4 propositions parmi cette liste fixe — UNIQUEMENT celles réalistes pour cet élément précis (ex: "Repeindre" n'a pas de sens pour une baignoire, ne force jamais toutes les options sur tous les éléments) :
${PROPOSITIONS_POSSIBLES.map((p) => `   - ${p}`).join("\n")}

Règle absolue (anti-invention) : ne décris et ne liste QUE ce qui est clairement visible sur les photos — jamais une supposition présentée comme un fait, jamais un élément que tu ne peux pas vraiment voir. Jamais de prix, jamais de délai ferme, jamais un avis juridique/assurance.

Réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour :
{"description":"string","elements":[{"element":"string","propositions":["string", ...]}]}

Tableau "elements" vide si rien d'exploitable sur la photo (floue, sans rapport...) — ne force jamais une identification incertaine.`,
      messages: [{ role: "user", content }]
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const parsed = parseAiJson(textBlock?.text);
    const description = typeof parsed?.description === "string" ? fixText(parsed.description).trim().slice(0, 500) : "";
    const elements = Array.isArray(parsed?.elements)
      ? parsed.elements
        .filter((e) => e && typeof e.element === "string" && e.element.trim() && Array.isArray(e.propositions))
        .slice(0, 5)
        .map((e) => ({
          element: fixText(e.element).trim().slice(0, 60),
          propositions: e.propositions
            .filter((p) => typeof p === "string" && PROPOSITIONS_POSSIBLES.includes(p.trim()))
            .map((p) => p.trim())
            .slice(0, 4)
        }))
        .filter((e) => e.propositions.length > 0)
      : [];
    return ok({ description, elements });
  } catch {
    return ok({ description: "", elements: [] });
  }
}
