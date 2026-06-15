function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBankSearchText(record) {
  return normalizeText([record?.reference, record?.payment_ref, record?.counterparty, record?.type, record?.category, record?.status].filter(Boolean).join(" "));
}

function amountOut(record) { return Number(record?.amount_out || 0); }
function amountIn(record) { return Number(record?.amount_in || 0); }
function hasAny(text, words) { return words.some(w => text.includes(normalizeText(w))); }
function isPnlExpense(costType) { return ["Operating Expense", "Shipping Cost", "Event Cost", "Payment Employees", "Car rental NL", "Transport Spain to Amsterdam"].includes(costType); }

function buildUpdate({ cost_type, module = "Other", channel = "Other", review_status = "OK", amount = 0, incomingAmount = 0, event_id = "", event_name = "" }) {
  const isExpenseRefund = cost_type === "Expense Refund";
  const signedCarRental = cost_type === "Car rental NL" ? amount - incomingAmount : 0;
  const signedSpainTransport = cost_type === "Transport Spain to Amsterdam" ? amount - incomingAmount : 0;
  const genericRefund = isExpenseRefund ? incomingAmount : 0;
  const employeePayment = cost_type === "Payment Employees" || channel === "Payment Employees" ? amount : 0;
  const eventProfit = cost_type === "Event Profit" || channel === "Event Profit" ? incomingAmount : 0;
  return {
    cost_type,
    module,
    channel,
    event_id,
    event_name,
    review_status,
    counted_expense: isPnlExpense(cost_type) ? amount : (isExpenseRefund ? -genericRefund : 0),
    shipping_cost: cost_type === "Shipping Cost" ? amount : 0,
    operating_expenses: cost_type === "Operating Expense" || cost_type === "Payment Employees" ? amount : (isExpenseRefund ? -genericRefund : 0),
    car_rental_nl: signedCarRental,
    transport_spain_to_amsterdam: signedSpainTransport,
    event_cost: cost_type === "Event Cost" ? amount : 0,
    event_profit: eventProfit,
    employee_payment: employeePayment,
    meat_purchase: cost_type === "Meat Purchase" ? amount : 0,
    refund_amount: cost_type === "Refund" ? amount : 0,
    expense_refund_amount: genericRefund || (incomingAmount > 0 && ["Car rental NL", "Transport Spain to Amsterdam"].includes(cost_type) ? incomingAmount : 0),
  };
}

function learnedMatch(record, learnedRules = []) {
  const text = getBankSearchText(record);
  const rules = (learnedRules || []).filter(r => r.keyword && r.cost_type && r.review_status === "OK");
  const best = rules.filter(r => text.includes(normalizeText(r.keyword))).sort((a, b) => normalizeText(b.keyword).length - normalizeText(a.keyword).length)[0];
  if (!best) return null;
  return buildUpdate({ cost_type: best.cost_type, module: best.module || best.channel || "Other", channel: best.channel || "Other", review_status: "OK", amount: amountOut(record), incomingAmount: amountIn(record), event_id: best.event_id || "", event_name: best.event_name || "" });
}

export function buildLearnedBankRules(records = []) {
  const seen = new Map();
  for (const r of records) {
    if (r.review_status !== "OK" || !r.cost_type || ["Manual Review", "Ignore"].includes(r.cost_type)) continue;
    const text = getBankSearchText(r);
    const firstWords = text.split(" ").filter(Boolean).slice(0, 3).join(" ");
    if (firstWords.length < 4) continue;
    if (!seen.has(firstWords)) seen.set(firstWords, { keyword: firstWords, cost_type: r.cost_type, module: r.module || "Other", channel: r.channel || "Other", event_id: r.event_id || "", event_name: r.event_name || "", review_status: "OK" });
  }
  return Array.from(seen.values());
}

export function classifyBankTransaction(record, learnedRules = []) {
  const text = getBankSearchText(record);
  const out = amountOut(record);
  const incoming = amountIn(record);
  const learned = learnedMatch(record, learnedRules);
  if (learned) return learned;
  if ((incoming > 0 || out > 0) && hasAny(text, ["diks", "autoverhuur", "mollie diks", "car rental", "rental car", "huurauto", "free2move", "greenwheels", "miles", "sixt", "hertz", "avis"])) return buildUpdate({ cost_type: "Car rental NL", module: "Other", channel: "Car rental NL", review_status: "OK", amount: out, incomingAmount: incoming });
  if (out > 0 && hasAny(text, ["ondara", "volanti", "cargo", "dlg", "warehouse", "almacen", "transport spain", "spain amsterdam", "malaga", "valencia", "pallet", "freight", "groupage", "logistics spain"])) return buildUpdate({ cost_type: "Transport Spain to Amsterdam", module: "Online Shop", channel: "Transport Spain to Amsterdam", review_status: "OK", amount: out });
  if (incoming > 0 && hasAny(text, ["mct pid", "sumup", "stichting derdengelden", "payout", "uitbetaling", "mctx", "betaling ontvangen", "mollie"])) return buildUpdate({ cost_type: "Payment Processor Payout", module: "Online Shop", channel: "Other", review_status: "OK", amount: 0, incomingAmount: incoming });
  if (incoming > 0 && hasAny(text, ["event profit", "event revenue", "cash event", "event cash", "tlx cash", "festival cash", "chef table", "private dining", "private dinning"])) return buildUpdate({ cost_type: "Event Profit", module: "Event", channel: "Event Profit", review_status: "To review", amount: 0, incomingAmount: incoming });
  if (incoming > 0 && hasAny(text, ["sebastian", "seba", "allemandi", "javier", "rizzo", "owner", "prive", "private", "loan", "lening", "payback", "terugbetaling"])) return buildUpdate({ cost_type: "Loan In / Payback", module: "Other", channel: "Other", review_status: "OK", amount: 0, incomingAmount: incoming });
  if (incoming > 0) return buildUpdate({ cost_type: "Transfer / Reconciliation", module: "Other", channel: "Other", review_status: "To review", amount: 0, incomingAmount: incoming });
  if (out <= 0) return buildUpdate({ cost_type: "Manual Review", module: "Other", channel: "Other", review_status: "To review", amount: 0, incomingAmount: incoming });
  if (hasAny(text, ["refund", "terugbetaling", "retour", "reversal", "restitutie", "chargeback", "dispute", "storno", "terugboeking"])) return buildUpdate({ cost_type: "Refund", module: "Online Shop", channel: "Other", review_status: "OK", amount: out });
  if (hasAny(text, ["la maxima", "lamaxima", "mercadrian", "adrian", "meat boys", "meatboys", "carnicer", "slager", "beef", "vlees", "meat", "proveedor", "supplier"])) return buildUpdate({ cost_type: "Meat Purchase", module: "Online Shop", channel: "Stock / Supplier", review_status: "OK", amount: out });
  if (hasAny(text, ["dhl", "postnl", "ups", "dpd", "fedex", "gls", "shipping", "delivery", "koerier", "courier"])) return buildUpdate({ cost_type: "Shipping Cost", module: "Online Shop", channel: "Shipping", review_status: "OK", amount: out });
  if (hasAny(text, ["chef table", "chef-table", "private dining", "private dinning", "catering", "workshop"])) return buildUpdate({ cost_type: "Event Cost", module: "Event", channel: hasAny(text, ["chef table", "chef-table"]) ? "Chef Table Experience" : "Private Dining", review_status: "To review", amount: out });
  if (hasAny(text, ["festival", "event", "venue", "atelier", "code noir", "bouncespace", "bloomingdale", "macumba", "fourvenues", "ticket", "tlx", "stand", "kraam", "tent", "sound", "dj"])) return buildUpdate({ cost_type: "Event Cost", module: "Event", channel: "Other", review_status: "To review", amount: out });
  if (hasAny(text, ["salary", "salaris", "employee", "payroll", "staff payment", "crew", "parrillero", "chef", "waiter", "waitress"])) return buildUpdate({ cost_type: "Payment Employees", module: "Other", channel: "Payment Employees", review_status: "OK", amount: out });
  if (hasAny(text, ["shell", "bp", "esso", "total", "tango", "fuel", "benzine", "parking", "parkeren", "praxis", "gamma", "hornbach", "action", "bol com", "amazon", "ikea", "makro", "hanos", "sligro", "kvk", "belastingdienst", "gemeente", "tax", "bankkosten", "bank cost", "fee", "kosten", "google", "meta", "facebook", "instagram", "shopify", "canva", "notion", "base44", "netlify", "vercel", "jumbo", "bagels beans", "ft store"])) return buildUpdate({ cost_type: "Operating Expense", module: "Other", channel: "Other", review_status: "OK", amount: out });
  if (hasAny(text, ["sebastian", "seba", "allemandi", "javier", "rizzo", "owner", "prive", "private"])) return buildUpdate({ cost_type: "Loan Out", module: "Other", channel: "Other", review_status: "OK", amount: 0 });
  return buildUpdate({ cost_type: "Manual Review", module: "Other", channel: "Other", review_status: "To review", amount: 0 });
}

export function applyBankRule(record, learnedRules = []) { return classifyBankTransaction(record, learnedRules); }
