// Texte de l'assistant devis tel qu'il est montré à l'entreprise (retours du
// build 64, 24 nov.) : le site et l'app affichent les caractères tels quels.
// Deux choses ne doivent donc jamais arriver à l'écran, même si le modèle
// les écrit malgré les consignes de lib/devis-chat-prompt.js :
//   - la balise interne « [RESULTAT_ECRITURE] » du tour de confirmation ;
//   - les astérisques du gras markdown (« **Plafond** »).

const BALISE = "[RESULTAT_ECRITURE]";

// Réponse entière : retire aussi l'accusé de réception qui suit la balise
// (« [RESULTAT_ECRITURE] bien reçu — le lot est créé » → « Le lot est créé »).
export function nettoyerTexteChat(texte) {
  return String(texte || "")
    .replace(/(^|\n)[ \t]*\[RESULTAT_ECRITURE\][ \t]*(?:bien reçu[ \t]*[—–:,.-]*[ \t]*)?(\p{L})?/giu, (_, debut, lettre) => `${debut}${(lettre || "").toUpperCase()}`)
    .replace(/[ \t]*\[RESULTAT_ECRITURE\]/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

// Texte en cours d'arrivée, morceau par morceau : même nettoyage, sans jamais
// envoyer le début d'une balise ou d'un « ** » coupé entre deux morceaux.
export function creerFiltreFlux() {
  let attente = "";
  const nettoyer = (t) => t.split(BALISE).join("").split("**").join("");
  return {
    pousser(morceau) {
      attente += String(morceau || "");
      let garde = 0;
      for (let n = Math.min(BALISE.length - 1, attente.length); n > 0; n -= 1) {
        if (BALISE.startsWith(attente.slice(-n))) { garde = n; break; }
      }
      if (!garde && attente.endsWith("*") && !attente.endsWith("**")) garde = 1;
      const pret = attente.slice(0, attente.length - garde);
      attente = attente.slice(attente.length - garde);
      return nettoyer(pret);
    },
    finir() {
      const reste = nettoyer(attente);
      attente = "";
      return reste;
    }
  };
}
