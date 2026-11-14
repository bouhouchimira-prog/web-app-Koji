// Où envoyer un lien e-mail Supabase arrivé sur une page du site (13 nov 2026).
//
// Les apps installées avant le 12 nov demandent à Supabase de revenir sur
// koji://reset-password. Supabase refuse cette adresse et renvoie vers son
// « Site URL », l'accueil de getkoji.io, avec la session dans l'URL :
//   https://getkoji.io/#access_token=…&type=recovery&…
// L'accueil l'ignorait (retour testeur : « le lien me renvoie sur la landing »).
//
// Code source, et non fonction importée : il est inséré tel quel dans un
// <script> de app/layout.jsx, pour rediriger avant que l'accueil s'affiche.
// Écrit en ES5 et autonome pour la même raison. Retourne l'adresse où aller,
// ou null pour rester sur la page.
//
// 14 nov : même chose pour le lien « Confirmez votre adresse » envoyé par
// Supabase quand on crée un compte dans une app (#…&type=signup) : il
// arrivait sur l'accueil ou la connexion du site Pro. → /compte-confirme,
// qui dit « Adresse confirmée, retournez dans l'app ».
export const AUTH_LINK_REDIRECT_SOURCE = `function cibleLienAuth(chemin, hash) {
  if (!hash || hash.length < 2) return null;
  chemin = String(chemin);
  if (chemin.indexOf("/set-password") === 0 || chemin.indexOf("/compte-confirme") === 0) return null;
  var p = new URLSearchParams(hash.slice(1));
  if (p.get("type") === "recovery" && p.get("access_token")) {
    return "/set-password?mode=reset&type=entreprise" + hash;
  }
  if (p.get("type") === "signup" && p.get("access_token")) {
    return "/compte-confirme" + hash;
  }
  if (chemin === "/" && p.get("error_code")) {
    return "/forgot-password?type=entreprise";
  }
  return null;
}
`;
