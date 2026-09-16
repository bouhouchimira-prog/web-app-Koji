import {
  VISITE_METIERS,
  METRE_FIELDS_BY_METIER,
  ETAT_CONSTATE_OPTIONS,
  FINITION_DEMANDEE_OPTIONS,
  ACCES_OPTIONS,
  STATIONNEMENT_OPTIONS,
  timestampedAnswer
} from "./visite-tree";
import { buildItemsFromVisite } from "./visite-devis-shape";
import { mergedOuvrages } from "./ouvrages";
import { fixText } from "./text";
import { mapQuote, quoteToRow, nextQuoteNumberFor } from "./quote-mapping";
import { applyQuoteTotals } from "./quote-calculations";
import { buildWebUser } from "./user-profile";
import { euro } from "./koji-assistant-tools";

// Questionnaire "devis" de l'assistant koji (15 septembre) — reprend EXACTEMENT
// l'arbre de questions deja construit pour la visite guidee du parcours
// marketplace (lib/visite-tree.js, lib/visite-devis-shape.js), pose ici une
// question a la fois dans la barre de chat au lieu du wizard pas-a-pas de
// /marketplace/[id]/visite. Zero appel IA pour le chiffrage (comme la visite
// guidee) — seule la Phase 1 de app/api/koji-assistant/route.js (classification
// du tout premier message) utilise Claude, tout le reste de ce flux est
// deterministe.
const SKIP_WORDS = new Set(["passer", "aucune", "aucun", "non merci", "skip", "rien"]);

function isSkip(text) {
  const value = String(text || "").trim().toLowerCase();
  return !value || SKIP_WORDS.has(value);
}

function newPiece(nom) {
  return {
    nom: fixText(nom || "Pièce"),
    metier: null,
    metre: { fields: {} },
    etatConstate: null,
    finitionsDemandees: null,
    finitionsPrecision: null,
    acces: null,
    stationnement: null,
    remarques: null
  };
}

function metreFieldsFor(metier) {
  return METRE_FIELDS_BY_METIER[metier] || [];
}

function matchOption(text, options) {
  const needle = String(text || "").trim().toLowerCase();
  const exact = options.find((o) => o.toLowerCase() === needle);
  if (exact) return exact;
  const partial = options.find((o) => o.toLowerCase().includes(needle) || (needle && needle.includes(o.toLowerCase())));
  return partial || options[0];
}

function metreQuestionText(piece, fieldDef) {
  if (fieldDef.type === "oui_non") return `${fieldDef.label} dans "${piece.nom}" ?`;
  if (fieldDef.type === "compteur") return `Combien de ${fieldDef.label.toLowerCase()} au total dans "${piece.nom}" ?`;
  return `${fieldDef.label} de "${piece.nom}" (en ${fieldDef.unit}) ?`;
}

function ask(state, awaiting, questionText, quickReplies = []) {
  return { state: { ...state, awaiting }, question: questionText, quickReplies };
}

function computeNext(ctx, state) {
  if (state.finalize) return null;

  if (!state.clientName) return ask(state, "clientName", "Pour quel client souhaitez-vous ce devis ?");

  const piece = state.pieces[state.currentPieceIndex];
  if (!piece) {
    return ask(state, "pieceName", state.pieces.length === 0 ? "Quelle est la première pièce concernée ?" : "Quelle est cette nouvelle pièce ?");
  }
  if (!piece.metier) {
    return ask(state, "pieceMetier", `Quel type de travaux dans "${piece.nom}" ?`, VISITE_METIERS.map((m) => m.label));
  }
  const fields = metreFieldsFor(piece.metier);
  const nextField = fields.find((f) => !(f.key in (piece.metre.fields || {})));
  if (nextField) {
    return ask(state, `metre:${nextField.key}`, metreQuestionText(piece, nextField), nextField.type === "oui_non" ? ["Oui", "Non"] : []);
  }
  if (!piece.etatConstate) return ask(state, "support", `État des supports constaté dans "${piece.nom}" ?`, ETAT_CONSTATE_OPTIONS);
  if (!piece.finitionsDemandees) return ask(state, "finition", `Quel niveau de finition souhaité pour "${piece.nom}" ?`, FINITION_DEMANDEE_OPTIONS);
  if (piece.finitionsPrecision === null) {
    return ask(state, "finitionPrecision", `Une précision sur le matériel ou les finitions pour "${piece.nom}" ? (ou "passer")`);
  }
  if (!piece.acces) return ask(state, "acces", `Accès à "${piece.nom}" ?`, ACCES_OPTIONS);
  if (!piece.stationnement) return ask(state, "stationnement", `Stationnement à proximité de "${piece.nom}" ?`, STATIONNEMENT_OPTIONS);
  if (piece.remarques === null) return ask(state, "remarques", `Une remarque à ajouter sur "${piece.nom}" ? (ou "passer")`);

  // Plusieurs pieces citees d'un coup (ex: "Salon, Cuisine, WC") sont deja
  // toutes creees dans state.pieces des la reponse a "pieceName" — on les
  // enchaine une par une SANS reposer "une autre piece ?" entre elles ; cette
  // question n'arrive qu'une fois la liste initiale epuisee.
  if (state.currentPieceIndex + 1 < state.pieces.length) {
    state.currentPieceIndex += 1;
    return computeNext(ctx, state);
  }

  return ask(state, "anotherPiece", "Une autre pièce à ajouter à ce devis ?", ["Oui, ajouter une pièce", "Non, générer le devis"]);
}

function applyAnswer(state, answer) {
  const key = state.awaiting;
  state.awaiting = null;
  if (!key) return;
  const text = fixText(String(answer || ""));

  if (key === "clientName") { state.clientName = text || null; return; }
  if (key === "pieceName") {
    // Accepte aussi bien "Salon" qu'une liste "Salon, Cuisine, chambre 1" —
    // chaque nom separe par une virgule devient sa propre piece, enchainee
    // automatiquement (voir computeNext) plutot que fusionnee en une seule
    // piece au nom a rallonge.
    const names = text.split(",").map((n) => n.trim()).filter(Boolean);
    const newPieces = (names.length ? names : [text]).map((n) => newPiece(n));
    state.pieces.push(...newPieces);
    return;
  }

  const piece = state.pieces[state.currentPieceIndex];
  if (!piece) return;

  if (key === "pieceMetier") {
    const found = VISITE_METIERS.find((m) => m.label.toLowerCase() === text.toLowerCase())
      || VISITE_METIERS.find((m) => text.toLowerCase().includes(m.label.split(" ")[0].toLowerCase()));
    piece.metier = (found || VISITE_METIERS[0]).key;
    return;
  }
  if (key.startsWith("metre:")) {
    const fieldKey = key.slice("metre:".length);
    const fieldDef = metreFieldsFor(piece.metier).find((f) => f.key === fieldKey);
    if (!piece.metre.fields) piece.metre.fields = {};
    if (fieldDef?.type === "compteur") {
      piece.metre.fields[fieldKey] = timestampedAnswer({ points: Math.max(0, Math.round(Number(text.replace(",", ".")) || 0)) });
    } else if (fieldDef?.type === "oui_non") {
      piece.metre.fields[fieldKey] = timestampedAnswer(/oui/i.test(text) ? "oui" : "non");
    } else {
      piece.metre.fields[fieldKey] = timestampedAnswer(Math.max(0, Number(text.replace(",", ".")) || 0));
    }
    return;
  }
  if (key === "support") { piece.etatConstate = timestampedAnswer(matchOption(text, ETAT_CONSTATE_OPTIONS)); return; }
  if (key === "finition") { piece.finitionsDemandees = timestampedAnswer(matchOption(text, FINITION_DEMANDEE_OPTIONS)); return; }
  if (key === "finitionPrecision") { piece.finitionsPrecision = isSkip(text) ? "" : timestampedAnswer(text); return; }
  if (key === "acces") { piece.acces = timestampedAnswer(matchOption(text, ACCES_OPTIONS)); return; }
  if (key === "stationnement") { piece.stationnement = timestampedAnswer(matchOption(text, STATIONNEMENT_OPTIONS)); return; }
  if (key === "remarques") { piece.remarques = isSkip(text) ? "" : timestampedAnswer(text); return; }
  if (key === "anotherPiece") {
    if (/oui/i.test(text)) state.currentPieceIndex += 1;
    else state.finalize = true;
    return;
  }
}

// lib/visite-devis-shape.js n'a pas ete modifie (reutilise tel quel) — il ne
// connait pas le champ "stationnement" ajoute a lib/visite-tree.js pour ce
// flux. On le fusionne dans le texte d'acces avant l'appel, plutot que de
// toucher au fichier partage avec la visite guidee marketplace.
function mergeAccesStationnement(piece) {
  if (!piece.acces) return piece.acces;
  const stationText = piece.stationnement && piece.stationnement.value ? ` — Stationnement : ${piece.stationnement.value}` : "";
  return { value: `${piece.acces.value}${stationText}`, timestamp: piece.acces.timestamp };
}

async function finalizeDevisFlowWithState(ctx, state) {
  const { auth, db } = ctx;
  const catalog = mergedOuvrages(db);

  const shapedPieces = state.pieces.map((p) => ({
    nom: p.nom,
    metier: p.metier,
    metre: p.metre,
    etatConstate: p.etatConstate,
    finitionsDemandees: p.finitionsDemandees,
    finitionsPrecision: p.finitionsPrecision,
    acces: mergeAccesStationnement(p),
    remarques: p.remarques
  }));

  const { data: profile } = await auth.supabase.from("users").select("*").eq("id", auth.userId).maybeSingle();
  const webUser = buildWebUser({ id: auth.userId, email: profile?.email || "", profile });
  const business = webUser.business || {};

  // Aucun ouvrier n'est demande a la creation du devis (18 septembre) —
  // l'affectation d'une equipe reelle se fait plus tard, au demarrage du
  // chantier/planning, pas ici. En attendant, le taux horaire par defaut de
  // l'entreprise (app/profil/page.jsx, meme formule que son "hourlyCost")
  // sert de base — jamais invente, c'est un chiffre deja configure par
  // l'entreprise elle-meme.
  const dailyRate = Number(business.dailyRate || 0);
  const hoursPerDay = Number(business.hoursPerDay || 0);
  const hourlyRate = hoursPerDay > 0 ? dailyRate / hoursPerDay : 0;

  const { rooms, items, notes } = buildItemsFromVisite({
    pieces: shapedPieces,
    worker: { hourlyRate },
    catalog,
    acceptedSuggestions: []
  });

  const now = new Date().toISOString();
  const quoteNumber = await nextQuoteNumberFor(auth);
  const workDescription = shapedPieces
    .map((p) => `${p.nom} (${(VISITE_METIERS.find((m) => m.key === p.metier) || {}).label || p.metier})`)
    .join(", ");

  const draft = {
    id: "",
    userId: auth.userId,
    quoteNumber,
    versionNumber: "001",
    client: fixText(state.clientName),
    clientEmail: "",
    clientPhone: "",
    project: (workDescription || "Devis").slice(0, 80),
    projectId: "",
    chantierAddress: fixText(state.address || ""),
    workDescription,
    validityDays: 30,
    company: webUser.business || {},
    quoteDate: now.slice(0, 10),
    status: "Brouillon",
    signatureStatus: "Non envoye",
    rooms,
    items,
    notes,
    surcharges: [],
    vatRate: 0.2,
    draftStep: 0,
    draftData: null,
    isCreationDraft: false,
    totalHt: 0,
    totalTtc: 0,
    createdAt: now.slice(0, 10),
    createdAtIso: now,
    updatedAt: now
  };

  const computed = applyQuoteTotals(draft);
  const row = quoteToRow(computed, auth.userId);
  const { data: inserted, error } = await auth.supabase.from("quotes").insert(row).select().single();
  if (error) return { outcome: "failed", message: `Création du devis impossible: ${error.message}` };

  const quote = mapQuote(inserted);
  return {
    outcome: "created",
    type: "devis",
    typeLabel: "Devis",
    id: quote.id,
    deleteRoute: "/api/quotes",
    deleteMethod: "patch-action",
    correctUrl: `/devis?id=${quote.id}`,
    summary: { Client: quote.client, Chantier: quote.project || "—", Montant: euro(quote.totalTtc) }
  };
}

export async function startDevisFlow(ctx, prefill, originalMessage) {
  const state = {
    flow: "devisVisite",
    clientName: fixText(prefill.clientName || "") || null,
    address: fixText(prefill.address || ""),
    pieces: Array.isArray(prefill.pieces)
      ? prefill.pieces.filter(Boolean).flatMap((nom) => String(nom).split(",").map((n) => n.trim()).filter(Boolean)).map((nom) => newPiece(nom))
      : [],
    currentPieceIndex: 0,
    finalize: false,
    awaiting: null
  };
  const next = computeNext(ctx, state);
  if (!next) return finalizeDevisFlowWithState(ctx, state);
  return { outcome: "clarify", question: next.question, quickReplies: next.quickReplies, state: next.state, originalMessage };
}

export async function advanceDevisFlow(ctx, state, answer, originalMessage) {
  applyAnswer(state, answer);
  const next = computeNext(ctx, state);
  if (!next) return finalizeDevisFlowWithState(ctx, state);
  return { outcome: "clarify", question: next.question, quickReplies: next.quickReplies, state: next.state, originalMessage };
}
