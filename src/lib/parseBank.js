import { format, parse } from "date-fns";

/**
 * Parse tab-separated bank export text.
 */
export function parseBankCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trimEnd());
  if (lines.length < 2) return { error: "Not enough rows." };

  const headers = lines[0].split("\t").map(h => h.trim().replace(/^"|"$/g, ""));

  const col = (name) => headers.findIndex(h => h.toLowerCase().replace(/\s/g, "").includes(name.toLowerCase().replace(/\s/g, "")));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 3) continue;

    const get = (name) => { const idx = col(name); return idx >= 0 ? cells[idx] : ""; };
    const parseNum = (v) => parseFloat((v || "0").replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;

    const rawDate = get("Date");
    let dateISO = rawDate;
    try {
      const parsed = parse(rawDate, "dd/MM/yyyy", new Date());
      if (!isNaN(parsed)) dateISO = format(parsed, "yyyy-MM-dd");
    } catch {}

    const month = dateISO.slice(0, 7);

    rows.push({
      date: dateISO,
      month,
      code: get("Code"),
      type: get("Type"),
      reference: get("Reference"),
      payment_ref: get("Payment Reference") || get("PaymentReference") || get("Paymentref"),
      status: get("Status"),
      amount_out: parseNum(get("Amount Out") || get("AmountOut")),
      amount_in: parseNum(get("Amount In") || get("AmountIn")),
      fees: parseNum(get("Fees") || get("Fee")),
      balance: parseNum(get("Balance")),
      review_status: "To review",
    });
  }

  if (!rows.length) return { error: "No data rows found." };
  return { rows };
}

/**
 * Apply basic heuristic categorisation to bank rows.
 * Fine-tuning happens in the Review Bank page.
 */
export function applyBankMapping(rows) {
  return rows.map(r => {
    const ref = (r.reference + " " + r.payment_ref).toLowerCase();

    let costType = undefined;
    let channel = undefined;

    // Very basic heuristics — user will review and correct
    if (ref.includes("sumup") || ref.includes("card") || ref.includes("settlement")) {
      costType = "Ignore"; // SumUp settlements are income not costs
    } else if (ref.includes("shipping") || ref.includes("colissimo") || ref.includes("chronopost") || ref.includes("mondialrelay") || ref.includes("dhl") || ref.includes("ups")) {
      costType = "Shipping Cost";
      channel = "Online Shop";
    } else if (ref.includes("meat") || ref.includes("abattoir") || ref.includes("boucher") || ref.includes("eleveur")) {
      costType = "Meat Purchase";
    }

    // Compute counted fields based on cost_type
    const amountOut = r.amount_out || 0;
    const shippingCost = costType === "Shipping Cost" ? amountOut : 0;
    const operatingExpenses = costType === "Operating Expense" ? amountOut : 0;
    const eventCost = costType === "Event Cost" ? amountOut : 0;
    const meatPurchase = costType === "Meat Purchase" ? amountOut : 0;

    const reviewStatus = costType ? (costType === "Ignore" ? "Ignore" : "OK") : "To review";

    return {
      ...r,
      cost_type: costType,
      channel,
      review_status: reviewStatus,
      counted_expense: amountOut,
      shipping_cost: shippingCost,
      operating_expenses: operatingExpenses,
      event_cost: eventCost,
      meat_purchase: meatPurchase,
    };
  });
}