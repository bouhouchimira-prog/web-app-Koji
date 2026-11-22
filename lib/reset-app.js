// De quelle app vient une réinitialisation de mot de passe (14 nov 2026) ?
//
// Retour testeur : « Mot de passe oublié » dans l'app Koji (particulier)
// finissait sur le site Koji Pro (page aux couleurs Pro, puis connexion au
// site Pro). Le lien e-mail porte maintenant &app=koji ou &app=pro, et la
// page /set-password dit « Retournez dans l'app … » au lieu de connecter au
// site. Sans indication (demande faite sur le site), comportement du site.

const APPS = new Set(["koji", "pro"]);

/**
 * Côté serveur (app/api/auth/forgot-password).
 * - `demande` : envoyé par les apps à partir de la version qui suit la 74.
 * - Compte particulier (is_pro false) : toujours l'app Koji, il n'a pas
 *   d'espace sur le site Pro.
 * - Sinon, client HTTP de Flutter (« Dart/… ») : app Koji Pro (versions ≤ 74,
 *   qui n'envoient pas encore `app`).
 */
export function appDuLien({ demande, isPro, userAgent } = {}) {
  if (APPS.has(demande)) return demande;
  if (isPro === false) return "koji";
  if (/^Dart\//i.test(String(userAgent || ""))) return "pro";
  return null;
}

/**
 * Côté page (lien Supabase des apps installées avant le 12 nov, session dans
 * l'URL) : le jeton dit si le compte est particulier. Ces liens ne viennent
 * que des apps ; par défaut Koji Pro.
 */
export function appDepuisJeton(accessToken) {
  try {
    const partie = String(accessToken || "").split(".")[1];
    if (!partie) return null;
    const base64 = partie.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function"
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, "base64").toString("utf8");
    const charge = JSON.parse(json);
    return charge?.user_metadata?.is_pro === false ? "koji" : "pro";
  } catch {
    return null;
  }
}

export const NOM_APP = { koji: "Koji", pro: "Koji Pro" };

// Plusieurs demandes à la suite (21 nov 2026) : chaque demande créait un
// nouveau jeton et annulait le lien de l'e-mail précédent. Quatre demandes en
// 90 secondes = quatre e-mails, dont trois menaient à « Ce lien ne fonctionne
// plus » — et rien ne dit lequel est le bon. Tant que le jeton en cours a
// encore au moins 15 minutes devant lui, on renvoie le même lien : tous les
// e-mails reçus fonctionnent. La durée de vie d'un jeton reste de 30 minutes
// au plus (on ne la prolonge pas).
export const RESET_MARGE_REUTILISATION_MS = 15 * 60 * 1000;

export function jetonResetReutilisable(jeton, expireA, maintenant = Date.now()) {
  if (!jeton || !expireA) return false;
  const fin = new Date(expireA).getTime();
  if (!Number.isFinite(fin)) return false;
  return fin - maintenant >= RESET_MARGE_REUTILISATION_MS;
}
