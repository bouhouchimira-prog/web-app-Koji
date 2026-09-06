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

export function validateAiQuote(parsed) {
  if (!parsed || !Array.isArray(parsed.lots) || parsed.lots.length === 0) return false;
  return parsed.lots.every((lot) =>
    lot && typeof lot.nom === "string" && Array.isArray(lot.postes) && lot.postes.length > 0 &&
    lot.postes.every((poste) =>
      poste && typeof poste.designation === "string" &&
      Number.isFinite(Number(poste.quantite)) &&
      Number.isFinite(Number(poste.prix_total))
    )
  );
}

export function buildItemsFromAiQuote(parsed) {
  const rooms = [];
  const items = [];
  let index = 0;
  for (const lot of parsed.lots) {
    const room = fixText(lot.nom || "Travaux");
    if (!rooms.includes(room)) rooms.push(room);
    for (const poste of lot.postes) {
      index += 1;
      items.push({
        id: `ai-${Date.now()}-${index}`,
        label: fixText(poste.designation || "Prestation"),
        room,
        quantity: Math.max(0, Number(poste.quantite) || 1),
        unit: poste.unite || "u",
        billingMode: "fixed",
        fixedAmountHt: Math.max(0, Number(poste.prix_total) || 0)
      });
    }
  }
  return { rooms, items };
}
