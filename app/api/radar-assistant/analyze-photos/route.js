import { ok } from "../../../../lib/http";
import { getVerifiedPortalUserId } from "../../../../lib/portal-session";
import { fixText } from "../../../../lib/text";
import { analyzePhotosForRadar } from "../../../../lib/radar-photo-analysis";

// Commentaire de photos en plein milieu de la conversation (4 oct, demande
// d'Amira) — jusqu'ici les photos etaient stockees en silence et seulement
// lues par l'IA a la toute fin, au moment de chiffrer (voir parsePhoto deja
// utilise par app/api/expertise-koji/route.js). Ici, koji regarde les photos
// des qu'elles sont envoyees et les commente dans la conversation.
//
// Etendu le 6 oct (demande d'Amira, remplace la generation d'image
// Replicate jamais branchee) : plutot qu'un simple texte, koji identifie
// les elements visibles sur la photo et propose, pour chacun, des travaux
// possibles que le client peut cocher (un ou plusieurs a la fois).
//
// Logique de prompt/appel IA deplacee dans lib/radar-photo-analysis.js le 8
// oct (demande d'Amira) pour etre reutilisee directement, cote serveur, par
// app/api/radar-assistant/route.js (detection du type de piece au tout
// premier message) sans aller-retour HTTP ni prompt duplique — cette route
// reste le point d'entree HTTP normal, appele par le client a chaque photo
// envoyee en cours de conversation.
//
// Volontairement JAMAIS bloquant (contrairement au reste du parcours garde-
// fou, ex. classifyReply) : c'est un bonus conversationnel, pas une etape de
// collecte d'information necessaire — toute erreur renvoie une reponse vide
// plutot qu'un statut d'erreur, pour que le client puisse passer directement
// a la question suivante sans jamais rester bloque (voir continueAfterPhotos
// dans app/client/radar/new/page.jsx).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const portalUserId = getVerifiedPortalUserId(request, body);
  if (!portalUserId) return ok({ description: "", elements: [] });

  const metier = fixText(body.metier || "").trim();
  const intro = fixText(body.intro || "").trim();
  const photos = Array.isArray(body.photos) ? body.photos : [];

  const { description, elements } = await analyzePhotosForRadar({ photos, metier, intro });
  return ok({ description, elements });
}
