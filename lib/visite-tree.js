// Arbre de questions de la visite guidee (Radar des Chantiers, etape
// "l'entreprise positionnee effectue sa visite") — FIXE, code en dur, comme
// les SLOTS de app/api/radar-assistant/route.js : rien n'est improvise par
// une IA ici. Seule la partie "metre" varie par metier ; le reste de la
// sous-sequence par piece (etat constate, finitions demandees, acces,
// remarques) est commun a tous les metiers.
//
// Premier lot (12 septembre) : 3 metiers couverts (Plomberie/Carrelage
// fusionnes en un seul, Peinture, Electricite). Etendu le 29 septembre aux
// 10 metiers du dictionnaire de vocabulaire (lib/renovation-question-bank.js)
// — meme base metier partout dans l'app plutot que deux taxonomies
// differentes. La bibliotheque de prix (data/catalog-ouvrages.json) ne
// couvre aujourd'hui que Carrelage, Peinture, Menuiserie et Plâtrerie —
// Plomberie, Electricite, Maçonnerie, Chauffage, Climatisation et Couverture
// n'ont encore aucune ligne. Ces metiers passent quand meme par la visite
// complete, mais generent des lignes "a chiffrer manuellement" plutot qu'un
// prix invente par l'IA (voir lib/visite-devis-shape.js) — a resorber au fur
// et a mesure qu'Amira etoffe la bibliotheque pour ces metiers.
export const VISITE_METIERS = [
  { key: "Plombier", label: "Plomberie", catalogueProfession: null },
  { key: "Electricien", label: "Électricité", catalogueProfession: null },
  { key: "Carreleur", label: "Carrelage", catalogueProfession: "Carrelage" },
  { key: "Menuisier", label: "Menuiserie", catalogueProfession: "Menuiserie" },
  { key: "Peintre", label: "Peinture", catalogueProfession: "Peinture" },
  { key: "Maçon", label: "Maçonnerie / Gros œuvre", catalogueProfession: null },
  { key: "Chauffagiste", label: "Chauffage", catalogueProfession: null },
  { key: "Climaticien", label: "Climatisation / Ventilation", catalogueProfession: null },
  { key: "Plaquiste", label: "Plâtrerie / Cloisons / Isolation", catalogueProfession: "Plâtrerie" },
  { key: "Couvreur", label: "Toiture / Couverture", catalogueProfession: null }
];

export function metierByKey(key) {
  return VISITE_METIERS.find((m) => m.key === key) || VISITE_METIERS[0];
}

// Champs de metre par metier quand aucun plan n'est fourni. "type" pilote
// le rendu cote page (nombre simple ou compteur de points). "ouvrageHint"
// aide lib/visite-devis-shape.js a choisir le bon ouvrage de la
// bibliotheque pour ce champ (ignore pour les metiers sans bibliotheque —
// voir commentaire ci-dessus).
export const METRE_FIELDS_BY_METIER = {
  Plombier: [
    { key: "pointsEau", label: "Points d'eau (lavabo, douche/baignoire, WC, autre)", unit: "point(s)", type: "compteur" },
    { key: "chauffeEauARevoir", label: "Chauffe-eau/ballon d'eau chaude à revoir ?", unit: "", type: "oui_non" }
  ],
  Electricien: [
    { key: "prises", label: "Nombre de prises", unit: "u", type: "nombre" },
    { key: "pointsLumineux", label: "Nombre de points lumineux", unit: "u", type: "nombre" },
    { key: "tableauARevoir", label: "Tableau électrique à revoir ?", unit: "", type: "oui_non" }
  ],
  Carreleur: [
    { key: "surfaceSol", label: "Surface au sol", unit: "m²", type: "nombre", ouvrageHint: "sol" },
    { key: "surfaceMurs", label: "Surface de murs à carreler", unit: "m²", type: "nombre", ouvrageHint: "mur" }
  ],
  Menuisier: [
    { key: "surfaceRevetementSol", label: "Surface de revêtement de sol (parquet, sol souple...)", unit: "m²", type: "nombre", ouvrageHint: "sol" },
    { key: "nbPortesFenetres", label: "Nombre de portes/fenêtres à remplacer", unit: "u", type: "nombre" },
    { key: "placardSurMesure", label: "Placard ou dressing sur mesure ?", unit: "", type: "oui_non" }
  ],
  Peintre: [
    { key: "surfaceMurs", label: "Surface de murs", unit: "m²", type: "nombre", ouvrageHint: "mur" },
    { key: "surfacePlafond", label: "Surface de plafond", unit: "m²", type: "nombre", ouvrageHint: "plafond" },
    { key: "ouvertures", label: "Nombre d'ouvertures (portes/fenêtres à protéger)", unit: "u", type: "nombre" }
  ],
  "Maçon": [
    { key: "surfaceDalle", label: "Surface de dalle béton", unit: "m²", type: "nombre" },
    { key: "lineaireMurCloison", label: "Linéaire de mur/cloison à monter ou démolir", unit: "ml", type: "nombre" },
    { key: "ouvertureMurPorteur", label: "Ouverture dans un mur porteur ?", unit: "", type: "oui_non" }
  ],
  Chauffagiste: [
    { key: "nbRadiateurs", label: "Nombre de radiateurs", unit: "u", type: "nombre" },
    { key: "puissanceKw", label: "Puissance de chaudière/PAC souhaitée", unit: "kW", type: "nombre" },
    { key: "chaudiereARemplacer", label: "Chaudière à remplacer ?", unit: "", type: "oui_non" }
  ],
  Climaticien: [
    { key: "nbUnitesInterieures", label: "Nombre d'unités intérieures", unit: "u", type: "nombre" },
    { key: "longueurLiaison", label: "Longueur de liaison frigorifique", unit: "m", type: "nombre" },
    { key: "vmcARevoir", label: "VMC à revoir ?", unit: "", type: "oui_non" }
  ],
  Plaquiste: [
    { key: "lineaireCloisonSeche", label: "Linéaire de cloison en placo", unit: "ml", type: "nombre" },
    { key: "surfaceFauxPlafond", label: "Surface de faux plafond", unit: "m²", type: "nombre" },
    { key: "isolationCombles", label: "Isolation des combles à prévoir ?", unit: "", type: "oui_non" }
  ],
  Couvreur: [
    { key: "surfaceToiture", label: "Surface de toiture", unit: "m²", type: "nombre" },
    { key: "lineaireGouttieres", label: "Linéaire de gouttières", unit: "ml", type: "nombre" },
    { key: "fuiteActive", label: "Fuite active constatée ?", unit: "", type: "oui_non" }
  ]
};

export const ETAT_CONSTATE_OPTIONS = [
  "Bon état",
  "Fissures ou trous",
  "Humidité ou infiltration",
  "À déposer entièrement",
  "Je ne sais pas"
];

export const FINITION_DEMANDEE_OPTIONS = ["Standard", "Milieu de gamme", "Haut de gamme"];

export const ACCES_OPTIONS = [
  "Rez-de-chaussée",
  "Étage avec ascenseur",
  "Étage sans ascenseur",
  "Je ne sais pas"
];

// Ajoute (15 septembre) pour le questionnaire devis de l'assistant koji —
// partage ce meme fichier avec la visite guidee marketplace, qui peut donc
// aussi s'en servir sans rien dupliquer.
export const STATIONNEMENT_OPTIONS = ["Oui", "Non", "Je ne sais pas"];

// Une "reponse" horodatee, rattachee a une piece — meme forme pour tous les
// champs de la visite (metre, etat constate, finitions demandees, acces,
// remarques). value peut etre une string, un nombre, ou un objet (compteur).
export function timestampedAnswer(value) {
  return { value, timestamp: new Date().toISOString() };
}
