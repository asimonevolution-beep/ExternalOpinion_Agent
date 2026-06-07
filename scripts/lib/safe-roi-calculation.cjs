function safeRoiCalculation(engineData) {
  const expectedRevenue = Number(engineData.expectedRevenue);
  const totalCosts = Number(engineData.totalCosts);

  if (!Number.isFinite(expectedRevenue)) {
    return null;
  }

  if (!Number.isFinite(totalCosts)) {
    return null;
  }

  if (totalCosts === 0) {
    return null;
  }

  const roi = ((expectedRevenue - totalCosts) / totalCosts) * 100;
  return Number(roi.toFixed(1));
}

module.exports = { safeRoiCalculation };
