// TVA automatique (maquette PRO-03.5) : Koji choisit le taux sur trois
// questions (qui est le client, quel local, quels travaux), les déduit
// quand il les connaît et les pose sinon. Le taux reste modifiable ligne
// par ligne. Mêmes règles dans l'app Koji Pro (mobile/lib/apps/entreprise/
// devis/tva.dart, mêmes exemples dans les tests).
//
// 10 % : amélioration, transformation, aménagement, entretien de locaux
// d'habitation achevés depuis plus de 2 ans (CGI art. 279-0 bis), hors
// immeuble neuf ou surface augmentée de plus de 10 %. 5,5 % : rénovation
// énergétique (CGI art. 278-0 bis A). Autoliquidation : sous-traitance de
// travaux de construction pour une entreprise du bâtiment (CGI art. 283,
// 2 nonies). Règles à faire valider par l'expert-comptable.

export const CLIENTS_TVA = [
  { id: "particulier", label: "Particulier" },
  { id: "entreprise", label: "Entreprise" },
  { id: "sous-traitance", label: "Entreprise du bâtiment qui vous sous-traite" }
];

export const LOCAUX_TVA = [
  { id: "logement-ancien", label: "Logement de plus de 2 ans" },
  { id: "logement-neuf", label: "Logement neuf" },
  { id: "professionnel", label: "Local professionnel" }
];

export const TRAVAUX_TVA = [
  { id: "renovation", label: "Rénovation" },
  { id: "energetique", label: "Rénovation énergétique" },
  { id: "construction", label: "Construction ou agrandissement" }
];

export const MENTION_TAUX_REDUIT = "Je soussigné(e), preneur de la prestation, certifie que les travaux réalisés concernent des locaux à usage d'habitation achevés depuis plus de deux ans, qu'ils n'ont pas pour effet de produire un immeuble neuf ni d'augmenter de plus de 10 % la surface de plancher des locaux existants, et que je conserverai ce document signé.";

export const MENTION_AUTOLIQUIDATION = "Autoliquidation : TVA due par le preneur assujetti (art. 283, 2 nonies du CGI).";

const ENERGETIQUE = /isol(ation|er|ant)|calorifug|pompe [àa] chaleur|\bPAC\b|chaudi[eè]re [àa] (condensation|biomasse|bois|granul)|po[eê]le [àa] (bois|granul)|solaire|thermostat|r[ée]gulation|programmateur|double flux|double vitrage|triple vitrage|fen[eê]tres? (isolantes?|double)|menuiseries? (isolantes?|ext[ée]rieures?)|volets? isolants?|porte isolante/i;

// Le client vu du devis : la fiche contact dit particulier ou société ; la
// sous-traitance se choisit (ou vient d'un besoin du Réseau pro).
export function clientTva(devis) {
  if (devis?.tva?.client) return devis.tva.client;
  return devis?.clientType === "societe" ? "entreprise" : "particulier";
}

// Décision : taux, autoliquidation, prochaine question, ce que Koji a
// vérifié et la mention à mettre sur le document.
export function decisionTva({ client = "particulier", local = "", travaux = "" } = {}) {
  if (client === "sous-traitance") {
    return {
      taux: 0,
      autoliquidation: true,
      question: "",
      titre: "Autoliquidation",
      verifications: ["Client : entreprise du bâtiment qui vous sous-traite", "Travaux de construction pour son chantier", "Le donneur d'ordre déclare et déduit la TVA"],
      mention: MENTION_AUTOLIQUIDATION
    };
  }
  const qui = client === "entreprise" ? "Client entreprise" : "Client particulier";
  if (!local) return { taux: null, autoliquidation: false, question: "local", titre: "", verifications: [qui], mention: "" };
  if (local === "professionnel") {
    return { taux: 20, autoliquidation: false, question: "", titre: "TVA 20 %", verifications: [qui, "Local professionnel"], mention: "" };
  }
  if (local === "logement-neuf") {
    return { taux: 20, autoliquidation: false, question: "", titre: "TVA 20 %", verifications: [qui, "Logement neuf (moins de 2 ans)"], mention: "" };
  }
  const base = [qui, "Logement achevé depuis plus de 2 ans"];
  if (travaux === "construction") {
    return { taux: 20, autoliquidation: false, question: "", titre: "TVA 20 %", verifications: [...base, "Construction ou agrandissement de plus de 10 %"], mention: "" };
  }
  if (travaux === "energetique") {
    return { taux: 5.5, autoliquidation: false, question: "", titre: "TVA 5,5 %", verifications: [...base, "Rénovation énergétique"], mention: MENTION_TAUX_REDUIT };
  }
  return {
    taux: 10,
    autoliquidation: false,
    question: "",
    titre: "TVA 10 %",
    verifications: [...base, "Pas d'agrandissement de plus de 10 %", "Pas de reconstruction à neuf"],
    mention: MENTION_TAUX_REDUIT
  };
}

export function estTauxReduit(taux) {
  return Number(taux) === 10 || Number(taux) === 5.5;
}

// Ligne de rénovation énergétique dans un logement de plus de 2 ans :
// Koji propose 5,5 % sur cette ligne.
export function tauxProposeLigne(libelle, decision) {
  if (!decision || decision.autoliquidation || Number(decision.taux) !== 10) return null;
  return ENERGETIQUE.test(String(libelle || "")) ? 5.5 : null;
}

// Question de Koji dans le Devis guidé, et ses réponses en un clic.
export function questionTva(question, client) {
  if (question !== "local") return null;
  if (client === "entreprise") {
    return {
      texte: "Les travaux concernent quel local ?",
      reponses: [
        { label: "Local professionnel", valeur: "professionnel" },
        { label: "Logement de plus de 2 ans", valeur: "logement-ancien" },
        { label: "Logement neuf", valeur: "logement-neuf" }
      ]
    };
  }
  return {
    texte: "Le logement a-t-il plus de 2 ans ?",
    reponses: [
      { label: "Oui", valeur: "logement-ancien" },
      { label: "Non, il est neuf", valeur: "logement-neuf" }
    ]
  };
}

// Ce que Koji dit une fois le taux appliqué.
export function confirmationTva(decision, { client = "", nom = "" } = {}) {
  if (!decision || decision.taux == null) return "";
  if (decision.autoliquidation) return "Devis en autoliquidation, sans TVA : le donneur d'ordre la déclarera.";
  const taux = String(decision.taux).replace(".", ",");
  if (estTauxReduit(decision.taux)) {
    return `TVA à ${taux} % appliquée. ${nom || "Le client"} signera la mention en acceptant le devis.`;
  }
  if (client === "entreprise") return `C'est un local professionnel ou neuf : TVA à ${taux} %.`;
  return `TVA à ${taux} % appliquée.`;
}

const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;

// TVA par taux : chaque ligne à son taux, les majorations au taux du devis.
// Avec un seul taux, le résultat est exactement celui d'avant (même arrondi).
export function ventilerTva(lignes, majorationsHt, tauxDevis) {
  const bases = new Map();
  const principal = Number(tauxDevis) || 0;
  for (const l of Array.isArray(lignes) ? lignes : []) {
    const taux = l.taux == null || l.taux === "" ? principal : Number(l.taux);
    bases.set(taux, (bases.get(taux) || 0) + (Number(l.ht) || 0));
  }
  bases.set(principal, (bases.get(principal) || 0) + (Number(majorationsHt) || 0));
  const parTaux = [...bases.entries()]
    .filter(([, base]) => Math.abs(base) > 0.004)
    .sort((a, b) => b[0] - a[0])
    .map(([taux, base]) => ({ taux, base: arrondi(base), tva: arrondi(base * taux / 100) }));
  return { parTaux, tva: arrondi(parTaux.reduce((s, t) => s + t.tva, 0)) };
}
