function rowNet(r) {
  if (r.net_amount_ex_vat != null) return Number(r.net_amount_ex_vat) || 0;
  if (r.net_ex_vat != null) return Number(r.net_ex_vat) || 0;
  const gross = Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0);
  const vat = Number(r.vat_amount || r.vat || 0);
  return gross - vat;
}

function isEventSale(r) {
  return r.revenue_type === "Event" || r.channel === "Event";
}

export function computeMetrics(sales, bank, transactions = []) {
  // Online-shop dashboard: events are excluded from operating profit.
  const activeSales = sales.filter(r => r.mapping_status !== "Ignore" && !isEventSale(r));
  const okBank = bank.filter(r => r.review_status === "OK");
  const refunds = okBank.reduce((s, r) => s + Number(r.refund_amount || 0), 0);

  const productRevenue = activeSales.filter(r => r.revenue_type === "Meat" || r.revenue_type === "Box").reduce((s, r) => s + (Number(r.product_revenue_ex_vat) || rowNet(r)), 0);
  const shippingRevenue = activeSales.filter(r => r.revenue_type === "Shipping").reduce((s, r) => s + (Number(r.shipping_revenue_ex_vat) || rowNet(r)), 0);
  const eventRevenueExcluded = sales.filter(r => r.mapping_status !== "Ignore" && isEventSale(r)).reduce((s, r) => s + rowNet(r), 0);
  const otherRevenueBeforeRefunds = activeSales.filter(r => r.revenue_type === "Custom Revenue" || r.revenue_type === "Other Revenue").reduce((s, r) => s + (Number(r.other_revenue_ex_vat) || rowNet(r)), 0);
  const otherRevenue = otherRevenueBeforeRefunds - refunds;
  const unmappedRevenue = activeSales.filter(r => !r.revenue_type || r.mapping_status === "To review").reduce((s, r) => s + rowNet(r), 0);

  const grossSalesRevenue = activeSales.reduce((s, r) => s + rowNet(r), 0);
  const totalRevenue = grossSalesRevenue - refunds;
  const salesIncVat = activeSales.reduce((s, r) => s + Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0), 0);
  const meatCogs = activeSales.reduce((s, r) => s + Number(r.meat_cogs || 0), 0);

  const unmappedCogs = activeSales.filter(r => {
    if (r.mapping_status === "Ignore") return false;
    if (r.mapping_status === "To review") return true;
    if (!r.revenue_type) return true;
    if (["Meat", "Box"].includes(r.revenue_type)) return !Number(r.kg_per_unit) || !Number(r.cost_per_kg);
    return false;
  }).length;

  const operatingExpenses = okBank.reduce((s, r) => s + Number(r.operating_expenses || 0), 0);
  const carRentalNL = okBank.reduce((s, r) => s + Number(r.car_rental_nl || 0), 0);
  const transportSpainToAmsterdam = okBank.reduce((s, r) => s + Number(r.transport_spain_to_amsterdam || 0), 0);
  const shippingCosts = okBank.reduce((s, r) => s + Number(r.shipping_cost || 0), 0);
  const eventCostsExcluded = okBank.reduce((s, r) => s + Number(r.event_cost || 0), 0);
  const meatPurchases = okBank.reduce((s, r) => s + Number(r.meat_purchase || 0), 0);
  const paymentFees = transactions.reduce((s, r) => s + Math.abs(Number(r.transaction_fee || 0)), 0);

  const paymentProcessorPayouts = okBank.filter(r => r.cost_type === "Payment Processor Payout").reduce((s, r) => s + Number(r.amount_in || 0), 0);
  const loanInPayback = okBank.filter(r => r.cost_type === "Loan In / Payback").reduce((s, r) => s + Number(r.amount_in || 0), 0);
  const loanOut = okBank.filter(r => r.cost_type === "Loan Out").reduce((s, r) => s + Number(r.amount_out || 0), 0);

  const grossProfit = totalRevenue - meatCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalCosts = meatCogs + operatingExpenses + carRentalNL + transportSpainToAmsterdam + shippingCosts + paymentFees;
  const operatingProfit = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (operatingProfit / totalRevenue) * 100 : 0;

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
    eventRevenue: 0,
    eventRevenueExcluded,
    otherRevenue,
    unmappedRevenue,
    meatCogs,
    unmappedCogs,
    operatingExpenses,
    carRentalNL,
    transportSpainToAmsterdam,
    shippingCosts,
    eventCosts: 0,
    eventCostsExcluded,
    paymentFees,
    meatPurchases,
    totalCosts,
    grossProfit,
    grossMarginPct,
    operatingProfit,
    marginPct,
    orderCount,
    salesPendingReview,
    bankPendingReview,
    paymentProcessorPayouts,
    loanInPayback,
    loanOut,
  };
}

export function computeEventMetrics(sales, bank, transactions = []) {
  const eventSales = sales.filter(r => r.mapping_status !== "Ignore" && isEventSale(r));
  const eventBank = bank.filter(r => r.review_status === "OK" && (r.cost_type === "Event Cost" || r.channel === "Event"));
  const eventTransactions = transactions.filter(r => r.channel === "Event");

  const revenue = eventSales.reduce((s, r) => s + rowNet(r), 0);
  const cogs = eventSales.reduce((s, r) => s + Number(r.meat_cogs || 0), 0);
  const costs = eventBank.reduce((s, r) => s + Number(r.event_cost || 0), 0);
  const paymentFees = eventTransactions.reduce((s, r) => s + Math.abs(Number(r.transaction_fee || 0)), 0);
  const grossProfit = revenue - cogs;
  const totalCosts = cogs + costs + paymentFees;
  const eventProfit = revenue - totalCosts;
  const marginPct = revenue > 0 ? (eventProfit / revenue) * 100 : 0;
  const pendingSales = sales.filter(r => isEventSale(r) && r.mapping_status === "To review").length;
  const pendingBank = bank.filter(r => (r.cost_type === "Event Cost" || r.channel === "Event") && r.review_status === "To review").length;

  return {
    revenue,
    cogs,
    costs,
    paymentFees,
    grossProfit,
    totalCosts,
    eventProfit,
    marginPct,
    eventRows: eventSales.length,
    bankRows: eventBank.length,
    pendingSales,
    pendingBank,
  };
}
