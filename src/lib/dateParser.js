/**
 * Central date parsing utility for Asadazo Finance Master.
 * Handles Excel serials, DD-MM-YYYY, YYYY-MM-DD, date+time, JS Date objects.
 */

// Excel serial date epoch: 1900-01-00 (with Lotus 1-2-3 1900 leap year bug)
const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

/**
 * Parse any date value → { iso: "YYYY-MM-DDTHH:mm", date: "YYYY-MM-DD", month: "YYYY-MM" }
 * Returns null if unparseable.
 */
export function parseDate(value) {
  if (value === null || value === undefined || value === "") return null;

  // Already a JS Date (from xlsx cellDates:true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return fromDate(value);
  }

  const s = String(value).trim();

  // Excel serial number (numeric string like "46025.74930555555")
  if (/^\d{4,6}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    // Excel serials for real dates are between ~1 (1900-01-01) and ~60000 (2064)
    if (serial > 1 && serial < 80000) {
      const ms = EXCEL_EPOCH.getTime() + serial * 86400000;
      return fromDate(new Date(ms));
    }
  }

  // ISO: YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm or YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})([T ](\d{2}):(\d{2}))?/);
  if (iso) {
    const [, y, mo, d, , hh = "00", mm = "00"] = iso;
    return buildResult(+y, +mo, +d, +hh, +mm);
  }

  // DD-MM-YYYY or DD/MM/YYYY with optional time
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})(?:[T ](\d{2}):(\d{2}))?/);
  if (dmy) {
    const [, d, mo, y, hh = "0", mm = "0"] = dmy;
    return buildResult(+y, +mo, +d, +hh, +mm);
  }

  // MM/DD/YYYY (US format — less likely but handle it)
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const [, mo, d, y] = mdy;
    // Only treat as MM/DD if day > 12 is impossible for first group
    if (+mo <= 12 && +d <= 31) {
      return buildResult(+y, +mo, +d, 0, 0);
    }
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

/**
 * Format a parsed date for display in preview table
 */
export function formatDateDisplay(value) {
  const parsed = parseDate(value);
  if (!parsed) return String(value ?? "");
  return parsed.iso.replace("T", " ");
}