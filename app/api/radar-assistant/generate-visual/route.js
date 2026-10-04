import { ok } from "../../../../lib/http";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { fixText } from "../../../../lib/text";

// Proposition visuelle generee apres l'analyse des photos (4 oct, demande
// d'Amira) — Claude ne genere pas d'images, seulement l'API Messages
// (analyse). Fournisseur choisi pour la generation : Replicate, modele
// adirik/interior-design (image-to-image, preserve la structure de la
// piece via segmentation + ControlNet, ~0,0075$/generation). Jeton a
// obtenir sur replicate.com -> Account -> API tokens, colle dans
// .env.local sous REPLICATE_API_TOKEN.
//
// Volontairement JAMAIS bloquant (meme principe que analyze-photos) : une
// erreur renvoie imageUrl:null plutot qu'un statut d'erreur, pour que le
// client puisse toujours continuer la conversation normalement.
const MODEL_URL = "https://api.replicate.com/v1/models/adirik/interior-design/predictions";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return ok({ imageUrl: null });

  const metier = fixText(body.metier || "").trim();
  const intro = fixText(body.intro || "").trim();
  const photo = typeof body.photo === "string" ? body.photo : "";
  if (!photo || !process.env.REPLICATE_API_TOKEN) return ok({ imageUrl: null });

  const prompt = `Rénovation ${metier || "intérieure"} moderne et soignée${intro ? ` — projet : ${intro}` : ""}, finitions neuves, style contemporain, lumineux, photoréaliste.`;

  try {
    const response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait"
      },
      body: JSON.stringify({ input: { image: photo, prompt } })
    });
    if (!response.ok) return ok({ imageUrl: null });
    const prediction = await response.json();
    const output = prediction.output;
    const imageUrl = Array.isArray(output) ? output[0] : typeof output === "string" ? output : null;
    return ok({ imageUrl: imageUrl || null });
  } catch {
    return ok({ imageUrl: null });
  }
}
