export function calculateTaskPrice({
  task,
  quantity,
  realityFactors,
  pricingProfile,
  selectedProducts
}) {
  const baseTime = task.isFixedTime ? task.normativeTime : task.normativeTime * quantity;
  const totalCoefficient = realityFactors.access * realityFactors.support * realityFactors.complexity;
  const correctedTime = baseTime * totalCoefficient;
  const laborCost = correctedTime * pricingProfile.hourlyRate;

  const materialCost = task.materialRequirements.reduce((sum, requirement) => {
    const product = selectedProducts.find((candidate) => candidate.category === requirement.productCategory);
    const quantityNeeded = requirement.isFixedQuantity ? 1 : requirement.yield > 0 ? quantity / requirement.yield : 0;
    const unitsToBuy = Math.ceil(quantityNeeded);
    return sum + unitsToBuy * (product?.priceHt ?? requirement.defaultPricePerUnit);
  }, 0);

  const totalHtBeforeMargin = laborCost + materialCost;
  const totalHt = totalHtBeforeMargin * (1 + pricingProfile.marginRate);

  return {
    totalTimeHours: baseTime,
    correctedTimeHours: correctedTime,
    laborCost,
    materialCost,
    totalHt,
    totalTtc: totalHt * (1 + pricingProfile.vatRate)
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
