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
  return normalizeText([
    record?.reference,
    record?.payment_ref,
    record?.counterparty,
    record?.type,
    record?.category,
    record?.status,
  ].filter(Boolean).join(" "));
}

function amountOut(record) { return Number(record?.amount_out || 0); }
function amountIn(record) { return Number(record?.amount_in || 0); }
function hasAny(text, words) { return words.some(w => text.includes(normalizeText(w))); }

function isPnlExpense(costType) {
  return ["Operating Expense", "Shipping Cost", "Event Cost"].includes(costType);
}

function buildUpdate({ cost_type, channel = "Other", review_status = "OK", amount = 0, incomingAmount = 0 }) {
  const expenseRefund = cost_type === "Expense Refund" ? incomingAmount : 0;
  return {
    cost_type,
    channel,
    review_status,
    counted_expense: isPnlExpense(cost_type) ? amount : (cost_type === "Expense Refund" ? -expenseRefund : 0),
    shipping_cost: cost_type === "Shipping Cost" ? amount : 0,
    operating_expenses: cost_type === "Operating Expense" ? amount : (cost_type === "Expense Refund" ? -expenseRefund : 0),
    event_cost: cost_type === "Event Cost" ? amount : 0,
    meat_purchase: cost_type === "Meat Purchase" ? amount : 0,
    refund_amount: cost_type === "Refund" ? amount : 0,
    expense_refund_amount: expenseRefund,
  };
}

export function classifyBankTransaction(record) {
  const text = getBankSearchText(record);
  const out = amountOut(record);
  const incoming = amountIn(record);

  // Diks / car-rental deposit logic:
  // - outgoing charge is temporarily counted as Operating Expense
  // - incoming refund reduces Operating Expense
  // If the refund went to a personal account, add a manual positive Expense Refund line.
  if (incoming > 0 && hasAny(text, ["diks", "autoverhuur", "car rental", "rental car", "huurauto"])) {
    return buildUpdate({ cost_type: "Expense Refund", channel: "Other", review_status: "OK", incomingAmount: incoming });
  }

  if (out > 0 && hasAny(text, ["diks", "autoverhuur", "mollie diks", "car rental", "rental car", "huurauto"])) {
    return buildUpdate({ cost_type: "Operating Expense", channel: "Other", review_status: "OK", amount: out });
  }

  // MCT PID rows are Mollie/SumUp/card payout-style incoming payments in this bank export.
  // They are not revenue: revenue is imported from SumUp Sales. They are reconciled cash-in.
  if (incoming > 0 && hasAny(text, ["mct pid", "sumup", "stichting derdengelden", "payout", "uitbetaling", "mctx", "betaling ontvangen", "mollie"])) {
    return buildUpdate({ cost_type: "Payment Processor Payout", channel: "Online Shop", review_status: "OK", amount: 0 });
  }

  if (incoming > 0 && hasAny(text, ["sebastian", "seba", "allemandi", "javier", "rizzo", "owner", "prive", "private", "loan", "lening", "payback", "terugbetaling"])) {
    return buildUpdate({ cost_type: "Loan In / Payback", channel: "Other", review_status: "OK", amount: 0 });
  }

  if (incoming > 0) {
    return buildUpdate({ cost_type: "Transfer / Reconciliation", channel: "Other", review_status: "To review", amount: 0 });
  }

  if (out <= 0) return buildUpdate({ cost_type: "Manual Review", channel: "Other", review_status: "To review", amount: 0 });

  if (hasAny(text, ["refund", "terugbetaling", "retour", "reversal", "restitutie", "chargeback", "dispute", "storno", "terugboeking"])) {
    return buildUpdate({ cost_type: "Refund", channel: "Online Shop", review_status: "OK", amount: out });
  }

  if (hasAny(text, [
    "la maxima", "lamaxima", "mercadrian", "adrian", "meat boys", "meatboys", "ondara",
    "carnicer", "slager", "beef", "vlees", "meat", "proveedor", "supplier"
  ])) {
    return buildUpdate({ cost_type: "Meat Purchase", channel: "Online Shop", review_status: "OK", amount: out });
  }

  if (hasAny(text, [
    "dhl", "postnl", "ups", "dpd", "fedex", "gls", "transport", "logistic", "logistics",
    "pallet", "freight", "shipment", "shipping", "delivery", "koerier", "courier"
  ])) {
    return buildUpdate({ cost_type: "Shipping Cost", channel: "Online Shop", review_status: "OK", amount: out });
  }

  if (hasAny(text, [
    "festival", "event", "venue", "atelier", "code noir", "bouncespace", "bloomingdale",
    "macumba", "fourvenues", "ticket", "tlx", "stand", "kraam", "tent", "sound", "dj"
  ])) {
    return buildUpdate({ cost_type: "Event Cost", channel: "Event", review_status: "OK", amount: out });
  }

  if (hasAny(text, [
    "free2move", "greenwheels", "miles", "sixt", "hertz", "avis", "rental", "rent a car",
    "shell", "bp", "esso", "total", "tango", "fuel", "benzine", "parking", "parkeren",
    "praxis", "gamma", "hornbach", "action", "bol com", "amazon", "ikea", "makro", "hanos", "sligro",
    "kvk", "belastingdienst", "gemeente", "tax", "bankkosten", "bank cost", "fee", "kosten",
    "google", "meta", "facebook", "instagram", "shopify", "canva", "notion", "base44", "netlify", "vercel",
    "jumbo", "bagels beans", "ft store"
  ])) {
    return buildUpdate({ cost_type: "Operating Expense", channel: "Other", review_status: "OK", amount: out });
  }

  if (hasAny(text, ["sebastian", "seba", "allemandi", "javier", "rizzo", "owner", "prive", "private", "salary", "salaris"])) {
    return buildUpdate({ cost_type: "Loan Out", channel: "Other", review_status: "OK", amount: 0 });
  }

  return buildUpdate({ cost_type: "Manual Review", channel: "Other", review_status: "To review", amount: 0 });
}

export function applyBankRule(record) {
  return classifyBankTransaction(record);
}
