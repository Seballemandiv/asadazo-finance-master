import { parseNumber } from "./numberParser";

export function normalizeProductName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSalesProductName(record) {
  return record?.product_name || record?.product || record?.description || "";
}

export function getSalesQuantity(record) {
  return parseNumber(record?.quantity ?? record?.qty) ?? 0;
}

export function getSalesNetExVat(record) {
  const net = parseNumber(record?.net_amount_ex_vat ?? record?.net_ex_vat);
  if (net !== null) return net;

  const gross = parseNumber(record?.gross_amount_inc_vat ?? record?.gross_inc_vat) ?? 0;
  const vat = parseNumber(record?.vat_amount ?? record?.vat) ?? 0;
  return gross - vat;
}

export function parseKgFromProductName(productName) {
  const raw = String(productName || "");
  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilo|kilogram)/i);
  if (!match) return 0;
  return parseNumber(match[1]) ?? 0;
}

export function inferMappingDefaults(productName) {
  const normalized = normalizeProductName(productName);
  const kg = parseKgFromProductName(productName);

  const isShipping = [
    "dhl",
    "delivery",
    "deliver",
    "shipping",
    "the netherlands",
    "netherlands",
    "amsterdam inside",
    "amsterdam outside",
    "inside the ring",
    "outside the ring",
  ].some(k => normalized.includes(k));

  const isPickup = [
    "pick up",
    "pickup",
    "afhalen",
    "location",
    "winkel",
  ].some(k => normalized.includes(k));

  const isCustom = normalized.includes("custom amount") || normalized.includes("custom");

  if (isPickup) {
    return {
      revenue_type: "Other Revenue",
      channel: "Online Shop",
      cut: "Pickup",
      kg_per_unit: 0,
      cost_per_kg: 0,
      status: "Ignore",
      notes: "Auto-created from sales import. Pickup row should normally be ignored.",
    };
  }

  if (isShipping) {
    return {
      revenue_type: "Shipping",
      channel: "Online Shop",
      cut: "Shipping",
      kg_per_unit: 0,
      cost_per_kg: 0,
      status: "OK",
      notes: "Auto-created from sales import. Shipping revenue has no meat COGS.",
    };
  }

  if (isCustom) {
    return {
      revenue_type: "Custom Revenue",
      channel: "Online Shop",
      cut: "Custom",
      kg_per_unit: 0,
      cost_per_kg: 0,
      status: "To review",
      notes: "Auto-created from sales import. Review what this custom amount represents.",
    };
  }

  return {
    revenue_type: "Meat",
    channel: "Online Shop",
    cut: inferCutName(productName),
    kg_per_unit: kg,
    cost_per_kg: 0,
    status: "To review",
    notes: kg > 0
      ? "Auto-created from sales import. Kg/unit was inferred from the product name. Add cost/kg to calculate COGS."
      : "Auto-created from sales import. Add kg/unit and cost/kg to calculate COGS.",
  };
}

function inferCutName(productName) {
  const normalized = normalizeProductName(productName);
  const cutRules = [
    ["asado banderita", "Asado banderita"],
    ["bife de chorizo", "Bife de chorizo"],
    ["ojo de bife", "Ojo de bife"],
    ["vacio", "Vacío"],
    ["entrana", "Entraña"],
    ["chorizo", "Chorizo criollo"],
    ["morcilla", "Morcilla"],
    ["molleja", "Molleja"],
    ["chinchulin", "Chinchulín"],
    ["matambre", "Matambre"],
    ["bondiola", "Bondiola"],
    ["salchicha", "Salchicha parrillera"],
    ["milanesa", "Milanesa"],
    ["colita", "Colita de cuadril"],
    ["lomo", "Lomo"],
  ];

  const found = cutRules.find(([needle]) => normalized.includes(needle));
  if (found) return found[1];

  return String(productName || "").split("-")[0].trim() || "Meat";
}

export function buildMappingIndex(mappings = []) {
  const exact = new Map();
  const activeMappings = mappings.filter(m => m && m.product_name);

  for (const mapping of activeMappings) {
    const key = normalizeProductName(mapping.product_name);
    if (key && !exact.has(key)) exact.set(key, mapping);
  }

  return { exact, activeMappings };
}

export function findProductMapping(record, mappingsOrIndex = []) {
  const productName = getSalesProductName(record);
  const key = normalizeProductName(productName);
  if (!key) return null;

  const index = Array.isArray(mappingsOrIndex) ? buildMappingIndex(mappingsOrIndex) : mappingsOrIndex;
  if (index.exact?.has(key)) return index.exact.get(key);

  // Safe fallback: try long contains-matches only. This helps when SumUp adds small suffix differences.
  const candidates = (index.activeMappings || [])
    .map(m => ({ mapping: m, key: normalizeProductName(m.product_name) }))
    .filter(x => x.key.length >= 8 && (key.includes(x.key) || x.key.includes(key)))
    .sort((a, b) => b.key.length - a.key.length);

  return candidates[0]?.mapping || null;
}

export function calculateSalesMappingUpdates(record, mapping) {
  if (!mapping) {
    return {
      mapping_status: "To review",
      review_flag: 1,
    };
  }

  const net = getSalesNetExVat(record);
  const qty = getSalesQuantity(record) || 0;
  const revenueType = mapping.revenue_type || "";
  const kgPerUnit = parseNumber(mapping.kg_per_unit) ?? 0;
  const costPerKg = parseNumber(mapping.cost_per_kg) ?? 0;
  const mappingStatus = mapping.status || "To review";

  if (mappingStatus === "Ignore") {
    return {
      revenue_type: revenueType,
      channel: mapping.channel || "Online Shop",
      cut: mapping.cut || "",
      kg_per_unit: kgPerUnit,
      cost_per_kg: costPerKg,
      meat_cogs: 0,
      product_revenue_ex_vat: 0,
      shipping_revenue_ex_vat: 0,
      event_revenue_ex_vat: 0,
      other_revenue_ex_vat: 0,
      mapping_status: "Ignore",
      review_flag: 0,
    };
  }

  const needsCogs = ["Meat", "Box", "Event"].includes(revenueType);
  const meatCogs = needsCogs ? qty * kgPerUnit * costPerKg : 0;
  const cogsComplete = !needsCogs || (kgPerUnit > 0 && costPerKg > 0);
  const status = mappingStatus === "OK" && cogsComplete && revenueType ? "OK" : "To review";

  return {
    revenue_type: revenueType,
    channel: mapping.channel || "Online Shop",
    cut: mapping.cut || "",
    kg_per_unit: kgPerUnit,
    cost_per_kg: costPerKg,
    meat_cogs: meatCogs,
    product_revenue_ex_vat: ["Meat", "Box", "Custom Revenue"].includes(revenueType) ? net : 0,
    shipping_revenue_ex_vat: revenueType === "Shipping" ? net : 0,
    event_revenue_ex_vat: revenueType === "Event" ? net : 0,
    other_revenue_ex_vat: revenueType === "Other Revenue" ? net : 0,
    mapping_status: status,
    review_flag: status === "OK" ? 0 : 1,
  };
}

export function createMissingMappingPayloads(salesRecords = [], existingMappings = []) {
  const index = buildMappingIndex(existingMappings);
  const seen = new Set();
  const payloads = [];

  for (const record of salesRecords) {
    const productName = getSalesProductName(record);
    const key = normalizeProductName(productName);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const existing = findProductMapping(record, index);
    if (existing) continue;

    payloads.push({
      product_name: productName,
      ...inferMappingDefaults(productName),
    });
  }

  return payloads.sort((a, b) => String(a.product_name).localeCompare(String(b.product_name)));
}
