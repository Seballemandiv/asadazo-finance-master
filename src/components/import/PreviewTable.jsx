import React from "react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * headers: string[]
 * rows: object[]
 * maxRows: number (default 10)
 */
export default function PreviewTable({ headers, rows, maxRows = 10 }) {
  if (!headers.length) return null;
  const preview = rows.slice(0, maxRows);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Preview — showing {preview.length} of {rows.length} rows
      </p>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs min-w-max">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                {headers.map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap max-w-[160px] truncate">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-t hover:bg-muted/20">
                  {headers.map(h => (
                    <td key={h} className="px-3 py-1.5 max-w-[160px] truncate whitespace-nowrap">
                      {String(row[h] ?? "")}
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