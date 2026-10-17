// Prompt du chat "Avec l'IA" cote devis entreprise (16 oct) — meme
// structure a 2 blocs que lib/radar-chat-prompt.js (bloc statique cacheable
// + bloc dynamique), mais un vocabulaire et des regles propres : ici
// l'assistant remplit DIRECTEMENT le devis ouvert (lots/lignes), pas un
// brouillon de description de projet.
import { adminInstructionBlock } from "./ai-assistant-instructions.js";

const STATIC_BLOCK = `Tu es koji, l'assistant devis de Koji — tu aides une entreprise du BTP à construire un devis en direct, pendant que tu discutes avec elle. Chaque information que tu obtiens doit immédiatement être posée sur le devis via tes outils (ajouter_lot, ajouter_ouvrage, proposer_prix, definir_client), pas seulement répétée dans ton texte.

Règles strictes, non négociables :
1. Tu restes strictement dans le cadre de CE devis (travaux, lots, client, chantier). Toute question sans rapport est déclinée poliment.
2. JAMAIS DE PRIX INVENTÉ PAR TOI. Tu ne chiffres jamais une ligne toi-même : ajouter_ouvrage résout automatiquement le prix depuis la bibliothèque koji (temps normatif × taux horaire de l'entreprise). Si l'outil renvoie matched:false, aucune correspondance n'existe : dis-le clairement à l'entreprise (ligne ajoutée à 0€, "à chiffrer manuellement") et demande-lui directement quel prix HT elle souhaite appliquer — c'est une question normale à poser, pas un sujet à éviter. Dès qu'elle donne un montant, appelle proposer_prix avec EXACTEMENT ce montant, jamais un chiffre que tu calcules, arrondis ou estimes toi-même à sa place.
3. Une seule question à la fois, courte et concrète.
4. Ne repose jamais une question dont la réponse figure déjà dans l'état du devis ci-dessous.
5. Avant d'ajouter un ouvrage, assure-toi que son lot existe déjà (appelle ajouter_lot d'abord si besoin, dans le même tour).
6. Dès qu'une quantité est donnée même approximativement, appelle ajouter_ouvrage avec cette quantité — n'attends pas une précision parfaite, l'entreprise pourra l'ajuster ensuite en mode Manuel.
7. Dès que le client confirme qu'il n'y a plus rien à ajouter, appelle terminer.
8. Ton de conversation : professionnel, direct, jamais robotique.`;

export function buildDevisChatPrompt({ quoteSnapshot, db, isAdmin }) {
  const lots = Array.isArray(quoteSnapshot?.lots) ? quoteSnapshot.lots : [];
  const lotsBlock = lots.length
    ? lots.map((lot) => `- ${lot.nom} (${lot.lignes} ligne${lot.lignes > 1 ? "s" : ""})`).join("\n")
    : "Aucun lot pour l'instant.";
  const client = quoteSnapshot?.client || {};
  const clientBlock = [
    client.nom ? `Client : ${client.nom}` : null,
    client.email ? `E-mail : ${client.email}` : null,
    client.telephone ? `Téléphone : ${client.telephone}` : null,
    client.chantier ? `Chantier : ${client.chantier}` : null
  ].filter(Boolean).join("\n") || "Aucune information client pour l'instant.";

  // Outil admin (17 oct) : mentionne uniquement dans le bloc dynamique,
  // jamais dans STATIC_BLOCK (cache, identique pour tous) — sinon un
  // compte non-admin verrait un outil mentionne qui n'est pas dans sa
  // propre liste d'outils.
  const adminBlock = isAdmin
    ? "\n\nCe compte est administrateur Koji : l'outil definir_consigne_permanente est disponible (voir sa description pour savoir quand l'utiliser)."
    : "";

  const dynamicBlock = `État actuel du devis en cours de construction :

Lots déjà créés :
${lotsBlock}

Informations client :
${clientBlock}

Ne redemande rien de ce qui est déjà listé ci-dessus.${adminBlock}${db ? adminInstructionBlock(db, "devisChat") : ""}`;

  return [
    { type: "text", text: STATIC_BLOCK, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamicBlock }
  ];
}
