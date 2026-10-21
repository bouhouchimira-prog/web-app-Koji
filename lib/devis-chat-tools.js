import { resolveOuvrageForLabel } from "./koji-assistant-tools.js";
import { fixText } from "./text.js";
import { setAssistantInstruction } from "./ai-assistant-instructions.js";
import { writeDb } from "./db.js";

// Outils du chat "Avec l'IA" cote devis entreprise (16 oct, etendu le 21
// oct avec modifier_ouvrage/supprimer_ouvrage) — vocabulaire ferme :
// ajouter_lot/ajouter_ouvrage/modifier_ouvrage/supprimer_ouvrage/
// proposer_prix/definir_client/terminer. ajouter_ouvrage passe TOUJOURS par
// resolveOuvrageForLabel (lib/koji-assistant-tools.js), la meme resolution
// catalogue-only utilisee par l'assistant global et par /api/devis-ia —
// jamais une reimplementation, jamais un prix invente : soit un ouvrage reel
// de la bibliotheque koji (temps normatif x taux horaire de l'entreprise),
// soit "a chiffrer manuellement" a 0€. modifier_ouvrage ne resout jamais de
// prix lui-meme non plus : il ne fait que transmettre une quantite/un prix
// unitaire que l'entreprise vient de donner EXPLICITEMENT, pour une ligne
// deja existante (identifiee par id, visible dans l'etat du devis fourni
// dans le prompt — voir lib/devis-chat-prompt.js).
export const DEVIS_CHAT_TOOLS = [
  {
    name: "ajouter_lot",
    description: "Ajoute un nouveau lot (pièce/zone du chantier) au devis, ex: \"Cuisine\", \"Salle de bain\". N'appelle jamais cet outil si le lot existe déjà (voir l'état du devis fourni dans le contexte).",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Nom du lot, ex: \"Cuisine\"." }
      },
      required: ["nom"]
    }
  },
  {
    name: "ajouter_ouvrage",
    description: "Ajoute une ligne de travaux (ouvrage) à un lot du devis, à partir d'une désignation en langage courant (ex: \"pose de carrelage au sol\"). Le prix n'est JAMAIS inventé : il vient de la bibliothèque koji (temps normatif × taux horaire de l'entreprise) si l'ouvrage y est référencé. Si le résultat indique matched:false, la ligne est ajoutée à 0€ \"à chiffrer manuellement\" — demande ALORS à l'entreprise (pas au client) le prix HT qu'elle souhaite appliquer, et dès qu'elle le donne, appelle proposer_prix pour l'enregistrer tel quel sur cette ligne.",
    input_schema: {
      type: "object",
      properties: {
        designation: { type: "string", description: "Désignation de l'ouvrage en langage courant, ex: \"pose de carrelage 60x60\"." },
        quantite: { type: "number", description: "Quantité, dans l'unité de l'ouvrage (m², ml, unité...)." },
        unite: { type: "string", description: "Unité si connue (m², ml, u...) — sinon celle de l'ouvrage trouvé dans la bibliothèque est utilisée." },
        lot: { type: "string", description: "Nom du lot auquel rattacher cette ligne — doit déjà exister (appelle ajouter_lot avant si besoin)." }
      },
      required: ["designation", "quantite", "lot"]
    }
  },
  {
    name: "modifier_ouvrage",
    description: "Corrige une ligne DÉJÀ PRÉSENTE sur le devis (quantité et/ou prix unitaire HT) — à utiliser dès que l'entreprise corrige quelque chose qu'elle vient de dire différemment, ou te signale une erreur sur une ligne existante. N'appelle JAMAIS ajouter_ouvrage pour une correction : cela créerait une ligne en double. Identifie la ligne par son id, visible dans l'état du devis fourni dans le contexte (jamais par sa seule désignation, qui peut être ambiguë). Si l'entreprise donne un prix, transmets-le EXACTEMENT tel quel (jamais un calcul ou une estimation de ta part) : si elle dit un prix par unité (ex. \"15€ le m²\"), utilise prixUnitaireHt ; elle ne te donne un prix total que si elle le dit explicitement (\"150€ en tout\"), auquel cas calcule prixUnitaireHt = total ÷ quantité (la quantité déjà connue ou celle qu'elle vient de donner dans le même message).",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant de la ligne à corriger, tel que fourni dans l'état du devis." },
        quantite: { type: "number", description: "Nouvelle quantité, si elle change." },
        prixUnitaireHt: { type: "number", description: "Nouveau prix unitaire HT (par unité, pas le total), si l'entreprise en donne un." }
      },
      required: ["id"]
    }
  },
  {
    name: "supprimer_ouvrage",
    description: "Retire une ligne déjà présente sur le devis — à utiliser quand l'entreprise demande de retirer un ouvrage, ou pour corriger un doublon créé par erreur. Identifie la ligne par son id, visible dans l'état du devis fourni dans le contexte.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Identifiant de la ligne à retirer." }
      },
      required: ["id"]
    }
  },
  {
    name: "proposer_prix",
    description: "À appeler UNIQUEMENT quand l'entreprise vient ELLE-MÊME de donner un prix HT (en euros) pour le dernier ouvrage ajouté sans correspondance dans la bibliothèque (ligne à 0€, \"à chiffrer manuellement\"). Transmets EXACTEMENT le montant donné par l'entreprise — ne calcule, n'arrondis et n'estime JAMAIS ce prix toi-même.",
    input_schema: {
      type: "object",
      properties: {
        prixHt: { type: "number", description: "Montant HT en euros, tel que donné par l'entreprise." }
      },
      required: ["prixHt"]
    }
  },
  {
    name: "definir_client",
    description: "Renseigne les informations du client et du chantier sur ce devis (nom, téléphone, email, adresse/nom du chantier). Appelle-le dès qu'une de ces informations est donnée, même partiellement.",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Nom du client." },
        telephone: { type: "string", description: "Téléphone du client." },
        email: { type: "string", description: "E-mail du client." },
        chantier: { type: "string", description: "Description ou adresse du chantier." }
      }
    }
  },
  {
    name: "terminer",
    description: "À appeler quand le devis contient tout ce que le client a décrit et qu'il n'y a plus rien à ajouter pour l'instant. Termine la conversation et bascule en mode Manuel pour la relecture/l'ajustement.",
    input_schema: { type: "object", properties: {} }
  }
];

// Execute un outil appele par Claude. Contrairement au chat Radar (qui
// ecrit dans un brouillon jetable cote serveur), ce chat ne modifie rien en
// base lui-meme : il renvoie juste le resultat resolu (ex: l'ouvrage
// trouve/non trouve dans la bibliotheque), et c'est le CLIENT (DevisEditor,
// via l'evenement SSE "action") qui applique le changement sur le devis
// actuellement ouvert, en reutilisant les memes fonctions que les boutons
// "Ajouter" manuels.
export async function executeDevisChatTool(toolName, toolInput, ctx) {
  if (toolName === "ajouter_lot") {
    const nom = fixText(toolInput?.nom || "").trim();
    if (!nom) return { content: JSON.stringify({ ok: false, error: "Nom de lot manquant." }), action: null, finished: false };
    return { content: JSON.stringify({ ok: true, nom }), action: { subAction: "addLot", lotName: nom }, finished: false };
  }

  if (toolName === "ajouter_ouvrage") {
    const designation = fixText(toolInput?.designation || "");
    const lot = fixText(toolInput?.lot || "");
    const quantite = Number(toolInput?.quantite || 0);
    if (!designation || !lot || quantite <= 0) {
      return { content: JSON.stringify({ ok: false, error: "Désignation, quantité ou lot manquant." }), action: null, finished: false };
    }
    const resolved = await resolveOuvrageForLabel(ctx, designation, { unit: toolInput?.unite });
    return {
      content: JSON.stringify({ ok: true, matched: resolved.matched, label: resolved.label, unit: resolved.unit, hourlyRate: resolved.hourlyRate }),
      action: { subAction: "addOuvrage", ouvrage: resolved, room: lot, quantity: quantite },
      finished: false
    };
  }

  if (toolName === "modifier_ouvrage") {
    const id = fixText(toolInput?.id || "").trim();
    if (!id) return { content: JSON.stringify({ ok: false, error: "Identifiant de ligne manquant." }), action: null, finished: false };
    const quantite = toolInput?.quantite != null ? Number(toolInput.quantite) : undefined;
    const prixUnitaireHt = toolInput?.prixUnitaireHt != null ? Number(toolInput.prixUnitaireHt) : undefined;
    if (quantite === undefined && prixUnitaireHt === undefined) {
      return { content: JSON.stringify({ ok: false, error: "Rien à modifier (ni quantité ni prix fournis)." }), action: null, finished: false };
    }
    return {
      content: JSON.stringify({ ok: true, id, quantite, prixUnitaireHt }),
      action: { subAction: "updateOuvrage", id, quantite, prixUnitaireHt },
      finished: false
    };
  }

  if (toolName === "supprimer_ouvrage") {
    const id = fixText(toolInput?.id || "").trim();
    if (!id) return { content: JSON.stringify({ ok: false, error: "Identifiant de ligne manquant." }), action: null, finished: false };
    return { content: JSON.stringify({ ok: true, id }), action: { subAction: "removeOuvrage", id }, finished: false };
  }

  if (toolName === "proposer_prix") {
    const prixHt = Number(toolInput?.prixHt || 0);
    if (prixHt <= 0) return { content: JSON.stringify({ ok: false, error: "Montant manquant ou invalide." }), action: null, finished: false };
    return { content: JSON.stringify({ ok: true, prixHt }), action: { subAction: "setManualPrice", amountHt: prixHt }, finished: false };
  }

  if (toolName === "definir_client") {
    const client = {
      nom: fixText(toolInput?.nom || ""),
      telephone: fixText(toolInput?.telephone || ""),
      email: fixText(toolInput?.email || ""),
      chantier: fixText(toolInput?.chantier || "")
    };
    return { content: JSON.stringify({ ok: true }), action: { subAction: "setClientInfo", client }, finished: false };
  }

  if (toolName === "terminer") {
    return { content: JSON.stringify({ ok: true }), action: null, finished: true };
  }

  // Reserve aux comptes admin — l'outil n'est meme pas dans la liste
  // proposee a Claude pour un compte non-admin (voir app/api/devis-chat/
  // route.js), mais on revalide quand meme ici au cas ou un outil du meme
  // nom serait un jour ajoute ailleurs sans la meme verification.
  if (toolName === "definir_consigne_permanente") {
    const consigne = fixText(toolInput?.consigne || "").trim();
    if (!consigne) return { content: JSON.stringify({ ok: false, error: "Consigne vide." }), action: null, finished: false };
    setAssistantInstruction(ctx.db, "devisChat", consigne);
    await writeDb(ctx.db);
    return { content: JSON.stringify({ ok: true }), action: null, finished: false };
  }

  return { content: JSON.stringify({ ok: false, error: "Outil inconnu." }), action: null, finished: false };
}
