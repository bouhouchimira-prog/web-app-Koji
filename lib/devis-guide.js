// Devis guidé (maquette PRO-03.1) : règles partagées par le chat du site
// (components/DevisChatPanel.jsx), la route /api/devis-chat et l'app Koji
// Pro (mobile/lib/apps/entreprise/devis/devis_guide.dart, mêmes exemples
// dans les tests). Rien ici ne touche au prix : Koji ne fait que poser les
// questions oubliées (oui / non en un clic) et dire ce qu'il est en train
// d'ajouter.

export const QUESTIONS_MAX = 3;
const QUESTION_LONGUEUR_MAX = 140;

function propre(texte) {
  return String(texte ?? "").replace(/\s+/g, " ").trim();
}

// Questions oui / non proposées par Koji : texte propre, terminé par « ? »,
// sans doublon, trois au plus (au-delà, l'écran devient une liste à cocher).
export function questionsOuiNon(brutes) {
  const vues = new Set();
  const questions = [];
  for (const brute of Array.isArray(brutes) ? brutes : []) {
    let q = propre(brute).slice(0, QUESTION_LONGUEUR_MAX);
    if (!q) continue;
    if (!q.endsWith("?")) q = `${q.replace(/[.!:;,\s]+$/, "")} ?`;
    const cle = q.toLowerCase();
    if (vues.has(cle)) continue;
    vues.add(cle);
    questions.push(q);
    if (questions.length === QUESTIONS_MAX) break;
  }
  return questions;
}

// Ce que Koji a demandé, tel qu'il le relit au tour suivant (l'historique
// envoyé au modèle ne contient que du texte).
export function texteQuestions(questions) {
  const liste = questionsOuiNon(questions);
  if (!liste.length) return "";
  return `Questions posées (oui / non) :\n${liste.map((q) => `- ${q}`).join("\n")}`;
}

// Réponses données d'un clic : une ligne par question, « Oui » ou « Non ».
export function texteReponses(questions, reponses) {
  return questionsOuiNon(questions)
    .map((q, i) => (reponses?.[i] === true ? `${q} Oui` : reponses?.[i] === false ? `${q} Non` : null))
    .filter(Boolean)
    .join("\n");
}

export function toutesRepondues(questions, reponses) {
  const liste = questionsOuiNon(questions);
  return liste.length > 0 && liste.every((_, i) => reponses?.[i] === true || reponses?.[i] === false);
}

function nombre(n) {
  return Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function lotDe(lots, nom) {
  const lot = (Array.isArray(lots) ? lots : []).find((l) => propre(l?.nom).toLowerCase() === propre(nom).toLowerCase());
  return lot?.code ? lot.code.replace(/^Lot /, "lot ") : nom ? `lot « ${propre(nom)} »` : "";
}

function libelleOuvrage(action) {
  return propre(action?.ouvrage?.label).replace(/^À chiffrer manuellement\s*—\s*/, "");
}

function ligneDe(lots, id) {
  for (const lot of Array.isArray(lots) ? lots : []) {
    const ligne = (lot.lignes || []).find((l) => l.id === id);
    if (ligne) return { ...ligne, lot: lot.nom };
  }
  return null;
}

// « Koji travaille » : ce que Koji est en train de faire, pour la ligne du
// chat et le bandeau du téléphone ({ lab: « Koji ajoute · lot 01 »,
// texte: « Ragréer le sol, 5,8 m² » }). null quand l'action ne se montre pas.
export function koji(action, lots) {
  if (!action) return null;
  if (action.subAction === "addOuvrage") {
    const lot = lotDe(lots, action.room);
    const libelle = libelleOuvrage(action);
    return {
      phrase: `Koji ajoute « ${libelle} »${lot ? ` au ${lot}` : ""}…`,
      lab: `Koji ajoute${lot ? ` · ${lot}` : ""}`,
      texte: action.quantity ? `${libelle}, ${nombre(action.quantity)} ${action.ouvrage?.unit || ""}`.trim() : libelle
    };
  }
  if (action.subAction === "addLot") {
    return { phrase: `Koji crée le lot « ${propre(action.lotName)} »…`, lab: "Koji crée un lot", texte: propre(action.lotName) };
  }
  if (action.subAction === "updateOuvrage") {
    const ligne = ligneDe(lots, action.id);
    const libelle = ligne?.designation || "la ligne";
    return { phrase: `Koji corrige « ${libelle} »…`, lab: `Koji corrige${ligne ? ` · ${lotDe(lots, ligne.lot)}` : ""}`, texte: libelle };
  }
  if (action.subAction === "removeOuvrage") {
    const ligne = ligneDe(lots, action.id);
    const libelle = ligne?.designation || "la ligne";
    return { phrase: `Koji retire « ${libelle} »…`, lab: "Koji retire", texte: libelle };
  }
  if (action.subAction === "setManualPrice") {
    return { phrase: "Koji reporte ton prix sur la ligne…", lab: "Koji reporte ton prix", texte: `${nombre(action.amountHt)} € HT` };
  }
  if (action.subAction === "setClientInfo") {
    const nom = propre(action.client?.nom);
    return { phrase: "Koji renseigne le client…", lab: "Koji renseigne le client", texte: nom || "Client et chantier" };
  }
  return null;
}

// Premier message de Koji, écrit sans IA : un devis vide demande une
// description ; un devis déjà rempli est résumé (« J'ai repris le devis de
// Mme Lefèvre : dépose et préparation, plomberie… »).
export function premierMessage(snapshot) {
  const lots = (Array.isArray(snapshot?.lots) ? snapshot.lots : []).filter((lot) => (lot.lignes || []).length > 0);
  if (!lots.length) return "Bonjour, décris-moi le chantier en quelques mots. Je prépare le devis pendant que tu parles.";
  const client = propre(snapshot?.client?.nom);
  const noms = lots.map((lot) => propre(lot.nom).toLowerCase());
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}` : noms[0];
  const lignes = lots.reduce((n, lot) => n + lot.lignes.length, 0);
  return `J'ai repris le devis${client ? ` de ${client}` : ""} : ${liste}, ${lignes} ligne${lignes > 1 ? "s" : ""}. Dis-moi ce qui change, ajoute un ouvrage ou pose une question.`;
}

// Écart de total pendant que Koji travaille (bandeau : « + 203,00 »).
export function ecartTotal(avant, apres) {
  const d = Math.round((Number(apres || 0) - Number(avant || 0)) * 100) / 100;
  if (!d) return "";
  const s = Math.abs(d).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return d > 0 ? `+ ${s}` : `− ${s}`;
}
