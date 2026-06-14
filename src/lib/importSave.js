import { base44 } from "@/api/base44Client";
import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

/**
 * Apply column mapping to a raw row, parse dates and numbers.
 * Returns a fully normalised object plus derived fields:
 *   transaction_date, accounting_month, raw_original_date
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
      // Keep raw value + parse
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

  // Fallback month if no date was parsed
  if (!out.accounting_month) out.accounting_month = fallbackMonth;

  // Keep month field in sync (used by older dashboard logic)
  out.month = out.accounting_month;

  return out;
}

/**
 * Save rows to the appropriate entity in chunks to respect rate limits.
 * Returns { rowCount, errorCount, months }
 */
export async function saveImportBatch({
  importType, rows, mapping, filename, fileHash, fallbackMonth,
}) {
  const batchId = crypto.randomUUID();
  const importDate = new Date().toISOString().slice(0, 10);

  const entity = getEntityForType(importType);
  const CHUNK = 5;

  let rowCount = 0;
  let errorCount = 0;
  const monthsSet = new Set();

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(row => {
        const processed = processRow(row, mapping, importType, fallbackMonth);
        processed.import_batch_id = batchId;
        if (processed.accounting_month) monthsSet.add(processed.accounting_month);
        if (!entity) return Promise.reject(new Error("Unknown entity"));
        return entity.create(processed);
      })
    );
    rowCount += results.filter(r => r.status === "fulfilled").length;
    errorCount += results.filter(r => r.status === "rejected").length;
  }

  const months = Array.from(monthsSet).sort();

  await base44.entities.ImportBatch.create({
    import_type: importType,
    filename,
    file_hash: fileHash,
    import_date: importDate,
    month: months[0] || fallbackMonth,
    row_count: rowCount,
    error_count: errorCount,
    status: "imported",
    column_mapping: JSON.stringify(mapping),
    notes: months.length > 1 ? `Months: ${months.join(", ")}` : undefined,
  });

  return { batchId, rowCount, errorCount, months };
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