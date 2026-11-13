// Démarrage guidé (maquette PRO-01.1) : six étapes lues dans le profil. Les
// trois premières suffisent pour envoyer un premier devis ; chaque étape
// dit ce qu'elle débloque. Tant qu'elles ne sont pas faites, le démarrage
// remplace l'accueil (app/page.jsx), sauf si l'artisan a choisi « Passer ».
export const DEMARRAGE_SKIP_KEY = "koji-demarrage-passe";

// Métiers proposés à l'étape 2 : mêmes valeurs que le profil et le Radar
// (le Radar rapproche ces noms des métiers des chantiers publiés), libellés
// comme dans la maquette (« Électricité », « Peinture »…), et les familles
// de la bibliothèque dont chaque métier fixe le taux horaire (étape 3).
export const METIERS_DEMARRAGE = [
  { metier: "Electricien", activite: "Électricité", familles: ["ELEC"] },
  { metier: "Peintre", activite: "Peinture", familles: ["PEI"] },
  { metier: "Carreleur", activite: "Carrelage, faïence", familles: ["CAR"] },
  { metier: "Plombier", activite: "Plomberie", familles: ["PLO"] },
  { metier: "Plaquiste", activite: "Plâtrerie, isolation", familles: ["PLA", "ISO"] },
  { metier: "Menuisier", activite: "Menuiserie", familles: ["MEI", "MEX"] },
  { metier: "Maçon", activite: "Maçonnerie", familles: ["GRO"] },
  { metier: "Chauffagiste", activite: "Chauffage", familles: ["CHA"] },
  { metier: "Climaticien", activite: "Climatisation, ventilation", familles: ["VEN"] },
  { metier: "Couvreur", activite: "Couverture", familles: ["COU"] },
  { metier: "Tout corps d'etat", activite: "Tous corps d'état", familles: [] }
];

export const RAYONS_ZONE = [5, 10, 20, 30, 50];

export function activiteDe(metier) {
  return METIERS_DEMARRAGE.find((m) => m.metier === metier)?.activite || metier;
}

// Taux par métier → taux par famille d'ouvrage (ce que lit la bibliothèque).
export function tauxParFamille(tauxParMetier = {}) {
  const sortie = {};
  for (const { metier, familles } of METIERS_DEMARRAGE) {
    const taux = Number(tauxParMetier[metier]);
    if (!(taux > 0)) continue;
    for (const famille of familles) sortie[famille] = Math.round(taux * 100) / 100;
  }
  return sortie;
}

// Et l'inverse, pour réafficher les taux enregistrés.
export function tauxParMetier(parFamille = {}) {
  const sortie = {};
  for (const { metier, familles } of METIERS_DEMARRAGE) {
    const taux = familles.map((f) => Number(parFamille[f])).find((t) => t > 0);
    if (taux) sortie[metier] = taux;
  }
  return sortie;
}

// Calcul du taux minimum en 4 questions : ce qu'il faut facturer par heure
// pour couvrir les charges et se verser le revenu voulu. Arrondi à l'euro
// supérieur ; null si une réponse manque.
export function tauxMinimum({ charges, revenu, heuresParSemaine, semaines }) {
  const c = Number(charges);
  const r = Number(revenu);
  const h = Number(heuresParSemaine);
  const s = Number(semaines);
  if (!(c >= 0) || !(r >= 0) || !(h > 0) || !(s > 0) || c + r <= 0) return null;
  return Math.ceil((c + r) / (h * s));
}

// « 992651123 » → « 992 ••• 123 » (rappel, pas besoin du numéro entier).
export function masquerSiren(siren) {
  const s = String(siren || "").replace(/\D/g, "");
  return s.length === 9 ? `${s.slice(0, 3)} ••• ${s.slice(6)}` : "";
}

export function tauxHoraireDe(business = {}) {
  const daily = Number(business.dailyRate || 0);
  const heures = Number(business.hoursPerDay || 7) || 7;
  return daily > 0 ? Math.round((daily / heures) * 100) / 100 : 0;
}

function euros(n) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} €`;
}

function dateCourte(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(d) : "";
}

// `taux` : taux par métier enregistrés (GET /api/entreprise/taux), pour le
// résumé de l'étape 3.
export function demarrageSteps(user, { taux = {} } = {}) {
  const business = user?.business || {};
  const professions = Array.isArray(user?.professions) ? user.professions : [];
  const metiersAvecTaux = professions.filter((p) => Number(taux[p]) > 0);
  const zone = Number(business.zoneRadiusKm) || 0;
  return [
    {
      id: "entreprise",
      title: "Votre entreprise",
      unlocks: "remplit vos devis",
      detail: "votre SIREN suffit, Koji remplit le reste depuis l'annuaire",
      resume: [
        business.siren ? `SIREN ${masquerSiren(business.siren)}` : business.siret ? `SIRET ${business.siret}` : "",
        [business.raisonSociale, business.formeJuridique, business.city].filter(Boolean).join(", ")
      ].filter(Boolean).join(" · "),
      done: Boolean(business.raisonSociale && (business.siret || business.siren))
    },
    {
      id: "metiers",
      title: "Vos métiers et votre zone",
      unlocks: "débloque le Radar",
      detail: "ce que vous faites, et jusqu'où vous vous déplacez",
      resume: [
        professions.length ? `${professions.length} métier${professions.length > 1 ? "s" : ""}` : "",
        zone ? `${zone} km autour ${business.zoneAddress ? "de votre adresse" : "du siège"}` : business.zoneAddress ? "zone renseignée" : ""
      ].filter(Boolean).join(" · "),
      done: Boolean(professions.length && (business.zoneAddress || business.zoneLat))
    },
    {
      id: "prix",
      title: "Vos prix",
      unlocks: "débloque le Devis guidé",
      detail: "votre taux par métier, ou calculez-le en 4 questions",
      resume: [
        ...metiersAvecTaux.slice(0, 3).map((p) => `${euros(Number(taux[p]))}/h ${activiteDe(p).toLowerCase()}`),
        tauxHoraireDe(business) ? `${euros(tauxHoraireDe(business))}/h autres postes` : ""
      ].filter(Boolean).join(" · "),
      done: Number(business.dailyRate) > 0
    },
    {
      id: "decennale",
      title: "Votre décennale",
      unlocks: "obligatoire sur vos devis",
      detail: "assureur, numéro de contrat et date de fin",
      resume: [business.decennaleInsurer, business.decennaleUntil ? `jusqu'au ${dateCourte(business.decennaleUntil)}` : ""].filter(Boolean).join(" · "),
      done: Boolean(business.decennaleInsurer && business.decennaleUntil)
    },
    {
      id: "logo",
      title: "Votre logo",
      unlocks: "KojiPage et carte de visite",
      detail: "une image carrée suffit ; sans logo, Koji affiche vos initiales",
      resume: "logo ajouté",
      done: Boolean(business.logoDataUrl || user?.logoUrl)
    },
    {
      id: "iban",
      title: "Votre IBAN",
      unlocks: "sur vos factures",
      detail: "pour être payé plus vite par virement",
      resume: business.iban ? `IBAN ${String(business.iban).replace(/\s/g, "").slice(0, 4)} ••• ${String(business.iban).replace(/\s/g, "").slice(-4)}` : "",
      done: Boolean(business.iban)
    }
  ];
}

export function essentialsDone(steps) {
  return steps.slice(0, 3).every((step) => step.done);
}
