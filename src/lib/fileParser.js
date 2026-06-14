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
  // IMPORTANT:
  // Do not let XLSX auto-parse CSV values. SumUp/NL exports use comma decimals
  // like "12,80" and those must remain raw strings until numberParser.js handles them.
  const clean = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(clean);
  const matrix = parseDelimitedText(clean, delimiter);
  return matrixToData(matrix);
}

function detectDelimiter(text) {
  const lines = text.split("\n").filter(l => l.trim()).slice(0, 5);
  const candidates = ["\t", ";", ","];
  let best = ",";
  let bestScore = -1;

  for (const delimiter of candidates) {
    const counts = lines.map(line => countDelimiterOutsideQuotes(line, delimiter));
    const positive = counts.filter(c => c > 0);
    if (!positive.length) continue;

    // Prefer delimiters that appear consistently across header/sample rows.
    const min = Math.min(...positive);
    const max = Math.max(...positive);
    const avg = positive.reduce((a, b) => a + b, 0) / positive.length;
    const consistencyPenalty = max - min;
    const score = avg - consistencyPenalty;

    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }

  return best;
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        i++; // escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === delimiter) {
      count++;
    }
  }

  return count;
}

function parseDelimitedText(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  // Final cell/row
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function parseExcel(buffer) {
  // raw: true keeps the underlying cell values. If Excel stores 12.8 as a real
  // number, that is fine. CSV comma decimals are handled by parseCSV above.
  const wb = XLSX.read(buffer, { type: "array", raw: true, cellDates: true });
  return sheetToData(wb.Sheets[wb.SheetNames[0]]);
}

function matrixToData(matrix) {
  if (!matrix || matrix.length < 2) return { headers: [], rows: [] };

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, matrix.length); i++) {
    if ((matrix[i] || []).some(cell => String(cell ?? "").trim() !== "")) {
      headerIdx = i;
      break;
    }
  }

  const headers = (matrix[headerIdx] || [])
    .map(h => String(h ?? "").replace(/^\uFEFF/, "").trim())
    .filter(Boolean);

  const dataRows = matrix.slice(headerIdx + 1).filter(row =>
    (row || []).some(cell => String(cell ?? "").trim() !== "")
  );

  const rows = dataRows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      // Keep all CSV cell values as strings so date/number parsers control conversion.
      obj[h] = row[i] === undefined || row[i] === null ? "" : String(row[i]).trim();
    });
    return obj;
  });

  return { headers, rows };
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
