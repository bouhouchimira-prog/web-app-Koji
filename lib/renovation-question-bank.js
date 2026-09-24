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
export const RENOVATION_QUESTION_BANK = {
  Plombier: {
    equipements: [
      { id: "douche", label: "Douche", icon: "🚿" },
      { id: "baignoire", label: "Baignoire", icon: "🛁" },
      { id: "double-vasque", label: "Double vasque", icon: "🪞" },
      { id: "wc", label: "WC", icon: "🚽" },
      { id: "meuble-vasque", label: "Meuble vasque", icon: "🗄️" },
      { id: "chauffe-eau", label: "Chauffe-eau", icon: "🔥" }
    ],
    styles: [
      { id: "standard", label: "Robinetterie standard", icon: "🚰" },
      { id: "design", label: "Robinetterie design", icon: "🚰" },
      { id: "haut-de-gamme", label: "Robinetterie haut de gamme", icon: "🚰" }
    ],
    travaux: [
      { id: "depose", label: "Dépose de l'existant" },
      { id: "plomberie", label: "Plomberie (arrivées/évacuations)" },
      { id: "chauffe-eau", label: "Chauffe-eau / chaudière" },
      { id: "raccordements", label: "Raccordements et tests" }
    ]
  },
  Electricien: {
    equipements: [
      { id: "tableau", label: "Tableau électrique", icon: "⚡" },
      { id: "prises", label: "Prises & interrupteurs", icon: "🔌" },
      { id: "eclairage", label: "Éclairage LED", icon: "💡" },
      { id: "vmc", label: "VMC", icon: "🌀" },
      { id: "borne", label: "Borne de recharge", icon: "🔋" }
    ],
    styles: [
      { id: "blanc", label: "Finition blanc", icon: "⬜" },
      { id: "anthracite", label: "Finition anthracite", icon: "◼️" },
      { id: "laiton", label: "Finition laiton", icon: "🟨" }
    ],
    travaux: [
      { id: "normes", label: "Mise aux normes" },
      { id: "cablage", label: "Câblage" },
      { id: "appareillage", label: "Pose appareillage" },
      { id: "tests", label: "Tests & certification" }
    ]
  },
  Carreleur: {
    equipements: [
      { id: "sol", label: "Carrelage sol", icon: "🧱" },
      { id: "faience", label: "Faïence murale", icon: "🧩" },
      { id: "plinthes", label: "Plinthes", icon: "📏" },
      { id: "douche-italienne", label: "Douche à l'italienne", icon: "🚿" }
    ],
    styles: [
      { id: "gres-cerame", label: "Grès cérame", icon: "🎨" },
      { id: "pierre-naturelle", label: "Pierre naturelle", icon: "🎨" },
      { id: "faience-style", label: "Faïence", icon: "🎨" },
      { id: "mosaique", label: "Mosaïque", icon: "🎨" }
    ],
    travaux: [
      { id: "depose", label: "Dépose de l'ancien carrelage" },
      { id: "ragreage", label: "Ragréage" },
      { id: "pose", label: "Pose" },
      { id: "joints", label: "Joints" }
    ]
  },
  Menuisier: {
    equipements: [
      { id: "placards", label: "Placards", icon: "🚪" },
      { id: "parquet", label: "Parquet", icon: "🪵" },
      { id: "portes", label: "Portes intérieures", icon: "🚪" },
      { id: "fenetres", label: "Fenêtres", icon: "🪟" },
      { id: "dressing", label: "Dressing", icon: "👔" }
    ],
    styles: [
      { id: "bois-clair", label: "Bois clair", icon: "🎨" },
      { id: "bois-fonce", label: "Bois foncé", icon: "🎨" },
      { id: "laque", label: "Laqué", icon: "🎨" },
      { id: "stratifie", label: "Stratifié", icon: "🎨" }
    ],
    travaux: [
      { id: "depose", label: "Dépose" },
      { id: "pose", label: "Pose" },
      { id: "finitions", label: "Finitions" },
      { id: "quincaillerie", label: "Quincaillerie" }
    ]
  },
  Peintre: {
    equipements: [
      { id: "murs", label: "Murs", icon: "🎨" },
      { id: "plafond", label: "Plafond", icon: "⬜" },
      { id: "boiseries", label: "Boiseries", icon: "🪵" },
      { id: "sous-couche", label: "Sous-couche", icon: "🧴" }
    ],
    styles: [
      { id: "mat", label: "Mat", icon: "🎨" },
      { id: "satine", label: "Satiné", icon: "🎨" },
      { id: "brillant", label: "Brillant", icon: "🎨" }
    ],
    travaux: [
      { id: "preparation", label: "Préparation des murs" },
      { id: "rebouchage", label: "Rebouchage" },
      { id: "sous-couche", label: "Sous-couche" },
      { id: "finition", label: "Finition" }
    ]
  },
  "Tout corps d'état": {
    equipements: [
      { id: "cuisine", label: "Cuisine équipée", icon: "🍳" },
      { id: "salle-de-bain", label: "Salle de bain complète", icon: "🛁" },
      { id: "revetements", label: "Revêtements sols", icon: "🪵" },
      { id: "peinture", label: "Peinture générale", icon: "🎨" },
      { id: "electricite", label: "Électricité générale", icon: "⚡" },
      { id: "plomberie", label: "Plomberie générale", icon: "🚿" }
    ],
    styles: [
      { id: "moderne", label: "Moderne", icon: "🎨" },
      { id: "classique", label: "Classique", icon: "🎨" },
      { id: "naturel", label: "Naturel", icon: "🎨" },
      { id: "industriel", label: "Industriel", icon: "🎨" }
    ],
    travaux: [
      { id: "demolition", label: "Démolition" },
      { id: "gros-oeuvre", label: "Gros œuvre" },
      { id: "second-oeuvre", label: "Second œuvre" },
      { id: "finitions", label: "Finitions" }
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
