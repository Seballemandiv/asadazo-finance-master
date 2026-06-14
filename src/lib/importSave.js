import { base44 } from "@/api/base44Client";
import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

const F = {
  SalesRecord: ["import_batch_id","accounting_month","month","transaction_date","date","transaction_id","transaction_type","type","payment_method","quantity","qty","product_name","product","description","source_category","category","sku","currency","price_before_discount","discount","gross_amount_inc_vat","gross_inc_vat","net_amount_ex_vat","net_ex_vat","vat_amount","vat","vat_rate","account","mapping_status","revenue_type","channel","cut","kg_per_unit","cost_per_kg","meat_cogs","product_revenue_ex_vat","shipping_revenue_ex_vat","event_revenue_ex_vat","other_revenue_ex_vat","review_flag","order_flag","is_active"],
  ArticleRecord: ["import_batch_id","accounting_month","month","product_name","variant_name","source_category","sku","quantity","currency","gross_amount","article_cost","article_profit","article_margin","is_active"],
  SumUpTransactionRecord: ["import_batch_id","accounting_month","month","transaction_date","transaction_id","transaction_type","status","payment_method","description","total_amount","net_sales","tax_amount","transaction_fee","payout_amount","payout_date","payout_number","reference","account_email","is_active"],
  BankTransaction: ["import_batch_id","accounting_month","month","date","code","type","reference","payment_ref","counterparty","status","amount_out","amount_in","fees","balance","category","cost_type","channel","review_status","counted_expense","shipping_cost","operating_expenses","event_cost","meat_purchase","refund_amount","is_active"],
};
const ALLOWED_FIELDS = Object.fromEntries(Object.entries(F).map(([k, v]) => [k, new Set(v)]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isThrottle = err => /rate limit|too many requests|429/i.test(String(err?.message || err || ""));

function getEntityInfo(importType) {
  const config = IMPORT_CONFIGS[importType];
  if (!config) return null;
  const entity = base44.entities[config.entityName];
  return entity ? { entityName: config.entityName, entity } : null;
}

async function createRow(entity, payload) {
  let last;
  for (let attempt = 1; attempt <= 7; attempt++) {
    try { return await entity.create(payload); }
    catch (err) {
      last = err;
      if (!isThrottle(err) || attempt === 7) break;
      await sleep(900 * attempt * attempt);
    }
  }
  throw last;
}

export function processRow(row, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || null;
  const entityName = config.entityName || "SalesRecord";
  const allowed = ALLOWED_FIELDS[entityName] || new Set();
  const raw = {};

  for (const [target, source] of Object.entries(mapping)) {
    if (!source) continue;
    const rawVal = row[source];
    if (rawVal === undefined || rawVal === null || rawVal === "") continue;
    if (dateField && target === dateField) {
      const parsed = parseDate(rawVal);
      if (parsed) { raw.__date_iso = parsed.iso; raw.__date_plain = parsed.date; raw.__month = parsed.month; }
      else raw.__month = fallbackMonth;
    } else if (numericFields.includes(target)) raw[target] = parseNumber(rawVal) ?? 0;
    else raw[target] = String(rawVal).trim();
  }

  const payload = {};
  for (const [key, val] of Object.entries(raw)) if (!key.startsWith("__") && allowed.has(key)) payload[key] = val;
  const month = raw.__month || fallbackMonth || "";

  if (entityName === "SalesRecord") {
    if (raw.__date_iso) payload.transaction_date = payload.date = raw.__date_iso;
    payload.accounting_month = payload.month = month;
    if (payload.product_name) payload.product = payload.product_name;
    if (!payload.product || String(payload.product).trim() === "") {
      payload.product = payload.product_name = "Unknown product - needs review";
      payload.mapping_status = "To review";
    }
    if (payload.gross_amount_inc_vat !== undefined) payload.gross_inc_vat = payload.gross_amount_inc_vat;
    if (payload.net_amount_ex_vat !== undefined) payload.net_ex_vat = payload.net_amount_ex_vat;
    if (payload.vat_amount !== undefined) payload.vat = payload.vat_amount;
    if (payload.quantity !== undefined) payload.qty = payload.quantity;
    if (!payload.mapping_status) payload.mapping_status = "To review";
    payload.is_active = true;
  }

  if (entityName === "ArticleRecord") {
    payload.accounting_month = payload.month = month;
    payload.is_active = true;
  }

  if (entityName === "SumUpTransactionRecord") {
    if (raw.__date_iso) payload.transaction_date = raw.__date_iso;
    payload.accounting_month = payload.month = month;
    payload.is_active = true;
  }

  if (entityName === "BankTransaction") {
    if (raw.__date_iso) payload.date = raw.__date_iso;
    payload.accounting_month = payload.month = month;
    const cp = mapping.counterparty ? String(row[mapping.counterparty] ?? "").trim() : "";
    const ref = mapping.description ? String(row[mapping.description] ?? "").trim() : "";
    payload.reference = cp || ref || "Unknown counterparty";
    if (cp) payload.counterparty = cp;
    if (ref) payload.payment_ref = ref;
    if (!cp) payload.review_status = "To review";
    if (mapping.amount_out) {
      const n = parseNumber(row[mapping.amount_out]);
      if (n !== null) { payload.amount_out = Math.abs(n); if (payload.amount_in === undefined) payload.amount_in = 0; }
    }
    if (mapping.amount_in) {
      const n = parseNumber(row[mapping.amount_in]);
      if (n !== null) { payload.amount_in = Math.abs(n); if (payload.amount_out === undefined) payload.amount_out = 0; }
    }
    if (mapping.amount && !mapping.amount_out && !mapping.amount_in) {
      const n = parseNumber(row[mapping.amount]);
      if (n !== null) n >= 0 ? (payload.amount_in = n, payload.amount_out = 0) : (payload.amount_out = Math.abs(n), payload.amount_in = 0);
    }
    payload.is_active = true;
  }
  return payload;
}

export async function saveImportBatch({ importType, rows, mapping, filename, fileHash, fallbackMonth, onProgress }) {
  const info = getEntityInfo(importType);
  if (!info) throw new Error(`Unknown import type: ${importType}`);
  const importedAt = new Date().toISOString();
  const importDate = importedAt.slice(0, 10);
  const monthsSet = new Set(), dateSet = new Set();
  const processed = rows.map(row => {
    const p = processRow(row, mapping, importType, fallbackMonth);
    const m = p.accounting_month || p.month; if (m) monthsSet.add(m);
    const d = p.transaction_date || p.date; if (d) dateSet.add(d.slice(0, 10));
    return p;
  });
  const months = Array.from(monthsSet).sort();
  const dates = Array.from(dateSet).sort();
  const dateRange = dates.length ? (dates.length === 1 ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`) : "";
  const batch = await base44.entities.ImportBatch.create({
    import_type: importType, source_file_name: filename, filename, file_hash: fileHash || "", imported_at: importedAt, import_date: importDate,
    accounting_months_detected: months.join(", "), date_range_detected: dateRange, month: months[0] || fallbackMonth || "",
    rows_detected: rows.length, rows_saved: 0, row_count: rows.length, errors_count: 0, error_count: 0, status: "saving", column_mapping: JSON.stringify(mapping),
    notes: rows.length > 100 ? "Saving sequentially to avoid Base44 limits." : "",
  });
  const batchId = batch?.id;
  if (!batchId) throw new Error("ImportBatch was created but no id was returned. Cannot link imported rows to the batch.");
  let savedCount = 0;
  try {
    for (const p of processed) {
      await createRow(info.entity, { ...p, import_batch_id: batchId });
      savedCount += 1;
      onProgress?.({ savedCount, total: rows.length });
      await sleep(180);
    }
    await base44.entities.ImportBatch.update(batchId, { rows_saved: savedCount, row_count: savedCount, errors_count: 0, error_count: 0, status: "imported" });
  } catch (err) {
    try { await base44.entities.ImportBatch.update(batchId, { rows_saved: savedCount, errors_count: rows.length - savedCount, error_count: rows.length - savedCount, status: "failed_save", notes: `Failed while saving child rows. Saved ${savedCount}/${rows.length}. Error: ${err?.message || err}` }); }
    catch (e) { console.error("Could not mark ImportBatch as failed_save", e); }
    throw err;
  }
  return { batchId, rowCount: savedCount, months };
}

export async function recordFailedValidation({ importType, filename, fileHash, fallbackMonth, rowCount, errors }) {
  const importDate = new Date().toISOString().slice(0, 10);
  await base44.entities.ImportBatch.create({ import_type: importType, source_file_name: filename, filename, file_hash: fileHash || "", imported_at: new Date().toISOString(), import_date: importDate, month: fallbackMonth || "", rows_detected: rowCount, rows_saved: 0, row_count: rowCount, errors_count: errors.length, error_count: errors.length, status: "failed_validation", notes: `Validation failed: ${errors.length} error(s)` });
}
