// Recherche par mots-cles (pas de sous-chaine exacte) pour retrouver un
// ouvrage/une fourniture a partir d'une phrase libre ("installer 6 metres
// de goulotte electrique pour faire passer des cables"). Avant ce fichier
// (23 oct), chaque appelant faisait `label.toLowerCase().includes(needle)` :
// la designation du catalogue devait contenir la phrase recherchee MOT POUR
// MOT, DANS LE MEME ORDRE — un test reel (Amira) a montre que ça ne trouve
// quasiment jamais rien des que l'utilisateur ne recopie pas la designation
// catalogue a l'identique (ex: ELC-GOUL-01 "Pose goulotte PVC standard
// (60×40 ou 90×55) — câble apparent" jamais trouve pour "Installer 6 metres
// de goulotte electrique apparente pour faire passer des cables").
//
// Principe : on compte combien des MOTS SIGNIFICATIFS de la designation du
// catalogue se retrouvent (meme au singulier/pluriel ou genre proche, via
// un prefixe commun) dans la phrase recherchee — pas l'inverse, pour que la
// longueur de la phrase de l'utilisateur n'penalise jamais le score. On
// exige au moins 2 mots retrouves (ou 1 si la designation catalogue est
// elle-meme tres courte) avant d'accepter une correspondance : un seul mot
// generique en commun (ex: juste "douche") ne suffit jamais a lui seul,
// pour eviter un faux positif qui attacherait un prix a la mauvaise ligne
// (regle "jamais de prix invente").
//
// Limite connue, acceptee : un vrai synonyme metier non lie par un prefixe
// commun (ex: "dechets" vs "gravats") ne sera pas trouve — seul un petit
// lexique verbal pose/depose est traite ci-dessous, car confondre une pose
// avec une depose serait pire qu'un faux negatif (deux actions opposees).

const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "un", "une", "et", "ou", "pour", "avec",
  "sur", "dans", "par", "au", "aux", "a", "en", "d", "l", "ce", "cette", "ces",
  "son", "sa", "ses", "depuis", "faire", "afin", "que", "qui", "ne", "pas",
  "plus", "tout", "toute", "tous", "toutes"
]);

// Pose et depose sont deux actions OPPOSEES dans le batiment : les
// confondre via un simple mot en commun ("douche", "receveur"...) serait
// plus grave qu'un faux negatif — normalise donc leurs variantes courantes
// vers un seul mot-cle canonique avant de comparer.
const SYNONYMS = {
  installer: "pose", installation: "pose", poser: "pose", montage: "pose", monter: "pose",
  demonter: "depose", demontage: "depose", retirer: "depose", retrait: "depose",
  enlever: "depose", enlevement: "depose", demolir: "depose", demolition: "depose"
};

function stripAccents(value) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function tokenize(text) {
  return stripAccents(String(text || "").toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && !STOPWORDS.has(t))
    .map((t) => SYNONYMS[t] || t);
}

// Prefixe commun (longueur >= 4) pour absorber singulier/pluriel et les
// variations de genre courantes (câble/câbles, apparent/apparente...) sans
// vrai lexique de flexion.
function tokensMatch(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.startsWith(b) || b.startsWith(a);
}

function scoreAgainst(labelTokens, needleTokens) {
  if (!labelTokens.length) return { count: 0, ratio: 0, total: 0 };
  const matched = labelTokens.filter((lt) => needleTokens.some((nt) => tokensMatch(lt, nt)));
  return { count: matched.length, ratio: matched.length / labelTokens.length, total: labelTokens.length };
}

function isAccepted(score) {
  return score.count >= 2 || (score.count >= 1 && score.total <= 2);
}

// Meilleure correspondance unique dans `candidates` pour la phrase `query`
// — `getLabel(candidate)` renvoie le texte de designation a comparer.
// Renvoie `null` si rien n'atteint le seuil d'acceptation (a traiter comme
// "aucune correspondance", jamais une approximation risquee).
export function bestCatalogMatch(candidates, query, getLabel) {
  const needleTokens = tokenize(query);
  if (!needleTokens.length) return null;
  let best = null;
  let bestScore = null;
  for (const candidate of candidates) {
    const labelTokens = [...new Set(tokenize(getLabel(candidate)))];
    const score = scoreAgainst(labelTokens, needleTokens);
    if (!bestScore || score.count > bestScore.count || (score.count === bestScore.count && score.ratio > bestScore.ratio)) {
      best = candidate;
      bestScore = score;
    }
  }
  if (!best || !isAccepted(bestScore)) return null;
  return best;
}

// Variante liste (jusqu'a `limit` candidats classes par pertinence) pour un
// usage de type "pistes a explorer" plutot qu'"une seule correspondance a
// utiliser" — meme seuil d'acceptation, pour ne pas renvoyer un resultat
// sans aucun rapport avec la recherche.
export function topCatalogMatches(candidates, query, getLabel, limit = 8) {
  const needleTokens = tokenize(query);
  if (!needleTokens.length) return [];
  const scored = candidates
    .map((candidate) => {
      const labelTokens = [...new Set(tokenize(getLabel(candidate)))];
      return { candidate, score: scoreAgainst(labelTokens, needleTokens) };
    })
    .filter((entry) => isAccepted(entry.score))
    .sort((a, b) => b.score.count - a.score.count || b.score.ratio - a.score.ratio);
  return scored.slice(0, limit).map((entry) => entry.candidate);
}
