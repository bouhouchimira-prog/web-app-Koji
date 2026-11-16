// Mode visite (maquette PRO-03.8) : ce que Koji prépare avant la visite,
// comprend pendant, calcule et propose à la fin. Aucune IA ici, des règles
// fixes et testées ; mêmes règles dans l'app Koji Pro
// (mobile/lib/apps/entreprise/visite/visite_mode.dart, mêmes exemples dans
// les tests). Aucun prix : les prix viennent de la bibliothèque, dans le
// Devis guidé.
import { estOuvre } from "./planning-chantier.js";

const sansAccents = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'");

// Points « À vérifier sur place », tirés de la demande et des lots prévus.
// Une question à la fois pendant la visite, avec des réponses en un geste.
const PIECE_EAU = /douche|baignoire|\bwc\b|toilette|lavabo|vasque|evier|receveur|plomberie|salle de bain|salle d'eau|cuisine/;
const POINTS = [
  { id: "evacuations", libelle: "Évacuations : diamètre et pente", court: "Évacuations", si: PIECE_EAU,
    question: "Évacuations : quel diamètre ?", choix: ["Ø 32", "Ø 40", "Ø 100 (WC)", "Je ne sais pas"] },
  { id: "arrivees", libelle: "Arrivées d'eau et robinet d'arrêt", court: "Arrivées d'eau", si: PIECE_EAU,
    question: "Arrivées d'eau : en quoi ?", choix: ["Cuivre", "PER", "Multicouche", "Je ne sais pas"] },
  { id: "support", libelle: "Support des murs", court: "Support des murs", si: /faience|carrel|peint|peind|enduit|platre|cloison|\bmurs?\b/,
    question: "Support des murs : quel état ?", choix: ["Plâtre sain", "À reprendre", "Carreaux de plâtre", "Je ne sais pas"] },
  { id: "sol", libelle: "Planéité et nature du sol", court: "Sol", si: /parquet|\bsols?\b|ragreage|chape|stratifie/,
    question: "Sol existant : quel état ?", choix: ["Plan, sain", "À ragréer", "Je ne sais pas"] },
  { id: "electricite", libelle: "Différentiel 30 mA au tableau", court: "Électricité", si: /electri|prise|eclairage|luminaire|tableau|radiateur|chauffe|douche|baignoire|salle de bain|salle d'eau|cuisine/,
    question: "Y a-t-il un différentiel 30 mA au tableau ?", choix: ["Oui", "Non", "Je ne sais pas"] },
  { id: "chauffage", libelle: "Chauffage existant", court: "Chauffage", si: /chauffage|chaudiere|pompe a chaleur|\bpac\b/,
    question: "Chauffage existant ?", choix: ["Gaz", "Électrique", "Pompe à chaleur", "Je ne sais pas"] },
  { id: "menuiseries", libelle: "Dimensions des tableaux et état des appuis", court: "Menuiseries", si: /fenetre|menuiser|volet|baie|porte-fenetre/,
    question: "Appuis de fenêtre : quel état ?", choix: ["Sains", "À reprendre", "Je ne sais pas"] },
  { id: "toiture", libelle: "Accès au toit et état de la charpente", court: "Toiture", si: /toit|toiture|couverture|tuile|gouttiere|charpente/,
    question: "Accès au toit ?", choix: ["Échelle", "Échafaudage nécessaire", "Je ne sais pas"] },
  { id: "acces", libelle: "Accès, stockage et évacuation des gravats", court: "Accès et gravats", toujours: true,
    question: "Accès au chantier ?", choix: ["Ascenseur", "Escalier seulement", "Plain-pied"] },
  { id: "ventilation", libelle: "Ventilation existante", court: "Ventilation", si: /douche|baignoire|salle de bain|salle d'eau|\bwc\b|toilette|cuisine/,
    question: "Ventilation : y a-t-il une VMC ?", choix: ["Oui", "Non, fenêtre seulement", "Je ne sais pas"] }
];

export function listeAVerifier(demande, lots = []) {
  const texte = sansAccents([demande, ...lots].join(" "));
  const faience = /faience/.test(texte);
  return POINTS.filter((p) => p.toujours || p.si.test(texte)).map((p) => ({
    id: p.id,
    libelle: p.id === "support" && faience ? "Support des murs, faïence à déposer" : p.libelle,
    court: p.court,
    question: p.question,
    choix: [...p.choix],
    reponse: "",
    detail: ""
  }));
}

// Prochaine question de Koji : le premier point sans réponse.
export function prochaineQuestion(points) {
  return (points || []).find((p) => !p.reponse) || null;
}

const inconnu = (r) => !r || /je ne sais pas/i.test(r);

// Ce que la réponse dit, en clair (résumé envoyé au client).
export function constat(point) {
  const r = String(point?.reponse || "");
  if (inconnu(r)) return "";
  const n = sansAccents(r);
  switch (point.id) {
    case "ventilation": return n.startsWith("non") ? "pas de VMC" : "VMC présente";
    case "electricite": return n.startsWith("non") ? "pas de différentiel 30 mA" : "différentiel 30 mA présent";
    case "evacuations": return `évacuation ${r}`;
    case "arrivees": return `arrivées d'eau en ${r.toLowerCase()}`;
    case "support": return n.includes("reprendre") ? "murs à reprendre" : n.includes("carreaux") ? "murs en carreaux de plâtre" : "murs sains";
    case "sol": return n.includes("ragreer") ? "sol à ragréer" : "sol sain";
    case "acces": return n.includes("escalier") ? "accès par l'escalier" : n.includes("ascenseur") ? "accès par ascenseur" : "accès de plain-pied";
    case "chauffage": return `chauffage ${r.toLowerCase()}`;
    case "menuiseries": return n.includes("reprendre") ? "appuis à reprendre" : "appuis sains";
    case "toiture": return n.includes("echafaudage") ? "échafaudage nécessaire" : "toit accessible à l'échelle";
    default: return r;
  }
}

// Une vérification qui change le devis donne une proposition, acceptée ou
// non par l'entrepreneur.
export function propositions(points, piece = "") {
  const ici = piece ? `dans la ${piece.toLowerCase()}` : "dans la pièce";
  const out = [];
  for (const p of points || []) {
    const n = sansAccents(p.reponse);
    if (p.id === "ventilation" && n.startsWith("non")) {
      out.push({ id: "extracteur", pointId: p.id, court: "extracteur", option: true, ligne: "Fourniture et pose d'un extracteur d'air",
        texte: `Pas de VMC : Koji propose un extracteur d'air ${ici}, en option sur le devis. Une photo de la fenêtre suffit.` });
    }
    if (p.id === "electricite" && n.startsWith("non")) {
      out.push({ id: "differentiel", pointId: p.id, court: "différentiel 30 mA", option: false, ligne: "Fourniture et pose d'un interrupteur différentiel 30 mA",
        texte: "Pas de différentiel 30 mA : Koji propose de l'ajouter au tableau, obligatoire pour une pièce d'eau." });
    }
    if (p.id === "acces" && n.includes("escalier")) {
      out.push({ id: "gravats", pointId: p.id, court: "évacuation des gravats", option: false, ligne: "Évacuation des gravats par l'escalier",
        texte: "Sans ascenseur : Koji propose une ligne pour descendre les gravats par l'escalier." });
    }
    if (p.id === "support" && n.includes("reprendre")) {
      out.push({ id: "reprise-murs", pointId: p.id, court: "reprise des murs", option: false, ligne: "Reprise des murs avant la pose",
        texte: "Murs à reprendre : Koji propose une ligne de reprise avant la pose." });
    }
  }
  return out;
}

// ── Cotes dictées ────────────────────────────────────────────────────────
const MOTS = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30,
  quarante: 40, cinquante: 50, soixante: 60, cent: 100, cents: 100
};
const METRE = /^(m|metres?|metre)$/;
const CENTI = /^(cm|centimetres?)$/;

// Les nombres d'une phrase, avec l'unité qui suit : « deux mètres quarante »
// → [2 m, 40]. « deux quarante » → [2, 40] (un chiffre seul suivi d'une
// dizaine commence un nouveau nombre).
function groupes(mots) {
  const out = [];
  let courant = null;
  const fermer = () => {
    if (courant) out.push(courant);
    courant = null;
  };
  for (const m of mots) {
    if (m === "et" && courant && !courant.decimal) continue;
    if (/^\d+([.,]\d+)?$/.test(m)) {
      fermer();
      courant = { valeur: Number(m.replace(",", ".")), decimal: /[.,]/.test(m), unite: "" };
      fermer();
      continue;
    }
    if (METRE.test(m) || CENTI.test(m)) {
      const dernier = courant || out[out.length - 1];
      fermer();
      if (dernier) dernier.unite = METRE.test(m) ? "m" : "cm";
      continue;
    }
    const v = MOTS[m];
    if (v === undefined) {
      fermer();
      continue;
    }
    if (!courant) {
      courant = { valeur: v, decimal: false, unite: "" };
    } else if (v === 100) {
      courant.valeur = (courant.valeur || 1) * 100;
    } else if (v === 20 && courant.valeur % 100 === 4) {
      courant.valeur += 76; // quatre-vingt
    } else if (courant.valeur > 0 && courant.valeur < 10 && v >= 10) {
      fermer();
      courant = { valeur: v, decimal: false, unite: "" };
    } else {
      courant.valeur += v;
    }
  }
  fermer();
  return out;
}

// Une dimension en mètres à partir des nombres entendus.
function enMetres(g) {
  if (!g.length) return null;
  const [a, b] = g;
  if (b && !b.unite && b.valeur < 100 && (a.unite === "m" || (!a.unite && !a.decimal && a.valeur < 10))) {
    return Math.round((a.valeur + b.valeur / 100) * 100) / 100;
  }
  if (a.unite === "cm") return a.valeur / 100;
  if (a.unite === "m" || a.decimal) return a.valeur;
  return a.valeur >= 10 ? a.valeur / 100 : a.valeur;
}

const premiereLettre = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);

// « Mur du fond deux mètres quarante » → { libelle: "Mur du fond",
// valeur: 2.4 }. « Porte quatre-vingt-trois par deux cent quatre » →
// { libelle: "Porte", largeur: 0.83, hauteur: 2.04 }. null si aucun nombre.
export function comprendreCote(texte) {
  const brut = String(texte || "").trim();
  const mots = sansAccents(brut)
    .replace(/(^|\s|\d)[×x*](?=\s|\d|$)/g, "$1 par ")
    .replace(/(\d)\s*(cm|m)(?=\d|\s|$)/g, "$1 $2 ")
    .replace(/[-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const premier = mots.findIndex((m) => /^\d/.test(m) || (MOTS[m] !== undefined && m !== "une"));
  if (premier < 0) return null;
  // Le libellé garde les mots dits avant le premier nombre (accents compris).
  const motsBruts = brut.replace(/[-]/g, " ").split(/\s+/).filter(Boolean);
  const libelle = premiereLettre(motsBruts.slice(0, premier).join(" ").replace(/[«»"“”:]/g, "").trim());
  const reste = mots.slice(premier);
  const sep = reste.findIndex((m) => m === "par" || m === "sur");
  if (sep > 0) {
    const largeur = enMetres(groupes(reste.slice(0, sep)));
    const hauteur = enMetres(groupes(reste.slice(sep + 1)));
    if (largeur && hauteur) return { libelle, largeur, hauteur };
  }
  const valeur = enMetres(groupes(reste));
  return valeur ? { libelle, valeur } : null;
}

// ── Surfaces et quantités ────────────────────────────────────────────────
const arrondi = (n) => Math.round(n * 100) / 100;
export const nombre = (n) => arrondi(n).toFixed(2).replace(".", ",");
const role = (c) => {
  const l = sansAccents(c.libelle);
  if (l.startsWith("longueur")) return "longueur";
  if (l.startsWith("largeur")) return "largeur";
  if (l.startsWith("hauteur")) return "hauteur";
  if (l.startsWith("porte")) return "porte";
  if (l.startsWith("fenetre")) return "fenetre";
  return "";
};

export function surfaces(cotes) {
  const de = (r) => (cotes || []).filter((c) => role(c) === r);
  const L = de("longueur")[0]?.valeur;
  const l = de("largeur")[0]?.valeur;
  const H = de("hauteur")[0]?.valeur;
  const portes = de("porte").filter((c) => c.largeur && c.hauteur);
  const fenetres = de("fenetre").filter((c) => c.largeur && c.hauteur);
  const out = { portes, fenetres };
  if (L && l) {
    out.sol = arrondi(L * l);
    out.perimetre = arrondi(2 * (L + l));
    out.L = L;
    out.l = l;
    out.bande = arrondi(out.perimetre - portes.reduce((s, p) => s + p.largeur, 0));
    if (H) {
      out.H = H;
      out.murs = arrondi(2 * (L + l) * H - [...portes, ...fenetres].reduce((s, o) => s + o.largeur * o.hauteur, 0));
    }
  }
  return out;
}

// « sol 5,81 m² · murs 21,93 m² » (en-tête des cotes de la pièce).
export function resumeSurfaces(cotes) {
  const s = surfaces(cotes);
  return [s.sol != null ? `sol ${nombre(s.sol)} m²` : "", s.murs != null ? `murs ${nombre(s.murs)} m²` : ""].filter(Boolean).join(" · ");
}

// Quantités reprises dans le Devis guidé, avec leur formule, toujours
// modifiables là-bas (pertes et chutes : bibliothèque).
export function quantitesCalculees(piece, demande = "") {
  const s = surfaces(piece?.cotes);
  const t = sansAccents(demande);
  const reponseSupport = sansAccents((piece?.points || []).find((p) => p.id === "support")?.reponse);
  const out = [];
  if (s.sol != null) {
    out.push({ id: "sol", libelle: /carrel|italienne|\bsols?\b|douche/.test(t) ? "Sol à carreler" : /parquet|stratifie/.test(t) ? "Sol, parquet" : "Surface au sol",
      formule: `${nombre(s.L)} × ${nombre(s.l)}`, valeur: s.sol, unite: "m²" });
  }
  if (s.murs != null) {
    const moins = [...s.portes.map(() => "porte"), ...s.fenetres.map(() => "fenêtre")].map((o) => ` − ${o}`).join("");
    const libelle = /faience/.test(t) ? (/toute hauteur/.test(t) ? "Faïence toute hauteur" : "Faïence murale") : /peint|peind/.test(t) ? "Murs à peindre" : "Surface des murs";
    out.push({ id: "murs", libelle, formule: `périmètre ${nombre(s.perimetre)} × ${nombre(s.H)}${moins}`, valeur: s.murs, unite: "m²" });
  }
  if (s.bande != null && /douche|italienne|baignoire|receveur/.test(t)) {
    out.push({ id: "bande", libelle: "Bande d'angle d'étanchéité", formule: s.portes.length ? "périmètre − porte" : "périmètre", valeur: s.bande, unite: "ml" });
  }
  if (s.murs != null && /faience/.test(t) && (/depos|a la place|remplac|refaire/.test(t) || reponseSupport.includes("depos"))) {
    out.push({ id: "depose", libelle: "Dépose faïence existante", formule: "même surface", valeur: s.murs, unite: "m²" });
  }
  if (s.bande != null && /parquet|plinthe|stratifie/.test(t)) {
    out.push({ id: "plinthes", libelle: "Plinthes", formule: s.portes.length ? "périmètre − porte" : "périmètre", valeur: s.bande, unite: "ml" });
  }
  if (s.sol != null && /plafond/.test(t)) {
    out.push({ id: "plafond", libelle: "Plafond", formule: "même surface que le sol", valeur: s.sol, unite: "m²" });
  }
  return out;
}

// « 2,40 m » ou « 0,83 × 2,04 m ».
export function texteCote(c) {
  if (c?.largeur && c?.hauteur) return `${nombre(c.largeur)} × ${nombre(c.hauteur)} m`;
  return c?.valeur != null ? `${nombre(c.valeur)} m` : "";
}

// ── Fin de visite ────────────────────────────────────────────────────────
const JOUR = 86400000;
const plus = (jour, n) => new Date(new Date(`${jour}T12:00:00Z`).getTime() + n * JOUR).toISOString().slice(0, 10);
const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const jourDe = (j) => new Date(`${j}T12:00:00Z`);

function ouvreApres(jour, n) {
  let j = jour;
  let reste = n;
  while (reste > 0) {
    j = plus(j, 1);
    if (estOuvre(j)) reste -= 1;
  }
  return j;
}

// Devis promis pour : le jour ouvré suivant la visite, ou deux jours ouvrés
// plus tard (« Lundi 26 oct. », « Mercredi 28 »).
export function datesPromises(jourVisite) {
  const d1 = ouvreApres(jourVisite, 1);
  const d2 = ouvreApres(d1, 2);
  const a = jourDe(d1);
  const b = jourDe(d2);
  return [
    { jour: d1, label: `${JOURS[a.getUTCDay()]} ${a.getUTCDate()} ${MOIS[a.getUTCMonth()]}` },
    { jour: d2, label: `${JOURS[b.getUTCDay()]} ${b.getUTCDate()}${b.getUTCMonth() === a.getUTCMonth() ? "" : ` ${MOIS[b.getUTCMonth()]}`}` }
  ];
}

// Rappel dans les tâches : la veille au soir.
export function veille(jour) {
  return plus(jour, -1);
}

export function jourLong(jour) {
  const d = jourDe(jour);
  return `${JOURS[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}

// Le résumé envoyé au client : information, jamais de prix.
export function resumeClient(visite, jourPromis = "") {
  const points = (visite?.pieces || []).flatMap((p) => p.points || []);
  const decisions = visite?.propositions || {};
  const props = (visite?.pieces || []).flatMap((p) => propositions(p.points, p.nom));
  const vus = [];
  for (const pt of points) {
    const c = constat(pt);
    if (!c) continue;
    const prop = props.find((x) => x.pointId === pt.id && decisions[x.id] === "acceptee");
    vus.push(prop ? `${c} (${prop.court} proposé${prop.option ? " en option" : ""})` : c);
  }
  const bonjour = visite?.client ? `Bonjour ${visite.client},` : "Bonjour,";
  const quand = jourPromis ? ` d'ici ${JOURS[jourDe(jourPromis).getUTCDay()].toLowerCase()}` : " très vite";
  return [
    bonjour,
    "",
    `Merci pour la visite.${vus.length ? ` Points vus : ${[...new Set(vus)].join(", ")}.` : ""} Vous recevrez le devis${quand}.`
  ].join("\n");
}

// « 18 photos, 9 cotes, 6 vérifications, 2 notes ».
export function compteVisite(visite) {
  const pieces = visite?.pieces || [];
  const n = {
    photos: pieces.reduce((s, p) => s + (p.photos || []).length, 0),
    cotes: pieces.reduce((s, p) => s + (p.cotes || []).length, 0),
    verifications: pieces.reduce((s, p) => s + (p.points || []).filter((x) => x.reponse).length, 0),
    notes: pieces.reduce((s, p) => s + (p.notes || []).length, 0)
  };
  const mot = (k, un, plusieurs) => `${n[k]} ${n[k] > 1 ? plusieurs : un}`;
  return { ...n, texte: [mot("photos", "photo", "photos"), mot("cotes", "cote", "cotes"), mot("verifications", "vérification", "vérifications"), mot("notes", "note", "notes")].join(", ") };
}

export function dureeVisite(debut, fin) {
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

// Ce que Koji reçoit pour préparer le Devis guidé.
export function demandeDevisGuide(visite) {
  const lignes = [`Compte rendu de visite${visite?.client ? ` chez ${visite.client}` : ""}${visite?.adresse ? ` (${visite.adresse})` : ""}.`];
  if (visite?.demande) lignes.push(`Demande du client : ${visite.demande}`);
  const decisions = visite?.propositions || {};
  for (const p of visite?.pieces || []) {
    lignes.push(`${p.nom} :`);
    const q = quantitesCalculees(p, visite?.demande);
    if (q.length) lignes.push(`- Quantités : ${q.map((x) => `${x.libelle} ${nombre(x.valeur)} ${x.unite}`).join(" ; ")}.`);
    if ((p.cotes || []).length) lignes.push(`- Cotes : ${p.cotes.map((c) => `${c.libelle} ${texteCote(c)}`).join(" ; ")}.`);
    const verifs = (p.points || []).filter((x) => x.reponse).map((x) => `${x.court} : ${[x.reponse, x.detail].filter(Boolean).join(", ")}`);
    if (verifs.length) lignes.push(`- Vérifications : ${verifs.join(" ; ")}.`);
    const acceptees = propositions(p.points, p.nom).filter((x) => decisions[x.id] === "acceptee");
    if (acceptees.length) lignes.push(`- À ajouter : ${acceptees.map((x) => `${x.ligne}${x.option ? " (en option)" : ""}`).join(" ; ")}.`);
    if ((p.notes || []).length) lignes.push(`- Notes : ${p.notes.map((n) => `« ${n.texte} »`).join(" ")}`);
  }
  lignes.push("Prépare le devis avec ces quantités et les prix de ma bibliothèque ; pose-moi les questions qui restent.");
  return lignes.join("\n");
}

// Questions restantes : points sans réponse ou « Je ne sais pas ».
export function questionsRestantes(visite) {
  return (visite?.pieces || []).flatMap((p) => p.points || []).filter((x) => inconnu(x.reponse)).length;
}

// Éléments pas encore envoyés à Koji (bandeau hors ligne).
export function enAttente(visite) {
  const pieces = visite?.pieces || [];
  return pieces.reduce((s, p) => s
    + (p.photos || []).filter((x) => !x.envoye).length
    + (p.cotes || []).filter((x) => !x.envoye).length
    + (p.notes || []).filter((x) => !x.envoye).length
    + (p.points || []).filter((x) => x.reponse && !x.envoye).length, 0);
}
