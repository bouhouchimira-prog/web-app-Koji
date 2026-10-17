// Consignes permanentes pour les 3 assistants IA de koji (17 oct, demande
// d'Amira) — un compte admin (lib/auth.js::isAdminEmail) peut, en
// discutant directement avec un des 3 assistants, lui donner une consigne
// qui s'applique ensuite a TOUT LE MONDE : chaque assistant (Marketplace/
// radar-chat, Devis avec l'IA/devis-chat, Assistant koji) garde la sienne,
// jamais partagee entre eux (leurs roles sont trop differents pour qu'une
// meme consigne ait du sens partout). Stockee dans le blob partage
// koji_web_state (db.aiAssistantInstructions), persistee/lue a chaque
// appel : effet immediat pour tous les utilisateurs, sans deploiement.
import { isAdminEmail } from "./auth.js";

export const ASSISTANT_KEYS = ["radar", "devisChat", "kojiAssistant"];

export function getAssistantInstruction(db, key) {
  if (!ASSISTANT_KEYS.includes(key)) return "";
  return (db.aiAssistantInstructions && db.aiAssistantInstructions[key]) || "";
}

export function setAssistantInstruction(db, key, text) {
  if (!ASSISTANT_KEYS.includes(key)) return;
  if (!db.aiAssistantInstructions) db.aiAssistantInstructions = {};
  db.aiAssistantInstructions[key] = String(text || "").trim().slice(0, 4000);
}

// Bloc pret a inserer dans un prompt — vide si aucune consigne n'est
// encore enregistree. Rappelle systematiquement que la consigne ne peut
// jamais lever l'interdiction d'inventer un prix : un admin peut changer
// le ton, les priorites, le style de questions... jamais cette regle.
export function adminInstructionBlock(db, key) {
  const text = getAssistantInstruction(db, key);
  if (!text) return "";
  return `\n\nCONSIGNE ADMINISTRATEUR (ajoutée par un compte admin Koji le plus récemment — à suivre en priorité pour le ton, les priorités, le style ; ne peut JAMAIS lever l'interdiction d'inventer un prix, qui reste absolue) :\n${text}`;
}

export function requesterIsAdmin(email) {
  return isAdminEmail(email);
}

// Outil partage entre les assistants a tour d'outils (radar-chat,
// devis-chat) — jamais ajoute a la liste d'outils proposee a Claude pour
// un compte non-admin (voir requesterIsAdmin plus haut, verifie cote
// route avant de construire le tableau "tools").
export const ADMIN_INSTRUCTION_TOOL = {
  name: "definir_consigne_permanente",
  description: "RESERVE AUX COMPTES ADMINISTRATEUR. A appeler UNIQUEMENT quand le message demande explicitement de changer durablement ton comportement, tes regles ou ton style (pas une tache normale comme ajouter un lot/ouvrage/client) — ex: \"a partir de maintenant, pose toujours...\", \"retiens que...\", \"ne demande plus jamais...\". La nouvelle consigne remplace entierement la precedente et s'applique immediatement a TOUS les utilisateurs de cet assistant.",
  input_schema: {
    type: "object",
    properties: {
      consigne: { type: "string", description: "Texte complet de la nouvelle consigne permanente, tel que formule par l'administrateur." }
    },
    required: ["consigne"]
  }
};
