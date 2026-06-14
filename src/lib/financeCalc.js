/**
 * Compute dashboard metrics from active SalesRecords and BankTransactions.
 *
 * Source rules:
 * - Revenue comes ONLY from SalesRecord (sumup_sales imports)
 * - ArticleRecord is for cross-check only — not counted as revenue here
 * - SumUpTransactionRecord is for payout/fee reconciliation only — not counted as revenue
 * - BankTransaction drives expense buckets (only OK-reviewed rows)
 * - COGS comes from SalesRecord.meat_cogs (qty × kg_per_unit × cost_per_kg applied during review)
 */
export function computeMetrics(sales, bank) {
  // Revenue — only non-ignored sales records
  const activeSales = sales.filter(r => r.mapping_status !== "Ignore");

  // Per-row net amount: prefer net_amount_ex_vat, fall back to net_ex_vat, then gross - vat
  function rowNet(r) {
    if (r.net_amount_ex_vat != null && r.net_amount_ex_vat !== 0) return r.net_amount_ex_vat;
    if (r.net_ex_vat != null && r.net_ex_vat !== 0) return r.net_ex_vat;
    const gross = r.gross_amount_inc_vat || r.gross_inc_vat || 0;
    const vat = r.vat_amount || r.vat || 0;
    return gross - vat;
  }

  // Revenue buckets — use mapped bucket fields if filled, else fall back to rowNet
  const productRevenue = activeSales
    .filter(r => r.revenue_type === "Meat" || r.revenue_type === "Box")
    .reduce((s, r) => s + (r.product_revenue_ex_vat || rowNet(r)), 0);

  const shippingRevenue = activeSales
    .filter(r => r.revenue_type === "Shipping")
    .reduce((s, r) => s + (r.shipping_revenue_ex_vat || rowNet(r)), 0);

  const eventRevenue = activeSales
    .filter(r => r.revenue_type === "Event")
    .reduce((s, r) => s + (r.event_revenue_ex_vat || rowNet(r)), 0);

  const otherRevenue = activeSales
    .filter(r => r.revenue_type === "Custom Revenue" || r.revenue_type === "Other Revenue")
    .reduce((s, r) => s + (r.other_revenue_ex_vat || rowNet(r)), 0);

  // Total = sum of all active rows net (provisionally — before mapping applied)
  const totalRevenue = activeSales.reduce((s, r) => s + rowNet(r), 0);

  const salesIncVat = activeSales.reduce((s, r) => s + (r.gross_amount_inc_vat || r.gross_inc_vat || 0), 0);

  // COGS from sales mapping
  const meatCogs = activeSales.reduce((s, r) => s + (r.meat_cogs || 0), 0);

  // Has unmapped products (COGS incomplete warning)
  const unmappedCogs = activeSales.filter(r =>
    (r.revenue_type === "Meat" || r.revenue_type === "Box") &&
    (!r.kg_per_unit || r.kg_per_unit === 0) &&
    r.mapping_status !== "Ignore"
  ).length;

  // Costs — only OK-reviewed bank rows
  const okBank = bank.filter(r => r.review_status === "OK");
  const operatingExpenses = okBank.reduce((s, r) => s + (r.operating_expenses || 0), 0);
  const shippingCosts     = okBank.reduce((s, r) => s + (r.shipping_cost || 0), 0);
  const eventCosts        = okBank.reduce((s, r) => s + (r.event_cost || 0), 0);
  const meatPurchases     = okBank.reduce((s, r) => s + (r.meat_purchase || 0), 0);

  const totalCosts  = meatCogs + operatingExpenses + shippingCosts + eventCosts + meatPurchases;
  const grossProfit = totalRevenue - totalCosts;
  const marginPct   = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Order count (distinct order_flag = 1 transaction_ids)
  const orderCount = activeSales.filter(r => r.order_flag === 1 || r.order_flag === "1").length;

  // Pending review counts
  const salesPendingReview = sales.filter(r => r.mapping_status === "To review").length;
  const bankPendingReview  = bank.filter(r => r.review_status === "To review").length;

  return {
    totalRevenue,
    salesIncVat,
    productRevenue,
    shippingRevenue,
    eventRevenue,
    otherRevenue,
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