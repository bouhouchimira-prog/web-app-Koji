import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise } from "../../../lib/entreprise-auth";
import { fixText } from "../../../lib/text";
import { chiffresConserves, langueDe } from "../../../lib/compte-pro";

// Traduction automatique (maquette PRO-15.1) : messages reçus traduits dans
// la langue de l'artisan, messages envoyés traduits en français, lecture
// des lignes d'un devis dans sa langue. Les documents eux-mêmes restent en
// français. Montants, dates et quantités sont recopiés tels quels : une
// traduction qui change un chiffre est refusée.
// POST { textes: [..], vers: "pt" | "fr", depuis?: "fr" | "pt", genre?: "message" | "devis" }
const OUTIL = {
  name: "traductions",
  description: "Rend la traduction de chaque texte, dans le même ordre.",
  input_schema: { type: "object", properties: { traductions: { type: "array", items: { type: "string" } } }, required: ["traductions"] }
};
const MAX_TEXTES = 30;
const MAX_CARACTERES = 6000;

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const vers = langueDe(body.vers);
  const depuis = body.depuis ? langueDe(body.depuis) : null;
  if (String(body.vers) !== vers.id) return badRequest("Langue inconnue.");
  const textes = (Array.isArray(body.textes) ? body.textes : []).map((x) => fixText(String(x || "")).trim().slice(0, 1500)).slice(0, MAX_TEXTES);
  if (!textes.length || textes.every((x) => !x)) return badRequest("Rien à traduire.");
  if (textes.join("").length > MAX_CARACTERES) return badRequest("Texte trop long pour une seule traduction.");
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("La traduction n'est pas configurée (clé API manquante).", 500);

  // Mémoire des traductions déjà faites (même texte, même langue) : un fil
  // relu ne repasse pas par le modèle.
  const db = await readDb();
  db.traductions = db.traductions || {};
  const memoire = (db.traductions[entreprise.userId] = db.traductions[entreprise.userId] || {});
  const cle = (texte) => `${vers.id}|${texte}`;
  const manquants = [...new Set(textes.filter((x) => x && !memoire[cle(x)]))];
  if (manquants.length) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const r = await anthropic.messages.create({
        model: "claude-sonnet-5",
        max_tokens: 4000,
        thinking: { type: "disabled" },
        system: `Tu traduis des ${body.genre === "devis" ? "lignes de devis de travaux" : "messages entre un artisan du bâtiment et son client"}${depuis ? ` du ${depuis.fr === "par défaut" ? "français" : depuis.fr}` : ""} vers ${vers.id === "fr" ? "le français" : `la langue « ${vers.nom} » (${vers.fr})`}. Vocabulaire du bâtiment exact (assurance décennale, devis, acompte, syndic, faïence, receveur, étanchéité…). Ne traduis JAMAIS les montants, dates, heures, quantités, dimensions, numéros, noms propres, adresses : recopie-les tels quels, avec les mêmes chiffres. Garde le ton et le vouvoiement du texte. N'ajoute rien, n'explique rien. ${vers.id === "fr" ? "Français courant et poli, comme un artisan qui écrit à son client." : ""}`,
        tools: [OUTIL],
        tool_choice: { type: "tool", name: OUTIL.name },
        messages: [{ role: "user", content: manquants.map((x, i) => `[${i + 1}] ${x}`).join("\n\n") }]
      });
      const rendu = r.content.find((b) => b.type === "tool_use")?.input?.traductions;
      if (!Array.isArray(rendu) || rendu.length !== manquants.length) return badRequest("La traduction n'a pas abouti. Réessayez.", 502);
      manquants.forEach((x, i) => {
        const tr = fixText(String(rendu[i] || "")).replace(/^\[\d+\]\s*/, "").trim();
        // Un chiffre changé : on garde le texte d'origine plutôt qu'une traduction fausse.
        memoire[cle(x)] = tr && chiffresConserves(x, tr) ? tr : x;
      });
      const cles = Object.keys(memoire);
      if (cles.length > 600) for (const k of cles.slice(0, cles.length - 600)) delete memoire[k];
      await writeDb(db);
    } catch (error) {
      const message = error?.status === 429 ? "La traduction est très demandée, réessayez dans un instant." : "La traduction n'a pas abouti. Réessayez.";
      return badRequest(message, 502);
    }
  }
  return ok({ traductions: textes.map((x) => (x ? memoire[cle(x)] || x : "")), vers: vers.id });
}
