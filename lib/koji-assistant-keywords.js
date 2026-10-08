// Phase 1 "algorithme" de l'assistant koji pro (8 oct) — meme philosophie que
// l'assistant Radar des Chantiers (app/api/radar-assistant/route.js) :
// un dictionnaire de mots-cles tente d'abord de reconnaitre l'action et le
// type demandes, SANS appel IA. L'IA n'est appelee que quand ce dictionnaire
// ne peut pas trancher avec confiance — jamais l'inverse. Reste volontairement
// prudent : en cas de doute (plusieurs types/actions possibles, message trop
// court ou absence totale de correspondance), la fonction renvoie null et le
// code appelant retombe sur la classification IA complete existante — jamais
// de supposition silencieuse.

const ACTION_VERBS = {
  navigate: [/\bouvre?\b/i, /\bva\s+sur\b/i, /\bmontre[- ]?moi\b/i, /\baffiche\b/i, /\bemm[eè]ne[- ]?moi\b/i],
  delete: [/\bsupprim(e|er|ez)\b/i, /\beffac(e|er|ez)\b/i, /\bannul(e|er|ez)\b/i, /\bretir(e|er|ez)\b/i],
  update: [/\bmodifi(e|er|ez)\b/i, /\bchang(e|er|ez)\b/i, /\bcorrig(e|er|ez)\b/i, /\bmets?\s+[àa]\s+jour\b/i, /\bmaj\b/i],
  create: [/\bcr[ée]e?r?\b/i, /\bajout(e|er|ez)\b/i, /\bnouvel?le?\b/i, /\bprogramm(e|er|ez)\b/i, /\bplanifi(e|er|ez)\b/i, /\bsaisi(s|r)\b/i]
};

// Un seul mot-cle par type suffit a le reconnaitre, mais jamais un mot trop
// generique qui risquerait de matcher un AUTRE type en meme temps (ex: pas
// "client" seul pour "contact", puisque "client" apparait aussi dans une
// phrase de devis — l'ambiguite doit rester ambigue, pas tranchee au hasard).
const TYPE_KEYWORDS = {
  rdv: [/\brdv\b/i, /rendez[- ]vous/i],
  visite: [/\bvisite\b/i, /compte[- ]rendu/i],
  depense: [/\bd[ée]pense\b/i, /\bticket\s+de\s+caisse\b/i, /\bre[çc]u\b/i],
  facture: [/\bfacture\b/i],
  fourniture: [/\bfourniture\b/i],
  alerte: [/\balerte\b/i, /\burgence\b/i, /\bincident\b/i, /\bd[ée]g[aâ]t\b/i, /\bincendie\b/i],
  devis: [/\bdevis\b/i],
  tache: [/\bt[aâ]che\b/i],
  equipe: [/\b[ée]quipier\b/i, /\bouvrier\b/i, /\bsalari[ée]\b/i],
  contact: [/\bcontact\b/i],
  chantier: [/\bchantier\b/i],
  fournisseur: [/\bfournisseur\b/i],
  ouvrage: [/\bouvrage\b/i],
  avenant: [/\bavenant\b/i]
};

const PAGE_ALIASES = {
  accueil: [/tableau de bord/i, /\baccueil\b/i],
  calendrier: [/calendrier/i, /\bagenda\b/i],
  chantiers: [/\bchantiers\b/i],
  devis: [/\bdevis\b/i],
  facturation: [/facturation/i, /\bfactures\b/i],
  fournitures: [/fournitures/i],
  equipe: [/[ée]quipe/i],
  contacts: [/\bcontacts\b/i],
  ouvrages: [/biblioth[eè]que/i, /\bouvrages\b/i],
  archives: [/\barchives\b/i],
  marketplace: [/marketplace/i],
  chiffreAffaires: [/chiffre d.affaires/i],
  notifications: [/notifications/i],
  profil: [/\bprofil\b/i],
  parametres: [/param[eè]tres/i]
};

function matchKeys(text, dict) {
  return Object.keys(dict).filter((key) => dict[key].some((re) => re.test(text)));
}

// Resultat possible :
// - { action: "navigate", pageKey }
// - { action: "ambiguous", type }
// - { action: "delete" | "create" | "update", type }
// - null (aucune confiance suffisante — l'appelant doit repasser par l'IA)
export function algorithmicClassify(message) {
  const text = String(message || "").trim();
  if (!text) return null;

  const navigateVerb = ACTION_VERBS.navigate.some((re) => re.test(text));
  if (navigateVerb) {
    const pages = matchKeys(text, PAGE_ALIASES);
    if (pages.length === 1) return { action: "navigate", pageKey: pages[0] };
    return null;
  }

  const actionMatches = ["delete", "update", "create"].filter((a) => ACTION_VERBS[a].some((re) => re.test(text)));
  const typeMatches = matchKeys(text, TYPE_KEYWORDS);

  // Message tres court compose uniquement d'un type, sans verbe d'action
  // (ex: "devis", "une facture") — meme traitement que le mode texte libre
  // actuel : "ambiguous", on propose les actions possibles pour ce type.
  if (actionMatches.length === 0 && typeMatches.length === 1 && text.split(/\s+/).length <= 4) {
    return { action: "ambiguous", type: typeMatches[0] };
  }

  if (actionMatches.length === 1 && typeMatches.length === 1) {
    return { action: actionMatches[0], type: typeMatches[0] };
  }

  return null;
}

// Construit un indice de recherche grossier pour une suppression reconnue
// par l'algorithme (sans IA) : retire les mots-cles d'action/type reconnus,
// garde le reste du message tel quel — resolveByHint fait ensuite le travail
// de correspondance reel par sous-chaine, cote deterministe, comme pour une
// suppression classifiee par l'IA.
export function buildSearchHintFromMessage(message, type) {
  let text = String(message || "");
  for (const re of ACTION_VERBS.delete) text = text.replace(re, " ");
  for (const re of TYPE_KEYWORDS[type] || []) text = text.replace(re, " ");
  return text.replace(/\s+/g, " ").trim();
}
