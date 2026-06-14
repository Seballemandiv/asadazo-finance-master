import { parseDate } from "./dateParser";
import { parseNumber, checkMoneyParsing } from "./numberParser";
import { IMPORT_CONFIGS } from "./importConfigs";

/**
 * Validate every row before saving.
 * Returns { valid: boolean, errors: RowError[], summary: { total, valid, errorCount } }
 *
 * RowError: { rowNumber, column, rawValue, parsedValue, errorType, message, suggestedFix }
 */
export function validateAllRows(rows, mapping, importType, fallbackMonth) {
  const config = IMPORT_CONFIGS[importType] || {};
  const numericFields = config.numericFields || [];
  const dateField = config.dateField || "date";
  const requiredEntityFields = config.requiredFields || [];

  const errors = [];

  const warnings = []; // non-blocking notices

  // Check 1: required fields must be mapped
  for (const field of config.targetFields?.filter(f => f.required) || []) {
    if (!mapping[field.key]) {
      errors.push({
        rowNumber: 0,
        column: field.key,
        rawValue: "",
        parsedValue: null,
        errorType: "MAPPING_MISSING",
        message: `Required column not mapped: "${field.label}"`,
        suggestedFix: `Map a column to "${field.label}" in the column mapper above.`,
      });
    }
  }

  // Optional bank counterparty — warn only, don't block
  if (importType === "bank_transactions" && !mapping["counterparty"]) {
    warnings.push({
      rowNumber: 0,
      column: "counterparty",
      errorType: "COUNTERPARTY_MISSING",
      message: "Counterparty / Name not mapped — rows will be sent to Review Bank with 'Unknown counterparty'.",
    });
  }

  // If hard mapping errors exist, skip per-row validation (can't proceed)
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      summary: { total: rows.length, valid: 0, errorCount: errors.length, rowsWithErrors: 0 },
    };
  }

  const dateSource = mapping[dateField];
  const dateIsRequired = requiredEntityFields.includes(dateField);

  // Check 2: per-row validation
  const rowErrorCounts = new Set();

  rows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let rowHasError = false;

    // Validate date field only if it is mapped OR required
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
        // If not required, silently skip — fallback month will be used
      } else {
        const parsed = parseDate(rawDate);
        if (!parsed) {
          errors.push({
            rowNumber: rowNum,
            column: dateSource,
            rawValue: rawDate,
            parsedValue: null,
            errorType: "DATE_PARSE_FAILED",
            message: `Could not parse date value: "${rawDate}"`,
            suggestedFix: "Expected formats: DD-MM-YYYY, YYYY-MM-DD, or Excel serial number.",
          });
          rowHasError = true;
        }
      }
    } else if (dateIsRequired) {
      // Date is required but not mapped — already caught in mapping check above
    }

    // Validate numeric fields
    for (const target of numericFields) {
      const source = mapping[target];
      if (!source) continue;
      const raw = row[source];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        // Only error if it was a strictly required field
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
          message: `Could not parse amount value: "${raw}"`,
          suggestedFix: "Expected numeric format like 1234.56 or European 1.234,56.",
        });
        rowHasError = true;
      } else {
        // Suspicious 100x parse check: if raw has comma and result ≥ 100x the EU interpretation
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
              message: `Possible decimal parsing error: raw "${raw}" parsed as ${n}, expected ${euVal}`,
              suggestedFix: "Check that the file delimiter is correct (semicolon vs comma). European decimals use comma.",
            });
            rowHasError = true;
          }
        }
      }
    }

    // Validate other required fields (product name, counterparty, etc.)
    for (const reqKey of requiredEntityFields) {
      if (reqKey === dateField || numericFields.includes(reqKey)) continue; // already handled
      const source = mapping[reqKey];
      if (!source) continue;
      const raw = row[source];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        const fieldLabel = config.targetFields?.find(f => f.key === reqKey)?.label || reqKey;
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

    if (rowHasError) rowErrorCounts.add(rowNum);
  });

  const errorCount = errors.length;
  const rowsWithErrors = rowErrorCounts.size;
  const valid = errorCount === 0;

  // Check money parsing sanity on numeric columns
  let moneyOk = true;
  for (const target of config.numericFields || []) {
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
      errorCount: errorCount + (moneyOk ? 0 : 1),
      rowsWithErrors,
    },
  };
}

/**
 * Export errors as CSV string
 */
export function errorsToCSV(errors, filename, importType) {
  const header = ["File","Import Type","Row Number","Column","Raw Value","Error Type","Message","Suggested Fix"];
  const rows = errors.map(e => [
    filename,
    importType,
    e.rowNumber === 0 ? "Mapping" : e.rowNumber,
    e.column,
    e.rawValue,
    e.errorType,
    e.message,
    e.suggestedFix,
  ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  return [header.join(","), ...rows].join("\n");
}