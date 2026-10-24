// Facteurs de situation (24 oct, bibliotheque v0, onglet Facteurs) —
// collectes UNE FOIS par devis (pas par ligne), appliques a chaque ligne
// selon la sensibilite de son ouvrage (lib/pricing.js::calculateTaskPrice).
// Source unique partagee par la carte de collecte (app/devis/DevisEditor.jsx)
// et le chat devis (lib/devis-chat-prompt.js, qui pose ces memes questions),
// pour ne jamais desynchroniser les 2.
export const SITUATION_FACTORS = [
  {
    key: "ACC",
    label: "Accès au logement",
    question: "Comment accède-t-on au chantier ?",
    options: [
      { label: "RDC ou plain-pied", value: 1 },
      { label: "Ascenseur", value: 1.1 },
      { label: "1er sans ascenseur", value: 1.12 },
      { label: "2e sans ascenseur", value: 1.24 },
      { label: "3e sans ascenseur", value: 1.36 },
      { label: "4e sans ascenseur", value: 1.48 },
      { label: "5e et plus sans ascenseur", value: 1.6 }
    ]
  },
  {
    key: "STO",
    label: "Distance de stockage ou benne",
    question: "À quelle distance se trouve le point de stockage ou la benne ?",
    options: [
      { label: "≤ 25 m", value: 1 },
      { label: "25 à 60 m", value: 1.15 },
      { label: "> 60 m ou cour intérieure sans accès", value: 1.3 }
    ]
  },
  {
    key: "EXI",
    label: "Exiguïté de la pièce",
    question: "Quelle est la surface de la pièce ?",
    options: [
      { label: "≥ 10 m²", value: 1 },
      { label: "4 à 10 m²", value: 1.1 },
      { label: "< 4 m²", value: 1.2 }
    ]
  },
  {
    key: "OCC",
    label: "Occupation du logement",
    question: "Le logement est-il vide ou occupé pendant les travaux ?",
    options: [
      { label: "Vide", value: 1 },
      { label: "Occupé ou meublé", value: 1.15 }
    ]
  },
  {
    key: "SUP",
    label: "État du support",
    question: "Le support est-il sain ou dégradé / ancien / scellé au ciment ?",
    options: [
      { label: "Sain", value: 1 },
      { label: "Dégradé ou ancien", value: 1.3 }
    ]
  },
  {
    key: "HSP",
    label: "Hauteur sous plafond",
    question: "Quelle est la hauteur sous plafond ?",
    options: [
      { label: "< 2,70 m", value: 1 },
      { label: "2,70 à 3,20 m", value: 1.1 },
      { label: "> 3,20 m", value: 1.25 }
    ]
  },
  {
    key: "HOR",
    label: "Horaires contraints",
    question: "Les horaires de travail sont-ils restreints (copropriété, voisinage) ?",
    options: [
      { label: "Libres", value: 1 },
      { label: "Restreints", value: 1.1 }
    ]
  }
];

export const SITUATION_FACTOR_DEFAULTS = SITUATION_FACTORS.reduce((acc, factor) => {
  acc[factor.key] = 1;
  return acc;
}, {});
