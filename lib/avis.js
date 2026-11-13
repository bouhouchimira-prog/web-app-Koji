// Avis et réalisation (maquette PRO-02.6) : le client note le chantier
// (note globale et quatre critères) dans Koji Client ; l'entreprise répond
// (réponse proposée par Koji, modifiable) ; tous les avis sont publiés sur
// la KojiPage, positifs comme négatifs, sans suppression possible. La
// réalisation (avant / après, titre, texte, avis lié) n'est publiée qu'avec
// l'accord du client sur les photos. Mêmes règles dans l'app Koji Pro
// (mobile/lib/apps/entreprise/chantiers/avis.dart).

export const CRITERES = [
  { id: "ponctualite", label: "Ponctualité" },
  { id: "proprete", label: "Propreté" },
  { id: "communication", label: "Communication" },
  { id: "prix", label: "Respect du prix" }
];

const note = (n) => Math.max(1, Math.min(5, Math.round(Number(n) || 0)));

export function noteValide(n) {
  const v = Number(n);
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

export function normaliserCriteres(criteres = {}) {
  const out = {};
  for (const c of CRITERES) if (noteValide(criteres[c.id])) out[c.id] = note(criteres[c.id]);
  return out;
}

// Nom affiché publiquement : le premier mot en entier, les suivants en
// initiale (« Karine Lefèvre » → « Karine L. », « Mme Lefèvre » → « Mme L. »).
export function auteurPublic(nom = "") {
  const mots = String(nom).trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return "Client Koji";
  return [mots[0], ...mots.slice(1).map((m) => `${m[0].toUpperCase()}.`)].join(" ");
}

// Note moyenne (une décimale), nombre d'avis vérifiés, part qui recommande
// (note de 4 ou 5).
export function statsAvis(avis = []) {
  const verifies = avis.filter((a) => a.verifie && noteValide(a.note));
  if (!verifies.length) return { moyenne: 0, nombre: 0, recommandent: 0 };
  const somme = verifies.reduce((n, a) => n + Number(a.note), 0);
  return {
    moyenne: Math.round((somme / verifies.length) * 10) / 10,
    nombre: verifies.length,
    recommandent: Math.round((verifies.filter((a) => Number(a.note) >= 4).length / verifies.length) * 100)
  };
}

export function moyenneTexte(moyenne) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(moyenne);
}

// Réponse proposée par Koji, à relire avant publication.
export function reponseProposee({ client = "", note: n = 5 } = {}) {
  const merci = `Merci${client ? ` ${client}` : ""} pour votre confiance et votre accueil pendant les travaux.`;
  if (Number(n) >= 4) return `${merci} Ravis que le résultat vous plaise ; n'hésitez pas à nous écrire dans Koji Client si besoin.`;
  if (Number(n) === 3) return `${merci} Merci aussi pour vos remarques : nous en tenons compte, et restons à votre disposition dans Koji Client.`;
  return `${merci} Nous sommes désolés que tout n'ait pas été à la hauteur ; nous vous recontactons pour trouver une solution.`;
}

// Réalisation préparée par Koji : titre du chantier, lots réalisés et durée.
export function realisationProposee({ titre = "", lots = [], jours = 0 } = {}) {
  const travaux = lots.map((l) => String(l).trim()).filter(Boolean).map((l, i) => (i === 0 ? l : l.toLowerCase()));
  const texte = [travaux.join(", "), jours ? `${jours} jour${jours > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
  return { titre: String(titre).trim() || "Chantier", texte };
}

export function etoiles(n) {
  const v = note(n);
  return "★".repeat(v) + "☆".repeat(5 - v);
}
