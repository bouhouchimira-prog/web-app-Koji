// Premier mois (maquette PRO-26, version 1) : huit étapes faites sur de
// vrais chantiers, des jetons du Radar offerts quand l'étape est constatée
// par Koji, jamais avant. La liste vit 30 jours ; pour un compte créé avant
// la mise en ligne, les 30 jours partent de la mise en ligne. Le grade, les
// hauts faits et les talents (reste de PRO-26) sont pour la version 2.

export const LANCEMENT = "2026-11-17";
export const DUREE_JOURS = 30;
export const SIEGE_MIN_OUVRAGES = 40;

export const ETAPES = [
  { id: "entreprise", titre: "Compléter mon entreprise", detail: "SIREN, assurance décennale, logo", jetons: 2, web: "/profil", app: "/profile/company", action: "Compléter" },
  { id: "bibliotheque", titre: "Importer ou choisir ma bibliothèque de prix", detail: `${SIEGE_MIN_OUVRAGES} ouvrages minimum`, jetons: 1, web: "/bibliotheque-ouvrages", app: "/bibliotheque", action: "Ouvrir la bibliothèque" },
  { id: "devis-envoye", titre: "Envoyer mon premier devis", detail: "depuis une visite ou un chantier existant", jetons: 1, web: "/devis", app: "/quote", action: "Faire un devis" },
  { id: "devis-signe", titre: "Premier devis signé par un client", detail: "par lien ou dans Koji Client", jetons: 3, web: "/devis", app: "/quote", action: "Voir mes devis" },
  { id: "compagnon", titre: "Inviter un compagnon", detail: "il reçoit un lien, pas de mot de passe", jetons: 1, web: "/equipe", app: "/equipe", action: "Inviter" },
  { id: "photo", titre: "Première photo datée sur un chantier", detail: "avant / après", jetons: 1, web: "/chantiers", app: "/projects", action: "Ouvrir mes chantiers" },
  { id: "facture-payee", titre: "Première facture payée dans Koji", detail: "acompte ou solde", jetons: 2, web: "/facturation", app: "/facturation", action: "Ouvrir mes factures" },
  { id: "pv", titre: "Premier chantier livré avec PV", detail: "réception signée par le client", jetons: 5, web: "/chantiers", app: "/projects", action: "Ouvrir mes chantiers" }
];

export const TOTAL_JETONS = ETAPES.reduce((s, e) => s + e.jetons, 0);

const JOUR = 86400000;
const jour = (iso) => String(iso || "").slice(0, 10);

// Fenêtre des 30 jours : à partir de l'inscription, ou de la mise en ligne
// pour un compte plus ancien.
export function fenetre(inscritLe, maintenant = new Date().toISOString()) {
  const debut = [jour(inscritLe), LANCEMENT].filter(Boolean).sort().at(-1);
  const fin = new Date(Date.parse(`${debut}T00:00:00Z`) + DUREE_JOURS * JOUR).toISOString().slice(0, 10);
  const restants = Math.ceil((Date.parse(`${fin}T00:00:00Z`) - Date.parse(maintenant)) / JOUR);
  return { debut, fin, joursRestants: Math.max(0, restants), ouverte: jour(maintenant) >= debut && jour(maintenant) < fin };
}

const sirenDe = (b = {}) => String(b.siren || b.siret || "").replace(/\s/g, "").slice(0, 9);
const estSigne = (q = {}) => Boolean(q.signedAt || q.signed_at) || ["signe", "signé", "accepte", "accepté"].includes(String(q.status || "").toLowerCase()) || q.signatureStatus === "Signe";
const estEnvoye = (q = {}) => estSigne(q) || Boolean(q.sentAt) || ["envoye", "envoyé"].includes(String(q.status || "").toLowerCase()) || q.signatureStatus === "Envoye";

// Ce que Koji constate pour chaque étape (données du compte seulement).
export function etapesFaites({ business = {}, ouvrages = 0, quotes = [], workers = [], photos = [], invoices = [], clotures = [] } = {}) {
  const dec = business.documents?.decennale || {};
  const manque = [
    /^\d{9}$/.test(sirenDe(business)) ? "" : "SIREN",
    dec.fileDataUrl || business.decennaleInsurer || dec.insurer ? "" : "assurance décennale",
    business.logoDataUrl ? "" : "logo"
  ].filter(Boolean);
  return {
    entreprise: { faite: manque.length === 0, reste: manque.length ? `manque : ${manque.join(", ")}` : "" },
    bibliotheque: { faite: ouvrages >= SIEGE_MIN_OUVRAGES, reste: ouvrages >= SIEGE_MIN_OUVRAGES ? "" : `${ouvrages} sur ${SIEGE_MIN_OUVRAGES}` },
    "devis-envoye": { faite: quotes.some(estEnvoye), reste: "" },
    "devis-signe": { faite: quotes.some(estSigne), reste: "" },
    compagnon: { faite: workers.length > 0, reste: "" },
    photo: { faite: photos.length > 0, reste: "" },
    "facture-payee": { faite: invoices.some((f) => f.kind !== "avoir" && (f.status === "Payee" || Boolean(f.paidAt))), reste: "" },
    pv: { faite: clotures.some((c) => Boolean(c.pv?.signeLe)), reste: "" }
  };
}

// État du parcours : étapes avec leur statut et leurs jetons, prochaine
// étape, jetons offerts, étapes à créditer maintenant.
export function parcours({ faits = {}, credits = [], inscritLe = "", maintenant = new Date().toISOString() } = {}) {
  const f = fenetre(inscritLe, maintenant);
  const credite = new Set(credits.map((c) => c.etape));
  const etapes = ETAPES.map((e, i) => ({ ...e, numero: i + 1, faite: Boolean(faits[e.id]?.faite), reste: faits[e.id]?.reste || "", creditee: credite.has(e.id) }));
  const aCrediter = f.ouverte ? etapes.filter((e) => e.faite && !e.creditee) : [];
  const offerts = credits.reduce((s, c) => s + (Number(c.quantite) || 0), 0) + aCrediter.reduce((s, e) => s + e.jetons, 0);
  return {
    fenetre: f,
    etapes: etapes.map((e) => ({ ...e, creditee: e.creditee || aCrediter.some((x) => x.id === e.id) })),
    faites: etapes.filter((e) => e.faite).length,
    total: etapes.length,
    prochaine: etapes.find((e) => !e.faite) || null,
    jetonsOfferts: offerts,
    jetonsTotal: TOTAL_JETONS,
    aCrediter
  };
}

export const idCredit = (userId, etape) => `premier-mois-${userId}-${etape}`;
