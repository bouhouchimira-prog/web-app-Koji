import Anthropic from "@anthropic-ai/sdk";
import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { resolveEntreprise } from "../../../../lib/entreprise-auth";
import { mergedOuvragesAsync } from "../../../../lib/ouvrages";
import { chargerCatalogue } from "../../../../lib/fournitures-serveur";
import { NIVEAUX_SENSIBILITE, prochainCode } from "../../../../lib/bibliotheque-pro";
import { fixText } from "../../../../lib/text";
import familles from "../../../../data/ouvrage-families.json";

// Création d'ouvrage (maquette PRO-08.1) : l'entrepreneur décrit l'ouvrage
// (texte ou dictée), Koji propose famille, unité, temps, sensibilités,
// fournitures et liaisons. Rien n'est enregistré ici ; chaque champ reste à
// valider. Koji ne donne jamais de prix : le taux vient de Mes prix.
const NIVEAUX = NIVEAUX_SENSIBILITE.map((x) => x.id);
const OUTIL = {
  name: "fiche_ouvrage",
  description: "Fiche d'un ouvrage de main-d'œuvre pour la bibliothèque de l'entreprise.",
  input_schema: {
    type: "object",
    properties: {
      designation: { type: "string", description: "Libellé commençant par un verbe d'action (« Poser un receveur de douche extra-plat, raccordé à l'évacuation existante »)." },
      famille: { type: "string", enum: familles.map((f) => f.code), description: "Code de la famille." },
      unite: { type: "string", enum: ["u", "m²", "ml", "m³", "forfait", "h", "kg"] },
      temps_base_h: { type: "number", description: "Heures de main-d'œuvre par unité, conditions de référence (estimation prudente)." },
      temps_fixe_h: { type: "number", description: "Heures fixes par intervention (installation, réglages), 0 si aucune." },
      sensibilites: {
        type: "object",
        properties: Object.fromEntries(["ACC", "EXI", "HSP", "OCC", "SUP", "STO", "HOR"].map((k) => [k, { type: "string", enum: NIVEAUX }])),
        description: "Sensibilité aux facteurs : ACC accès, EXI exiguïté, HSP hauteur sous plafond, OCC logement occupé, SUP support ancien, STO stockage, HOR horaires."
      },
      fournitures: {
        type: "array",
        items: { type: "object", properties: { nom: { type: "string" }, quantite_par_unite: { type: "number" }, unite: { type: "string" } }, required: ["nom", "quantite_par_unite"] },
        description: "Fournitures nécessaires par unité d'ouvrage (sans prix)."
      },
      declenche: { type: "array", items: { type: "string" }, description: "Codes d'ouvrages de la liste qui vont souvent avec (ne rien oublier)." },
      synonymes: { type: "array", items: { type: "string" } },
      questions: { type: "array", items: { type: "string" }, description: "1 à 2 questions à poser au client pour chiffrer juste." }
    },
    required: ["designation", "famille", "unite", "temps_base_h"]
  }
};

const sansAccents = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const description = fixText(String(body.description || "")).trim().slice(0, 1500);
  if (description.length < 8) return badRequest("Décrivez l'ouvrage en une phrase.");
  if (!process.env.ANTHROPIC_API_KEY) return badRequest("Koji n'est pas disponible pour le moment : remplissez la fiche à la main.", 503);

  const db = await readDb();
  const [ouvrages, catalogue] = await Promise.all([
    mergedOuvragesAsync(db, entreprise.userId),
    chargerCatalogue(entreprise, db).catch(() => ({ articles: [] }))
  ]);
  const liste = ouvrages.slice(0, 900).map((o) => `${o.code} | ${o.label} | ${o.unit}`).join("\n");

  let fiche;
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1500,
      thinking: { type: "disabled" },
      system: "Tu es Koji, assistant d'une entreprise de rénovation. Tu remplis la fiche d'un ouvrage de main-d'œuvre à partir de la description de l'entrepreneur. Temps en heures, estimés prudemment ; jamais de prix. Familles : " + familles.map((f) => `${f.code} ${f.name}`).join(" ; "),
      tools: [OUTIL],
      tool_choice: { type: "tool", name: OUTIL.name },
      messages: [{ role: "user", content: `Description : « ${description} »\n\nOuvrages déjà dans la bibliothèque (code | libellé | unité), pour « déclenche » :\n${liste}` }]
    });
    fiche = response.content.find((b) => b.type === "tool_use")?.input || null;
  } catch (error) {
    return badRequest(error?.status === 429 ? "Koji est très demandé, réessayez dans un instant." : "Koji n'a pas pu remplir la fiche. Remplissez-la à la main.", 502);
  }
  if (!fiche?.designation) return badRequest("Koji n'a pas pu remplir la fiche.", 502);

  const famille = familles.find((f) => f.code === fiche.famille) || null;
  const codes = ouvrages.map((o) => o.code);
  const parCode = new Map(ouvrages.map((o) => [String(o.code).toUpperCase(), o]));
  const valeur = (id) => NIVEAUX_SENSIBILITE.find((x) => x.id === id)?.valeur ?? 0;
  // Fournitures : rapprochées des articles du catalogue de l'entreprise.
  const articles = catalogue.articles || [];
  const fournitures = (Array.isArray(fiche.fournitures) ? fiche.fournitures : []).slice(0, 8).map((f) => {
    const mots = sansAccents(f.nom).split(/\W+/).filter((m) => m.length > 3);
    const article = articles.find((a) => mots.length && mots.filter((m) => sansAccents(a.name).includes(m)).length >= Math.min(2, mots.length));
    return { nom: fixText(String(f.nom || "")).trim(), conso: Math.max(0, Number(f.quantite_par_unite) || 0), unite: fixText(String(f.unite || "")).trim(), articleId: article?.id || "", articleNom: article?.name || "" };
  }).filter((f) => f.nom);

  return ok({
    proposition: {
      label: fixText(fiche.designation).trim(),
      familyCode: famille?.code || "",
      family: famille?.name || "",
      defaultLot: famille?.defaultLot || "",
      code: prochainCode(famille?.code || "PERSO", codes),
      unit: fiche.unite,
      normativeTime: Math.max(0, Math.round((Number(fiche.temps_base_h) || 0) * 100) / 100),
      fixedTime: Math.max(0, Math.round((Number(fiche.temps_fixe_h) || 0) * 100) / 100),
      sensitivities: Object.fromEntries(["ACC", "STO", "EXI", "OCC", "SUP", "HSP", "HOR"].map((k) => [k, valeur(fiche.sensibilites?.[k])])),
      confidence: "C",
      fournitures,
      triggers: (Array.isArray(fiche.declenche) ? fiche.declenche : []).map((c) => String(c).toUpperCase()).filter((c) => parCode.has(c)).slice(0, 6),
      synonyms: (Array.isArray(fiche.synonymes) ? fiche.synonymes : []).map((x) => fixText(String(x)).trim()).filter(Boolean).slice(0, 8),
      questions: (Array.isArray(fiche.questions) ? fiche.questions : []).map((x) => fixText(String(x)).trim()).filter(Boolean).slice(0, 3)
    }
  });
}
