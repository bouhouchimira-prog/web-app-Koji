// Modele compositionnel (24 oct, bibliotheque v0) — remplace le produit a
// 3 facteurs access*support*complexity (toujours fige a 1, aucune UI ne
// les alimentait, voir lib/plan precedent) par une ponderation par
// sensibilite sur 7 facteurs de situation, collectes une fois par devis
// (DevisEditor.jsx) plutot que par ligne : `situationFactors` remplace
// `realityFactors` — unique appelant existant (DevisEditor.jsx), aucun
// autre call site, changement assume sans compatibilite retro.
// `task.sensitivities` (copie depuis l'ouvrage catalogue par
// sourceToTask) donne, pour les facteurs qui concernent cet ouvrage
// (nature G/P/F), un poids de 0 (aucun effet) a 1 (effet plein) :
//   facteurMultiplicateur = Π (1 + (valeurFacteur − 1) × sensibilite)
// `task.fixedTime` (ex "Temps fixe (h)") s'ajoute une fois par ligne,
// jamais multiplie par la quantite ni par les facteurs — meme principe
// que le fichier source. `task.parameterMultiplier`/
// `task.parameterHoursAdd` (resolus par DevisEditor depuis le choix de
// parametre sur la ligne, voir lineSettings[id].parameterChoices)
// s'appliquent respectivement au temps de base et au temps fixe.
function factorMultiplier(situationFactors, sensitivities) {
  const entries = Object.entries(sensitivities || {});
  if (!entries.length) return 1;
  return entries.reduce((acc, [key, sensitivity]) => {
    const factorValue = Number(situationFactors?.[key] ?? 1);
    const s = Number(sensitivity || 0);
    return acc * (1 + (factorValue - 1) * s);
  }, 1);
}

export function calculateTaskPrice({
  task,
  quantity,
  situationFactors = {},
  pricingProfile,
  selectedProducts = []
}) {
  const safeQuantity = Number(quantity || 0);
  const hourlyRate = Number(pricingProfile.hourlyRate || 0);
  const vatRate = Number(pricingProfile.vatRate || 0);
  const normativeTime = Number(task.normativeTime || 0);
  const fixedTime = Number(task.fixedTime || 0);
  const parameterMultiplier = Number(task.parameterMultiplier ?? 1) || 1;
  const parameterHoursAdd = Number(task.parameterHoursAdd || 0);
  const totalCoefficient = factorMultiplier(situationFactors, task.sensitivities);
  const baseTime = (task.isFixedTime ? normativeTime : normativeTime * safeQuantity) * parameterMultiplier;
  const correctedTime = baseTime * totalCoefficient + fixedTime + parameterHoursAdd;
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
    fixedTime,
    parameterMultiplier,
    parameterHoursAdd,
    situationFactors: { ...situationFactors },
    sensitivities: task.sensitivities || {},
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
      baseTimeFormula: task.isFixedTime ? "temps fixe" : "quantite x temps de base x multiplicateur de parametre",
      laborFormula: billingMode === "fixed" ? "montant forfaitaire HT" : "(temps corrige + temps fixe) x taux horaire",
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
