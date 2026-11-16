// Carte de visite (maquette PRO-13.4) : contenu repris du profil et de la
// KojiPage, modifiable dans l'onglet Carte de visite (site.carte).
export function contenuCarte(site = {}, webUser = {}) {
  const b = webUser.business || {};
  const k = site.carte || {};
  const metiers = (k.metiers?.length ? k.metiers : site.specialties || webUser.professions || []).filter(Boolean).slice(0, 4);
  const personne = k.personne || site.contactName || [b.firstName || b.prenom, b.lastName].filter(Boolean).join(" ");
  return {
    nom: k.nom || site.title || b.raisonSociale || "",
    personne,
    fonction: k.fonction || (personne ? "Dirigeant" : ""),
    telephone: k.telephone || site.contactPhone || b.phone || "",
    email: k.email || site.contactEmail || b.emailPro || "",
    accroche: site.tagline || "",
    metiers,
    logo: k.logo !== false,
    photo: k.photo === true,
    adresse: k.adresse === true,
    adresseTexte: [b.addressLine1, [b.postalCode, b.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    qr: k.qr !== false
  };
}
