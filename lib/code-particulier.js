import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// « Retrouver mon projet » (maquette CLI-05) : le particulier revient sans
// mot de passe, avec un code à 6 chiffres reçu par e-mail (pas de
// fournisseur SMS). Règles pures, testées dans tests/unit/code-particulier.
//
// Stockage : db.particulierCodes (bloc JSON koji_web_state, comme
// db.loginAttempts), un objet indexé par l'empreinte de l'adresse — jamais
// l'adresse en clair, pour ne pas garder les adresses tapées par erreur :
//   { [cleAdresse]: { userId, empreinte, sel, expireLe, essais, envois: [ms…] } }
// - empreinte : HMAC-SHA256 du code (jamais le code lui-même), salé ;
// - expireLe : 10 minutes après l'envoi ; essais : 5 au plus, puis le code
//   est effacé et il faut en redemander un ;
// - envois : horodatages des demandes de la dernière heure (1 par minute,
//   5 par heure), gardés même quand l'adresse ne correspond à aucun compte,
//   pour que la réponse reste la même dans les deux cas.

export const CODE_CHIFFRES = 6;
export const CODE_DUREE_MS = 10 * 60 * 1000;
export const CODE_ESSAIS_MAX = 5;
export const ENVOI_INTERVALLE_MS = 60 * 1000;
export const ENVOIS_PAR_HEURE = 5;
const HEURE_MS = 60 * 60 * 1000;

export const adresseNormalisee = (email) => String(email || "").trim().toLowerCase();

// Code à 6 chiffres, tiré par la source cryptographique (jamais Math.random).
export function genererCode(tirage = randomInt) {
  return String(tirage(0, 10 ** CODE_CHIFFRES)).padStart(CODE_CHIFFRES, "0");
}

const hmac = (secret, texte) => createHmac("sha256", String(secret || "")).update(texte).digest("hex");

export function cleAdresse(email, secret) {
  return hmac(secret, `adresse:${adresseNormalisee(email)}`);
}

export function empreinteCode(code, sel, secret) {
  return hmac(secret, `code:${sel}:${String(code || "").trim()}`);
}

function memeEmpreinte(a, b) {
  const x = Buffer.from(String(a || ""), "hex");
  const y = Buffer.from(String(b || ""), "hex");
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

const envoisRecents = (entree, maintenant) => (Array.isArray(entree?.envois) ? entree.envois : []).filter((t) => maintenant - Number(t) < HEURE_MS);

// Fréquence d'envoi par adresse : 1 par minute, 5 par heure.
export function peutEnvoyer(entree, maintenant = Date.now()) {
  const envois = envoisRecents(entree, maintenant);
  if (envois.length >= ENVOIS_PAR_HEURE) return { ok: false, attenteMs: HEURE_MS - (maintenant - Math.min(...envois)) };
  const dernier = envois.length ? Math.max(...envois) : 0;
  if (dernier && maintenant - dernier < ENVOI_INTERVALLE_MS) return { ok: false, attenteMs: ENVOI_INTERVALLE_MS - (maintenant - dernier) };
  return { ok: true, attenteMs: 0 };
}

// Nouvelle demande : l'envoi est compté dans tous les cas ; le code n'existe
// que si un compte actif correspond (userId), et remplace le précédent.
// Sans compte, l'entrée a la même durée et le même compteur d'essais, pour
// que les réponses ne trahissent pas l'existence de l'adresse.
export function enregistrerDemande(entree, { userId = "", code = "", sel = "", secret = "", maintenant = Date.now() } = {}) {
  const envois = [...envoisRecents(entree, maintenant), maintenant];
  if (!userId || !code) return { expireLe: maintenant + CODE_DUREE_MS, essais: 0, envois };
  return { userId, empreinte: empreinteCode(code, sel, secret), sel, expireLe: maintenant + CODE_DUREE_MS, essais: 0, envois };
}

// Vérification : { ok, raison, entree } — raison : "absent" | "expire" |
// "epuise" | "faux". L'entrée rendue remplace l'ancienne (code consommé si
// juste, essai compté si faux, code effacé au 5e essai ou à l'expiration).
export function verifierCode(entree, code, secret, maintenant = Date.now()) {
  const envois = envoisRecents(entree, maintenant);
  if (!entree?.expireLe) return { ok: false, raison: "absent", entree: { envois } };
  if (maintenant > Number(entree.expireLe || 0)) return { ok: false, raison: "expire", entree: { envois } };
  const valable = Boolean(entree.empreinte && entree.userId);
  if (Number(entree.essais || 0) >= CODE_ESSAIS_MAX) return { ok: false, raison: "epuise", entree: { envois } };
  const propre = String(code || "").replace(/\s/g, "");
  if (valable && /^\d{6}$/.test(propre) && memeEmpreinte(empreinteCode(propre, entree.sel, secret), entree.empreinte)) {
    return { ok: true, raison: "", userId: entree.userId, entree: { envois } };
  }
  const essais = Number(entree.essais || 0) + 1;
  if (essais >= CODE_ESSAIS_MAX) return { ok: false, raison: "epuise", entree: { envois } };
  return { ok: false, raison: "faux", entree: { ...entree, essais, envois } };
}

// Ménage : on garde une entrée tant qu'elle a un code valable ou un envoi
// dans l'heure.
export function nettoyerCodes(codes = {}, maintenant = Date.now()) {
  const propre = {};
  for (const [cle, e] of Object.entries(codes || {})) {
    const envois = envoisRecents(e, maintenant);
    const codeValable = e?.empreinte && maintenant <= Number(e.expireLe || 0);
    if (codeValable || envois.length) propre[cle] = { ...e, envois };
  }
  return propre;
}

// Adresse masquée pour l'écran « Code reçu » (« s••••@••••.fr »).
export { adresseMasquee } from "./profil-client.js";

export const MESSAGE_ENVOI = "Si cette adresse correspond à un compte Koji, un code vient d'y être envoyé. Il est valable 10 minutes.";
export const ERREUR_CODE = "Code incorrect ou expiré.";
export const ERREUR_EPUISE = "Trop d'essais pour ce code. Demandez-en un nouveau.";
