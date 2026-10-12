import { mergedOuvrages } from "./ouvrages";
import { readDb } from "./db";
import { updateDraftData, finishDraft } from "./radar-offer-draft";

// Outils exposes a Claude pour le nouveau chat Radar des Chantiers (9 oct,
// refonte 100% IA avec tool use — voir app/api/radar-chat/route.js). Trois
// outils seulement, volontairement etroits : enregistrer ce qui vient d'etre
// appris (jamais de champ hors de la liste deja cartographiee avec Amira),
// consulter la bibliotheque de prix en lecture seule (pour savoir si une
// precision chiffree a un sens avant de la demander), et signaler la fin de
// la collecte. Les photos ne passent PAS par un outil : elles sont donnees a
// Claude directement comme blocs image dans le tour (vision native), il les
// commente et appelle update_offer_draft avec ce qu'il en tire, exactement
// comme pour une reponse texte.
export const RADAR_TOOLS = [
  {
    name: "update_offer_draft",
    description: "Enregistre ou met à jour une ou plusieurs informations déjà obtenues du client sur son projet. Appelle cet outil dès qu'une information utile est donnée dans le message du client — jamais en fin de conversation seulement. N'envoie QUE les champs que tu viens d'apprendre, jamais les champs déjà connus (relis l'état actuel fourni dans le contexte).",
    input_schema: {
      type: "object",
      properties: {
        intro: { type: "string", description: "Description libre du projet, telle que donnée par le client." },
        metier: { type: "string", description: "Le corps de métier principal concerné (ex: Plombier, Électricien, Peintre, Tout corps d'état...)." },
        cadragePrecisions: { type: "string", description: "Précisions sur la nature exacte des travaux (quel élément, remplacement ou réparation...), phrases courtes séparées par ' ; '." },
        rooms: {
          type: "array",
          description: "UNIQUEMENT si le projet concerne plusieurs pièces ou un logement entier — une entrée par pièce.",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "Nom de la pièce, ex: \"Chambre 1\", \"Salle de bain\"." },
              summary: { type: "string", description: "Résumé des travaux prévus pour cette pièce." },
              metiers: { type: "array", items: { type: "string" }, description: "Corps de métier concernés par cette pièce." }
            },
            required: ["label"]
          }
        },
        adresse: { type: "string", description: "Adresse complète du chantier — à demander en tout dernier, jamais avant d'avoir couvert le reste." },
        cotes: { type: "string", description: "Dimensions ou surface concernées." },
        configuration: { type: "string", description: "Configuration de la pièce (rectangulaire, en longueur, forme atypique...)." },
        disposition: { type: "string", description: "Modifier la disposition existante ou la garder telle quelle." },
        etage: { type: "string", description: "Étage du chantier." },
        ascenseur: { type: "string", description: "Présence d'un ascenseur." },
        acces: { type: "string", description: "Accès pour les artisans et le matériel." },
        stationnement: { type: "string", description: "Stationnement pour les artisans." },
        fournitures: { type: "string", description: "Fournitures déjà prévues par le client, ou à la charge de l'entreprise." },
        nettoyage: { type: "string", description: "Qui s'occupe du nettoyage de fin de chantier." },
        etat: { type: "string", description: "État actuel de la pièce ou de l'espace (meubles à sortir, déjà vide...)." },
        complements: {
          type: "array",
          description: "Ajouts ou précisions données en plus du projet initial.",
          items: {
            type: "object",
            properties: { item: { type: "string" }, precision: { type: "string" } },
            required: ["item"]
          }
        },
        equipements: { type: "string", description: "Équipements souhaités par le client (ex: douche, baignoire, double vasque...), en texte libre." },
        style: { type: "string", description: "Style ou gamme souhaités (ex: standard, design, haut de gamme)." },
        etatGeneral: { type: "string", description: "État général de l'espace (bon état / état moyen / mauvais état)." },
        travauxDetail: { type: "string", description: "Liste des travaux à réaliser, en texte libre." },
        travauxPrecisions: { type: "string", description: "Précisions chiffrées sur les travaux (quantités, surfaces...)." }
      }
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
  }
];

async function searchPriceLibrary(motsCles) {
  const db = await readDb();
  const catalog = mergedOuvrages(db);
  const needle = String(motsCles || "").toLowerCase();
  const matches = catalog
    .filter((o) => (o.label || "").toLowerCase().includes(needle) || (o.category || "").toLowerCase().includes(needle))
    .slice(0, 8)
    .map((o) => ({ label: o.label, unite: o.unit, tempsNormatifHeures: o.normativeTime }));
  return matches;
}

// Execute un outil appele par Claude et renvoie le contenu du tool_result a
// renvoyer dans le tour suivant. `draftId` est deja connu du serveur (jamais
// fourni par l'IA elle-meme, pour ne pas lui laisser la possibilite
// d'ecrire sur le brouillon de quelqu'un d'autre).
export async function executeRadarTool(toolName, toolInput, { draftId }) {
  if (toolName === "update_offer_draft") {
    const updated = await updateDraftData(draftId, toolInput || {});
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
  return { content: JSON.stringify({ ok: false, error: "Outil inconnu." }), finished: false };
}
