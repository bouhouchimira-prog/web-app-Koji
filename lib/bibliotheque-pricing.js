import { VISITE_METIERS } from "./visite-tree";

export function formatMoney(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatHours(value) {
  return Number(value || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

// Prix HT d'un ouvrage catalogue, affichage seul (le vrai calcul d'une
// ligne de devis reste app/devis/DevisEditor.jsx::recalculateLine /
// lib/pricing.js::calculateTaskPrice — cette fonction ne sert qu'a
// afficher le prix dans la bibliotheque, jamais a chiffrer un devis).
export function ouvragePriceHt(item, fallbackRate = 0) {
  if (item.billingMode === "fixed") return Number(item.fixedAmountHt || 0);
  const rate = Number(item.hourlyRate || 0) || fallbackRate;
  const labor = Math.max(0, Number(item.normativeTime || 0) * rate);
  return labor + Number(item.suppliesCost || 0);
}

// Prochain code "PERSO-N" disponible pour cette entreprise (meme principe
// que nextSubCode dans l'ancienne page bibliotheque — calcul cote client,
// best-effort, pas atomique, suffisant pour un seul artisan qui clique).
// `ouvrages` vient deja de mergedOuvrages(db, monUserId) cote serveur : tout
// item avec un userId non vide m'appartient deja, pas besoin de le refiltrer
// par id exact.
export function nextPersoCode(ouvrages) {
  const numbers = (ouvrages || [])
    .filter((item) => item.userId)
    .map((item) => /^PERSO-(\d+)$/.exec(item.code || ""))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const next = Math.max(0, ...numbers) + 1;
  return `PERSO-${String(next).padStart(2, "0")}`;
}

// Tableau de bord (15 oct, maquette fournie par Amira) — "metier couvert"
// n'est pas un champ stocke : on rapproche chaque famille d'ouvrage
// (ouvrages.family, texte libre) d'un des 10 metiers de la visite guidee
// (lib/visite-tree.js, meme taxonomie que le Radar des Chantiers) par mots-
// cles, pour savoir quels metiers ont deja une bibliotheque de prix.
export const METIER_KEYWORDS = {
  Plombier: ["plomberie", "plombier", "sanitaire"],
  Electricien: ["electricite", "electricien"],
  Carreleur: ["carrelage", "carreleur"],
  Menuisier: ["menuiserie", "menuisier"],
  Peintre: ["peinture", "peintre"],
  "Maçon": ["maconnerie", "gros oeuvre", "macon"],
  Chauffagiste: ["chauffage", "chauffagiste"],
  Climaticien: ["climatisation", "ventilation", "vmc"],
  Plaquiste: ["cloison", "plafond", "platrerie", "isolation", "plaquiste"],
  Couvreur: ["toiture", "couverture", "couvreur", "charpente", "zinguerie"]
};

export const METIER_ICONS = {
  Electricien: "⚡", Peintre: "🖌️", Carreleur: "▦", Plaquiste: "🧱",
  Menuisier: "🪚", Plombier: "🔧", "Maçon": "🧱", Chauffagiste: "🔥",
  Climaticien: "❄️", Couvreur: "🏠"
};

// Note manuelle : le catalogue "Isolation" ne couvre aujourd'hui que les
// combles, pas toute l'Isolation/Platrerie du metier Plaquiste.
export const FAMILY_SUBTITLE_OVERRIDES = { "Isolation": "Combles uniquement" };

export const METIER_SANS_OUVRAGE_DESC = {
  Plombier: "Fuite, WC, chauffe-eau, robinetterie",
  "Maçon": "Murs, dalles, fondations",
  Chauffagiste: "Chaudière, radiateurs, pompe à chaleur",
  Climaticien: "Climatisation, VMC",
  Couvreur: "Toiture, charpente, zinguerie"
};

export function stripAccents(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function matchMetier(familyName) {
  const normalized = stripAccents(familyName).toLowerCase();
  return VISITE_METIERS.find((m) => (METIER_KEYWORDS[m.key] || []).some((kw) => normalized.includes(kw))) || null;
}
