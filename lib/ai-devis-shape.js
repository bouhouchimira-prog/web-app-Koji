import { fixText } from "./text";

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
// Seuls les postes sans correspondance gardent le prix "fixed" propose par
// l'IA (billingMode "fixed").
export function buildItemsFromAiQuote(parsed, catalogItems = []) {
  const byCode = new Map(
    (Array.isArray(catalogItems) ? catalogItems : [])
      .filter((o) => o && o.code)
      .map((o) => [String(o.code).toUpperCase(), o])
  );
  const rooms = [];
  const items = [];
  let index = 0;
  for (const lot of parsed.lots) {
    const room = fixText(lot.nom || "Travaux");
    if (!rooms.includes(room)) rooms.push(room);
    for (const poste of lot.postes) {
      index += 1;
      const match = byCode.get(fixText(poste.codeCatalogue || "").toUpperCase());
      if (match) {
        items.push({
          id: `ai-${Date.now()}-${index}`,
          label: fixText(poste.designation || match.label || "Prestation"),
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
      } else {
        items.push({
          id: `ai-${Date.now()}-${index}`,
          label: fixText(poste.designation || "Prestation"),
          room,
          quantity: Math.max(0, Number(poste.quantite) || 1),
          unit: poste.unite || "u",
          billingMode: "fixed",
          fixedAmountHt: Math.max(0, Number(poste.prix_total) || 0),
          priceSource: "ia"
        });
      }
    }
  }
  return { rooms, items };
}
