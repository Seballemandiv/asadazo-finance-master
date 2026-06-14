import { base44 } from "@/api/base44Client";
import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

/**
 * Apply column mapping to a raw row, parse dates and numbers.
 * Returns a fully normalised object.
 */
export function processRow(row, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || "date";

  const out = {};

  for (const [target, source] of Object.entries(mapping)) {
    if (!source) continue;
    const raw = row[source];
    if (raw === undefined || raw === null || raw === "") continue;

    if (target === dateField) {
      out.raw_original_date = String(raw);
      const parsed = parseDate(raw);
      if (parsed) {
        out.transaction_date = parsed.iso;
        out.accounting_month = parsed.month;
      } else {
        out.accounting_month = fallbackMonth;
      }
    } else if (numericFields.includes(target)) {
      const n = parseNumber(raw);
      out[target] = n ?? 0;
    } else {
      out[target] = String(raw).trim();
    }
  }

  if (!out.accounting_month) out.accounting_month = fallbackMonth;
  out.month = out.accounting_month;
  return out;
}

/**
 * All-or-nothing save. Only call after validateAllRows() returns valid:true.
 * Returns { batchId, rowCount, months }
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

  // Process all rows first
  const processed = rows.map(row => {
    const p = processRow(row, mapping, importType, fallbackMonth);
    p.import_batch_id = batchId;
    if (p.accounting_month) monthsSet.add(p.accounting_month);
    return p;
  });

  // Save in chunks
  for (let i = 0; i < processed.length; i += CHUNK) {
    const chunk = processed.slice(i, i + CHUNK);
    await Promise.all(chunk.map(p => entity.create(p)));
  }

  const months = Array.from(monthsSet).sort();

  await base44.entities.ImportBatch.create({
    import_type: importType,
    filename,
    file_hash: fileHash,
    import_date: importDate,
    month: months[0] || fallbackMonth,
    row_count: rows.length,
    error_count: 0,
    status: "imported",
    column_mapping: JSON.stringify(mapping),
    notes: months.length > 1 ? `Months: ${months.join(", ")}` : undefined,
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
    file_hash: fileHash,
    import_date: importDate,
    month: fallbackMonth,
    row_count: rowCount,
    error_count: errors.length,
    status: "failed_validation",
    validation_errors: JSON.stringify(errors.slice(0, 200)), // cap to avoid size issues
  });
}

function getEntityForType(type) {
  switch (type) {
    case "sumup_sales":
    case "sumup_articles":
    case "sumup_transactions":
      return base44.entities.SalesRecord;
    case "bank_transactions":
    case "supplier_documents":
    case "logistics_documents":
      return base44.entities.BankTransaction;
    default:
      return null;
  }
}