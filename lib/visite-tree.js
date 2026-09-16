// Arbre de questions de la visite guidee (Radar des Chantiers, etape
// "l'entreprise positionnee effectue sa visite") — FIXE, code en dur, comme
// les SLOTS de app/api/radar-assistant/route.js : rien n'est improvise par
// une IA ici. Seule la partie "metre" varie par metier ; le reste de la
// sous-sequence par piece (etat constate, finitions demandees, acces,
// remarques) est commun a tous les metiers.
//
// Premier lot (12 septembre) : 3 metiers couverts. La bibliotheque de prix
// (data/catalog-ouvrages.json) ne couvre aujourd'hui que Carrelage et
// Peinture — Plomberie et Electricite n'ont aucune ligne. Decide avec
// Amira : ces deux metiers passent quand meme par la visite complete, mais
// generent des lignes "a chiffrer manuellement" plutot qu'un prix invente
// par l'IA (voir lib/visite-devis-shape.js).
export const VISITE_METIERS = [
  { key: "plomberie_carrelage", label: "Plomberie / Carrelage (SDB)", catalogueProfession: "Carrelage" },
  { key: "peinture", label: "Peinture", catalogueProfession: "Peinture" },
  { key: "electricite", label: "Électricité", catalogueProfession: null }
];

export function metierByKey(key) {
  return VISITE_METIERS.find((m) => m.key === key) || VISITE_METIERS[0];
}

// Champs de metre par metier quand aucun plan n'est fourni. "type" pilote
// le rendu cote page (nombre simple ou compteur de points). "ouvrageHint"
// aide lib/visite-devis-shape.js a choisir le bon ouvrage de la
// bibliotheque pour ce champ (ignore pour l'electricite, sans bibliotheque).
export const METRE_FIELDS_BY_METIER = {
  plomberie_carrelage: [
    { key: "surfaceSol", label: "Surface au sol", unit: "m²", type: "nombre", ouvrageHint: "sol" },
    { key: "surfaceMurs", label: "Surface de murs à carreler", unit: "m²", type: "nombre", ouvrageHint: "mur" },
    { key: "pointsEau", label: "Points d'eau (lavabo, douche/baignoire, WC, autre)", unit: "point(s)", type: "compteur" }
  ],
  peinture: [
    { key: "surfaceMurs", label: "Surface de murs", unit: "m²", type: "nombre", ouvrageHint: "mur" },
    { key: "surfacePlafond", label: "Surface de plafond", unit: "m²", type: "nombre", ouvrageHint: "plafond" },
    { key: "ouvertures", label: "Nombre d'ouvertures (portes/fenêtres à protéger)", unit: "u", type: "nombre" }
  ],
  electricite: [
    { key: "prises", label: "Nombre de prises", unit: "u", type: "nombre" },
    { key: "pointsLumineux", label: "Nombre de points lumineux", unit: "u", type: "nombre" },
    { key: "tableauARevoir", label: "Tableau électrique à revoir ?", unit: "", type: "oui_non" }
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
