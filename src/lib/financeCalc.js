export function computeMetrics(sales, bank) {
  const activeSales = sales.filter(r => r.mapping_status !== "Ignore");

  function rowNet(r) {
    if (r.net_amount_ex_vat != null) return Number(r.net_amount_ex_vat) || 0;
    if (r.net_ex_vat != null) return Number(r.net_ex_vat) || 0;
    const gross = Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0);
    const vat = Number(r.vat_amount || r.vat || 0);
    return gross - vat;
  }

  const okBank = bank.filter(r => r.review_status === "OK");
  const refunds = okBank.reduce((s, r) => s + Number(r.refund_amount || 0), 0);

  const productRevenue = activeSales
    .filter(r => r.revenue_type === "Meat" || r.revenue_type === "Box")
    .reduce((s, r) => s + (Number(r.product_revenue_ex_vat) || rowNet(r)), 0);

  const shippingRevenue = activeSales
    .filter(r => r.revenue_type === "Shipping")
    .reduce((s, r) => s + (Number(r.shipping_revenue_ex_vat) || rowNet(r)), 0);

  const eventRevenue = activeSales
    .filter(r => r.revenue_type === "Event")
    .reduce((s, r) => s + (Number(r.event_revenue_ex_vat) || rowNet(r)), 0);

  const otherRevenueBeforeRefunds = activeSales
    .filter(r => r.revenue_type === "Custom Revenue" || r.revenue_type === "Other Revenue")
    .reduce((s, r) => s + (Number(r.other_revenue_ex_vat) || rowNet(r)), 0);
  const otherRevenue = otherRevenueBeforeRefunds - refunds;

  const unmappedRevenue = activeSales
    .filter(r => !r.revenue_type || r.mapping_status === "To review")
    .reduce((s, r) => s + rowNet(r), 0);

  const grossSalesRevenue = activeSales.reduce((s, r) => s + rowNet(r), 0);
  const totalRevenue = grossSalesRevenue - refunds;
  const salesIncVat = activeSales.reduce((s, r) => s + Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0), 0);
  const meatCogs = activeSales.reduce((s, r) => s + Number(r.meat_cogs || 0), 0);

  const unmappedCogs = activeSales.filter(r => {
    if (r.mapping_status === "Ignore") return false;
    if (r.mapping_status === "To review") return true;
    if (!r.revenue_type) return true;
    if (["Meat", "Box", "Event"].includes(r.revenue_type)) {
      return !Number(r.kg_per_unit) || !Number(r.cost_per_kg);
    }
    return false;
  }).length;

  const operatingExpenses = okBank.reduce((s, r) => s + Number(r.operating_expenses || 0), 0);
  const shippingCosts = okBank.reduce((s, r) => s + Number(r.shipping_cost || 0), 0);
  const eventCosts = okBank.reduce((s, r) => s + Number(r.event_cost || 0), 0);
  const meatPurchases = okBank.reduce((s, r) => s + Number(r.meat_purchase || 0), 0);

  const totalCosts = meatCogs + operatingExpenses + shippingCosts + eventCosts;
  const grossProfit = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const orderCount = activeSales.filter(r => r.order_flag === 1 || r.order_flag === "1").length;
  const salesPendingReview = sales.filter(r => r.mapping_status === "To review").length;
  const bankPendingReview = bank.filter(r => r.review_status === "To review").length;

  return {
    totalRevenue,
    grossSalesRevenue,
    refunds,
    salesIncVat,
    productRevenue,
    shippingRevenue,
    eventRevenue,
    otherRevenue,
    unmappedRevenue,
    meatCogs,
    unmappedCogs,
    operatingExpenses,
    shippingCosts,
    eventCosts,
    meatPurchases,
    totalCosts,
    grossProfit,
    marginPct,
    orderCount,
    salesPendingReview,
    bankPendingReview,
  };
}
