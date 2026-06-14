import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { errorsToCSV } from "@/lib/importValidation";

const ERROR_TYPE_LABELS = {
  MAPPING_MISSING: "Column not mapped",
  DATE_MISSING: "Date missing",
  DATE_PARSE_FAILED: "Date parse error",
  AMOUNT_MISSING: "Amount missing",
  AMOUNT_PARSE_FAILED: "Amount parse error",
  REQUIRED_FIELD_EMPTY: "Required field empty",
};

const ERROR_TYPE_COLORS = {
  MAPPING_MISSING: "bg-purple-100 text-purple-800",
  DATE_MISSING: "bg-orange-100 text-orange-800",
  DATE_PARSE_FAILED: "bg-red-100 text-red-800",
  AMOUNT_MISSING: "bg-orange-100 text-orange-800",
  AMOUNT_PARSE_FAILED: "bg-red-100 text-red-800",
  REQUIRED_FIELD_EMPTY: "bg-orange-100 text-orange-800",
};

export default function ErrorReport({ errors, summary, filename, importType }) {
  const [expanded, setExpanded] = useState(true);

  const handleDownload = () => {
    const csv = errorsToCSV(errors, filename, importType);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import-errors-${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-red-200 shadow-none">
      <CardHeader className="pb-2 bg-red-50 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm text-red-800">
              Import blocked — {errors.length} error{errors.length !== 1 ? "s" : ""} found
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100" onClick={handleDownload}>
              <Download className="w-3 h-3 mr-1" />
              Download Error Report
            </Button>
            <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-red-100 text-red-600">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-red-700 mt-1">
          <span>Total rows: <strong>{summary.total}</strong></span>
          <span>Valid rows: <strong className="text-green-700">{summary.valid}</strong></span>
          <span>Rows with errors: <strong className="text-red-700">{summary.rowsWithErrors}</strong></span>
          <span>Error count: <strong>{summary.errorCount}</strong></span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead className="bg-red-50/70 text-red-800">
                <tr>
                  {["Row #", "Column", "Raw Value", "Error Type", "Message", "Suggested Fix"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {errors.map((err, i) => (
                  <tr key={i} className="border-t border-red-100 hover:bg-red-50/40">
                    <td className="px-3 py-1.5 font-mono font-semibold text-red-700">
                      {err.rowNumber === 0 ? <span className="italic">Mapping</span> : err.rowNumber}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{err.column}</td>
                    <td className="px-3 py-1.5 max-w-[160px] truncate text-muted-foreground" title={String(err.rawValue)}>
                      {String(err.rawValue) || <span className="italic">(empty)</span>}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge className={`text-xs border-0 ${ERROR_TYPE_COLORS[err.errorType] || "bg-gray-100 text-gray-700"}`}>
                        {ERROR_TYPE_LABELS[err.errorType] || err.errorType}
                      </Badge>
                    </td>
                    <td className="px-3 py-1.5 max-w-[240px]">{err.message}</td>
                    <td className="px-3 py-1.5 max-w-[240px] text-muted-foreground">{err.suggestedFix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}