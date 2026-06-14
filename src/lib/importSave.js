import { base44 } from "@/api/base44Client";
import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

// Fields that are valid on SalesRecord entity
const SALES_RECORD_FIELDS = new Set([
  "date", "month", "type", "transaction_id", "payment_method", "qty",
  "product", "category", "sku", "currency", "gross_inc_vat", "net_ex_vat",
  "vat", "vat_rate", "discount", "mapping_status", "revenue_type", "channel",
  "cut", "kg_per_unit", "cost_per_kg", "meat_cogs", "product_revenue_ex_vat",
  "shipping_revenue_ex_vat", "event_revenue_ex_vat", "other_revenue_ex_vat",
  "review_flag", "order_flag", "import_batch_id",
]);

// Fields that are valid on BankTransaction entity
const BANK_TRANSACTION_FIELDS = new Set([
  "date", "month", "code", "type", "reference", "payment_ref", "status",
  "amount_out", "amount_in", "fees", "balance", "category", "cost_type",
  "channel", "review_status", "counted_expense", "shipping_cost",
  "operating_expenses", "event_cost", "meat_purchase", "import_batch_id",
]);

/**
 * Apply column mapping to a raw row, parse dates and numbers.
 * Returns a payload ready to save to the target entity.
 */
export function processRow(row, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || "date";
  const isSales = ["sumup_sales", "sumup_articles"].includes(importType);
  const allowedFields = isSales ? SALES_RECORD_FIELDS : BANK_TRANSACTION_FIELDS;

  const raw = {}; // intermediate: target_key → parsed value

  for (const [target, source] of Object.entries(mapping)) {
    if (!source) continue;
    const rawVal = row[source];
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;

    if (target === dateField) {
      const parsed = parseDate(rawVal);
      if (parsed) {
        raw.__date_iso = parsed.iso;
        raw.__month = parsed.month;
      } else {
        raw.__month = fallbackMonth;
      }
    } else if (numericFields.includes(target)) {
      const n = parseNumber(rawVal);
      raw[target] = n ?? 0;
    } else {
      raw[target] = String(rawVal).trim();
    }
  }

  // Build entity payload — only include fields that exist in the schema
  const payload = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("__")) continue; // internal keys
    if (allowedFields.has(key)) {
      payload[key] = val;
    }
    // silently drop unknown fields
  }

  // Map date → entity "date" field (string for bank, datetime for sales)
  if (raw.__date_iso) {
    payload.date = raw.__date_iso;
  }

  // Map accounting month → entity "month" field
  const month = raw.__month || fallbackMonth;
  payload.month = month;

  // Guarantee required `product` field for SalesRecord rows
  if (isSales) {
    if (!payload.product || String(payload.product).trim() === "") {
      payload.product = "Unknown product - needs review";
      payload.mapping_status = "To review";
    }
  }

  // Set default mapping_status for sales records
  if (isSales && !payload.mapping_status) {
    payload.mapping_status = "To review";
  }

  // For bank: map counterparty → reference if present
  if (!isSales && mapping.counterparty) {
    const cpSource = mapping.counterparty;
    const cpVal = row[cpSource];
    if (cpVal) payload.reference = String(cpVal).trim();
  }

  // For bank: map description → payment_ref if present
  if (!isSales && mapping.description) {
    const dSource = mapping.description;
    const dVal = row[dSource];
    if (dVal) payload.payment_ref = String(dVal).trim();
  }

  // For bank: map amount (single col) → amount_in or amount_out based on sign
  if (!isSales && mapping.amount) {
    const aSource = mapping.amount;
    const n = parseNumber(row[aSource]);
    if (n !== null && !payload.amount_in && !payload.amount_out) {
      if (n >= 0) {
        payload.amount_in = n;
        payload.amount_out = 0;
      } else {
        payload.amount_out = Math.abs(n);
        payload.amount_in = 0;
      }
    }
  }

  return payload;
}

/**
 * All-or-nothing save. Only call after validateAllRows() returns valid:true.
 * Returns { batchId, rowCount, months }
 * Throws on any save failure — caller must handle with try/catch.
 */
export async function saveImportBatch({
  importType, rows, mapping, filename, fileHash, fallbackMonth,
}) {
  const batchId = crypto.randomUUID();
  const importDate = new Date().toISOString().slice(0, 10);
  const entity = getEntityForType(importType);
  if (!entity) throw new Error(`Unknown import type: ${importType}`);

  const CHUNK = 5;
  const monthsSet = new Set();

  // Process all rows first (sync, no await)
  const processed = rows.map(row => {
    const p = processRow(row, mapping, importType, fallbackMonth);
    if (p.month) monthsSet.add(p.month);
    return p;
  });

  // Save in chunks — await each chunk sequentially to respect rate limits
  for (let i = 0; i < processed.length; i += CHUNK) {
    const chunk = processed.slice(i, i + CHUNK);
    await Promise.all(chunk.map(p => entity.create({ ...p, import_batch_id: batchId })));
  }

  const months = Array.from(monthsSet).sort();

  await base44.entities.ImportBatch.create({
    import_type: importType,
    filename,
    file_hash: fileHash || "",
    import_date: importDate,
    month: months[0] || fallbackMonth,
    row_count: rows.length,
    error_count: 0,
    status: "imported",
    column_mapping: JSON.stringify(mapping),
    notes: months.length > 1 ? `Months: ${months.join(", ")}` : "",
  });

  return { batchId, rowCount: rows.length, months };
}

/**
 * Record a failed validation attempt in ImportBatch (no rows saved).
 */
export async function recordFailedValidation({
  importType, filename, fileHash, fallbackMonth, rowCount, errors,
}) {
  const importDate = new Date().toISOString().slice(0, 10);
  await base44.entities.ImportBatch.create({
    import_type: importType,
    filename,
    file_hash: fileHash || "",
    import_date: importDate,
    month: fallbackMonth,
    row_count: rowCount,
    error_count: errors.length,
    status: "failed_validation",
    notes: `Validation failed: ${errors.length} error(s)`,
  });
}

function getEntityForType(type) {
  switch (type) {
    case "sumup_sales":
    case "sumup_articles":
      return base44.entities.SalesRecord;
    case "sumup_transactions": // no product info — save as bank/transaction row
    case "bank_transactions":
    case "supplier_documents":
    case "logistics_documents":
      return base44.entities.BankTransaction;
    default:
      return null;
  }
}