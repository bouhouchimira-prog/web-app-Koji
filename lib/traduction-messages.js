import { LANGUES } from "./compte-pro.js";

// Messages traduits (maquettes PRO-15.1 et CLI-03) : l'artisan écrit dans sa
// langue, le message part en français. Le texte d'origine et sa langue sont
// gardés au moment de la traduction, pour « traduit du portugais · voir
// l'original » chez le client ; en cas de doute, l'original fait foi.

const MAX = 3000;
const langue = (id) => LANGUES.find((l) => l.id === String(id || ""));

// L'original envoyé avec le message traduit, ou null (même texte, langue
// inconnue ou français).
export function originalDuMessage(body = {}, message = "") {
  const l = langue(body?.langueOriginale);
  if (!l || l.id === "fr") return null;
  const texte = String(body?.original || "").trim().slice(0, MAX);
  if (!texte || texte === String(message || "").trim()) return null;
  return { texte, langue: l.id };
}

// Ce que l'écran affiche : « portugais », l'original, son sens d'écriture.
export function traductionPublique(m = {}) {
  const o = m?.original;
  const l = langue(o?.langue);
  if (!l || l.id === "fr" || !String(o?.texte || "").trim()) return null;
  return { langue: l.fr, original: String(o.texte), sens: l.rtl ? "rtl" : "ltr" };
}
