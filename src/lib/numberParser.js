/**
 * Parse European and standard numeric/currency strings to JS numbers.
 *
 * Correct behaviour:
 *   "300,00"    → 300.00   (comma = decimal separator)
 *   "1.234,56"  → 1234.56  (dot = thousands, comma = decimal)
 *   "€1.234,56" → 1234.56
 *   "-25,00"    → -25.00
 *   "25.00"     → 25.00    (dot = decimal)
 *   "30000.00"  → 30000.00 (only if raw value was truly 30000.00)
 *   30000       → 30000    (JS number passthrough — no re-parse)
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  // If already a JS number (e.g. from xlsx cell), return as-is — do NOT re-parse
  if (typeof value === "number") return isNaN(value) ? null : value;

  let s = String(value).trim();

  // Remove currency symbols and non-breaking spaces
  s = s.replace(/[€$£¥\u00a0\s]/g, "");
  if (s === "" || s === "-") return null;

  // Determine format:
  // European: has both thousands-dot AND comma-decimal  e.g. "1.234,56" or "1.234.567,89"
  if (/^\-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    // European thousands with optional comma decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/,/.test(s) && !/\./.test(s)) {
    // Only a comma, no dot → comma is decimal separator: "300,00" → "300.00"
    s = s.replace(",", ".");
  } else if (/,/.test(s) && /\./.test(s)) {
    // Has both: determine which is decimal by position of last separator
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // comma is decimal: "1.234,56"
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // dot is decimal, comma is thousands: "1,234.56"
      s = s.replace(/,/g, "");
    }
  }
  // else: plain dot decimal or integer — no change needed

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Format a number for display (2 decimal places)
 */
export function formatNumber(value) {
  const n = parseNumber(value);
  if (n === null) return String(value ?? "");
  return n.toFixed(2);
}

/**
 * Check if a value looks like a number/amount
 */
export function looksLikeNumber(value) {
  if (typeof value === "number") return !isNaN(value);
  const s = String(value ?? "").trim().replace(/[€$£¥\u00a0\s]/g, "");
  return /^-?[\d.,]+$/.test(s) && s !== "";
}