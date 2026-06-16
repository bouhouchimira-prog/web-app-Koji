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

export function computeQuoteItem(item = {}, quote = {}) {
  const pricingProfile = quote.pricingProfile || quote.company || {};
  const quantity = Math.max(0, toNumber(firstDefined(item.quantity, item.qty, 1), 1));
  const hourlyRate = Math.max(0, toNumber(firstDefined(item.hourlyRate, item.tauxHoraire, pricingProfile.hourlyRate, quote.hourlyRate, 52), 52));
  const vatRate = normalizeRate(firstDefined(item.vatRate, quote.vatRate, pricingProfile.vatRate, 0.2), 0.2);
  const marginRate = normalizeRate(firstDefined(item.marginRate, pricingProfile.marginRate, quote.marginRate, 0), 0);
  const normativeTime = Math.max(0, toNumber(firstDefined(item.normativeTime, item.time, item.timeHours, item.temps, item.tempsHu, 0), 0));
  const access = Math.max(0, toNumber(firstDefined(item.access, item.acces, item.realityFactors?.access, 1), 1));
  const support = Math.max(0, toNumber(firstDefined(item.support, item.realityFactors?.support, 1), 1));
  const complexity = Math.max(0, toNumber(firstDefined(item.complexity, item.complexite, item.realityFactors?.complexity, 1), 1));
  const coefficient = Math.max(0, toNumber(firstDefined(item.coefficient, item.coef, 1), 1));
  const baseTime = item.isFixedTime ? normativeTime : normativeTime * quantity;
  const correctedTimeHours = round2(baseTime * access * support * complexity * coefficient);

  const fixedTtc = toNumber(firstDefined(item.fixedAmountTtc, item.forfaitTtc, item.totalTtcForfait), Number.NaN);
  const fixedHt = toNumber(firstDefined(item.fixedAmountHt, item.forfaitHt, item.fixedPriceHt, item.amountHt), Number.NaN);
  const hasFixedAmount = Number.isFinite(fixedHt) || Number.isFinite(fixedTtc);
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
  const totalHt = round2(discountedHt * (1 + marginRate));
  const totalVat = round2(totalHt * vatRate);
  const totalTtc = round2(totalHt + totalVat);

  const storedHt = toNumber(firstDefined(item.totalHt, item.totalHT, item.ht), Number.NaN);
  const storedTtc = toNumber(firstDefined(item.totalTtc, item.totalTTC, item.ttc, item.total), Number.NaN);
  const emptyComputed = totalHt === 0 && normativeTime === 0 && materialCostHt === 0 && !hasFixedAmount;

  if (emptyComputed && (Number.isFinite(storedHt) || Number.isFinite(storedTtc))) {
    const ht = Number.isFinite(storedHt) ? storedHt : storedTtc / (1 + vatRate);
    return {
      ...item,
      quantity,
      billingMode,
      hourlyRate,
      vatRate,
      vatPercent: round2(vatRate * 100),
      baseTimeHours: 0,
      correctedTimeHours: 0,
      laborCostHt: round2(ht),
      materialCostHt: 0,
      materialLines,
      totalHt: round2(ht),
      totalVat: round2(ht * vatRate),
      totalTtc: round2(Number.isFinite(storedTtc) ? storedTtc : ht * (1 + vatRate))
    };
  }

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
  const totalHt = round2(items.reduce((sum, item) => sum + toNumber(item.totalHt), 0));
  const totalVat = round2(items.reduce((sum, item) => sum + toNumber(item.totalVat), 0));
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
