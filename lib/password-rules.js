// Règles du nouveau mot de passe (maquette PRO-00.1) : trois règles visibles
// et cochées au fur et à mesure. Longueur plutôt que complexité (CNIL 2022) :
// 8 caractères au moins, une lettre et un chiffre, ni l'e-mail ni « koji ».
// Mêmes règles à l'écran et sur le serveur (app/api/auth/set-password).

export const REGLES_MOT_DE_PASSE = [
  { id: "longueur", label: "8 caractères au moins" },
  { id: "lettreChiffre", label: "Une lettre et un chiffre" },
  { id: "pasEmail", label: "Pas votre e-mail ni « koji »" },
];

function sansAccents(texte) {
  return String(texte || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function verifierMotDePasse(motDePasse, email = "") {
  const mdp = String(motDePasse || "");
  const bas = sansAccents(mdp);
  const local = sansAccents(String(email || "").split("@")[0]);
  const contientEmail = Boolean(local && local.length >= 3 && bas.includes(local));
  const resultat = {
    longueur: mdp.length >= 8,
    lettreChiffre: /\p{L}/u.test(mdp) && /\d/.test(mdp),
    pasEmail: mdp.length > 0 && !bas.includes("koji") && !contientEmail,
  };
  return { ...resultat, ok: resultat.longueur && resultat.lettreChiffre && resultat.pasEmail };
}

export function erreurMotDePasse(motDePasse, email = "") {
  const r = verifierMotDePasse(motDePasse, email);
  if (!r.longueur) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!r.lettreChiffre) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  if (!r.pasEmail) return "Le mot de passe ne doit contenir ni votre e-mail ni « koji ».";
  return "";
}

// « bilal@exemple.fr » → « bil•••@exemple.fr » (confirmation d'envoi).
export function masquerEmail(email) {
  const [local, domaine] = String(email || "").trim().split("@");
  if (!local || !domaine) return "";
  return `${local.slice(0, Math.min(3, local.length))}•••@${domaine}`;
}
