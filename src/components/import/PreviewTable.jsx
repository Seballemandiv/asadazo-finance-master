import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseDate, formatDateDisplay } from "@/lib/dateParser";
import { parseNumber, looksLikeNumber } from "@/lib/numberParser";
import { IMPORT_CONFIGS } from "@/lib/importConfigs";

/**
 * Enhanced PreviewTable:
 * - Renders parsed dates (not Excel serials)
 * - Renders parsed numbers (European format → decimal)
 * - Shows accounting_month column derived from the date field
 */
export default function PreviewTable({ headers, rows, mapping = {}, importType, maxRows = 10 }) {
  if (!headers.length) return null;

  const config = IMPORT_CONFIGS[importType] || {};
  const dateField = config.dateField || "date";
  const numericFields = config.numericFields || [];

  // Which source columns are mapped to date / numeric fields
  const mappedDateCols = new Set(
    Object.entries(mapping)
      .filter(([target]) => target === dateField)
      .map(([, src]) => src)
  );
  const mappedNumericCols = new Set(
    Object.entries(mapping)
      .filter(([target]) => numericFields.includes(target))
      .map(([, src]) => src)
  );

  const preview = rows.slice(0, maxRows);

  const renderCell = (col, rawVal) => {
    const s = String(rawVal ?? "");
    if (mappedDateCols.has(col)) {
      const parsed = parseDate(rawVal);
      if (parsed) {
        return (
          <span className="text-green-700 font-medium">
            {parsed.iso.replace("T", " ")}
          </span>
        );
      }
      return <span className="text-amber-600">{s || "—"}</span>;
    }
    if (mappedNumericCols.has(col) || looksLikeNumber(rawVal)) {
      const n = parseNumber(rawVal);
      if (n !== null) {
        return (
          <span className={n < 0 ? "text-red-600" : ""}>
            {n.toFixed(2)}
          </span>
        );
      }
    }
    return <span>{s || <span className="text-muted-foreground/50">—</span>}</span>;
  };

  // Compute accounting month per row for display
  const getMonth = (row) => {
    for (const col of mappedDateCols) {
      const parsed = parseDate(row[col]);
      if (parsed) return parsed.month;
    }
    return null;
  };

  const showMonthCol = mappedDateCols.size > 0;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Preview — showing {preview.length} of {rows.length} rows
        {showMonthCol && <span className="ml-2 text-green-700">● dates parsed</span>}
      </p>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs min-w-max">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {showMonthCol && (
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap bg-green-50 text-green-800">
                    Accounting Month
                  </th>
                )}
                {headers.map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap max-w-[160px]">
                    {h}
                    {mappedDateCols.has(h) && <span className="ml-1 text-green-600">📅</span>}
                    {mappedNumericCols.has(h) && <span className="ml-1 text-blue-500">#</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/20">
                  {showMonthCol && (
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono text-green-700 bg-green-50/50">
                      {getMonth(row) || <span className="text-amber-500">?</span>}
                    </td>
                  )}
                  {headers.map(h => (
                    <td key={h} className="px-3 py-1.5 max-w-[200px] truncate whitespace-nowrap">
                      {renderCell(h, row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}