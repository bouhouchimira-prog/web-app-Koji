const CHILD_KEYS = ["children", "subItems", "subitems", "subOuvrages", "subouvrages", "sousOuvrages", "sousouvrages", "subWorks", "subworks"];
const MATERIAL_KEYS = ["materials", "materialRequirements", "fournitures", "supplies", "supplyNeeds"];

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function round2(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function normalizeRate(value, fallback = 0) {
  const number = toNumber(value, fallback);
  if (number > 1) return number / 100;
  return number;
}

function sourceItemsFromRooms(rooms = []) {
  return rooms.flatMap((room) => {
    const roomItems = room.items || room.tasks || room.ouvrages || room.works || [];
    return roomItems.map((item) => ({
      ...item,
      room: item.room || room.label || room.name || room.title || "Chantier",
      roomId: item.roomId || room.id || ""
    }));
  });
}

export function getQuoteSourceItems(quote = {}) {
  if (Array.isArray(quote.items) && quote.items.length > 0) return quote.items;
  if (Array.isArray(quote.ouvrages) && quote.ouvrages.length > 0) return quote.ouvrages;
  if (Array.isArray(quote.rooms) && quote.rooms.length > 0) return sourceItemsFromRooms(quote.rooms);
  return [];
}

export function flattenQuoteItems(items = [], parent = null, roomFallback = "Chantier") {
  const flat = [];
  items.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const id = String(firstDefined(item.id, item.quoteItemId, item.taskId, item.code, `${parent?.id || "item"}-${index}`));
    const room = item.room || parent?.room || roomFallback || "Chantier";
    const node = { ...item, id, quoteItemId: id, parentQuoteItemId: parent?.quoteItemId || parent?.id || "", room };
    flat.push(node);

    CHILD_KEYS.forEach((key) => {
      if (Array.isArray(item[key])) {
        flat.push(...flattenQuoteItems(item[key], node, room));
      }
    });
  });
  return flat;
}

function getMaterialLines(item = {}, quantity = 1) {
  const requirements = MATERIAL_KEYS.flatMap((key) => Array.isArray(item[key]) ? item[key] : []);
  return requirements.map((line, index) => {
    const product = line.product || line.selectedProduct || line.supply || line.fourniture || null;
    const yieldValue = toNumber(firstDefined(line.yield, line.yieldPerUnit, line.consumptionFactor, product?.yield, product?.consumptionFactor), 0);
    const quantityNeeded = toNumber(firstDefined(line.quantity, line.qty, line.requiredQuantity), Number.NaN);
    const computedQuantity = Number.isFinite(quantityNeeded)
      ? quantityNeeded
      : line.isFixedQuantity
        ? 1
        : yieldValue > 0
          ? quantity / yieldValue
          : 0;
    const unitsToBuy = Math.max(0, Math.ceil(toNumber(firstDefined(line.unitsToBuy, line.units, computedQuantity), 0)));
    const unitPriceHt = toNumber(firstDefined(
      line.unitPriceHt,
      line.priceHt,
      line.priceHT,
      line.defaultPricePerUnit,
      product?.unitPriceHt,
      product?.salePriceHt,
      product?.priceHt,
      product?.priceHT,
      product?.price
    ), 0);

    return {
      id: String(firstDefined(line.id, product?.id, `${item.id || item.code || "material"}-${index}`)),
      name: firstDefined(line.name, line.label, product?.name, product?.label, "Fourniture"),
      category: firstDefined(line.category, product?.category, item.family, "Divers"),
      unit: firstDefined(line.unit, product?.unit, "u"),
      quantity: unitsToBuy,
      unitPriceHt: round2(unitPriceHt),
      totalHt: round2(unitsToBuy * unitPriceHt),
      showToClient: line.showToClient !== false && item.showMaterialsToClient !== false,
      source: line
    };
  });
}

// DevisEditor.jsx already computes each line's totalHt/totalTtc correctly
// (labor, materials, adjustments all applied — see recalculateLine). That
// pre-computed value is trusted here whenever present: re-deriving it from
// raw fields (below) is a fragile approximation that doesn't know the exact
// field shapes DevisEditor writes, and was silently producing 0 for ordinary
// time-billed items (a stray `fixedAmountHt: 0` field was wrongly read as
// "this item has a fixed price of 0", and `materialLines` wasn't a
// recognized material-cost key).
export function computeQuoteItem(item = {}, quote = {}) {
  const pricingProfile = quote.pricingProfile || quote.company || {};
  const quantity = Math.max(0, toNumber(firstDefined(item.quantity, item.qty, 1), 1));
  const vatRate = normalizeRate(firstDefined(item.vatRate, quote.vatRate, pricingProfile.vatRate, 0.2), 0.2);

  const storedHt = toNumber(firstDefined(item.totalHt, item.totalHT, item.ht), Number.NaN);
  const storedTtc = toNumber(firstDefined(item.totalTtc, item.totalTTC, item.ttc, item.total), Number.NaN);
  const hasStoredTotal = (Number.isFinite(storedHt) && storedHt > 0) || (Number.isFinite(storedTtc) && storedTtc > 0);

  if (hasStoredTotal) {
    const totalHt = Number.isFinite(storedHt) && storedHt > 0 ? round2(storedHt) : round2(storedTtc / (1 + vatRate));
    const totalTtc = Number.isFinite(storedTtc) && storedTtc > 0 ? round2(storedTtc) : round2(totalHt * (1 + vatRate));
    return {
      ...item,
      quantity,
      billingMode: item.billingMode || (item.isForfait ? "fixed" : "time"),
      vatRate,
      vatPercent: round2(vatRate * 100),
      correctedTimeHours: Math.max(0, toNumber(item.correctedTimeHours, 0)),
      laborCostHt: Math.max(0, toNumber(firstDefined(item.laborCost, item.laborCostHt), 0)),
      materialCostHt: Math.max(0, toNumber(firstDefined(item.materialCost, item.materialCostHt), 0)),
      materialLines: item.materialLines || [],
      totalHt,
      totalVat: round2(totalTtc - totalHt),
      totalTtc
    };
  }

  const hourlyRate = Math.max(0, toNumber(firstDefined(item.hourlyRate, item.tauxHoraire, pricingProfile.hourlyRate, quote.hourlyRate, 52), 52));
  const normativeTime = Math.max(0, toNumber(firstDefined(item.normativeTime, item.time, item.timeHours, item.temps, item.tempsHu, 0), 0));
  // Modele compositionnel (24 oct, bibliotheque v0) — meme formule que
  // lib/pricing.js::calculateTaskPrice, a garder synchronisee : remplace
  // le produit access*support*complexity (toujours fige a 1, jamais
  // alimente) par une ponderation par sensibilite. `situationFactors` vit
  // sur le devis (collecte une fois, pas par ligne) ; `sensitivities`/
  // `fixedTime`/`parameterMultiplier`/`parameterHoursAdd` vivent sur la
  // ligne (copies depuis l'ouvrage catalogue + le choix de parametre au
  // moment de l'ajout, voir DevisEditor.jsx::sourceToTask).
  const situationFactors = quote.situationFactors || {};
  const sensitivities = item.sensitivities || {};
  const fixedTime = Math.max(0, toNumber(item.fixedTime, 0));
  const parameterMultiplier = Math.max(0, toNumber(item.parameterMultiplier, 1)) || 1;
  const parameterHoursAdd = Math.max(0, toNumber(item.parameterHoursAdd, 0));
  const coefficient = Math.max(0, toNumber(firstDefined(item.coefficient, item.coef, 1), 1));
  const factorEntries = Object.entries(sensitivities);
  const totalCoefficient = factorEntries.length
    ? factorEntries.reduce((acc, [key, sensitivity]) => {
        const factorValue = toNumber(situationFactors[key], 1);
        return acc * (1 + (factorValue - 1) * toNumber(sensitivity, 0));
      }, 1)
    : 1;
  const baseTime = (item.isFixedTime ? normativeTime : normativeTime * quantity) * parameterMultiplier;
  const correctedTimeHours = round2(baseTime * totalCoefficient * coefficient + fixedTime + parameterHoursAdd);

  const fixedTtc = toNumber(firstDefined(item.fixedAmountTtc, item.forfaitTtc, item.totalTtcForfait), Number.NaN);
  const fixedHt = toNumber(firstDefined(item.fixedAmountHt, item.forfaitHt, item.fixedPriceHt, item.amountHt), Number.NaN);
  const hasFixedAmount = (Number.isFinite(fixedHt) && fixedHt > 0) || (Number.isFinite(fixedTtc) && fixedTtc > 0);
  const billingMode = item.billingMode === "fixed" || item.billingMode === "forfait" || item.isForfait || hasFixedAmount ? "fixed" : "time";
  const fixedAmountHt = Number.isFinite(fixedHt) ? fixedHt : Number.isFinite(fixedTtc) ? fixedTtc / (1 + vatRate) : 0;
  const laborBaseHt = billingMode === "fixed" ? Math.max(0, fixedAmountHt) : correctedTimeHours * hourlyRate;

  const materialLines = getMaterialLines(item, quantity);
  const materialCostHt = round2(materialLines.reduce((sum, line) => sum + toNumber(line.totalHt), 0));
  const adjustmentPercent = Math.max(0, toNumber(firstDefined(item.adjustmentPercent, item.adjustment, item.surcoutPercent, 0), 0));
  const discountPercent = Math.max(0, toNumber(firstDefined(item.discountPercent, item.discount, item.reductionPercent, 0), 0));
  const baseHt = laborBaseHt + materialCostHt;
  const adjustedHt = baseHt * (1 + adjustmentPercent / 100);
  const discountedHt = adjustedHt * (1 - discountPercent / 100);
  const totalHt = round2(discountedHt);
  const totalVat = round2(totalHt * vatRate);
  const totalTtc = round2(totalHt + totalVat);

  return {
    ...item,
    quantity,
    billingMode,
    hourlyRate,
    vatRate,
    vatPercent: round2(vatRate * 100),
    baseTimeHours: round2(baseTime),
    correctedTimeHours,
    laborCostHt: round2(laborBaseHt),
    materialCostHt,
    materialLines,
    adjustmentPercent,
    discountPercent,
    totalHt,
    totalVat,
    totalTtc
  };
}

// Surcharges (majorations/minorations, ex: "Coordination de chantier 10%") are
// a percentage added on top of the items HT total. Only rows marked "internal"
// or "client" are billable. Each row picks its own calculationBase: "total_lots"
// (the default — a percentage of the raw lots total alone, ignoring every other
// surcharge row) or "chiffrage_cumule" (a percentage of the running subtotal
// built up by every prior billable row instead — e.g. "Assurance decennale",
// which is priced on the whole affair, not just the direct works) — mirrors
// DevisEditor.jsx's summaryTotals, the authoritative in-app calculation this
// function must stay in sync with.
export function computeSurchargeBreakdown(itemsHt, surcharges = []) {
  let running = itemsHt;
  const lines = (Array.isArray(surcharges) ? surcharges : []).map((surcharge) => {
    const billable = surcharge.mode === "internal" || surcharge.mode === "client";
    // `cumulative` is the legacy boolean this field replaced — kept as a
    // fallback so any quote already saved with it still computes correctly.
    const isCumulative = surcharge.calculationBase === "chiffrage_cumule" || surcharge.cumulative === true;
    const base = isCumulative ? running : itemsHt;
    const amount = round2(base * (toNumber(surcharge.percent) / 100));
    if (billable) running = round2(running + amount);
    return { ...surcharge, amount, base };
  });
  return { lines, total: round2(running - itemsHt), totalHt: running };
}

function surchargeTotalHt(quote, itemsHt) {
  return computeSurchargeBreakdown(itemsHt, quote.surcharges).total;
}

export function computeQuoteTotals(quote = {}) {
  const sourceItems = getQuoteSourceItems(quote);
  const flatItems = flattenQuoteItems(sourceItems);
  if (flatItems.length === 0) {
    const totalHt = round2(quote.totalHt || 0);
    const totalTtc = round2(quote.totalTtc || 0);
    return {
      items: [],
      totalHt,
      totalVat: round2(Math.max(0, totalTtc - totalHt)),
      totalTtc,
      totalHours: 0,
      materialCostHt: 0,
      laborCostHt: totalHt
    };
  }

  const items = flatItems.map((item) => computeQuoteItem(item, quote));
  const itemsHt = round2(items.reduce((sum, item) => sum + toNumber(item.totalHt), 0));
  const vatRate = normalizeRate(firstDefined(quote.vatRate, 0.2), 0.2);
  const totalHt = round2(itemsHt + surchargeTotalHt(quote, itemsHt));
  const totalVat = round2(totalHt * vatRate);
  return {
    items,
    totalHt,
    totalVat,
    totalTtc: round2(totalHt + totalVat),
    totalHours: round2(items.reduce((sum, item) => sum + toNumber(item.correctedTimeHours), 0)),
    materialCostHt: round2(items.reduce((sum, item) => sum + toNumber(item.materialCostHt), 0)),
    laborCostHt: round2(items.reduce((sum, item) => sum + toNumber(item.laborCostHt), 0))
  };
}

export function applyQuoteTotals(quote = {}) {
  const totals = computeQuoteTotals(quote);
  return {
    ...quote,
    totalHt: totals.totalHt,
    totalVat: totals.totalVat,
    totalTtc: totals.totalTtc,
    totalHours: totals.totalHours,
    materialCostHt: totals.materialCostHt,
    laborCostHt: totals.laborCostHt,
    calculatedItems: totals.items
  };
}
