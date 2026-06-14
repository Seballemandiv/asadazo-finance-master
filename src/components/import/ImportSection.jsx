import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, X, FileText } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import ColumnMapper from "./ColumnMapper";
import PreviewTable from "./PreviewTable";
import PasteTextFallback from "./PasteTextFallback";
import { parseFile, hashFile } from "@/lib/fileParser";
import { IMPORT_CONFIGS, autoDetectMapping, validateMapping } from "@/lib/importConfigs";
import { saveImportBatch } from "@/lib/importSave";
import { parseDate } from "@/lib/dateParser";
import { base44 } from "@/api/base44Client";

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

function detectFallbackMonth(rows, mapping, dateField) {
  const dateSource = mapping[dateField];
  if (!dateSource) return MONTHS[0];
  for (const row of rows) {
    const parsed = parseDate(row[dateSource]);
    if (parsed) return parsed.month;
  }
  return MONTHS[0];
}

export default function ImportSection({ importType, onImportDone }) {
  const config = IMPORT_CONFIGS[importType];

  const [stage, setStage] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fallbackMonth, setFallbackMonth] = useState(MONTHS[0]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [dupWarning, setDupWarning] = useState(false);

  const reset = () => {
    setStage("upload");
    setFileName(""); setFileHash(""); setHeaders([]); setRows([]);
    setMapping({}); setFallbackMonth(MONTHS[0]); setSaving(false);
    setResult(null); setDupWarning(false);
  };

  const handleFile = async (file) => {
    const [parsed, hash] = await Promise.all([parseFile(file), hashFile(file)]);
    await loadParsed(parsed, file.name, hash);
  };

  const loadParsed = async ({ headers, rows }, name, hash) => {
    if (hash) {
      const existing = await base44.entities.ImportBatch.filter({ file_hash: hash, status: "imported" });
      if (existing.length > 0) setDupWarning(true);
    }
    const autoMapping = autoDetectMapping(headers, importType);
    const detectedMonth = detectFallbackMonth(rows, autoMapping, config.dateField);
    setFileName(name || "pasted");
    setFileHash(hash || "");
    setHeaders(headers);
    setRows(rows);
    setMapping(autoMapping);
    setFallbackMonth(detectedMonth);
    setStage("preview");
  };

  // Validation
  const missingFields = validateMapping(mapping, importType);
  const canSave = missingFields.length === 0;

  const handleSave = async () => {
    setSaving(true);
    const res = await saveImportBatch({
      importType,
      rows,
      mapping,
      filename: fileName,
      fileHash,
      fallbackMonth,
    });
    setSaving(false);
    setResult(res);
    setStage("done");
    onImportDone?.();
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
                A file with the same content was already imported. Check for duplicates before saving.
              </div>
            )}

            {/* File info + fallback month */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileName}</p>
                <p className="text-xs text-muted-foreground">{rows.length} rows · {importType}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Import fallback month:</label>
                <Select value={fallbackMonth} onValueChange={setFallbackMonth}>
                  <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Validation warning */}
            {missingFields.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Required fields not mapped:</span>{" "}
                  {missingFields.join(", ")}. Please map these columns before saving.
                </div>
              </div>
            )}

            <ColumnMapper
              targetFields={config.targetFields}
              fileHeaders={headers}
              mapping={mapping}
              onChange={setMapping}
            />

            <PreviewTable
              headers={headers}
              rows={rows}
              mapping={mapping}
              importType={importType}
            />

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="bg-[#611111] hover:bg-[#450A0A] text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : `Save Import Batch (${rows.length} rows)`}
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
                {result.errorCount > 0 && <span className="text-red-600 ml-1">· {result.errorCount} errors</span>}
                {result.months?.length > 0 && (
                  <span className="ml-1">· months: {result.months.join(", ")}</span>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={reset}>Import another</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}