import Anthropic from "@anthropic-ai/sdk";
import { parseAiJson } from "./ai-json";
import { fixText } from "./text";
import { parsePhoto } from "./ai-photo";

// Logique partagee d'analyse de photos pour Radar des Chantiers (8 oct,
// extraite de app/api/radar-assistant/analyze-photos/route.js pour etre
// appelee aussi directement, cote serveur, par app/api/radar-assistant/
// route.js (detection du type de piece des le tout premier message, sans
// aller-retour HTTP ni prompt duplique) — meme contrat, un seul endroit a
// faire evoluer.
export const PROPOSITIONS_POSSIBLES = [
  "Déposer l'élément existant",
  "Conserver l'élément existant",
  "Remplacer par un élément neuf",
  "Réparer",
  "Repeindre",
  "Modifier",
  "Ajouter un nouvel élément"
];

// room_type_guess de l'IA -> {type, label} dans le vocabulaire interne de
// l'app (meme 4 types que ROOM_TYPE_LABELS dans app/api/radar-assistant/
// route.js : chambre/salle_de_bain/cuisine/autre — "salon"/"bureau" n'ont
// pas de type dedie, mappes sur "autre" avec leur propre libelle).
const ROOM_TYPE_GUESS_MAP = {
  chambre: { type: "chambre", label: "Chambre" },
  salle_de_bain: { type: "salle_de_bain", label: "Salle de bain" },
  cuisine: { type: "cuisine", label: "Cuisine" },
  salon: { type: "autre", label: "Salon" },
  bureau: { type: "autre", label: "Bureau" }
};

export async function analyzePhotosForRadar({ photos, metier, intro, guessRoomType = false }) {
  const empty = { description: "", elements: [], roomTypeGuess: null };
  if (!Array.isArray(photos) || photos.length === 0 || !process.env.ANTHROPIC_API_KEY) return empty;

  const content = [];
  for (const dataUrl of photos.slice(0, 8)) {
    const photo = parsePhoto(dataUrl);
    if (photo) content.push({ type: "image", source: { type: "base64", media_type: photo.mediaType, data: photo.data } });
  }
  if (content.length === 0) return empty;
  content.push({
    type: "text",
    text: `Projet de ${fixText(metier || "rénovation/BTP")} : "${fixText(intro) || "non précisé"}". Analyse ces photos.`
  });

  const roomTypeInstruction = guessRoomType
    ? `\n3) Si la photo montre clairement l'intérieur d'une pièce d'habitation, identifie de quel TYPE de pièce il s'agit : "chambre", "salle_de_bain", "cuisine", "salon" ou "bureau". Mets null au moindre doute (photo d'un détail/élément isolé, pièce ambiguë ou non identifiable avec certitude) — ne force JAMAIS une identification incertaine, un mauvais type de pièce fausserait les questions suivantes.`
    : "";
  const roomTypeSchema = guessRoomType ? `,"room_type_guess":"chambre"|"salle_de_bain"|"cuisine"|"salon"|"bureau"|null` : "";

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 900,
      thinking: { type: "disabled" },
      system: `Tu es koji, conseiller rénovation/BTP. Le client vient d'envoyer des photos de l'existant pour son projet.

1) Décris en 2 à 3 phrases ce que tu observes sur ces photos qui est pertinent pour ce chantier (état actuel, éléments visibles, points d'attention).
2) Identifie jusqu'à 5 éléments distincts et clairement visibles sur la photo (ex: "Carrelage mural", "Baignoire", "Fenêtre", "Plafond") qui pourraient faire l'objet de travaux. Pour CHAQUE élément, choisis 2 à 4 propositions parmi cette liste fixe — UNIQUEMENT celles réalistes pour cet élément précis (ex: "Repeindre" n'a pas de sens pour une baignoire, ne force jamais toutes les options sur tous les éléments) :
${PROPOSITIONS_POSSIBLES.map((p) => `   - ${p}`).join("\n")}${roomTypeInstruction}

Règle absolue (anti-invention) : ne décris et ne liste QUE ce qui est clairement visible sur les photos — jamais une supposition présentée comme un fait, jamais un élément que tu ne peux pas vraiment voir. Jamais de prix, jamais de délai ferme, jamais un avis juridique/assurance.

Réponds UNIQUEMENT avec un objet JSON strict, sans texte ni balise markdown autour :
{"description":"string","elements":[{"element":"string","propositions":["string", ...]}]${roomTypeSchema}}

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
    const roomTypeGuess = guessRoomType && typeof parsed?.room_type_guess === "string"
      ? ROOM_TYPE_GUESS_MAP[parsed.room_type_guess.trim().toLowerCase()] || null
      : null;
    return { description, elements, roomTypeGuess };
  } catch {
    return empty;
  }
}
