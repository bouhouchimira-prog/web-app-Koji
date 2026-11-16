// Contrat de sous-traitance (maquette PRO-14.1) : Koji prépare les
// conditions (parties, lot, prix avec autoliquidation, délais, paiement,
// assurances), présente le sous-traitant au client pour acceptation (loi
// n° 75-1334 du 31 déc. 1975, art. 3) et rappelle la garantie de paiement
// (art. 14). Aucune clause juridique n'est rédigée par Koji : le modèle est
// à faire valider par un avocat. Règles pures, testées dans
// tests/unit/sous-traitance.test.js.

const jour = (v) => String(v || "").slice(0, 10);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function dateCourte(j) {
  const d = jour(j);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return `${Number(d.slice(8, 10))} ${MOIS[Number(d.slice(5, 7)) - 1]}`;
}
export function periode(debut, fin) {
  if (!debut) return "dates à convenir";
  if (!fin || fin === debut) return `le ${dateCourte(debut)}`;
  const memeMois = debut.slice(0, 7) === fin.slice(0, 7);
  return `du ${memeMois ? Number(debut.slice(8, 10)) : dateCourte(debut)} au ${dateCourte(fin)}`;
}
const euros = (n) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0).replace(/ /g, " ");

export const GARANTIES = { delegation: "Délégation de paiement par le client", caution: "Caution bancaire" };
export const PAIEMENT_DEFAUT = "30 jours, après situation acceptée";

// Étapes : préparé → envoyé au sous-traitant → présenté au client → accepté.
export function etatContrat(c = {}) {
  if (c.refuseLe) return { cle: "refuse", label: "Refusé par le client" };
  if (c.accepteLe) return { cle: "accepte", label: "Accepté par le client" };
  if (c.presenteLe) return { cle: "presente", label: "Présenté au client · accord en attente" };
  if (c.envoyeLe) return { cle: "envoye", label: "Envoyé au sous-traitant" };
  return { cle: "prepare", label: "Préparé" };
}

// Relance du client deux jours après la présentation.
export function relanceClient(c = {}) {
  if (!c.presenteLe || c.accepteLe || c.refuseLe) return "";
  const base = jour(c.relanceLe || c.presenteLe);
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

// Ce que le contrat reprend, ligne par ligne (écran et PDF).
export function lignesContrat(c = {}) {
  return [
    ["Entreprise principale", c.entreprise || ""],
    ["Sous-traitant", [c.sousTraitant, c.documentsAJour ? "documents de vigilance à jour" : "documents de vigilance à demander"].filter(Boolean).join(" · ")],
    ["Travaux", [c.lot, c.chantier].filter(Boolean).join(", ")],
    ["Prix", c.prixHt > 0 ? `${euros(c.prixHt)} € HT${c.autoliquidation !== false ? " · autoliquidation de la TVA" : ""}` : "à fixer"],
    ["Délais", periode(c.debut, c.fin)],
    ["Paiement", c.paiement || PAIEMENT_DEFAUT],
    ["Assurances", "décennale et RC du sous-traitant jointes"]
  ];
}

// Ce qui manque avant de présenter au client.
export function manquesContrat(c = {}) {
  const m = [];
  if (!(Number(c.prixHt) > 0)) m.push("le prix");
  if (!c.debut) m.push("les dates");
  if (!c.lot) m.push("le lot");
  return m;
}

// Message présenté au client (Koji Client et e-mail).
export function messageClient(c = {}) {
  const prix = c.prixHt > 0 ? ` (${euros(c.prixHt).replace(/,00$/, "")} € HT)` : "";
  return `${c.entreprise || "Votre entreprise"} vous présente ${c.sousTraitant || "un sous-traitant"} pour le ${String(c.lot || "lot").replace(/^lot\s+/i, "lot ")}${prix}, ${periode(c.debut, c.fin)}.`.replace(/\.\.$/, ".");
}
