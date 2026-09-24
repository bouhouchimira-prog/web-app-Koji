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
  "Tout corps d'état": "Chaque lot suit son propre DTU (plomberie, électricité NF C 15-100, carrelage, peinture...)."
};

export function normesFor(metier) {
  return METIER_NORMES[metier] || METIER_NORMES["Tout corps d'état"];
}
