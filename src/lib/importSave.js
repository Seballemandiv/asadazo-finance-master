import { base44 } from "@/api/base44Client";
import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

/**
 * Allowed fields per entity — prevents unknown field errors from the SDK.
 */
const ALLOWED_FIELDS = {
  SalesRecord: new Set([
    "import_batch_id", "accounting_month", "month", "transaction_date", "date",
    "transaction_id", "transaction_type", "type", "payment_method",
    "quantity", "qty", "product_name", "product", "description",
    "source_category", "category", "sku", "currency",
    "price_before_discount", "discount",
    "gross_amount_inc_vat", "gross_inc_vat",
    "net_amount_ex_vat", "net_ex_vat",
    "vat_amount", "vat", "vat_rate", "account",
    "mapping_status", "revenue_type", "channel",
    "cut", "kg_per_unit", "cost_per_kg", "meat_cogs",
    "product_revenue_ex_vat", "shipping_revenue_ex_vat",
    "event_revenue_ex_vat", "other_revenue_ex_vat",
    "review_flag", "order_flag", "is_active",
  ]),
  ArticleRecord: new Set([
    "import_batch_id", "accounting_month", "month",
    "product_name", "variant_name", "source_category", "sku",
    "quantity", "currency", "gross_amount",
    "article_cost", "article_profit", "article_margin",
    "is_active",
  ]),
  SumUpTransactionRecord: new Set([
    "import_batch_id", "accounting_month", "month",
    "transaction_date", "transaction_id", "transaction_type", "status",
    "payment_method", "description",
    "total_amount", "net_sales", "tax_amount",
    "transaction_fee", "payout_amount", "payout_date", "payout_number",
    "reference", "account_email", "is_active",
  ]),
  BankTransaction: new Set([
    "import_batch_id", "accounting_month", "month", "date",
    "code", "type", "reference", "payment_ref", "counterparty", "status",
    "amount_out", "amount_in", "fees", "balance",
    "category", "cost_type", "channel", "review_status",
    "counted_expense", "shipping_cost", "operating_expenses",
    "event_cost", "meat_purchase", "is_active",
  ]),
};

/**
 * Map import type → entity name and Base44 entity reference.
 */
function getEntityInfo(importType) {
  const config = IMPORT_CONFIGS[importType];
  if (!config) return null;
  const entityName = config.entityName;
  const entity = base44.entities[entityName];
  if (!entity) return null;
  return { entityName, entity };
}

/**
 * Process a single raw row into an entity payload.
 * Returns payload object ready to save.
 */
export function processRow(row, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || null;
  const entityName = config.entityName || "SalesRecord";
  const allowedFields = ALLOWED_FIELDS[entityName] || new Set();

  const raw = {};

  for (const [target, source] of Object.entries(mapping)) {
    if (!source) continue;
    const rawVal = row[source];
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;

    if (dateField && target === dateField) {
      const parsed = parseDate(rawVal);
      if (parsed) {
        raw.__date_iso = parsed.iso;
        raw.__date_plain = parsed.date;
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

  // Build entity payload — only include allowed fields
  const payload = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith("__")) continue;
    if (allowedFields.has(key)) {
      payload[key] = val;
    }
  }

  const month = raw.__month || fallbackMonth || "";

  // ── SalesRecord specific ────────────────────────────────────────────────
  if (entityName === "SalesRecord") {
    if (raw.__date_iso) {
      payload.transaction_date = raw.__date_iso;
      payload.date = raw.__date_iso;
    }
    payload.accounting_month = month;
    payload.month = month;
    // Sync dual field names
    if (payload.product_name) payload.product = payload.product_name;
    if (!payload.product || String(payload.product).trim() === "") {
      payload.product = "Unknown product - needs review";
      payload.product_name = "Unknown product - needs review";
      payload.mapping_status = "To review";
    }
    if (payload.gross_amount_inc_vat !== undefined) payload.gross_inc_vat = payload.gross_amount_inc_vat;
    if (payload.net_amount_ex_vat !== undefined) payload.net_ex_vat = payload.net_amount_ex_vat;
    if (payload.vat_amount !== undefined) payload.vat = payload.vat_amount;
    if (payload.quantity !== undefined) payload.qty = payload.quantity;
    if (!payload.mapping_status) payload.mapping_status = "To review";
    payload.is_active = true;
  }

  // ── ArticleRecord specific ──────────────────────────────────────────────
  if (entityName === "ArticleRecord") {
    // No date required; use fallback month
    payload.accounting_month = month;
    payload.month = month;
    payload.is_active = true;
  }

  // ── SumUpTransactionRecord specific ────────────────────────────────────
  if (entityName === "SumUpTransactionRecord") {
    if (raw.__date_iso) {
      payload.transaction_date = raw.__date_iso;
    }
    payload.accounting_month = month;
    payload.month = month;
    payload.is_active = true;
  }

  // ── BankTransaction specific ────────────────────────────────────────────
  if (entityName === "BankTransaction") {
    if (raw.__date_iso) payload.date = raw.__date_iso;
    payload.accounting_month = month;
    payload.month = month;

    // Build reference: counterparty name → fallback to description → "Unknown counterparty"
    const cpVal = mapping.counterparty ? String(row[mapping.counterparty] ?? "").trim() : "";
    const refVal = mapping.description ? String(row[mapping.description] ?? "").trim() : "";
    payload.reference = cpVal || refVal || "Unknown counterparty";
    if (cpVal) payload.counterparty = cpVal;
    if (refVal) payload.payment_ref = refVal;

    // If no counterparty, flag for review
    if (!cpVal) payload.review_status = "To review";

    // Amount out (debit) — always positive magnitude
    if (mapping.amount_out) {
      const n = parseNumber(row[mapping.amount_out]);
      if (n !== null) {
        payload.amount_out = Math.abs(n);
        if (payload.amount_in === undefined) payload.amount_in = 0;
      }
    }
    // Amount in (credit) — always positive magnitude
    if (mapping.amount_in) {
      const n = parseNumber(row[mapping.amount_in]);
      if (n !== null) {
        payload.amount_in = Math.abs(n);
        if (payload.amount_out === undefined) payload.amount_out = 0;
      }
    }
    // Single signed amount column
    if (mapping.amount && !mapping.amount_out && !mapping.amount_in) {
      const n = parseNumber(row[mapping.amount]);
      if (n !== null) {
        if (n >= 0) { payload.amount_in = n; payload.amount_out = 0; }
        else { payload.amount_out = Math.abs(n); payload.amount_in = 0; }
      }
    }

    payload.is_active = true;
  }

  return payload;
}

/**
 * All-or-nothing batch save.
 * Returns { batchId, rowCount, months }
 * Throws on any save failure.
 */
export async function saveImportBatch({
  importType, rows, mapping, filename, fileHash, fallbackMonth,
}) {
  const info = getEntityInfo(importType);
  if (!info) throw new Error(`Unknown import type: ${importType}`);

  const importedAt = new Date().toISOString();
  const importDate = importedAt.slice(0, 10);

  const CHUNK = 5;
  const monthsSet = new Set();
  const dateSet = new Set();

  // Process all rows first (synchronous)
  const processed = rows.map(row => {
    const p = processRow(row, mapping, importType, fallbackMonth);
    const m = p.accounting_month || p.month;
    if (m) monthsSet.add(m);
    const d = p.transaction_date || p.date;
    if (d) dateSet.add(d.slice(0, 10));
    return p;
  });

  const months = Array.from(monthsSet).sort();
  const dates = Array.from(dateSet).sort();
  const dateRange = dates.length > 0
    ? (dates.length === 1 ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`)
    : "";

  // Create the ImportBatch first and use the real Base44 id on every row.
  // Previous code generated a crypto UUID for rows, then created ImportBatch later.
  // Base44 assigns its own ImportBatch.id, so Dashboard batch matching could see
  // active imports but exclude all child rows, causing €0 after a successful upload.
  const createdBatch = await base44.entities.ImportBatch.create({
    import_type: importType,
    source_file_name: filename,
    filename,
    file_hash: fileHash || "",
    imported_at: importedAt,
    import_date: importDate,
    accounting_months_detected: months.join(", "),
    date_range_detected: dateRange,
    month: months[0] || fallbackMonth || "",
    rows_detected: rows.length,
    rows_saved: 0,
    row_count: rows.length,
    errors_count: 0,
    error_count: 0,
    status: "imported",
    column_mapping: JSON.stringify(mapping),
    notes: months.length > 1 ? `Months: ${months.join(", ")}` : "",
  });

  const batchId = createdBatch?.id;
  if (!batchId) {
    throw new Error("ImportBatch was created but no id was returned. Cannot link imported rows to the batch.");
  }

  let savedCount = 0;
  try {
    for (let i = 0; i < processed.length; i += CHUNK) {
      const chunk = processed.slice(i, i + CHUNK);
      await Promise.all(chunk.map(p => info.entity.create({ ...p, import_batch_id: batchId })));
      savedCount += chunk.length;
    }

    await base44.entities.ImportBatch.update(batchId, {
      rows_saved: savedCount,
      row_count: savedCount,
      errors_count: 0,
      error_count: 0,
      status: "imported",
    });
  } catch (err) {
    try {
      await base44.entities.ImportBatch.update(batchId, {
        rows_saved: savedCount,
        errors_count: rows.length - savedCount,
        error_count: rows.length - savedCount,
        status: "failed_save",
        notes: `Failed while saving child rows. Saved ${savedCount}/${rows.length}. Error: ${err?.message || err}`,
      });
    } catch (updateErr) {
      console.error("Could not mark ImportBatch as failed_save", updateErr);
    }
    throw err;
  }

  return { batchId, rowCount: savedCount, months };
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
    source_file_name: filename,
    filename,
    file_hash: fileHash || "",
    imported_at: new Date().toISOString(),
    import_date: importDate,
    month: fallbackMonth || "",
    rows_detected: rowCount,
    rows_saved: 0,
    row_count: rowCount,
    errors_count: errors.length,
    error_count: errors.length,
    status: "failed_validation",
    notes: `Validation failed: ${errors.length} error(s)`,
  });
}
