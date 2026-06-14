import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, AlertCircle, Loader2, Info } from "lucide-react";
import { parseSumUpCSV, applySalesMapping } from "@/lib/parseSumUp";
import { toast } from "@/components/ui/use-toast";

const EXPECTED_COLUMNS = [
  "Transaction ID", "Date", "Time", "Type", "Payment Method",
  "Quantity", "Product", "Category", "SKU", "Currency",
  "Price (Gross)", "Price (Net)", "Tax", "Tax rate (%)", "Transaction refunded"
];

export default function ImportSales() {
  const [rawText, setRawText] = useState("");
  const [preview, setPreview] = useState([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleParse = async () => {
    setParseError("");
    setPreview([]);
    setImportResult(null);
    if (!rawText.trim()) { setParseError("Please paste some data first."); return; }

    const [mappings, cutCosts] = await Promise.all([
      base44.entities.ProductMapping.list(),
      base44.entities.CutCost.list(),
    ]);

    const result = parseSumUpCSV(rawText);
    if (result.error) { setParseError(result.error); return; }

    const enriched = applySalesMapping(result.rows, mappings, cutCosts);
    setPreview(enriched);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    const created = await base44.entities.SalesRecord.bulkCreate(preview);
    setImporting(false);
    setImportResult({ count: preview.length });
    setPreview([]);
    setRawText("");
    toast({ title: "Import successful", description: `${preview.length} records imported.` });
  };

  const statusColor = {
    "OK": "bg-green-100 text-green-800",
    "To review": "bg-yellow-100 text-yellow-800",
    "Ignore": "bg-slate-100 text-slate-600",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import SumUp Sales</h1>
        <p className="text-muted-foreground text-sm mt-1">Paste the tab-separated export from SumUp</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-muted-foreground" />
            Expected columns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EXPECTED_COLUMNS.map(c => (
              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <Textarea
            className="min-h-40 font-mono text-xs"
            placeholder="Paste SumUp export data here (tab-separated, with header row)..."
            value={rawText}
            onChange={e => setRawText(e.target.value)}
          />
          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" /> {parseError}
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={handleParse} variant="outline">
              <Upload className="w-4 h-4 mr-2" /> Parse & Preview
            </Button>
            {preview.length > 0 && (
              <Button onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Import {preview.length} rows
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {importResult && (
        <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4" /> {importResult.count} records imported successfully.
        </div>
      )}

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — {preview.length} rows</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {["Date", "Product", "Qty", "Gross", "Net", "Channel", "Rev Type", "Cut", "kg/unit", "COGS", "Status"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-1.5 whitespace-nowrap">{r.date?.slice(0, 10)}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate">{r.product}</td>
                    <td className="px-3 py-1.5">{r.qty}</td>
                    <td className="px-3 py-1.5">€{r.gross_inc_vat?.toFixed(2)}</td>
                    <td className="px-3 py-1.5">€{r.net_ex_vat?.toFixed(2)}</td>
                    <td className="px-3 py-1.5">{r.channel}</td>
                    <td className="px-3 py-1.5">{r.revenue_type}</td>
                    <td className="px-3 py-1.5">{r.cut}</td>
                    <td className="px-3 py-1.5">{r.kg_per_unit}</td>
                    <td className="px-3 py-1.5">€{r.meat_cogs?.toFixed(2)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.mapping_status] || ""}`}>
                        {r.mapping_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}