// Démarrage guidé (PRO-01.1) : six étapes lues dans le profil. Les trois
// premières suffisent pour envoyer un premier devis ; chaque étape dit ce
// qu'elle débloque.
export const DEMARRAGE_SKIP_KEY = "koji-demarrage-passe";

export function demarrageSteps(user) {
  const business = user?.business || {};
  const professions = Array.isArray(user?.professions) ? user.professions : [];
  return [
    {
      id: "entreprise",
      title: "Votre entreprise",
      detail: "Raison sociale et SIRET",
      unlocks: "Devis et factures à votre nom",
      done: Boolean(business.raisonSociale && (business.siret || business.siren)),
      href: "/profil"
    },
    {
      id: "metiers",
      title: "Métiers et zone d'intervention",
      detail: "Ce que vous faites, et où",
      unlocks: "Les chantiers du Radar autour de vous",
      done: Boolean(professions.length && (business.zoneAddress || business.zoneLat)),
      href: "/profil"
    },
    {
      id: "prix",
      title: "Vos prix",
      detail: "Prix de la journée, TVA, majorations",
      unlocks: "Le Devis guidé chiffre avec votre taux",
      done: Number(business.dailyRate) > 0,
      href: "/bibliotheque-ouvrages/mes-prix"
    },
    {
      id: "decennale",
      title: "Assurance décennale",
      detail: "Assureur, numéro de contrat, date de fin",
      unlocks: "Rassure vos clients et les pros du Réseau",
      done: Boolean(business.decennaleInsurer && business.decennaleUntil),
      inline: true
    },
    {
      id: "logo",
      title: "Votre logo",
      detail: "Une image carrée suffit",
      unlocks: "Votre logo sur devis et factures",
      done: Boolean(business.logoDataUrl || user?.logoUrl),
      href: "/profil"
    },
    {
      id: "iban",
      title: "Coordonnées bancaires",
      detail: "IBAN et titulaire du compte",
      unlocks: "Vos coordonnées de paiement sur chaque facture",
      done: Boolean(business.iban),
      href: "/profil?tab=devis"
    }
  ];
}

export function essentialsDone(steps) {
  return steps.slice(0, 3).every((step) => step.done);
}
