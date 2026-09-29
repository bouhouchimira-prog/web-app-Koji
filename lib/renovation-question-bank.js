// Catalogue statique (24 septembre) des cartes equipements/styles/travaux
// proposees dans l'onglet "Offre IA" (app/client/radar/new/page.jsx), une
// fois le metier connu — aucun appel IA pour ces choix, meme esprit que les
// listes deja codees en dur ailleurs dans l'app (FINITIONS/LABOR_LEVELS/
// FOURNITURES_OPTIONS dans app/devis-ia/new/page.jsx). Icones en emoji pour
// l'instant (pas de vraies photos, confirme avec Amira le 24 septembre) —
// a remplacer par de vraies photos quand elle en fournira.
//
// Memes cles metier que METIERS dans app/devis-ia/new/page.jsx — pas de
// nouvelle taxonomie.
//
// v2 (meme jour, a la demande d'Amira) : chaque travail mesurable (surface,
// nombre) porte desormais un champ `detail` optionnel — une sous-question
// ciblee posee UNIQUEMENT si ce travail est coche, sur un seul ecran
// recapitulatif apres la liste (app/client/radar/new/page.jsx, phase
// "travaux-detail") plutot qu'un aller-retour par item. Toujours aucun
// appel IA : juste plus de precision chiffree transmise a l'expertise.
export const RENOVATION_QUESTION_BANK = {
  Plombier: {
    equipements: [
      { id: "douche", label: "Douche", icon: "🚿" },
      { id: "baignoire", label: "Baignoire", icon: "🛁" },
      { id: "double-vasque", label: "Double vasque", icon: "🪞" },
      { id: "wc", label: "WC", icon: "🚽" },
      { id: "meuble-vasque", label: "Meuble vasque", icon: "🗄️" },
      { id: "chauffe-eau", label: "Chauffe-eau", icon: "🔥" },
      { id: "adoucisseur", label: "Adoucisseur d'eau", icon: "💧" },
      { id: "seche-serviettes", label: "Sèche-serviettes", icon: "🧻" }
    ],
    styles: [
      { id: "standard", label: "Robinetterie standard", icon: "🚰" },
      { id: "design", label: "Robinetterie design", icon: "🚰" },
      { id: "haut-de-gamme", label: "Robinetterie haut de gamme", icon: "🚰" }
    ],
    travaux: [
      { id: "depose-wc", label: "Dépose WC" },
      { id: "depose-baignoire", label: "Dépose baignoire" },
      { id: "depose-douche", label: "Dépose douche" },
      { id: "depose-lavabo", label: "Dépose lavabo / vasque" },
      { id: "depose-robinetterie", label: "Dépose robinetterie" },
      { id: "arrivees-eau", label: "Plomberie — arrivées d'eau" },
      { id: "evacuations", label: "Plomberie — évacuations" },
      { id: "chauffe-eau", label: "Raccordement chauffe-eau / chaudière" },
      {
        id: "pose-wc", label: "Pose WC",
        detail: { key: "plomberieNbWc", question: "Combien de WC à poser ?", placeholder: "Ex : 1" }
      },
      {
        id: "pose-baignoire-douche", label: "Pose baignoire ou douche",
        detail: { key: "plomberieNbBaignoireDouche", question: "Combien de baignoires/douches à poser ?", placeholder: "Ex : 1" }
      },
      {
        id: "pose-vasque", label: "Pose vasque / meuble vasque",
        detail: { key: "plomberieNbVasque", question: "Combien de vasques à poser ?", placeholder: "Ex : 1 ou 2" }
      },
      {
        id: "pose-robinetterie", label: "Pose robinetterie",
        detail: { key: "plomberieNbRobinetterie", question: "Combien de points de robinetterie (évier, vasque, douche...) ?", placeholder: "Ex : 3" }
      },
      { id: "protection-sol", label: "Protection du sol pendant travaux" },
      { id: "tests-etancheite", label: "Tests d'étanchéité et mise en eau" }
    ]
  },
  Electricien: {
    equipements: [
      { id: "tableau", label: "Tableau électrique", icon: "⚡" },
      { id: "prises", label: "Prises & interrupteurs", icon: "🔌" },
      { id: "eclairage", label: "Éclairage LED", icon: "💡" },
      { id: "vmc", label: "VMC", icon: "🌀" },
      { id: "borne", label: "Borne de recharge", icon: "🔋" },
      { id: "interphone", label: "Interphone / visiophone", icon: "📞" },
      { id: "domotique", label: "Domotique", icon: "📱" }
    ],
    styles: [
      { id: "blanc", label: "Finition blanc", icon: "⬜" },
      { id: "anthracite", label: "Finition anthracite", icon: "◼️" },
      { id: "laiton", label: "Finition laiton", icon: "🟨" }
    ],
    travaux: [
      { id: "depose-tableau", label: "Dépose ancien tableau électrique" },
      { id: "depose-appareillage", label: "Dépose anciennes prises / interrupteurs" },
      { id: "normes", label: "Mise aux normes du tableau électrique (NF C 15-100)" },
      {
        id: "cablage", label: "Câblage / tirage de câbles",
        detail: { key: "electriciteNbPoints", question: "Combien de points électriques environ (prises, interrupteurs, éclairages) ?", placeholder: "Ex : 15" }
      },
      {
        id: "pose-prises", label: "Pose prises et interrupteurs",
        detail: { key: "electriciteNbPrises", question: "Combien de prises et interrupteurs à poser ?", placeholder: "Ex : 10" }
      },
      {
        id: "pose-eclairage", label: "Pose éclairage (spots, appliques, plafonnier)",
        detail: { key: "electriciteNbEclairage", question: "Combien de points lumineux ?", placeholder: "Ex : 6" }
      },
      { id: "pose-vmc", label: "Pose VMC" },
      { id: "pose-borne", label: "Pose borne de recharge" },
      { id: "protection-sol", label: "Protection du sol pendant travaux" },
      { id: "tests", label: "Tests et certification (Consuel)" }
    ]
  },
  Carreleur: {
    equipements: [
      { id: "sol", label: "Carrelage sol", icon: "🧱" },
      { id: "faience", label: "Faïence murale", icon: "🧩" },
      { id: "plinthes", label: "Plinthes", icon: "📏" },
      { id: "douche-italienne", label: "Douche à l'italienne", icon: "🚿" },
      { id: "credence", label: "Crédence carrelée", icon: "🍽️" }
    ],
    styles: [
      { id: "gres-cerame", label: "Grès cérame", icon: "🎨" },
      { id: "pierre-naturelle", label: "Pierre naturelle", icon: "🎨" },
      { id: "faience-style", label: "Faïence", icon: "🎨" },
      { id: "mosaique", label: "Mosaïque", icon: "🎨" }
    ],
    travaux: [
      { id: "depose-sol", label: "Dépose carrelage existant (sol)" },
      { id: "depose-murs", label: "Dépose carrelage existant (murs)" },
      { id: "ragreage", label: "Ragréage du sol" },
      {
        id: "pose-sol", label: "Pose carrelage sol",
        detail: { key: "carrelageSurfaceSol", question: "Quelle surface de carrelage au sol ? (m²)", placeholder: "Ex : 5 m²" }
      },
      {
        id: "pose-faience", label: "Pose faïence murale",
        detail: { key: "carrelageSurfaceMurs", question: "Quelle surface de faïence murale ? (m²)", placeholder: "Ex : 8 m²" }
      },
      {
        id: "plinthes", label: "Pose plinthes",
        detail: { key: "carrelageLineairePlinthes", question: "Quel linéaire de plinthes ? (mètres)", placeholder: "Ex : 12 m" }
      },
      { id: "joints", label: "Joints et finitions" },
      { id: "protection", label: "Protection du sol / mobilier pendant travaux" }
    ]
  },
  Menuisier: {
    equipements: [
      { id: "placards", label: "Placards", icon: "🚪" },
      { id: "parquet", label: "Parquet", icon: "🪵" },
      { id: "portes", label: "Portes intérieures", icon: "🚪" },
      { id: "fenetres", label: "Fenêtres", icon: "🪟" },
      { id: "dressing", label: "Dressing", icon: "👔" },
      { id: "escalier", label: "Escalier", icon: "🪜" }
    ],
    styles: [
      { id: "bois-clair", label: "Bois clair", icon: "🎨" },
      { id: "bois-fonce", label: "Bois foncé", icon: "🎨" },
      { id: "laque", label: "Laqué", icon: "🎨" },
      { id: "stratifie", label: "Stratifié", icon: "🎨" }
    ],
    travaux: [
      { id: "depose-parquet", label: "Dépose ancien parquet / revêtement" },
      { id: "depose-portes", label: "Dépose anciennes portes" },
      { id: "depose-placard", label: "Dépose ancien placard / dressing" },
      {
        id: "pose-parquet", label: "Pose parquet ou stratifié",
        detail: { key: "menuiserieSurfaceParquet", question: "Quelle surface de parquet/stratifié ? (m²)", placeholder: "Ex : 20 m²" }
      },
      {
        id: "pose-portes", label: "Pose portes intérieures",
        detail: { key: "menuiserieNbPortes", question: "Combien de portes intérieures à poser ?", placeholder: "Ex : 3" }
      },
      {
        id: "pose-placards", label: "Pose placards / dressing sur mesure",
        detail: { key: "menuiserieLineairePlacards", question: "Quel linéaire de placards/dressing ? (mètres)", placeholder: "Ex : 3 m" }
      },
      {
        id: "pose-fenetres", label: "Pose fenêtres",
        detail: { key: "menuiserieNbFenetres", question: "Combien de fenêtres à poser ?", placeholder: "Ex : 4" }
      },
      { id: "quincaillerie", label: "Quincaillerie et finitions" },
      { id: "protection-sol", label: "Protection du sol pendant travaux" }
    ]
  },
  Peintre: {
    equipements: [
      { id: "murs", label: "Murs", icon: "🎨" },
      { id: "plafond", label: "Plafond", icon: "⬜" },
      { id: "boiseries", label: "Boiseries", icon: "🪵" },
      { id: "sous-couche", label: "Sous-couche", icon: "🧴" },
      { id: "facade", label: "Façade extérieure", icon: "🏠" }
    ],
    styles: [
      { id: "mat", label: "Mat", icon: "🎨" },
      { id: "satine", label: "Satiné", icon: "🎨" },
      { id: "brillant", label: "Brillant", icon: "🎨" }
    ],
    travaux: [
      { id: "depose-revetement", label: "Dépose ancien revêtement mural (papier peint...)" },
      { id: "protection", label: "Protection du sol et du mobilier" },
      { id: "preparation", label: "Préparation des murs (rebouchage, ponçage)" },
      { id: "sous-couche", label: "Sous-couche" },
      {
        id: "peinture-murs", label: "Peinture murs",
        detail: { key: "peintureSurfaceMurs", question: "Quelle surface de murs à peindre ? (m²)", placeholder: "Ex : 30 m²" }
      },
      {
        id: "peinture-plafond", label: "Peinture plafond (en plus des murs)",
        detail: { key: "peintureSurfacePlafond", question: "Quelle surface de plafond à peindre ? (m²)", placeholder: "Ex : 10 m²" }
      },
      { id: "peinture-boiseries", label: "Peinture boiseries (portes, plinthes)" },
      { id: "finitions", label: "Finitions et retouches" }
    ]
  },
  "Maçon": {
    equipements: [
      { id: "ouverture-mur", label: "Ouverture dans un mur", icon: "🧱" },
      { id: "cloison", label: "Cloison", icon: "🧱" },
      { id: "dalle", label: "Dalle béton", icon: "⬜" },
      { id: "facade", label: "Façade / ravalement", icon: "🏠" },
      { id: "isolation-ext", label: "Isolation extérieure (ITE)", icon: "🧊" },
      { id: "escalier-beton", label: "Escalier béton", icon: "🪜" }
    ],
    styles: [
      { id: "enduit-tal", label: "Enduit taloché", icon: "🎨" },
      { id: "enduit-gratte", label: "Enduit gratté", icon: "🎨" },
      { id: "pierre", label: "Pierre apparente", icon: "🎨" },
      { id: "bardage", label: "Bardage", icon: "🎨" }
    ],
    travaux: [
      { id: "demolition-mur", label: "Démolition de mur ou cloison existante" },
      { id: "reparation-fissures", label: "Réparation de fissures" },
      {
        id: "ouverture-mur", label: "Ouverture dans un mur porteur (avec IPN)",
        detail: { key: "maconnerieLargeurOuverture", question: "Quelle largeur d'ouverture environ ? (mètres)", placeholder: "Ex : 3 m" }
      },
      {
        id: "cloison", label: "Montage de cloison",
        detail: { key: "maconnerieLineaireCloison", question: "Quel linéaire de cloison ? (mètres)", placeholder: "Ex : 8 m" }
      },
      {
        id: "dalle", label: "Coulage de dalle béton",
        detail: { key: "maconnerieSurfaceDalle", question: "Quelle surface de dalle ? (m²)", placeholder: "Ex : 20 m²" }
      },
      {
        id: "ravalement", label: "Ravalement de façade",
        detail: { key: "maconnerieSurfaceFacade", question: "Quelle surface de façade ? (m²)", placeholder: "Ex : 60 m²" }
      },
      { id: "isolation-ext", label: "Isolation extérieure (ITE)" },
      { id: "evacuation-gravats", label: "Évacuation des gravats" },
      { id: "protection-sol", label: "Protection du sol et du mobilier" }
    ]
  },
  Chauffagiste: {
    equipements: [
      { id: "chaudiere", label: "Chaudière (gaz/fioul)", icon: "🔥" },
      { id: "pac", label: "Pompe à chaleur", icon: "♨️" },
      { id: "radiateurs", label: "Radiateurs", icon: "🌡️" },
      { id: "plancher-chauffant", label: "Plancher chauffant", icon: "🏠" },
      { id: "ballon-eau-chaude", label: "Ballon d'eau chaude", icon: "🚿" },
      { id: "thermostat", label: "Thermostat / régulation", icon: "🎛️" }
    ],
    styles: [
      { id: "gaz", label: "Énergie gaz", icon: "🔥" },
      { id: "electrique", label: "Énergie électrique", icon: "⚡" },
      { id: "pac-style", label: "Pompe à chaleur", icon: "♨️" },
      { id: "bois", label: "Bois / granulés", icon: "🪵" }
    ],
    travaux: [
      { id: "depose-chaudiere", label: "Dépose ancienne chaudière" },
      { id: "depose-radiateurs", label: "Dépose anciens radiateurs" },
      {
        id: "pose-chaudiere", label: "Pose chaudière ou pompe à chaleur",
        detail: { key: "chauffagePuissanceKw", question: "Quelle puissance environ ? (kW)", placeholder: "Ex : 24 kW" }
      },
      {
        id: "pose-radiateurs", label: "Pose radiateurs",
        detail: { key: "chauffageNbRadiateurs", question: "Combien de radiateurs à poser ?", placeholder: "Ex : 6" }
      },
      {
        id: "pose-plancher-chauffant", label: "Pose plancher chauffant",
        detail: { key: "chauffageSurfacePlancher", question: "Quelle surface de plancher chauffant ? (m²)", placeholder: "Ex : 70 m²" }
      },
      { id: "raccordements", label: "Raccordements plomberie/électricité" },
      { id: "mise-en-route", label: "Purge et mise en route" },
      { id: "protection-sol", label: "Protection du sol pendant travaux" }
    ]
  },
  Climaticien: {
    equipements: [
      { id: "split", label: "Climatiseur split", icon: "❄️" },
      { id: "multi-split", label: "Multi-split", icon: "❄️" },
      { id: "gainable", label: "Climatiseur gainable", icon: "🌬️" },
      { id: "vmc", label: "VMC double flux", icon: "🌀" },
      { id: "pac-air-air", label: "Pompe à chaleur air/air", icon: "♨️" }
    ],
    styles: [
      { id: "mono-split", label: "Mono-split", icon: "❄️" },
      { id: "multi-split-style", label: "Multi-split", icon: "❄️" },
      { id: "gainable-style", label: "Gainable (invisible)", icon: "❄️" },
      { id: "console", label: "Console", icon: "❄️" }
    ],
    travaux: [
      { id: "depose-clim", label: "Dépose ancienne climatisation" },
      {
        id: "pose-unite-int", label: "Pose unité(s) intérieure(s)",
        detail: { key: "climNbUnitesInt", question: "Combien d'unités intérieures ?", placeholder: "Ex : 3" }
      },
      { id: "pose-unite-ext", label: "Pose unité extérieure" },
      {
        id: "liaison-frigorifique", label: "Tirage de la liaison frigorifique",
        detail: { key: "climLongueurLiaison", question: "Quelle longueur de liaison environ ? (mètres)", placeholder: "Ex : 8 m" }
      },
      { id: "raccordement-electrique", label: "Raccordement électrique dédié" },
      { id: "mise-en-service", label: "Mise en service et tests d'étanchéité" },
      { id: "protection-sol", label: "Protection du sol pendant travaux" }
    ]
  },
  "Tout corps d'état": {
    equipements: [
      { id: "cuisine", label: "Cuisine équipée", icon: "🍳" },
      { id: "salle-de-bain", label: "Salle de bain complète", icon: "🛁" },
      { id: "revetements", label: "Revêtements sols", icon: "🪵" },
      { id: "peinture", label: "Peinture générale", icon: "🎨" },
      { id: "electricite", label: "Électricité générale", icon: "⚡" },
      { id: "plomberie", label: "Plomberie générale", icon: "🚿" },
      { id: "isolation", label: "Isolation", icon: "🧱" },
      { id: "chauffage", label: "Chauffage", icon: "🔥" }
    ],
    styles: [
      { id: "moderne", label: "Moderne", icon: "🎨" },
      { id: "classique", label: "Classique", icon: "🎨" },
      { id: "naturel", label: "Naturel", icon: "🎨" },
      { id: "industriel", label: "Industriel", icon: "🎨" }
    ],
    travaux: [
      { id: "demolition", label: "Démolition / dépose de l'existant" },
      { id: "protection", label: "Protection du sol et du mobilier" },
      { id: "gros-oeuvre", label: "Gros œuvre (cloisons, ouvertures)" },
      { id: "plomberie", label: "Plomberie (arrivées, évacuations, sanitaires)" },
      { id: "electricite", label: "Électricité (tableau, câblage, prises, éclairage)" },
      {
        id: "carrelage", label: "Carrelage / revêtements de sol",
        detail: { key: "tceSurfaceRevetements", question: "Quelle surface de revêtements de sol au total ? (m²)", placeholder: "Ex : 40 m²" }
      },
      {
        id: "peinture", label: "Peinture murs et plafonds",
        detail: { key: "tceSurfacePeinture", question: "Quelle surface à peindre au total ? (m²)", placeholder: "Ex : 80 m²" }
      },
      { id: "menuiseries", label: "Menuiseries (portes, placards)" },
      { id: "cuisine", label: "Cuisine équipée" },
      { id: "salle-de-bain", label: "Salle de bain complète" },
      { id: "finitions", label: "Finitions générales" }
    ]
  }
};

export const RENOVATION_METIERS = Object.keys(RENOVATION_QUESTION_BANK);

export function questionBankFor(metier) {
  return RENOVATION_QUESTION_BANK[metier] || RENOVATION_QUESTION_BANK["Tout corps d'état"];
}

// Meme principe que RENOVATION_QUESTION_BANK (choix statiques, sans appel
// IA) mais communs a tous les metiers — pas besoin d'un jeu par metier.
export const GAMME_OPTIONS = [
  { id: "eco", label: "Économique", icon: "💶" },
  { id: "standard", label: "Standard", icon: "💳" },
  { id: "haut", label: "Haut de gamme", icon: "💎" }
];

export const ETAT_GENERAL_OPTIONS = [
  { id: "bon", label: "Bon état", hint: "rafraîchissement", icon: "✨" },
  { id: "moyen", label: "État moyen", hint: "rénovation partielle", icon: "🛠️" },
  { id: "mauvais", label: "Mauvais état", hint: "rénovation complète", icon: "🔨" }
];

// Rappels de normes (24 septembre, a la demande d'Amira) — INFORMATIF
// uniquement, jamais une question ni un avis juridique personnalise : juste
// les references DTU/NF stables et bien etablies pour le metier detecte,
// affichees comme un encart d'info sur l'ecran "travaux", et glissees dans
// le prompt de app/api/expertise-koji pour que le devis genere s'y refere.
export const METIER_NORMES = {
  Plombier: "DTU 60.1 et 60.11 — dimensionnement des alimentations et évacuations sanitaires.",
  Electricien: "NF C 15-100 — norme électrique française (protection différentielle, volumes de sécurité en pièce d'eau, nombre de prises minimum par pièce).",
  Carreleur: "DTU 52.1 et 52.2 — pose collée et pose scellée des revêtements céramiques.",
  Menuisier: "DTU 36.5 — menuiseries intérieures et extérieures ; RE2020 pour la performance thermique des fenêtres neuves.",
  Peintre: "DTU 59.1 — travaux de peinture (préparation des supports et nombre de couches).",
  "Maçon": "DTU 20.1 — murs en maçonnerie de petits éléments ; DTU 21 — ouvrages en béton armé.",
  Chauffagiste: "DTU 65 — installations de chauffage ; RE2020 pour les installations neuves.",
  Climaticien: "RE2020 pour les installations neuves ; réglementation fluides frigorigènes (manipulation réservée à un professionnel certifié).",
  "Tout corps d'état": "Chaque lot suit son propre DTU (plomberie, électricité NF C 15-100, carrelage, peinture...)."
};

export function normesFor(metier) {
  return METIER_NORMES[metier] || METIER_NORMES["Tout corps d'état"];
}

// Dictionnaire de vocabulaire metier (28 sept, demande d'Amira) : permet de
// reconnaitre un metier de facon deterministe, sans appel IA, meme a partir
// d'un seul mot ("electricite", "plomberie"...) — plus rapide et plus fiable
// qu'une classification IA pour ce cas frequent. Quand plusieurs metiers
// ressortent a la fois (ex: "peinture et electricite"), le serveur les
// propose tous les deux au client (voir METIER_CHOICE_SLOT_KEY dans
// app/api/radar-assistant/route.js) plutot que de deviner ou de basculer
// silencieusement sur l'IA — l'IA ne tranche que si le client rejette les
// propositions ("Autre, precisez").
export const METIER_VOCABULAIRE = {
  Plombier: /plomb|fuite\b|\bwc\b|toilettes?|[ée]vier|baignoire|douche\b|chauffe-?eau|robinet|sanitaires?\b|canalisation|[ée]vacuation|siphon|tuyauterie/i,
  Electricien: /[ée]lectri|tableau [ée]lectrique|prises?\b|interrupteurs?|disjoncteur|c[âa]blage|[ée]clairage|compteur [ée]lectrique|court-?circuit|panne [ée]lectrique|luminaire|va-et-vient/i,
  Carreleur: /carrelage|carreleur|fa[ïi]ence|mosa[ïi]que|joint de carrelage/i,
  Menuisier: /menuiserie|menuisier|\bportes?\b|fen[êe]tres?|placards?\b|parquet|dressing|volets?\b|escalier en bois/i,
  Peintre: /peinture|peintre|peindre|enduit mural|ravalement peinture|tapisserie|papier peint/i,
  "Maçon": /ma[çc]onnerie|ma[çc]on\b|mur porteur|\bdalle\b|fondations?\b|cloisons?\b|gros ?[œoe]uvre|b[ée]ton|parpaing|ouverture murale|fissures?\b/i,
  Chauffagiste: /chauffage|chauffagiste|chaudi[èe]re|radiateurs?\b|pompe [àa] chaleur|plancher chauffant|ballon d'eau chaude/i,
  Climaticien: /climatisation|climatiseur|climaticien|\bclim\b|multi-?split|gainable/i
};

// Renvoie TOUS les metiers dont un mot-cle apparait dans le texte (0, 1 ou
// plusieurs) — matchMetierFromVocabulaire() ci-dessous reste le raccourci
// "un seul metier certain", utilise partout ou une seule reponse suffit.
export function matchAllMetiersFromVocabulaire(text) {
  const value = String(text || "");
  return Object.entries(METIER_VOCABULAIRE).filter(([, regex]) => regex.test(value)).map(([metier]) => metier);
}

export function matchMetierFromVocabulaire(text) {
  const matches = matchAllMetiersFromVocabulaire(text);
  return matches.length === 1 ? matches[0] : null;
}
