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
  // Plaquiste et Couvreur (29 sept) : ajoutes a la demande d'Amira apres
  // reception d'un dictionnaire de vocabulaire metier plus complet — deux
  // corps de metier reels qui n'avaient pas d'equivalent parmi les 8
  // metiers existants (plâtrerie/cloisons/isolation interieure pour l'un,
  // toiture/couverture/etancheite pour l'autre).
  Plaquiste: {
    equipements: [
      { id: "cloison-seche", label: "Cloison en placo", icon: "🧱" },
      { id: "faux-plafond", label: "Faux plafond", icon: "🔲" },
      { id: "isolation-int", label: "Isolation intérieure (murs/combles)", icon: "🧊" },
      { id: "doublage", label: "Doublage de mur", icon: "🧱" },
      { id: "trappe-visite", label: "Trappe de visite", icon: "🚪" }
    ],
    styles: [
      { id: "standard-plaquiste", label: "Isolation standard", icon: "🎨" },
      { id: "phonique", label: "Isolation renforcée phonique", icon: "🎨" },
      { id: "thermique", label: "Isolation renforcée thermique", icon: "🎨" }
    ],
    travaux: [
      { id: "demolition-cloison", label: "Démolition de cloison existante" },
      {
        id: "pose-cloison", label: "Pose de cloison en placo",
        detail: { key: "plaquisteLineaireCloison", question: "Quel linéaire de cloison ? (mètres)", placeholder: "Ex : 10 m" }
      },
      {
        id: "pose-faux-plafond", label: "Pose de faux plafond",
        detail: { key: "plaquisteSurfacePlafond", question: "Quelle surface de faux plafond ? (m²)", placeholder: "Ex : 25 m²" }
      },
      {
        id: "isolation-combles", label: "Isolation des combles",
        detail: { key: "plaquisteSurfaceCombles", question: "Quelle surface de combles à isoler ? (m²)", placeholder: "Ex : 40 m²" }
      },
      {
        id: "isolation-murs", label: "Isolation des murs",
        detail: { key: "plaquisteSurfaceMurs", question: "Quelle surface de murs à isoler ? (m²)", placeholder: "Ex : 50 m²" }
      },
      { id: "traitement-joints", label: "Traitement des joints (prêt à peindre)" },
      { id: "evacuation-gravats", label: "Évacuation des gravats" },
      { id: "protection-sol", label: "Protection du sol pendant travaux" }
    ]
  },
  Couvreur: {
    equipements: [
      { id: "toiture-tuiles", label: "Toiture tuiles", icon: "🏠" },
      { id: "toiture-ardoises", label: "Toiture ardoises", icon: "🏠" },
      { id: "zinguerie", label: "Zinguerie / couverture métallique", icon: "🔩" },
      { id: "gouttieres", label: "Gouttières / chéneaux", icon: "🌧️" },
      { id: "velux", label: "Fenêtre de toit (Velux)", icon: "🪟" },
      { id: "isolation-toiture", label: "Isolation de toiture", icon: "🧊" }
    ],
    styles: [
      { id: "tuile", label: "Couverture tuiles", icon: "🎨" },
      { id: "ardoise", label: "Couverture ardoises", icon: "🎨" },
      { id: "bac-acier", label: "Bac acier", icon: "🎨" },
      { id: "zinc", label: "Zinc", icon: "🎨" }
    ],
    travaux: [
      { id: "demoussage", label: "Démoussage / nettoyage de toiture" },
      {
        id: "reparation-couverture", label: "Réparation de tuiles ou ardoises",
        detail: { key: "couvreurNbTuiles", question: "Combien de tuiles/ardoises environ à remplacer ?", placeholder: "Ex : 15" }
      },
      {
        id: "remplacement-gouttieres", label: "Remplacement de gouttières",
        detail: { key: "couvreurLineaireGouttieres", question: "Quel linéaire de gouttières ? (mètres)", placeholder: "Ex : 20 m" }
      },
      {
        id: "refection-couverture", label: "Réfection complète de la couverture",
        detail: { key: "couvreurSurfaceToiture", question: "Quelle surface de toiture ? (m²)", placeholder: "Ex : 90 m²" }
      },
      {
        id: "etancheite-terrasse", label: "Étanchéité toiture-terrasse",
        detail: { key: "couvreurSurfaceEtancheite", question: "Quelle surface à traiter ? (m²)", placeholder: "Ex : 30 m²" }
      },
      { id: "pose-velux", label: "Pose de fenêtre de toit (Velux)" },
      { id: "traitement-charpente", label: "Traitement de charpente" },
      { id: "isolation-toiture", label: "Isolation de toiture" }
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
  Plaquiste: "DTU 25.41 (plaques de plâtre) et DTU 25.42 (cloisons en carreaux de plâtre) ; DTU 45.10 pour l'isolation thermique des combles.",
  Couvreur: "DTU 40 (séries) pour les couvertures tuiles/ardoises/zinc ; DTU 43.1 pour l'étanchéité des toitures-terrasses.",
  "Tout corps d'état": "Chaque lot suit son propre DTU (plomberie, électricité NF C 15-100, carrelage, peinture...)."
};

export function normesFor(metier) {
  return METIER_NORMES[metier] || METIER_NORMES["Tout corps d'état"];
}

// Dictionnaire de vocabulaire metier (28 sept, demande d'Amira ; considerablement
// enrichi le 29 sept a partir d'une liste de vocabulaire BTP fournie par Amira —
// ouvrages, materiaux, equipements, defauts/symptomes specifiques a chaque metier,
// pas seulement des noms de metiers) : permet de reconnaitre un metier de facon
// deterministe, sans appel IA, meme a partir d'un seul mot ("tableau electrique",
// "fuite"...) — plus rapide et plus fiable qu'une classification IA pour ce cas
// frequent. Quand plusieurs metiers ressortent a la fois (ex: "peinture et
// electricite"), le serveur les propose tous les deux au client (voir
// METIER_CHOICE_SLOT_KEY dans app/api/radar-assistant/route.js) plutot que de
// deviner ou de basculer silencieusement sur l'IA — l'IA ne tranche que si le
// client rejette les propositions ("Autre, precisez"). Les vocabulaires
// transverses (symptomes generiques type "fuite"/"panne", demolition, mesures,
// synonymes canoniques) restent hors de ce dictionnaire pour l'instant — sujet
// distinct, plus proche du cadrage IA que de la reconnaissance de metier.
export const METIER_VOCABULAIRE = {
  Plombier: /plomb|fuite\b|\bwc\b|toilettes?|[ée]vier|baignoire|douche\b|chauffe-?eau|robinet|sanitaires?\b|canalisation|[ée]vacuation|siphon|tuyauterie|mitigeur|\bvanne\b|\bbonde\b|lavabo|vasque|receveur de douche|wc suspendu|chasse d'eau|ballon d'eau chaude|\bcumulus\b|groupe de s[ée]curit[ée]|adoucisseur|d[ée]bouchage|canalisation bouch[ée]e|d[ée]g[âa]t des eaux|pression d'eau|manque de pression|recherche de fuite|arriv[ée]e d'eau/i,
  Electricien: /[ée]lectri|tableau [ée]lectrique|tableau divisionnaire|prises?\b|interrupteurs?|disjoncteur|diff[ée]rentiel|c[âa]blage|c[âa]ble [ée]lectrique|[ée]clairage|compteur [ée]lectrique|court-?circuit|panne [ée]lectrique|luminaire|va-et-vient|t[ée]l[ée]rupteur|contacteur|goulotte|mise [àa] la terre|mise en conformit[ée] [ée]lectrique|circuit [ée]lectrique|\bspot\b|plafonnier|applique murale|d[ée]tecteur de mouvement|interphone|visiophone|sonnette\b|portail [ée]lectrique|volet roulant [ée]lectrique|disjonction/i,
  Carreleur: /carrelage|carreleur|fa[ïi]ence|mosa[ïi]que|joint de carrelage|gr[èe]s c[ée]rame|cr[ée]dence|croisillons?\b|ragr[ée]age|natte d'[ée]tanch[ée]it[ée]|carrelage fissur[ée]|carreau cass[ée]|joint moisi/i,
  Menuisier: /menuiserie|menuisier|\bportes?\b|porte-fen[êe]tre|fen[êe]tres?|baie vitr[ée]e|placards?\b|parquet|dressing|volets?\b|volet roulant|volet battant|escalier en bois|garde-corps|claustra|verri[èe]re|menuiserie (pvc|aluminium|bois)|double vitrage|simple vitrage|\bvitrage\b|serrure|charni[èe]re|sol (pvc|vinyle)|\blino\b|moquette|jonc de mer|vitrification (du )?parquet|pon[çc]age (du )?parquet|parquet gondol[ée]/i,
  Peintre: /peinture|peintre|peindre|enduit mural|enduit de (lissage|rebouchage)|ravalement( de fa[çc]ade)?|tapisserie|papier peint|sous-couche|primaire d'accroche|toile de verre|rev[êe]tement mural|peinture (acrylique|glyc[ée]ro)|peinture anti-(humidit[ée]|moisissure)|moisissure|\bcloques?\b|[ée]caillage|peinture qui (s'[ée]caille|cloque)|nettoyage fa[çc]ade|lavage haute pression|microfissures?\b/i,
  "Maçon": /ma[çc]onnerie|ma[çc]on\b|mur porteur|\bdalle\b|fondations?\b|cloisons?\b|gros ?[œoe]uvre|b[ée]ton|parpaing|ouverture murale|fissures?\b|\bsemelle\b|\bchape\b|\bradier\b|\bpoteau\b|\bpoutre\b|\blinteau\b|cha[îi]nage|soubassement|\bmuret\b|mur de cl[ôo]ture|reprise de ma[çc]onnerie|d[ée]molition de mur|rebouchage|scellement|coffrage|ferraillage|b[ée]tonnage|rejointoiement|l[ée]zarde|effritement|reprise en sous-[œoe]uvre|isolation ext[ée]rieure|\bite\b|bardage/i,
  Chauffagiste: /chauffage|chauffagiste|chaudi[èe]re|radiateurs?\b|pompe [àa] chaleur|plancher chauffant|ballon d'eau chaude|thermostat|r[ée]gulation( de)? chauffage|absence de chauffage|radiateur qui ne chauffe pas/i,
  Climaticien: /climatisation|climatiseur|climaticien|\bclim\b|multi-?split|gainable|\bvmc\b|ventilation|extracteur|condensation|bouche d'a[ée]ration|mauvaise ventilation/i,
  Plaquiste: /placo\b|plaquiste|pl[âa]trier|plaque de pl[âa]tre|\bba1[035]\b|cloison s[èe]che|cloison phonique|cloison hydrofuge|doublage\b|faux plafond|plafond suspendu|plafond d[ée]montable|corniche\b|isolation (thermique|phonique|acoustique|des combles|des murs)|laine de verre|laine de roche|polystyr[èe]ne|polyur[ée]thane|pare-vapeur|ossature m[ée]tallique|bande [àa] joint|trappe de visite/i,
  Couvreur: /toiture|couverture|couvreur|tuiles?\b|ardoises?\b|charpente|goutti[èe]re|ch[ée]neau|fa[îi]tage|\brives?\b|\bnoue\b|\bsolin\b|zinguerie|bac acier|[ée]tanch[ée]it[ée] (de )?toiture|toit-terrasse|d[ée]moussage|\bvelux\b|fen[êe]tre de toit|[ée]cran sous-toiture/i
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

// Vocabulaire general du batiment (2 oct, remonte par Amira : "MURS" et
// "SALLE DE BAIN" tapes seuls se faisaient rejeter comme "projet pas
// decrit" — "il faut tout comprendre quand c'est dans le champ lexical du
// batiment"). Distinct de METIER_VOCABULAIRE ci-dessus : ne nomme pas un
// metier precis (une piece ou un element seul ne dit pas qui doit
// intervenir), mais suffit a reconnaitre, de facon deterministe et sans
// appel IA, qu'un message decrit bien un sujet BTP — evite de faire
// reposer cette decision uniquement sur le jugement de l'IA (voir
// analyzeIntro dans app/api/radar-assistant/route.js, dont le filet de
// securite refuse desormais par defaut en cas de doute).
export const BTP_GENERAL_VOCABULAIRE = /salle de bain|salle d'eau|\bsdb\b|\bchambre\b|\bcuisine\b|\bsalon\b|s[ée]jour|\bbureau\b|\bcave\b|\bcellier\b|\bgarage\b|\bgrenier\b|\bcombles?\b|entr[ée]e|\bcouloir\b|\bbalcon\b|\bterrasse\b|v[ée]randa|\bdressing\b|\bbuanderie\b|sous-sol|appartement|\bmaison\b|\bstudio\b|\bduplex\b|\blogement\b|\bmurs?\b|\bsols?\b|\bplafonds?\b|fa[çc]ade|\bescalier\b|r[ée]novation|\btravaux\b|am[ée]nagement|\bextension\b|sur[ée]l[ée]vation|\bisolation\b/i;

export function matchesBtpGeneralVocabulaire(text) {
  return BTP_GENERAL_VOCABULAIRE.test(String(text || ""));
}

// Reconnaissance "F3"/"T4"... (8 oct, demande d'Amira) — convention
// immobiliere FR standard : le chiffre compte les PIECES PRINCIPALES
// (chambres + salon), JAMAIS la cuisine ni la salle de bain, qui ne sont pas
// comptees par cette notation et varient trop d'un logement a l'autre pour
// etre devinees ici (une cuisine/salle de bain s'ajoute normalement via le
// flux existant "Une autre piece ?" une fois ce decoupage confirme). Purement
// deterministe (regex), 0 appel IA — seulement une PROPOSITION : jamais
// applique sans confirmation explicite du client (voir
// app/api/radar-assistant/route.js, meme principe que
// proposeExtractionConfirmation pour l'extraction de faits du message
// d'intro).
const TYPE_LOGEMENT_REGEX = /\b[ft]\s?(\d)\b/i;

// Chambre(s) + 1 salon, jusqu'a un T6 raisonnable — au-dela, trop
// d'incertitude sur la composition reelle pour proposer quoi que ce soit.
const TYPE_LOGEMENT_BREAKDOWN = {
  1: [{ type: "autre", label: "Pièce principale" }],
  2: [{ type: "chambre", label: "Chambre" }, { type: "autre", label: "Salon" }],
  3: [{ type: "chambre", label: "Chambre 1" }, { type: "chambre", label: "Chambre 2" }, { type: "autre", label: "Salon" }],
  4: [{ type: "chambre", label: "Chambre 1" }, { type: "chambre", label: "Chambre 2" }, { type: "chambre", label: "Chambre 3" }, { type: "autre", label: "Salon" }],
  5: [{ type: "chambre", label: "Chambre 1" }, { type: "chambre", label: "Chambre 2" }, { type: "chambre", label: "Chambre 3" }, { type: "chambre", label: "Chambre 4" }, { type: "autre", label: "Salon" }],
  6: [{ type: "chambre", label: "Chambre 1" }, { type: "chambre", label: "Chambre 2" }, { type: "chambre", label: "Chambre 3" }, { type: "chambre", label: "Chambre 4" }, { type: "chambre", label: "Chambre 5" }, { type: "autre", label: "Salon" }]
};

// Renvoie { n, rooms } si un code F/T plausible est trouve, sinon null.
export function matchTypeLogement(text) {
  const match = TYPE_LOGEMENT_REGEX.exec(String(text || ""));
  if (!match) return null;
  const n = Number(match[1]);
  const rooms = TYPE_LOGEMENT_BREAKDOWN[n];
  if (!rooms) return null;
  return { n, rooms };
}
