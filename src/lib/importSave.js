import { base44 } from "@/api/base44Client";

/**
 * Map a raw row using the column mapping { targetField: sourceHeader }
 */
export function applyMapping(row, mapping) {
  const out = {};
  for (const [target, source] of Object.entries(mapping)) {
    if (source && row[source] !== undefined) {
      out[target] = row[source];
    }
  }
  return out;
}

/**
 * Normalise a numeric string → number, return 0 if invalid
 */
export function toNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Normalise a date value → YYYY-MM-DD string
 */
export function toDateStr(v) {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s;
}

/**
 * Extract YYYY-MM from a date string
 */
export function toMonth(v) {
  const d = toDateStr(v);
  return d ? d.slice(0, 7) : "";
}

/**
 * Save an import batch and its records.
 * importType: one of the enum values
 * rows: raw row objects
 * mapping: { targetField: sourceHeader }
 * filename, fileHash, month, saveRowFn
 *
 * saveRowFn(mappedRow, batchId) → promise, called for each row
 * Returns { batchId, rowCount, errorCount }
 */
export async function saveImportBatch({ importType, rows, mapping, filename, fileHash, month, saveRowFn }) {
  const batchId = crypto.randomUUID();
  const importDate = new Date().toISOString().slice(0, 10);

  let errorCount = 0;
  const results = await Promise.allSettled(
    rows.map(row => {
      const mapped = applyMapping(row, mapping);
      return saveRowFn(mapped, batchId);
    })
  );
  errorCount = results.filter(r => r.status === "rejected").length;
  const rowCount = results.filter(r => r.status === "fulfilled").length;

  await base44.entities.ImportBatch.create({
    id: batchId,
    import_type: importType,
    filename,
    file_hash: fileHash,
    import_date: importDate,
    month,
    row_count: rowCount,
    error_count: errorCount,
    status: "imported",
    column_mapping: JSON.stringify(mapping),
  });

  return { batchId, rowCount, errorCount };
}