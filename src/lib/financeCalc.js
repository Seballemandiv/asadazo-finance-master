/**
 * Compute dashboard metrics from filtered SalesRecords and BankTransactions.
 */
export function computeMetrics(sales, bank) {
  // Revenue — only non-ignored records
  const activeSales = sales.filter(r => r.mapping_status !== "Ignore");

  const productRevenue = activeSales.reduce((s, r) => s + (r.product_revenue_ex_vat || 0), 0);
  const shippingRevenue = activeSales.reduce((s, r) => s + (r.shipping_revenue_ex_vat || 0), 0);
  const eventRevenue = activeSales.reduce((s, r) => s + (r.event_revenue_ex_vat || 0), 0);
  const otherRevenue = activeSales.reduce((s, r) => s + (r.other_revenue_ex_vat || 0), 0);

  // fallback: if revenue buckets not filled, use net_ex_vat
  const totalRevenue = (productRevenue + shippingRevenue + eventRevenue + otherRevenue) ||
    activeSales.reduce((s, r) => s + (r.net_ex_vat || 0), 0);

  const meatCogs = activeSales.reduce((s, r) => s + (r.meat_cogs || 0), 0);

  // Costs — only OK-reviewed bank rows that are not ignored
  const activeBank = bank.filter(r => r.review_status !== "Ignore");
  const operatingExpenses = activeBank.reduce((s, r) => s + (r.operating_expenses || 0), 0);
  const shippingCosts = activeBank.reduce((s, r) => s + (r.shipping_cost || 0), 0);
  const eventCosts = activeBank.reduce((s, r) => s + (r.event_cost || 0), 0);
  const meatPurchases = activeBank.reduce((s, r) => s + (r.meat_purchase || 0), 0);

  const totalCosts = meatCogs + operatingExpenses + shippingCosts + eventCosts + meatPurchases;
  const grossProfit = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  return {
    totalRevenue,
    productRevenue,
    shippingRevenue,
    eventRevenue,
    otherRevenue,
    meatCogs,
    operatingExpenses,
    shippingCosts,
    eventCosts,
    meatPurchases,
    totalCosts,
    grossProfit,
    marginPct,
  };
}