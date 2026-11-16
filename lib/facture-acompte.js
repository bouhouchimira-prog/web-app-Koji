// Facture d'acompte (maquette PRO-03.4) : depuis le devis signé, seul le
// pourcentage se choisit ; la facture reprend le devis (client, montants,
// TVA). Mêmes règles dans l'app Koji Pro (mobile/lib/apps/entreprise/devis/
// facture_acompte.dart, mêmes exemples dans les tests).

export const POURCENTAGES_ACOMPTE = [20, 30, 40, 50];

export const ECHEANCES_ACOMPTE = [
  { id: "reception", libelle: "À réception · avant le démarrage", jours: 0 },
  { id: "8", libelle: "À 8 jours", jours: 8 },
  { id: "15", libelle: "À 15 jours", jours: 15 },
  { id: "30", libelle: "À 30 jours", jours: 30 }
];

const JOUR = 86400000;
const arrondi = (n) => Math.round((Number(n) || 0) * 100) / 100;

function long(jour) {
  const d = new Date(`${String(jour || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" }).format(d) : "";
}

// Montant TTC de l'acompte : pourcentage × TTC du devis.
export function montantAcompte(totalTtc, pourcentage) {
  return arrondi((Number(totalTtc) || 0) * (Number(pourcentage) || 0) / 100);
}

// TVA comprise dans un montant TTC (« dont TVA 10 % 158,14 € »).
export function tvaIncluse(montantTtc, taux) {
  const t = Number(taux) || 0;
  return arrondi((Number(montantTtc) || 0) * t / (100 + t));
}

export function dateEcheance(aujourdhui, jours) {
  const d = new Date(`${String(aujourdhui).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() + (Number(jours) || 0) * JOUR).toISOString().slice(0, 10) : "";
}

// Message proposé au client, modifiable.
export function messageAcompte({ client = "", pourcentage = 30, debut = "" } = {}) {
  const pct = String(Number(pourcentage) || 0).replace(".", ",");
  const demarrage = debut && long(debut) ? `le démarrage le ${long(debut)}` : "le démarrage du chantier";
  return `Bonjour${client ? ` ${client}` : ""}, merci pour votre signature. Voici la facture d'acompte de ${pct} % prévue au devis. Son règlement confirme ${demarrage}.`;
}

// Ce qui empêche de créer ou d'envoyer la facture, ou "".
export function erreurAcompte({ pourcentage, montant, restant, envoyer = false, email = false, adresse = "" }) {
  const p = Number(pourcentage) || 0;
  if (p <= 0 || p > 100) return "Choisis un pourcentage entre 1 et 100.";
  if (restant != null && Number(montant) > Number(restant) + 0.01) return "Le montant dépasse ce qui reste à facturer sur ce devis.";
  if (envoyer && email && !String(adresse || "").trim()) return "Ajoute l'e-mail du client pour lui envoyer la facture.";
  return "";
}
