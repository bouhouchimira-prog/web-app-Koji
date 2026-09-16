import { fixText } from "./text";
import { METRE_FIELDS_BY_METIER, metierByKey } from "./visite-tree";

// Transforme les reponses de la visite guidee en lignes de devis
// ({ rooms, items }) exploitables telles quelles par
// applyQuoteTotals/quoteToRow — formule imposee le 12 septembre :
//
//   temps_estime (bibliotheque) x taux_horaire_de_la_personne
//   + fournitures (ajoutees ensuite par l'entreprise depuis l'editeur,
//     bouton "Ajouter une fourniture" deja existant)
//   + finitions_client (lignes separees)
//
// Aucun appel IA ici : tout est deterministe, comme LABOR_LEVEL_COEFFICIENTS
// dans app/api/devis-ia/route.js — le prix ne vient jamais du jugement libre
// d'une IA. Quand aucun ouvrage de la bibliotheque ne correspond (Plomberie,
// Electricite : bibliotheque vide pour l'instant, decision du 12 septembre
// avec Amira), la ligne est generee a 0€, clairement marquee "a chiffrer
// manuellement", plutot que d'inventer un prix.
//
// origin distingue ce que l'artisan CONSTATE (metre, suggestions du moteur
// de regles) de ce que le CLIENT DEMANDE (finitions) — champ separe sur
// chaque item, jamais melange.

function pickOuvrageForField(catalog, catalogueProfession, hint) {
  if (!catalogueProfession || !hint) return null;
  const professionNeedle = catalogueProfession.toLowerCase();
  const professionMatches = catalog.filter((o) => {
    const p = (o.profession || "").toLowerCase();
    return p.includes(professionNeedle) || professionNeedle.includes(p);
  });
  const pool = professionMatches.length ? professionMatches : catalog;
  const hintNeedle = hint.toLowerCase();
  const hinted = pool.find((o) =>
    (o.label || "").toLowerCase().includes(hintNeedle) || (o.category || "").toLowerCase().includes(hintNeedle)
  );
  return hinted || pool[0] || null;
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function manualLineItem({ label, room, quantity, unit, origin }) {
  return {
    id: makeId("visite-manuel"),
    label: `À chiffrer manuellement — ${label}`,
    room,
    quantity: Math.max(0, Number(quantity) || 1),
    unit: unit || "u",
    billingMode: "fixed",
    fixedAmountHt: 0,
    origin: origin || "constate"
  };
}

function timeLineItem({ label, room, quantity, unit, normativeTime, hourlyRate, origin }) {
  return {
    id: makeId("visite"),
    label,
    room,
    quantity: Math.max(0, Number(quantity) || 0),
    unit: unit || "u",
    billingMode: "time",
    normativeTime: Math.max(0, Number(normativeTime) || 0),
    hourlyRate: Math.max(0, Number(hourlyRate) || 0),
    origin: origin || "constate"
  };
}

function buildMetreItems(piece, roomName, hourlyRate, catalog) {
  const metier = metierByKey(piece.metier);
  const fieldDefs = METRE_FIELDS_BY_METIER[metier.key] || [];
  const answers = (piece.metre && piece.metre.fields) || {};
  const items = [];

  for (const fieldDef of fieldDefs) {
    const answer = answers[fieldDef.key];
    if (!answer || answer.value == null || answer.value === "") continue;

    if (fieldDef.type === "compteur") {
      const counts = answer.value || {};
      for (const [sousType, count] of Object.entries(counts)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        items.push(manualLineItem({ label: `${fieldDef.label} — ${sousType}`, room: roomName, quantity: n, unit: "u" }));
      }
      continue;
    }

    if (fieldDef.type === "oui_non") {
      if (answer.value === "oui") {
        items.push(manualLineItem({ label: fieldDef.label, room: roomName, quantity: 1, unit: "u" }));
      }
      continue;
    }

    // type "nombre"
    const quantity = Number(answer.value) || 0;
    if (quantity <= 0) continue;
    const ouvrage = fieldDef.ouvrageHint ? pickOuvrageForField(catalog, metier.catalogueProfession, fieldDef.ouvrageHint) : null;
    if (ouvrage) {
      items.push(timeLineItem({
        label: ouvrage.label,
        room: roomName,
        quantity,
        unit: ouvrage.unit || fieldDef.unit,
        normativeTime: ouvrage.normativeTime,
        hourlyRate
      }));
    } else {
      items.push(manualLineItem({ label: fieldDef.label, room: roomName, quantity, unit: fieldDef.unit }));
    }
  }

  return items;
}

function buildFinitionItem(piece, roomName) {
  const finition = piece.finitionsDemandees && piece.finitionsDemandees.value;
  if (!finition) return null;
  const precision = piece.finitionsPrecision && piece.finitionsPrecision.value;
  return {
    id: makeId("visite-finition"),
    label: `Finition demandée par le client : ${fixText(finition)}${precision ? ` — ${fixText(precision)}` : ""}`,
    room: roomName,
    quantity: 1,
    unit: "u",
    billingMode: "fixed",
    fixedAmountHt: 0,
    origin: "demande"
  };
}

// Note informative par piece (etat constate + acces + remarques) — jamais
// une ligne chiffree, juste de la visibilite pour l'entreprise dans
// l'editeur (meme mecanisme que les notes "materiaux a la charge du
// client" de app/api/devis-ia/route.js, jamais comptees dans les totaux).
function buildPieceNote(piece, roomName) {
  const lines = [];
  if (piece.etatConstate && piece.etatConstate.value) {
    lines.push(`État constaté par l'artisan : ${fixText(piece.etatConstate.value)}`);
  }
  if (piece.acces && piece.acces.value) {
    lines.push(`Accès : ${fixText(piece.acces.value)}`);
  }
  if (piece.remarques && piece.remarques.value) {
    lines.push(`Remarques : ${fixText(piece.remarques.value)}`);
  }
  if (lines.length === 0) return null;
  return {
    id: makeId("visite-note"),
    room: roomName,
    type: "message",
    message: lines.join("\n")
  };
}

export function buildItemsFromVisite({ pieces, worker, catalog, acceptedSuggestions }) {
  const rooms = [];
  const items = [];
  const notes = [];
  const hourlyRate = Number((worker && worker.hourlyRate) || 0);

  for (const piece of pieces || []) {
    const roomName = fixText(piece.nom || "Pièce");
    if (!rooms.includes(roomName)) rooms.push(roomName);

    items.push(...buildMetreItems(piece, roomName, hourlyRate, catalog || []));

    const finitionItem = buildFinitionItem(piece, roomName);
    if (finitionItem) items.push(finitionItem);

    const note = buildPieceNote(piece, roomName);
    if (note) notes.push(note);
  }

  for (const suggestion of acceptedSuggestions || []) {
    items.push(manualLineItem({
      label: suggestion.label,
      room: suggestion.pieceNom || rooms[0] || "Général",
      quantity: suggestion.quantity || 1,
      unit: suggestion.unit || "u"
    }));
  }

  return { rooms, items, notes };
}
