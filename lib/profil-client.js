import { villeCourte } from "./projets-client.js";

// Koji Client · profil (maquette CLI-03). Règles pures, sans module serveur :
// coordonnées masquées dans la liste, ligne « Mon logement ».

const chiffres = (texte) => String(texte || "").replace(/\D/g, "");

// « 06 •• •• 41 18 » ; un numéro +33 est écrit à la française.
export function telephoneMasque(tel) {
  let c = chiffres(tel);
  if (c.startsWith("33") && c.length === 11) c = `0${c.slice(2)}`;
  if (c.length < 6) return "";
  return `${c.slice(0, 2)} •• •• ${c.slice(-4, -2)} ${c.slice(-2)}`;
}

// « s••••@••••.fr »
export function adresseMasquee(email) {
  const [nom, domaine = ""] = String(email || "").trim().toLowerCase().split("@");
  if (!nom || !domaine) return "";
  const fin = domaine.includes(".") ? domaine.slice(domaine.lastIndexOf(".")) : "";
  return `${nom[0]}••••@••••${fin}`;
}

export function ligneCoordonnees(user = {}) {
  return [telephoneMasque(user.personal?.phone), adresseMasquee(user.email)].filter(Boolean).join(" · ") || "à compléter";
}

// Ancienneté déclarée par le client (taux de TVA réduit à partir de 2 ans).
export function ancienneteLogement(logement = {}) {
  if (logement?.plusDeDeuxAns === true) return "plus de 2 ans";
  if (logement?.plusDeDeuxAns === false) return "moins de 2 ans";
  return "";
}

// « 12 rue des Vinaigriers, Paris 10e · plus de 2 ans »
export function ligneLogement(user = {}) {
  const p = user.personal || {};
  const lieu = [String(p.address || "").trim(), villeCourte(p.city, p.postalCode)].filter(Boolean).join(", ");
  const age = ancienneteLogement(user.logement);
  return [lieu, age].filter(Boolean).join(" · ") || "adresse et ancienneté à préciser";
}

export function nomAffiche(user = {}) {
  const p = user.personal || {};
  return [p.firstName, p.lastName].map((x) => String(x || "").trim()).filter(Boolean).join(" ") || String(user.name || "").trim();
}
