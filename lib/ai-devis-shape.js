import { fixText } from "./text";

// Marge de la fourchette de prix affichee au particulier (Radar des
// Chantiers) — deplacee ici le 30 sept pour etre partagee par
// app/api/expertise-koji/route.js (premier calcul) et
// app/api/estimer-devis/route.js (recalcul a chaque creation de devis
// entreprise, pour rester toujours coherent avec le total reel).
export const PRICE_RANGE_SPREAD = 0.15;

// Shared helpers for turning a Claude JSON response (lots/postes/prix) into
// the app's quote item shape, and for picking a relevant slice of the price
// library to send in a prompt. Used by app/api/expertise-koji/route.js (the
// one place that now calls Claude for pricing) — app/api/estimer-devis
// no longer calls the AI itself, it copies an existing expertise devis.

const MAX_OUVRAGES_IN_PROMPT = 20;

export function pickRelevantOuvrages(ouvrages, metier) {
  const needle = fixText(metier || "").toLowerCase();
  const matched = needle
    ? ouvrages.filter((o) => {
        const profession = (o.profession || "").toLowerCase();
        const family = (o.family || "").toLowerCase();
        return profession.includes(needle) || needle.includes(profession) ||
          family.includes(needle) || needle.includes(family);
      })
    : [];
  const pool = matched.length ? matched : ouvrages;
  return pool.slice(0, MAX_OUVRAGES_IN_PROMPT).map((o) => ({
    code: o.code,
    label: o.label,
    unit: o.unit,
    normativeTime: o.normativeTime,
    hourlyRate: o.hourlyRate
  }));
}

// Un poste est valide s'il a soit un code de bibliotheque (le prix viendra
// du catalogue, prix_total n'est alors qu'indicatif), soit un prix_total
// donne par l'IA (poste hors catalogue — voir buildItemsFromAiQuote).
export function validateAiQuote(parsed) {
  if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return false;
  return parsed.lots.every((lot) =>
    lot && typeof lot.nom === "string" && Array.isArray(lot.postes) && lot.postes.length > 0 &&
    lot.postes.every((poste) =>
      poste && typeof poste.designation === "string" &&
      Number.isFinite(Number(poste.quantite)) &&
      (Boolean(fixText(poste.codeCatalogue || "").trim()) || Number.isFinite(Number(poste.prix_total)))
    )
  );
}

// Chiffrage 100% bibliotheque de prix, l'IA en relais uniquement pour ce qui
// n'existe pas dans le catalogue (demande d'Amira, 29 septembre) : quand le
// poste renvoye par l'IA porte un "codeCatalogue" qui correspond a un
// ouvrage reel, on ignore son prix_total et on construit un item en mode
// "time" (temps normatif + taux horaire du catalogue/de l'entreprise) — le
// meme moteur de calcul que les devis crees a la main (lib/quote-calculations.js).
//
// Pour un poste SANS correspondance, deux comportements possibles selon
// `trustAiPriceForUnmatched` (30 septembre, demande d'Amira) :
// - true (par defaut, cote particulier/expertise-koji) : le prix propose par
//   l'IA est garde tel quel — une fourchette doit toujours pouvoir etre
//   affichee au particulier, meme pour un metier non couvert par la
//   bibliotheque.
// - false (cote entreprise/devis-ia) : le prix de l'IA n'est JAMAIS utilise
//   pour un poste hors catalogue — le poste est cree a 0€, avec une note
//   visible sur le lot demandant a l'entreprise de completer elle-meme le
//   prix ("on n'a pas ce prix dans notre base"). L'entreprise est la
//   professionnelle la mieux placee pour donner un prix reel, jamais une
//   estimation IA non verifiee.
export function buildItemsFromAiQuote(parsed, catalogItems = [], { trustAiPriceForUnmatched = true } = {}) {
  const byCode = new Map(
    (Array.isArray(catalogItems) ? catalogItems : [])
      .filter((o) => o && o.code)
      .map((o) => [String(o.code).toUpperCase(), o])
  );
  const rooms = [];
  const items = [];
  const missingPriceNotes = [];
  let index = 0;
  for (const lot of parsed.lots) {
    const room = fixText(lot.nom || "Travaux");
    if (!rooms.includes(room)) rooms.push(room);
    for (const poste of lot.postes) {
      index += 1;
      const match = byCode.get(fixText(poste.codeCatalogue || "").toUpperCase());
      const label = fixText(poste.designation || match?.label || "Prestation");
      if (match) {
        items.push({
          id: `ai-${Date.now()}-${index}`,
          label,
          room,
          quantity: Math.max(0, Number(poste.quantite) || 1),
          unit: match.unit || poste.unite || "u",
          billingMode: "time",
          normativeTime: Math.max(0, Number(match.normativeTime) || 0),
          coefficient: Number(match.coefficient) > 0 ? Number(match.coefficient) : 1,
          hourlyRate: Number(match.hourlyRate) > 0 ? Number(match.hourlyRate) : undefined,
          catalogCode: match.code,
          priceSource: "catalogue"
        });
      } else if (trustAiPriceForUnmatched) {
        items.push({
          id: `ai-${Date.now()}-${index}`,
          label,
          room,
          quantity: Math.max(0, Number(poste.quantite) || 1),
          unit: poste.unite || "u",
          billingMode: "fixed",
          fixedAmountHt: Math.max(0, Number(poste.prix_total) || 0),
          priceSource: "ia"
        });
      } else {
        items.push({
          id: `ai-${Date.now()}-${index}`,
          label,
          room,
          quantity: Math.max(0, Number(poste.quantite) || 1),
          unit: poste.unite || "u",
          billingMode: "fixed",
          fixedAmountHt: 0,
          priceSource: "manquant",
          needsPrice: true
        });
        missingPriceNotes.push({ room, label });
      }
    }
  }
  return { rooms, items, missingPriceNotes };
}

// Un poste marque priceSource "ia" a ete chiffre par l'IA faute de
// correspondance dans la bibliotheque de prix — fiable pour donner au
// particulier une fourchette indicative (expertise-koji), mais jamais a
// faire passer pour un prix sur sur le devis REEL d'une entreprise (30
// sept, demande d'Amira). Remis a 0€, avec needsPrice:true pour que
// l'ecran de revue (app/marketplace/[id]/proposition-devis) et
// app/api/estimer-devis puissent le signaler clairement. Partagee entre
// les deux car utilisee par l'apercu ET par la creation finale.
export function clearUnverifiedAiPrices(items) {
  const missingPriceNotes = [];
  const cleaned = (items || []).map((item) => {
    if (item.priceSource !== "ia") return item;
    missingPriceNotes.push({ room: item.room || "Général", label: item.label || "Prestation" });
    return { ...item, billingMode: "fixed", fixedAmountHt: 0, priceSource: "manquant", needsPrice: true };
  });
  return { items: cleaned, missingPriceNotes };
}

// Regroupe les postes sans prix par lot en notes lisibles, dans le meme
// format que les autres notes de devis (lib/db.js, affichees par
// DevisEditor.jsx) — un message clair demandant a l'entreprise de completer
// le prix, plutot qu'un poste a 0€ sans explication.
export function buildMissingPriceNotes(missingPriceNotes) {
  if (!Array.isArray(missingPriceNotes) || missingPriceNotes.length === 0) return [];
  const byRoom = new Map();
  for (const entry of missingPriceNotes) {
    if (!byRoom.has(entry.room)) byRoom.set(entry.room, []);
    byRoom.get(entry.room).push(entry.label);
  }
  return Array.from(byRoom.entries()).map(([room, labels], index) => ({
    id: `ai-missing-price-${Date.now()}-${index}`,
    room,
    type: "message",
    message: `Prix manquant pour : ${labels.join(", ")}. Nous n'avons pas ce prix dans notre base — pouvez-vous proposer un prix pour finir le devis ?`
  }));
}
