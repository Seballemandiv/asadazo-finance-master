/**
 * Parse European and standard numeric/currency strings to JS numbers.
 *
 * Rules (in priority order):
 *   1. Already a JS number → return as-is (no re-parse)
 *   2. Strip currency symbols / whitespace
 *   3. European thousands + comma decimal:  "1.234,56" → 1234.56
 *   4. Comma only (no dot):                 "12,80"   → 12.80
 *   5. Both dot and comma present:
 *      - last separator is comma → comma is decimal: "1.234,56"
 *      - last separator is dot  → dot is decimal:    "1,234.56"
 *   6. Plain dot decimal or integer
 *
 * NOTE: Excel/CSV with comma delimiter may produce raw string "12,80".
 *       This parser ALWAYS treats a lone comma as decimal separator.
 */
export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  // Already a JS number — return as-is
  if (typeof value === "number") return isNaN(value) ? null : value;

  let s = String(value).trim();

  // Strip currency symbols, non-breaking spaces, ordinary spaces
  s = s.replace(/[€$£¥\u00a0\s]/g, "");
  if (s === "" || s === "-") return null;

  const hasDot   = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    const lastDot   = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    if (lastComma > lastDot) {
      // "1.234,56" → comma is decimal
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // "1,234.56" → dot is decimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // "12,80" or "300,00" → comma is decimal separator
    s = s.replace(",", ".");
  }
  // else: plain "25.00" or "300" — no change

  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Alias used in validation / import configs
export const parseEuropeanMoney = parseNumber;

/**
 * Check a list of raw values for suspicious 100x parsing errors.
 * Returns { ok: boolean, examples: string[] }
 * A value is suspicious when it has a comma, gets parsed, and the result
 * looks ≥ 100x larger than what the European interpretation would give.
 */
export function checkMoneyParsing(rawValues) {
  const suspicious = [];
  for (const raw of rawValues) {
    if (typeof raw !== "string") continue;
    const s = raw.trim().replace(/[€$£¥\u00a0\s]/g, "");
    // Only check strings that contain a comma and digits
    if (!s.includes(",") || !/\d/.test(s)) continue;

    const parsed = parseNumber(raw);
    if (parsed === null) continue;

    // European interpretation: treat comma as decimal
    const euStr = s.replace(/\./g, "").replace(",", ".");
    const euVal = parseFloat(euStr);
    if (isNaN(euVal)) continue;

    // If result is 100x+ larger than European interpretation, flag it
    if (Math.abs(parsed) >= 100 * Math.abs(euVal) && Math.abs(euVal) > 0) {
      suspicious.push({ raw, parsed, expected: euVal });
    }
  }
  return { ok: suspicious.length === 0, examples: suspicious };
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