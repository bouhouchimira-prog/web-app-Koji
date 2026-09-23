export function calculateTaskPrice({
  task,
  quantity,
  realityFactors = {},
  pricingProfile,
  selectedProducts = []
}) {
  const safeQuantity = Number(quantity || 0);
  const hourlyRate = Number(pricingProfile.hourlyRate || 0);
  const vatRate = Number(pricingProfile.vatRate || 0);
  const access = Number(realityFactors.access || 1);
  const support = Number(realityFactors.support || 1);
  const complexity = Number(realityFactors.complexity || 1);
  const normativeTime = Number(task.normativeTime || 0);
  const baseTime = task.isFixedTime ? normativeTime : normativeTime * safeQuantity;
  const totalCoefficient = access * support * complexity;
  const correctedTime = baseTime * totalCoefficient;
  const billingMode = task.billingMode === "fixed" ? "fixed" : "time";
  const fixedAmountHt = Math.max(0, Number(task.fixedAmountHt || 0));
  const laborCost = billingMode === "fixed" ? fixedAmountHt : correctedTime * hourlyRate;
  const adjustmentPercent = Math.max(0, Number(task.adjustmentPercent || 0));
  const discountPercent = Math.max(0, Number(task.discountPercent || 0));

  const materialLines = (task.materialRequirements || []).map((requirement) => {
    const product = selectedProducts.find((candidate) => candidate.category === requirement.productCategory);
    const yieldValue = Number(requirement.yield || 0);
    const quantityNeeded = requirement.isFixedQuantity ? 1 : yieldValue > 0 ? safeQuantity / yieldValue : 0;
    const unitsToBuy = Math.ceil(quantityNeeded);
    const unitPrice = Number(product?.priceHt ?? product?.salePriceHt ?? requirement.defaultPricePerUnit ?? 0);
    return {
      category: requirement.productCategory,
      productId: product?.id || "",
      productName: product?.name || "",
      quantityNeeded,
      unitsToBuy,
      unitPrice,
      total: unitsToBuy * unitPrice,
      showToClient: task.showMaterialsToClient !== false
    };
  });
  const materialCost = materialLines.reduce((sum, line) => sum + line.total, 0);

  const totalHtBase = laborCost + materialCost;
  const adjustmentAmount = totalHtBase * (adjustmentPercent / 100);
  const totalHtAfterAdjustment = totalHtBase + adjustmentAmount;
  const discountAmount = totalHtAfterAdjustment * (discountPercent / 100);
  const totalHt = Math.max(0, totalHtAfterAdjustment - discountAmount);
  const vatAmount = totalHt * vatRate;

  return {
    totalTimeHours: baseTime,
    correctedTimeHours: correctedTime,
    totalCoefficient,
    coefficients: { access, support, complexity },
    hourlyRate,
    billingMode,
    fixedAmountHt,
    laborCost,
    materialCost,
    materialLines,
    totalHtBase,
    adjustmentPercent,
    adjustmentAmount,
    discountPercent,
    discountAmount,
    vatAmount,
    totalHt,
    totalTtc: totalHt + vatAmount,
    method: {
      baseTimeFormula: task.isFixedTime ? "temps fixe" : "quantite x temps normatif",
      laborFormula: billingMode === "fixed" ? "montant forfaitaire HT" : "temps corrige x taux horaire",
      materialFormula: "quantite / rendement, arrondi a l'unite d'achat",
      adjustmentFormula: "surcout ouvrage en pourcentage",
      discountFormula: "remise ouvrage en pourcentage",
      totalFormula: "main d'oeuvre + fournitures + ajustement - reduction, puis TVA"
    }
  };
}

export function euro(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);
}

export function shortDate(value) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}
