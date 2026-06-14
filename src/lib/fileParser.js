import * as XLSX from "xlsx";

/**
 * Parse a File object (CSV, XLS, XLSX) → { headers: string[], rows: object[] }
 */
export async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "csv") {
    return parseCSV(await file.text());
  } else if (ext === "xls" || ext === "xlsx") {
    return parseExcel(await file.arrayBuffer());
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

function parseCSV(text) {
  // Detect delimiter: tab > semicolon > comma
  // European CSVs often use semicolons so that commas in numbers (e.g. "12,80") are preserved as-is
  const firstLine = text.split("\n")[0] || "";
  let delimiter = ",";
  if (firstLine.includes("\t")) delimiter = "\t";
  else if (firstLine.includes(";")) delimiter = ";";

  const wb = XLSX.read(text, { type: "string", raw: true, FS: delimiter });
  return sheetToData(wb.Sheets[wb.SheetNames[0]]);
}

function parseExcel(buffer) {
  // raw: true keeps cell values as strings, preserving European number formats like "12,80"
  // cellDates kept for date detection
  const wb = XLSX.read(buffer, { type: "array", raw: true, cellDates: true });
  return sheetToData(wb.Sheets[wb.SheetNames[0]]);
}

function sheetToData(sheet) {
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (!raw || raw.length < 2) return { headers: [], rows: [] };

  // Find first non-empty row as header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (raw[i].some(cell => cell !== "")) { headerIdx = i; break; }
  }

  const headers = raw[headerIdx].map(h => String(h).trim()).filter(Boolean);
  const dataRows = raw.slice(headerIdx + 1).filter(row =>
    row.some(cell => cell !== "" && cell !== null && cell !== undefined)
  );

  const rows = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });

  return { headers, rows };
}

/**
 * Simple hash of file content for duplicate detection
 */
export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/**
 * Detect the month (YYYY-MM) from an array of row objects, given a date column name
 */
export function detectMonth(rows, dateCol) {
  if (!dateCol) return "";
  for (const row of rows) {
    const val = row[dateCol];
    if (!val) continue;
    // Try to find YYYY-MM pattern
    const str = String(val);
    const m = str.match(/(\d{4})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}`;
    // dd/mm/yyyy or dd-mm-yyyy
    const m2 = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}`;
    // Excel serial date
    if (val instanceof Date) return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}`;
  }
  return "";
}