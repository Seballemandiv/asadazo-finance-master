import { base44 } from "@/api/base44Client";
import { IMPORT_CONFIGS } from "./importConfigs";
import { processRow } from "./importSave";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function isRateLimitError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("429");
}

async function createWithRetry(entity, payload) {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await entity.create(payload);
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err) || attempt === 6) break;
      await sleep(700 * attempt * attempt);
    }
  }
  throw lastError;
}

function getEntityInfo(importType) {
  const config = IMPORT_CONFIGS[importType];
  if (!config) return null;
  const entityName = config.entityName;
  const entity = base44.entities[entityName];
  if (!entity) return null;
  return { entityName, entity };
}

export async function saveImportBatchThrottled({
  importType,
  rows,
  mapping,
  filename,
  fileHash,
  fallbackMonth,
  onProgress,
}) {
  const info = getEntityInfo(importType);
  if (!info) throw new Error(`Unknown import type: ${importType}`);

  const importedAt = new Date().toISOString();
  const importDate = importedAt.slice(0, 10);
  const monthsSet = new Set();
  const dateSet = new Set();

  const processed = rows.map(row => {
    const payload = processRow(row, mapping, importType, fallbackMonth);
    const month = payload.accounting_month || payload.month;
    if (month) monthsSet.add(month);
    const date = payload.transaction_date || payload.date;
    if (date) dateSet.add(date.slice(0, 10));
    return payload;
  });

  const months = Array.from(monthsSet).sort();
  const dates = Array.from(dateSet).sort();
  const dateRange = dates.length > 0
    ? (dates.length === 1 ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`)
    : "";

  const batch = await base44.entities.ImportBatch.create({
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
    status: "saving",
    column_mapping: JSON.stringify(mapping),
    notes: rows.length > 100 ? "Large file saved with throttling to avoid Base44 rate limits." : "",
  });

  const batchId = batch?.id;
  if (!batchId) throw new Error("ImportBatch was created but no id was returned.");

  let savedCount = 0;
  try {
    for (const payload of processed) {
      await createWithRetry(info.entity, { ...payload, import_batch_id: batchId });
      savedCount += 1;
      onProgress?.({ savedCount, total: rows.length });
      await sleep(120);
    }

    await base44.entities.ImportBatch.update(batchId, {
      rows_saved: savedCount,
      row_count: savedCount,
      errors_count: 0,
      error_count: 0,
      status: "imported",
    });
  } catch (err) {
    await base44.entities.ImportBatch.update(batchId, {
      rows_saved: savedCount,
      errors_count: rows.length - savedCount,
      error_count: rows.length - savedCount,
      status: "failed_save",
      notes: `Failed while saving child rows. Saved ${savedCount}/${rows.length}. Error: ${err?.message || err}`,
    });
    throw err;
  }

  return { batchId, rowCount: savedCount, months };
}
