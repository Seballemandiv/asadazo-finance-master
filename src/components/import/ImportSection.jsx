import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, X, FileText } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import ColumnMapper from "./ColumnMapper";
import PreviewTable from "./PreviewTable";
import PasteTextFallback from "./PasteTextFallback";
import { parseFile, hashFile, detectMonth } from "@/lib/fileParser";
import { IMPORT_CONFIGS, autoDetectMapping } from "@/lib/importConfigs";

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

export default function ImportSection({ importType, onImportDone }) {
  const config = IMPORT_CONFIGS[importType];

  const [stage, setStage] = useState("upload"); // upload | preview | done
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [month, setMonth] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { rowCount, errorCount }
  const [dupWarning, setDupWarning] = useState(false);

  const reset = () => {
    setStage("upload");
    setFileName(""); setFileHash(""); setHeaders([]); setRows([]);
    setMapping({}); setMonth(""); setSaving(false); setResult(null); setDupWarning(false);
  };

  const handleFile = async (file) => {
    const [parsed, hash] = await Promise.all([parseFile(file), hashFile(file)]);
    await loadParsed(parsed, file.name, hash);
  };

  const loadParsed = async ({ headers, rows }, name, hash) => {
    // Check duplicate
    if (hash) {
      const existing = await base44.entities.ImportBatch.filter({ file_hash: hash, status: "imported" });
      if (existing.length > 0) {
        setDupWarning(true);
      }
    }
    const autoMapping = autoDetectMapping(headers, importType);
    const detectedMonth = detectMonth(rows, autoMapping[config.dateField] || headers.find(h => /date|datum/i.test(h)));
    setFileName(name || "pasted");
    setFileHash(hash || "");
    setHeaders(headers);
    setRows(rows);
    setMapping(autoMapping);
    setMonth(detectedMonth || MONTHS[0]);
    setStage("preview");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const batchId = `batch_${Date.now()}`;
      const importDate = new Date().toISOString().slice(0, 10);

      // Save raw rows as-is with the mapping applied as metadata — actual row saving is done per import type downstream
      // For now we just record the batch + write each row to the appropriate entity
      const saveRow = async (row, bId) => {
        const entity = getEntityForType(importType);
        if (!entity) return;
        const mapped = {};
        for (const [target, source] of Object.entries(mapping)) {
          if (source) mapped[target] = row[source] ?? "";
        }
        // Enrich with batch and month info
        mapped.import_batch_id = bId;
        mapped.import_type = importType;
        mapped.month = month;
        await entity.create(mapped);
      };

      let errorCount = 0;
      let rowCount = 0;

      // Save in batches of 5 to avoid rate limiting
      const CHUNK = 5;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const results = await Promise.allSettled(chunk.map(row => saveRow(row, batchId)));
        rowCount += results.filter(r => r.status === "fulfilled").length;
        errorCount += results.filter(r => r.status === "rejected").length;
      }

      await base44.entities.ImportBatch.create({
        import_type: importType,
        filename: fileName,
        file_hash: fileHash,
        import_date: importDate,
        month,
        row_count: rowCount,
        error_count: errorCount,
        status: "imported",
        column_mapping: JSON.stringify(mapping),
      });

      setResult({ rowCount, errorCount });
      setStage("done");
      onImportDone?.();
    } finally {
      setSaving(false);
    }
  };

  const getEntityForType = (type) => {
    switch (type) {
      case "sumup_sales": return base44.entities.SalesRecord;
      case "sumup_articles": return base44.entities.SalesRecord;
      case "sumup_transactions": return base44.entities.SalesRecord;
      case "bank_transactions": return base44.entities.BankTransaction;
      case "supplier_documents": return base44.entities.BankTransaction;
      case "logistics_documents": return base44.entities.BankTransaction;
      default: return null;
    }
  };

  return (
    <Card className="shadow-none border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{config.label}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
          {stage !== "upload" && (
            <button onClick={reset} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* STAGE: upload */}
        {stage === "upload" && (
          <>
            <FileUploadZone onFile={handleFile} />
            <PasteTextFallback onParsed={({ headers, rows }) => loadParsed({ headers, rows }, "pasted.csv", "")} />
          </>
        )}

        {/* STAGE: preview */}
        {stage === "preview" && (
          <>
            {dupWarning && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                A file with the same content was already imported. You can continue, but check for duplicates.
              </div>
            )}

            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{rows.length} rows detected</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Month:</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ColumnMapper
              targetFields={config.targetFields}
              fileHeaders={headers}
              mapping={mapping}
              onChange={setMapping}
            />

            <PreviewTable headers={headers} rows={rows} />

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-[#611111] hover:bg-[#450A0A] text-white">
                {saving ? "Saving…" : `Save ${rows.length} rows`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
            </div>
          </>
        )}

        {/* STAGE: done */}
        {stage === "done" && result && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-800">Import complete</p>
              <p className="text-xs text-green-700 mt-0.5">
                {result.rowCount} rows saved
                {result.errorCount > 0 && `, ${result.errorCount} errors`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={reset}>Import another</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}