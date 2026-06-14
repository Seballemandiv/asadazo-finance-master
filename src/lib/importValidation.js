import { parseDate } from "./dateParser";
import { parseNumber, checkMoneyParsing } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

/**
 * Validate every row before saving.
 * Returns {
 *   valid: boolean,
 *   errors: RowError[],
 *   warnings: Warning[],
 *   moneyOk: boolean,
 *   summary: { total, valid, errorCount, rowsWithErrors }
 * }
 */
export function validateAllRows(rows, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || null;
  const requiredEntityFields = config.requiredFields || [];
  const noDateRequired = config.noDateRequired === true;

  const errors = [];
  const warnings = [];

  // ── Check 1: required fields must be mapped ──────────────────────────
  for (const field of config.targetFields?.filter(f => f.required) || []) {
    // Skip date if this import type has no date requirement
    if (noDateRequired && field.key === dateField) continue;
    if (!mapping[field.key]) {
      errors.push({
        rowNumber: 0,
        column: field.key,
        rawValue: "",
        parsedValue: null,
        errorType: "MAPPING_MISSING",
        message: `Required column not mapped: "${field.label}"`,
        suggestedFix: `Map a file column to "${field.label}" in the column mapper above.`,
      });
    }
  }

  // Bank counterparty — warn only, never block
  if (importType === "bank_transactions" && !mapping["counterparty"]) {
    warnings.push({
      rowNumber: 0,
      column: "counterparty",
      errorType: "COUNTERPARTY_MISSING",
      message: "Counterparty / Name not mapped — rows will be tagged 'To review' with reference from Description/Referentie.",
    });
  }

  // Article report has no date — inform user
  if (noDateRequired && !mapping[dateField]) {
    warnings.push({
      rowNumber: 0,
      column: "transaction_date",
      errorType: "DATE_NOT_REQUIRED",
      message: `Article Report has no date column — accounting month will use fallback month: ${fallbackMonth || "(not set)"}`,
    });
  }

  // Hard mapping errors → skip per-row validation
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      moneyOk: true,
      summary: { total: rows.length, valid: 0, errorCount: errors.length, rowsWithErrors: 0 },
    };
  }

  const dateSource = dateField ? mapping[dateField] : null;
  const dateIsRequired = !noDateRequired && requiredEntityFields.includes(dateField);

  const rowErrorCounts = new Set();

  // ── Check 2: per-row validation ─────────────────────────────────────
  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let rowHasError = false;

    // Date validation
    if (dateSource) {
      const rawDate = row[dateSource];
      if (rawDate === undefined || rawDate === null || String(rawDate).trim() === "") {
        if (dateIsRequired) {
          errors.push({
            rowNumber: rowNum,
            column: dateSource,
            rawValue: rawDate ?? "",
            parsedValue: null,
            errorType: "DATE_MISSING",
            message: "Required date field is empty",
            suggestedFix: "Ensure every row has a date value in the mapped date column.",
          });
          rowHasError = true;
        }
      } else {
        const parsed = parseDate(rawDate);
        if (!parsed) {
          errors.push({
            rowNumber: rowNum,
            column: dateSource,
            rawValue: rawDate,
            parsedValue: null,
            errorType: "DATE_PARSE_FAILED",
            message: `Could not parse date: "${rawDate}"`,
            suggestedFix: "Expected: DD-MM-YYYY, YYYY-MM-DD, Excel serial, or Dutch like '3 jan 2026 17:59'.",
          });
          rowHasError = true;
        }
      }
    }

    // Numeric field validation + 100x suspicious money check
    for (const target of numericFields) {
      const source = mapping[target];
      if (!source) continue;
      const raw = row[source];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        if (requiredEntityFields.includes(target)) {
          errors.push({
            rowNumber: rowNum,
            column: source,
            rawValue: raw ?? "",
            parsedValue: null,
            errorType: "AMOUNT_MISSING",
            message: `Required field "${source}" is empty`,
            suggestedFix: `Ensure every row has a value in column "${source}".`,
          });
          rowHasError = true;
        }
        continue;
      }
      const n = parseNumber(raw);
      if (n === null) {
        errors.push({
          rowNumber: rowNum,
          column: source,
          rawValue: raw,
          parsedValue: null,
          errorType: "AMOUNT_PARSE_FAILED",
          message: `Could not parse amount: "${raw}"`,
          suggestedFix: "Expected numeric format like 1234.56 or European 1.234,56 or 12,80.",
        });
        rowHasError = true;
      } else {
        // Suspicious 100x check
        const rawStr = String(raw).trim().replace(/[€$£¥\u00a0\s]/g, "");
        if (rawStr.includes(",")) {
          const euStr = rawStr.replace(/\./g, "").replace(",", ".");
          const euVal = parseFloat(euStr);
          if (!isNaN(euVal) && Math.abs(euVal) > 0 && Math.abs(n) >= 100 * Math.abs(euVal)) {
            errors.push({
              rowNumber: rowNum,
              column: source,
              rawValue: raw,
              parsedValue: n,
              errorType: "MONEY_PARSE_SUSPICIOUS",
              message: `Decimal parsing error: "${raw}" parsed as ${n}, expected ~${euVal}`,
              suggestedFix: "The file delimiter may be wrong. European files should use semicolon (;). Comma is the decimal separator.",
            });
            rowHasError = true;
          }
        }
      }
    }

    // Other required text fields (not date, not numeric)
    for (const reqKey of requiredEntityFields) {
      if (dateField && reqKey === dateField) continue;
      if (numericFields.includes(reqKey)) continue;
      const source = mapping[reqKey];
      if (!source) continue;
      const raw = row[source];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        const fieldLabel = config.targetFields?.find(f => f.key === reqKey)?.label || reqKey;
        // For product_name: fill with fallback instead of hard blocking
        if (reqKey === "product_name" || reqKey === "product") {
          // non-blocking: will be filled with "Unknown product - needs review" in processRow
        } else {
          errors.push({
            rowNumber: rowNum,
            column: source,
            rawValue: raw ?? "",
            parsedValue: null,
            errorType: "REQUIRED_FIELD_EMPTY",
            message: `Required field "${fieldLabel}" is empty`,
            suggestedFix: `Ensure every row has a value in column "${source}".`,
          });
          rowHasError = true;
        }
      }
    }

    if (rowHasError) rowErrorCounts.add(rowNum);
  });

  const rowsWithErrors = rowErrorCounts.size;
  const valid = errors.length === 0;

  // ── Money sanity check across all numeric columns ─────────────────────
  let moneyOk = true;
  for (const target of numericFields) {
    const source = mapping[target];
    if (!source) continue;
    const rawVals = rows.map(r => r[source]);
    const check = checkMoneyParsing(rawVals);
    if (!check.ok) {
      moneyOk = false;
      break;
    }
  }

  return {
    valid: valid && moneyOk,
    errors,
    warnings,
    moneyOk,
    summary: {
      total: rows.length,
      valid: rows.length - rowsWithErrors,
      errorCount: errors.length + (moneyOk ? 0 : 1),
      rowsWithErrors,
    },
  };
}

/**
 * Export errors as CSV string
 */
export function errorsToCSV(errors, filename, importType) {
  const header = ["File", "Import Type", "Row", "Column", "Raw Value", "Error Type", "Message", "Suggested Fix"];
  const rows = errors.map(e => [
    filename, importType,
    e.rowNumber === 0 ? "Mapping" : e.rowNumber,
    e.column, e.rawValue, e.errorType, e.message, e.suggestedFix,
  ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...rows].join("\n");
}