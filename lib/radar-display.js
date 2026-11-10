// Affichage des offres du Radar des chantiers côté entreprise (Accueil,
// /marketplace) : les offres n'ont ni titre ni adresse exacte, on dérive un
// titre court de la description et on n'affiche que la ville.

const NOUVEAU_HEURES = 48;
const TITRE_COUPURES = [",", ".", ";", " : ", " - ", " qui ", " car ", " dans ", " pour ", " avec ", " depuis ", " et "];
const TITRE_MAX = 48;

// L'API renvoie ville + code postal (adresse masquée) : on n'affiche que la ville.
export function villeSeule(address) {
  const text = String(address || "").trim();
  const match = text.match(/\b\d{5}\s+(.+)$/);
  if (match) return match[1].trim();
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].replace(/^\d{5}\s*/, "") : text.replace(/^\d{5}\s*/, "");
}

export function titreCourt(description) {
  // Virgule décimale (« 5,8 m² ») masquée le temps du découpage.
  let text = String(description || "").replace(/\s+/g, " ").trim().replace(/(\d),(\d)/g, "$1\u0001$2");
  if (!text) return "Chantier";
  for (const sep of TITRE_COUPURES) {
    const index = text.indexOf(sep);
    if (index >= 15) text = text.slice(0, index);
  }
  if (text.length > TITRE_MAX) {
    const cut = text.slice(0, TITRE_MAX);
    text = `${cut.slice(0, cut.lastIndexOf(" ")) || cut}…`;
  }
  text = text.replace(/\u0001/g, ",");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function estNouveau(createdAt) {
  const time = new Date(createdAt || 0).getTime();
  return Number.isFinite(time) && Date.now() - time < NOUVEAU_HEURES * 3600 * 1000;
}

export function publication(createdAt) {
  if (!createdAt) return "";
  const time = new Date(createdAt).getTime();
  if (!Number.isFinite(time)) return "";
  const heures = Math.floor((Date.now() - time) / 3600000);
  if (heures < 1) return "publié à l'instant";
  if (heures < 24) return `publié il y a ${heures} h`;
  return `publié le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(time))}`;
}

// Prix recommandé (lib/prix-recommande.js) : montant TTC arrondi, ou rien
// quand aucun poste n'a pu être chiffré avec la bibliothèque de l'entreprise.
const EURO = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function prixCourt(prix) {
  return prix?.ttc ? EURO.format(prix.ttc) : "À chiffrer";
}

// Phrase sous le prix : ce qui a servi au calcul et ce qui manque.
export function notePrix(prix) {
  if (!prix || !prix.postes) return "";
  const n = Number(prix.manquants || 0);
  if (n && prix.tauxManquant) return "Renseignez votre taux de main-d'œuvre (Bibliothèque › Mes prix) : sans lui, Koji ne chiffre pas les ouvrages au temps.";
  if (!prix.ttc) return "Aucun poste de ce chantier n'a de prix dans votre bibliothèque : Koji n'invente pas de montant.";
  if (n) return `${n} poste${n > 1 ? "s" : ""} sur ${prix.postes} sans prix dans votre bibliothèque : ${n > 1 ? "ils ne sont pas comptés" : "il n'est pas compté"}.`;
  return `Calculé avec vos prix sur ${prix.postes} poste${prix.postes > 1 ? "s" : ""}, TTC arrondi à la centaine.`;
}

// Prix calculé sur une partie des postes seulement.
export function prixPartiel(prix) {
  return Boolean(prix?.ttc && prix.manquants);
}

// Tri « Prix recommandé, du plus haut » : les chantiers sans prix en dernier.
export function comparerPrix(a, b) {
  return Number(b.prixRecommande?.ttc || 0) - Number(a.prixRecommande?.ttc || 0);
}
