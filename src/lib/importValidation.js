import { parseDate } from "./dateParser";
import { parseNumber } from "./numberParser";
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

  // If mapping errors exist, skip per-row validation (can't proceed)
  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      summary: { total: rows.length, valid: 0, errorCount: errors.length },
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

  return {
    valid,
    errors,
    summary: {
      total: rows.length,
      valid: rows.length - rowsWithErrors,
      errorCount,
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