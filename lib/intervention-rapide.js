// Intervention rapide (maquette PRO-17.1) : un client appelle directement
// l'artisan. Client, adresse, problème, urgence, prix envoyés par écrit,
// en route, devis avant travaux en deux blocs, facture, paiement noté.
// Règles pures, testées dans tests/unit/intervention-rapide.test.js ; l'app
// (mobile/lib/features/intervention_rapide) porte les mêmes textes.

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const euros = (n) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: Number.isInteger(r2(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(r2(n)).replace(/ | /g, " ")} €`;
export const euros2 = (n) => `${new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(r2(n)).replace(/ | /g, " ")} €`;

// Prix d'intervention de l'artisan (jamais inventés par Koji).
export function prixValides(prix = {}) {
  return Number(prix.deplacement) > 0 && Number(prix.demiHeure) > 0;
}

// Information écrite préalable sur le prix (arrêté du 24 janvier 2017).
export function messagePrix({ entreprise = "", prix = {}, lien = "" } = {}) {
  if (!prixValides(prix)) return "";
  const t = `${entreprise ? `${entreprise} : ` : ""}déplacement et 1re demi-heure ${euros(prix.deplacement)} TTC, puis ${euros(prix.demiHeure)} la demi-heure. Devis gratuit, signé avant tout travail.`;
  return lien ? `${t} Confirmez ces prix ici : ${lien}` : t;
}

export const ETAPES = [
  { cle: "creee", label: "Créée" },
  { cle: "acceptee", label: "Prix acceptés" },
  { cle: "en_route", label: "En route" },
  { cle: "sur_place", label: "Sur place" },
  { cle: "devis_signe", label: "Devis signé" },
  { cle: "terminee", label: "Terminée" }
];

export function etapeDe(i = {}) {
  if (i.annuleeLe) return "annulee";
  if (i.termineeLe) return "terminee";
  if (i.devis?.signeLe) return "devis_signe";
  if (i.arriveLe) return "sur_place";
  if (i.enRouteLe) return "en_route";
  if (i.accepteLe) return "acceptee";
  return "creee";
}

export const totalLignes = (lignes = []) => r2(lignes.reduce((s, l) => s + (Number(l.ttc) || 0), 0));

export function nettoyerLignes(lignes = []) {
  return (Array.isArray(lignes) ? lignes : [])
    .map((l) => ({ label: String(l?.label || "").trim().slice(0, 140), ttc: r2(l?.ttc) }))
    .filter((l) => l.label && l.ttc > 0)
    .slice(0, 20);
}

// Devis signé au domicile : réparation urgente sans rétractation (L221-28) ;
// à planifier ou travaux en plus : 14 jours, rien à payer avant 7 jours.
export function mentionDevis(urgence = "maintenant") {
  return urgence === "maintenant"
    ? "Réparation urgente demandée par le client, limitée au strict nécessaire : pas de délai de rétractation."
    : "Signé au domicile : 14 jours pour se rétracter, aucun paiement avant 7 jours.";
}
export const MENTION_EN_PLUS = "Devis séparé : 14 jours pour se rétracter, rien à payer avant 7 jours.";

export const PIECES = { garde: "Le client garde les pièces remplacées", refuse: "Le client n'en veut pas" };
export const MOYENS_PAIEMENT = { terminal: "Carte, mon terminal", especes: "Espèces", virement: "Virement", cheque: "Chèque" };

export const lienItineraire = (adresse = "") => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;

// Heure d'arrivée annoncée (Paris), à partir d'un temps de trajet en minutes.
export function arriveeVers(minutes, maintenant = new Date().toISOString()) {
  const d = new Date(Date.parse(maintenant) + Math.max(0, Math.round(Number(minutes) || 0)) * 60000);
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}
export function heureParis(iso) {
  return iso ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)) : "";
}

// « Mme Lefèvre » → fiche contact ; « Claire Lefèvre » → prénom + nom.
export function nomContact(nom = "") {
  const t = String(nom).trim().replace(/\s+/g, " ");
  const civ = /^(M\.|Mme|Mlle|Monsieur|Madame)\s+/i.exec(t);
  if (civ) return { firstName: "", lastName: t };
  const [prenom, ...reste] = t.split(" ");
  return reste.length ? { firstName: prenom, lastName: reste.join(" ") } : { firstName: "", lastName: t };
}

// Libellé du suivi pour le client (page publique).
export function suiviClient(i = {}) {
  const e = etapeDe(i);
  if (e === "annulee") return "Intervention annulée.";
  if (e === "creee") return "Confirmez les prix pour que l'artisan parte.";
  if (e === "acceptee") return "Prix confirmés. L'artisan vous prévient quand il part.";
  if (e === "en_route") return `L'artisan est en route${i.arriveeVers ? `, arrivée vers ${i.arriveeVers.replace(":", " h ")}` : ""}.`;
  if (e === "sur_place") return "L'artisan est sur place. Il vous fera signer un devis avant de commencer.";
  if (e === "devis_signe") return "Devis signé, travaux en cours.";
  return "Intervention terminée. Merci !";
}
