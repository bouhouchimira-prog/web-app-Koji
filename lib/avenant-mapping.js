// Shared helpers for the `avenants` entity (blob JSON store, see lib/db.js —
// same "not yet shared with the mobile app" treatment as db.invoices), used
// by app/api/avenants/route.js and app/api/avenants/[id]/documents/route.js.

import { fixText } from "./text";

const LIGNE_TYPES = new Set(["ajout", "suppression", "modification"]);

// Maps an avenant's `status` to its i18n key under L.avenants.* — shared by
// app/avenant/AvenantEditor.jsx and the "Avenants" tab in app/devis/DevisEditor.jsx
// so both render the exact same label for a given status.
export const AVENANT_STATUS_LABEL_KEYS = {
  Brouillon: "statusBrouillon",
  Envoye: "statusEnvoye",
  Signe: "statusSigne",
  Refuse: "statusRefuse",
  Archive: "statusArchive"
};

function toAmount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

// Sequential per-devis numbering ("AV-1", "AV-2"...), same "scan existing,
// take max+1" principle as nextQuoteNumberFor (lib/quote-mapping.js) but
// scoped by quoteId instead of by user/year.
export function nextAvenantNumero(db, quoteId) {
  const count = (db.avenants || []).filter((avenant) => avenant.quoteId === quoteId).length;
  return `AV-${count + 1}`;
}

// Never trusts a client-sent line total — always recomputed from the atomic
// quantity/unitPriceHt/type fields, same principle as never trusting a
// client-supplied price elsewhere in the app. "suppression" lines are forced
// negative regardless of the sign the client sent; "ajout"/"modification"
// keep whatever sign quantity*unitPriceHt produces (a modification can be a
// decrease, entered as a negative unitPriceHt).
export function normalizeLignes(lignes = []) {
  return (Array.isArray(lignes) ? lignes : []).map((ligne, index) => {
    const type = LIGNE_TYPES.has(ligne?.type) ? ligne.type : "ajout";
    const quantity = Number(ligne?.quantity || 0);
    const unitPriceHt = Number(ligne?.unitPriceHt || 0);
    const rawTotal = toAmount(quantity * unitPriceHt);
    const totalHt = type === "suppression" ? -Math.abs(rawTotal) : rawTotal;
    return {
      id: ligne?.id || `av-line-${Date.now()}-${index}`,
      type,
      room: fixText(String(ligne?.room || "")) || "Travaux",
      label: fixText(String(ligne?.label || "")),
      quantity,
      unit: fixText(String(ligne?.unit || "u")),
      unitPriceHt,
      totalHt,
      ligneDevisRef: ligne?.ligneDevisRef || "",
      note: fixText(String(ligne?.note || ""))
    };
  });
}

export function computeAvenantTotals(lignes = [], vatRatePercent = 20) {
  const totalHtDelta = toAmount((lignes || []).reduce((sum, ligne) => sum + Number(ligne.totalHt || 0), 0));
  const rate = Number(vatRatePercent || 0) / 100;
  const totalTtcDelta = toAmount(totalHtDelta * (1 + rate));
  return { totalHtDelta, totalTtcDelta };
}

// Total du marché à jour = total du devis + delta des avenants SIGNÉS de ce
// devis (un avenant brouillon/envoyé/refusé ne compte pas).
export function cumulativeMarketTotal(quote, avenants = []) {
  const base = toAmount(quote?.totalTtc || 0);
  const signedDelta = (avenants || [])
    .filter((avenant) => avenant.quoteId === quote?.id && avenant.status === "Signe")
    .reduce((sum, avenant) => sum + Number(avenant.totalTtcDelta || 0), 0);
  return toAmount(base + signedDelta);
}
