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

function amountOut(record) {
  return Number(record?.amount_out || 0);
}

function amountIn(record) {
  return Number(record?.amount_in || 0);
}

function hasAny(text, words) {
  return words.some(w => text.includes(normalizeText(w)));
}

function buildUpdate({ cost_type, channel = "Other", review_status = "OK", amount = 0 }) {
  const isIgnore = cost_type === "Ignore" || review_status === "Ignore";
  return {
    cost_type,
    channel,
    review_status: isIgnore ? "Ignore" : review_status,
    counted_expense: isIgnore || cost_type === "Meat Purchase" || cost_type === "Owner Payment" ? 0 : amount,
    shipping_cost: cost_type === "Shipping Cost" ? amount : 0,
    operating_expenses: cost_type === "Operating Expense" ? amount : 0,
    event_cost: cost_type === "Event Cost" ? amount : 0,
    meat_purchase: cost_type === "Meat Purchase" ? amount : 0,
  };
}

export function classifyBankTransaction(record) {
  const text = getBankSearchText(record);
  const out = amountOut(record);
  const incoming = amountIn(record);

  // Incoming SumUp payouts are reconciliation, not revenue. Revenue comes from SumUp Sales.
  if (incoming > 0 && hasAny(text, ["sumup", "stichting derdengelden", "payout", "uitbetaling", "mctx", "betaling ontvangen"])) {
    return buildUpdate({ cost_type: "Ignore", channel: "Online Shop", review_status: "Ignore", amount: 0 });
  }

  // Other incoming transfers/refunds: keep out of P&L by default, review only if unclear.
  if (incoming > 0) {
    if (hasAny(text, ["refund", "terugbetaling", "retour", "reversal", "restitutie"])) {
      return buildUpdate({ cost_type: "Ignore", channel: "Other", review_status: "Ignore", amount: 0 });
    }
    return buildUpdate({ cost_type: "Ignore", channel: "Other", review_status: "Ignore", amount: 0 });
  }

  if (out <= 0) {
    return null;
  }

  // Meat suppliers / inventory purchases. These are cash movement / stock purchases,
  // not COGS. COGS comes from Sales x Monthly Prices.
  if (hasAny(text, [
    "la maxima", "lamaxima", "mercadrian", "adrian", "meat boys", "meatboys", "ondara",
    "carnicer", "slager", "beef", "vlees", "meat", "proveedor", "supplier"
  ])) {
    return buildUpdate({ cost_type: "Meat Purchase", channel: "Online Shop", review_status: "OK", amount: out });
  }

  // Shipping / delivery / logistics.
  if (hasAny(text, [
    "dhl", "postnl", "ups", "dpd", "fedex", "gls", "transport", "logistic", "logistics",
    "pallet", "freight", "shipment", "shipping", "delivery", "koerier", "courier"
  ])) {
    return buildUpdate({ cost_type: "Shipping Cost", channel: "Online Shop", review_status: "OK", amount: out });
  }

  // Event-specific costs.
  if (hasAny(text, [
    "festival", "event", "venue", "atelier", "code noir", "bouncespace", "bloomingdale",
    "macumba", "fourvenues", "ticket", "tlx", "stand", "kraam", "tent", "sound", "dj"
  ])) {
    return buildUpdate({ cost_type: "Event Cost", channel: "Event", review_status: "OK", amount: out });
  }

  // Vehicle/fuel/parking and general business operations.
  if (hasAny(text, [
    "free2move", "greenwheels", "miles", "sixt", "hertz", "avis", "rental", "rent a car",
    "shell", "bp", "esso", "total", "tango", "fuel", "benzine", "parking", "parkeren",
    "praxis", "gamma", "hornbach", "action", "bol com", "amazon", "ikea", "makro", "hanos", "sligro",
    "kvk", "belastingdienst", "gemeente", "tax", "bankkosten", "bank cost", "fee", "kosten",
    "google", "meta", "facebook", "instagram", "shopify", "canva", "notion", "base44", "netlify", "vercel"
  ])) {
    return buildUpdate({ cost_type: "Operating Expense", channel: "Other", review_status: "OK", amount: out });
  }

  // Owner payments / private transfers should not be counted as operating cost.
  if (hasAny(text, ["sebastian", "seba", "allemandi", "javier", "rizzo", "owner", "prive", "private", "salary", "salaris"])) {
    return buildUpdate({ cost_type: "Owner Payment", channel: "Other", review_status: "OK", amount: out });
  }

  return null;
}

export function applyBankRule(record) {
  const update = classifyBankTransaction(record);
  if (update) return update;
  return {
    review_status: "To review",
  };
}
