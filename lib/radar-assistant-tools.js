import { mergedOuvrages } from "./ouvrages";
import { readDb, writeDb } from "./db";
import { updateDraftData, finishDraft } from "./radar-offer-draft";
import { fixText } from "./text";
import { setAssistantInstruction } from "./ai-assistant-instructions";
import { topCatalogMatches } from "./catalog-match";

// Outils exposes a Claude pour le nouveau chat Radar des Chantiers (9-10
// oct, refonte 100% IA avec tool use — voir app/api/radar-chat/route.js).
// enregistrer_info prend UN champ a la fois (nom exact demande par Amira,
// 10 oct) — l'IA l'appelle plusieurs fois dans le meme tour si plusieurs
// infos sont apprises a la fois, jamais un gros objet fourre-tout. Jamais
// de champ hors de la liste deja cartographiee avec Amira (whitelist cote
// serveur, voir DRAFT_FIELDS dans lib/radar-offer-draft.js).
export const RADAR_TOOLS = [
  {
    name: "enregistrer_info",
    description: "Enregistre UNE information déjà obtenue du client sur son projet. Appelle cet outil (autant de fois que nécessaire, un appel par champ) dès qu'une information utile est donnée dans le message du client — jamais en fin de conversation seulement. N'appelle JAMAIS cet outil pour un champ déjà connu (relis l'état actuel fourni dans le contexte).",
    input_schema: {
      type: "object",
      properties: {
        champ: {
          type: "string",
          description: "Le nom exact du champ à enregistrer.",
          enum: [
            "intro", "metier", "cadragePrecisions", "rooms",
            "adresse", "cotes", "disposition", "etage", "ascenseur", "acces", "stationnement", "logementOccupe",
            "fournitures", "nettoyage", "etat",
            "complements", "equipements", "style", "etatGeneral", "travauxDetail", "travauxPrecisions",
            "budget", "delai"
          ]
        },
        valeur: {
          description: "La valeur à enregistrer pour ce champ — texte libre pour la plupart des champs. EXCEPTION STRICTE pour \"rooms\" : toujours un tableau d'objets avec EXACTEMENT ces 3 clés, aucune autre, jamais renommées : {\"label\": nom de la pièce (ex: \"Chambre de la fille\"), \"summary\": résumé en une phrase des travaux pour cette pièce, \"metiers\": tableau de corps de métier concernés (ex: [\"Peinture\", \"Revêtement de sol\"])}. EXCEPTION STRICTE pour \"complements\" : toujours un tableau d'objets avec EXACTEMENT ces 2 clés : {\"item\": l'élément concerné, \"precision\": le détail donné}."
        }
      },
      required: ["champ", "valeur"]
    }
  },
  {
    name: "demander_photo",
    description: "Demande explicitement au client d'envoyer une photo sur un sujet précis (ex: l'état du mur, la fuite, la pièce à rénover). Utilise-la quand une photo aiderait vraiment à cadrer le projet — jamais systématiquement. N'écris pas la demande dans ton texte, utilise cet outil, l'interface l'affiche.",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Ce que la photo doit montrer, en quelques mots (ex: \"l'état actuel du mur\", \"la zone de la fuite\")." }
      },
      required: ["sujet"]
    }
  },
  {
    name: "consulter_bibliotheque_prix",
    description: "Cherche dans la bibliothèque interne de prestations pour savoir si une tâche est déjà référencée, et si une quantité précise (nombre, surface...) vaut la peine d'être demandée. Ne renvoie JAMAIS un prix à annoncer au client — uniquement une liste de prestations de référence pour t'aider à poser la bonne question.",
    input_schema: {
      type: "object",
      properties: {
        motsCles: { type: "string", description: "Mots-clés de la prestation recherchée, ex: \"pose carrelage sol\"." }
      },
      required: ["motsCles"]
    }
  },
  {
    name: "terminer_collecte",
    description: "À appeler UNIQUEMENT quand toutes les informations nécessaires ont été obtenues (y compris l'adresse, demandée en dernier) et confirmées par le client. Termine la collecte et déclenche la redirection vers le récapitulatif — n'appelle jamais cet outil avec des informations manquantes ou douteuses.",
    input_schema: { type: "object", properties: {} }
  },
  {
    name: "proposer_choix",
    description: "Affiche une question à choix au client sous forme de liste cochable — OBLIGATOIRE dès que la question se prête à un choix parmi plusieurs options plausibles (métier, pièce, type de travaux, oui/non...). N'écris JAMAIS les options toi-même dans ton texte : appelle cet outil, l'interface les affiche. Une seule idée par option, jamais \"A, B et C\" regroupés sur une ligne. Une seule question à la fois (un seul sujet).",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "La question posée, courte et concrète." },
        options: { type: "array", items: { type: "string" }, description: "2 à 6 options courtes, une seule idée chacune." },
        multiple: { type: "boolean", description: "true si le client peut cocher plusieurs options à la fois, false pour un choix unique (validation immédiate au clic)." },
        allowUnknown: { type: "boolean", description: "true pour ajouter une option \"Je ne sais pas\" en fin de liste (exclusive, décoche les autres) — à mettre à false seulement si la question ne s'y prête vraiment pas." },
        allowOther: { type: "boolean", description: "true pour ajouter une option \"Autre, précisez\" en fin de liste, qui ouvre un champ de texte libre." }
      },
      required: ["question", "options", "multiple"]
    }
  }
];

async function searchPriceLibrary(motsCles) {
  const db = await readDb();
  const catalog = mergedOuvrages(db);
  // Recherche par mots-cles (lib/catalog-match.js, 23 oct) a la place d'une
  // sous-chaine exacte — meme correction que resolveOuvrageForLabel cote
  // devis (lib/koji-assistant-tools.js), pour la meme raison : une sous-
  // chaine exacte ne trouvait presque jamais rien sur une phrase libre.
  // Synonymes (24 oct, bibliotheque v0) — meme principe que
  // lib/koji-assistant-tools.js::resolveOuvrageForLabel.
  const matches = topCatalogMatches(catalog, motsCles, (o) => [o.label, ...(o.synonyms || [])].filter(Boolean).join(" "), 8)
    .map((o) => ({ label: o.label, unite: o.unit, tempsNormatifHeures: o.normativeTime }));
  return matches;
}

// Execute un outil appele par Claude et renvoie le contenu du tool_result a
// renvoyer dans le tour suivant. `draftId` est deja connu du serveur (jamais
// fourni par l'IA elle-meme, pour ne pas lui laisser la possibilite
// d'ecrire sur le brouillon de quelqu'un d'autre).
export async function executeRadarTool(toolName, toolInput, { draftId, db }) {
  // Reserve aux comptes admin — l'outil n'est meme pas dans la liste
  // proposee a Claude pour un compte non-admin (voir app/api/radar-chat/
  // route.js), revalide quand meme ici par principe.
  if (toolName === "definir_consigne_permanente") {
    const consigne = fixText(toolInput?.consigne || "").trim();
    if (!consigne || !db) return { content: JSON.stringify({ ok: false, error: "Consigne vide." }), finished: false };
    setAssistantInstruction(db, "radar", consigne);
    await writeDb(db);
    return { content: JSON.stringify({ ok: true }), finished: false };
  }
  if (toolName === "enregistrer_info") {
    const champ = toolInput?.champ;
    if (!champ) return { content: JSON.stringify({ ok: false, error: "Champ manquant." }), finished: false };
    const updated = await updateDraftData(draftId, { [champ]: toolInput.valeur });
    return { content: JSON.stringify({ ok: true, data: updated.data }), finished: false };
  }
  if (toolName === "consulter_bibliotheque_prix") {
    const matches = await searchPriceLibrary(toolInput?.motsCles);
    return { content: JSON.stringify({ matches }), finished: false };
  }
  if (toolName === "terminer_collecte") {
    const updated = await finishDraft(draftId);
    return { content: JSON.stringify({ ok: true, status: updated.status }), finished: true };
  }
  if (toolName === "proposer_choix" || toolName === "demander_photo") {
    // Rien a ecrire en base — directives d'affichage, relayees au client
    // par app/api/radar-chat/route.js (evenements SSE "choice"/"photo-
    // request"), pas executees ici comme les autres outils.
    return { content: JSON.stringify({ ok: true }), finished: false };
  }
  return { content: JSON.stringify({ ok: false, error: "Outil inconnu." }), finished: false };
}
