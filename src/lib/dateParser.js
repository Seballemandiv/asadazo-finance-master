/**
 * Central date parsing utility for Asadazo Finance Master.
 * Handles:
 *   - Excel serial dates: 46025.74930555555
 *   - ISO: 2026-01-03 17:59 / 2026-01-03T17:59
 *   - DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 *   - Dutch short text: "3 jan 2026 17:59", "5 jan 2026 22:12"
 *   - MM/DD/YYYY (US fallback)
 */

const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

const DUTCH_MONTHS = {
  jan: 1, feb: 2, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5,
  jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
};

/**
 * Parse any date value → { iso: "YYYY-MM-DDTHH:mm", date: "YYYY-MM-DD", month: "YYYY-MM" }
 * Returns null if unparseable.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;

  // Already a JS Date
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return fromDate(value);
  }

  const s = String(value).trim();
  if (!s) return null;

  // Excel serial number (numeric string like "46025.74930555555")
  // Must be 4-6 digits (real dates 1900–2064 = serial ~1 to ~60000)
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    if (serial > 1 && serial < 80000) {
      const ms = EXCEL_EPOCH.getTime() + serial * 86400000;
      return fromDate(new Date(ms));
    }
  }

  // Dutch short text: "3 jan 2026 17:59" or "3 jan 2026" or "29 jan 2026 09:38"
  const dutchMatch = s.match(/^(\d{1,2})\s+([a-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/i);
  if (dutchMatch) {
    const [, day, monthStr, year, hh = "0", mm = "0"] = dutchMatch;
    const mo = DUTCH_MONTHS[monthStr.toLowerCase()];
    if (mo) return buildResult(+year, mo, +day, +hh, +mm);
  }

  // ISO: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, mo, d, hh = "0", mm = "0"] = iso;
    return buildResult(+y, +mo, +d, +hh, +mm);
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY with optional time
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[T ](\d{2}):(\d{2}))?/);
  if (dmy) {
    const [, d, mo, y, hh = "0", mm = "0"] = dmy;
    return buildResult(+y, +mo, +d, +hh, +mm);
  }

  return null;
}

function fromDate(d) {
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return buildResult(y, mo, day, hh, mm);
}

function buildResult(y, mo, d, hh, mm) {
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const pad = n => String(n).padStart(2, "0");
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  const iso = `${date}T${pad(hh)}:${pad(mm)}`;
  const month = `${y}-${pad(mo)}`;
  return { iso, date, month };
}

export function formatDateDisplay(value) {
  const parsed = parseDate(value);
  if (!parsed) return String(value ?? "");
  return parsed.iso.replace("T", " ");
}