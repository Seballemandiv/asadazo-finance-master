import { format, parse, parseISO } from "date-fns";

/**
 * Parse tab-separated SumUp export text into row objects.
 */
export function parseSumUpCSV(text) {
  const lines = text.trim().split("\n").map(l => l.trimEnd());
  if (lines.length < 2) return { error: "Not enough rows — need a header + at least one data row." };

  const headers = lines[0].split("\t").map(h => h.trim().replace(/^"|"$/g, ""));

  // Flexible column mapping
  const col = (name) => {
    const idx = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    return idx;
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t").map(c => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 5) continue;

    const get = (name) => {
      const idx = col(name);
      return idx >= 0 ? cells[idx] : "";
    };

    const parseNum = (v) => {
      if (!v) return 0;
      return parseFloat(v.replace(",", ".").replace(/[^0-9.\-]/g, "")) || 0;
    };

    const rawDate = get("Date");
    const rawTime = get("Time") || "00:00:00";
    let dateStr = rawDate;
    // try parse dd/mm/yyyy or mm/dd/yyyy
    let dateISO = rawDate;
    try {
      // SumUp usually exports DD/MM/YYYY
      const parsed = parse(rawDate, "dd/MM/yyyy", new Date());
      if (!isNaN(parsed)) dateISO = format(parsed, "yyyy-MM-dd");
    } catch {}

    const month = dateISO.slice(0, 7); // YYYY-MM

    const type = get("Type");
    const transactionId = get("Transaction ID");
    const paymentMethod = get("Payment Method");
    const qty = parseNum(get("Quantity")) || 1;
    const product = get("Product");
    const category = get("Category");
    const sku = get("SKU");
    const currency = get("Currency") || "EUR";
    const gross = parseNum(get("Gross") || get("Price (Gross)") || get("Gross Amount"));
    const net = parseNum(get("Net") || get("Price (Net)") || get("Net Amount"));
    const tax = parseNum(get("Tax") || get("VAT"));
    const taxRate = get("Tax rate") || get("VAT rate") || "";

    rows.push({
      date: dateISO,
      month,
      type,
      transaction_id: transactionId,
      payment_method: paymentMethod,
      qty,
      product,
      category,
      sku,
      currency,
      gross_inc_vat: gross,
      net_ex_vat: net,
      vat: tax,
      vat_rate: taxRate,
      mapping_status: "To review",
    });
  }

  if (!rows.length) return { error: "No data rows found. Check the format." };
  return { rows };
}

/**
 * Apply ProductMapping and CutCost data to enrich parsed rows.
 */
export function applySalesMapping(rows, mappings, cutCosts) {
  const mapIndex = {};
  for (const m of mappings) {
    mapIndex[m.product_name?.toLowerCase()?.trim()] = m;
  }
  const cutIndex = {};
  for (const c of cutCosts) {
    cutIndex[c.cut?.toLowerCase()?.trim()] = c;
  }

  return rows.map(r => {
    const mapping = mapIndex[r.product?.toLowerCase()?.trim()];

    if (!mapping || mapping.status === "Ignore") {
      return {
        ...r,
        mapping_status: mapping?.status === "Ignore" ? "Ignore" : "To review",
      };
    }

    const revenueType = mapping.revenue_type || "Other Revenue";
    const channel = mapping.channel || "Other";
    const cut = mapping.cut || "";
    const kgPerUnit = mapping.kg_per_unit || 0;
    let costPerKg = mapping.cost_per_kg || 0;

    // Look up cost from CutCost table if available
    if (cut && cutIndex[cut.toLowerCase().trim()]) {
      costPerKg = cutIndex[cut.toLowerCase().trim()].cost_per_kg || costPerKg;
    }

    const meatCogs = revenueType === "Meat" ? (r.qty || 1) * kgPerUnit * costPerKg : 0;

    // Revenue breakdown
    const net = r.net_ex_vat || 0;
    const productRevenueExVat = ["Meat", "Box", "Custom Revenue"].includes(revenueType) ? net : 0;
    const shippingRevenueExVat = revenueType === "Shipping" ? net : 0;
    const eventRevenueExVat = revenueType === "Event" ? net : 0;
    const otherRevenueExVat = revenueType === "Other Revenue" ? net : 0;

    return {
      ...r,
      revenue_type: revenueType,
      channel,
      cut,
      kg_per_unit: kgPerUnit,
      cost_per_kg: costPerKg,
      meat_cogs: meatCogs,
      product_revenue_ex_vat: productRevenueExVat,
      shipping_revenue_ex_vat: shippingRevenueExVat,
      event_revenue_ex_vat: eventRevenueExVat,
      other_revenue_ex_vat: otherRevenueExVat,
      mapping_status: mapping.status === "OK" ? "OK" : "To review",
    };
  });
}