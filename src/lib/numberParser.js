/**
 * Parse European and standard numeric/currency strings to JS numbers.
 * Handles: 1.234,56 → 1234.56 | €1.234,56 → 1234.56 | -25,00 → -25 | 25.50 → 25.50
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  let s = String(value).trim();

  // Remove currency symbols and whitespace
  s = s.replace(/[€$£¥\s]/g, "");
  if (s === "" || s === "-") return null;

  // Detect European format: has both . and , where . comes before ,
  // e.g. "1.234,56" or "1.234.567,89"
  if (/\d\.\d{3},\d/.test(s)) {
    // European: remove dots (thousand sep), replace comma with dot
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/\d,\d{3}\.\d/.test(s)) {
    // US: remove commas (thousand sep)
    s = s.replace(/,/g, "");
  } else {
    // Single comma as decimal separator (e.g. "25,50" or "-12,00")
    s = s.replace(",", ".");
  }

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
  if (typeof value === "number") return true;
  const s = String(value ?? "").trim().replace(/[€$£¥\s]/g, "");
  return /^-?[\d.,]+$/.test(s) && s !== "";
}