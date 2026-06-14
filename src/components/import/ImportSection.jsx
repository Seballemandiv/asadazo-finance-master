import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, X, FileText, RefreshCw, Eye } from "lucide-react";
import FileUploadZone from "./FileUploadZone";
import ColumnMapper from "./ColumnMapper";
import PreviewTable from "./PreviewTable";
import PasteTextFallback from "./PasteTextFallback";
import ErrorReport from "./ErrorReport";
import { parseFile, hashFile } from "@/lib/fileParser";
import { IMPORT_CONFIGS, autoDetectMapping } from "@/lib/importConfigs";
import { validateAllRows } from "@/lib/importValidation";
import { saveImportBatch, recordFailedValidation, processRow } from "@/lib/importSave";
import { parseDate } from "@/lib/dateParser";
import { base44 } from "@/api/base44Client";

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

function detectFallbackMonth(rows, mapping, dateField) {
  if (!dateField) return null; // no-date files start empty
  const dateSource = mapping[dateField];
  if (!dateSource) return null;
  for (const row of rows) {
    const parsed = parseDate(row[dateSource]);
    if (parsed) return parsed.month;
  }
  return null; // couldn't detect — user must pick
}

export default function ImportSection({ importType, onImportDone }) {
  const config = IMPORT_CONFIGS[importType];

  const [stage, setStage] = useState("upload"); // upload | preview | done
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fallbackMonth, setFallbackMonth] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { success, rowCount, months, errors, summary }
  const [saveError, setSaveError] = useState(null);
  const [dupWarning, setDupWarning] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Build debug preview rows for the first 10 rows
  const debugPreview = useMemo(() => {
    if (!rows.length || !mapping) return [];
    return rows.slice(0, 10).map((row, i) => {
      const p = processRow(row, mapping, importType, fallbackMonth);
      return {
        rowNum: i + 1,
        product: p.product || null,
        qty: p.qty ?? null,
        gross_inc_vat: p.gross_inc_vat ?? null,
        month: p.month || fallbackMonth,
        import_type: importType,
        missingProduct: !p.product || p.product === "Unknown product - needs review",
      };
    });
  }, [rows, mapping, importType, fallbackMonth]);

  const reset = () => {
    setStage("upload");
    setFileName(""); setFileHash(""); setHeaders([]); setRows([]);
    setMapping({}); setFallbackMonth(null); setSaving(false);
    setResult(null); setSaveError(null); setDupWarning(false); setShowDebug(false);
  };

  const handleFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "xls", "xlsx"].includes(ext)) {
      setSaveError(`Unsupported file type: .${ext}. Please upload a CSV, XLS, or XLSX file.`);
      return;
    }
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

  // Live validation (re-runs whenever mapping or rows change)
  const validation = useMemo(
    () => rows.length > 0 ? validateAllRows(rows, mapping, importType, fallbackMonth) : null,
    [rows, mapping, importType, fallbackMonth]
  );

  const needsFallbackMonth = !config.dateField && !fallbackMonth;
  const canSave = validation?.valid === true && !needsFallbackMonth;

  const handleSave = async () => {
    if (!validation?.valid) return;
    setSaving(true);
    setSaveError(null);

    // Timeout protection: 20 seconds
    const timeoutId = setTimeout(() => {
      setSaving(false);
      setSaveError("Import timed out after 20 seconds. No rows were saved. Please retry or check console errors.");
    }, 20000);

    try {
      const res = await saveImportBatch({
        importType, rows, mapping, filename: fileName, fileHash, fallbackMonth,
      });
      clearTimeout(timeoutId);
      setResult({ success: true, rowCount: res.rowCount, months: res.months });
      setStage("done");
      onImportDone?.();
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Import save failed:", err);
      const msg = err?.message || "Unknown error during save.";
      // Improve product-field error message
      const friendlyMsg = msg.includes("product") && msg.toLowerCase().includes("required")
        ? "Save payload is missing the required SalesRecord field 'product'. Check that the Description / Product Name column is mapped correctly (e.g. Beschrijving or Naam van artikel)."
        : msg;
      setSaveError(friendlyMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleRecordFailed = async () => {
    if (!validation || validation.valid) return;
    await recordFailedValidation({
      importType,
      filename: fileName,
      fileHash,
      fallbackMonth,
      rowCount: rows.length,
      errors: validation.errors,
    });
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
                {config.dateField ? (
                  fallbackMonth ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                      ✓ Detected month: <strong>{fallbackMonth}</strong> (from row dates)
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                      ⚠ Could not detect month from dates
                    </span>
                  )
                ) : (
                  <>
                    <label className="text-xs text-muted-foreground whitespace-nowrap font-medium">
                      Fallback month <span className="text-red-500">*</span>
                    </label>
                    <Select value={fallbackMonth || ""} onValueChange={setFallbackMonth}>
                      <SelectTrigger className={`w-36 h-7 text-xs ${!fallbackMonth ? "border-red-300" : ""}`}>
                        <SelectValue placeholder="Select fallback month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            </div>

            {/* Month confirmation notice */}
            {!config.dateField && !fallbackMonth && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                This file has no date column. Please select a <strong>fallback month</strong> above before saving.
              </div>
            )}
            {config.dateField && fallbackMonth && (
              <div className="text-xs text-slate-500 px-1">
                Accounting month will be calculated per row from transaction dates.
              </div>
            )}

            <ColumnMapper
              targetFields={config.targetFields}
              fileHeaders={headers}
              mapping={mapping}
              onChange={setMapping}
            />

            {/* Non-blocking warnings (e.g. missing counterparty) */}
            {validation?.warnings?.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 space-y-1">
                {validation.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0">⚠</span>
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Validation summary */}
            {validation && (
              <div className={`rounded-lg border px-4 py-3 text-xs ${
                validation.valid
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                <div className="flex flex-wrap gap-4 font-medium">
                  <span>Rows detected: <strong>{validation.summary.total}</strong></span>
                  <span className="text-green-700">Valid rows: <strong>{validation.summary.valid}</strong></span>
                  {validation.summary.rowsWithErrors > 0 && (
                    <span className="text-red-700">Rows with errors: <strong>{validation.summary.rowsWithErrors}</strong></span>
                  )}
                  <span>Will be saved: <strong>{validation.valid ? validation.summary.total : 0}</strong></span>
                  {validation.moneyOk === true && <span className="text-green-700">✓ money parsed</span>}
                  {validation.moneyOk === false && <span className="text-red-700">⚠ money parsing error</span>}
                </div>
                {!validation.valid && (
                  <p className="mt-1 text-red-700">
                    Fix all errors before importing. This import is all-or-nothing — no partial imports allowed.
                  </p>
                )}
              </div>
            )}

            {/* Error report (if any) */}
            {validation && !validation.valid && (
              <ErrorReport
                errors={validation.errors}
                summary={validation.summary}
                filename={fileName}
                importType={importType}
              />
            )}

            <PreviewTable
              headers={headers}
              rows={rows}
              mapping={mapping}
              importType={importType}
            />

            {/* Debug payload preview */}
            {["sumup_sales", "sumup_articles"].includes(importType) && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDebug(v => !v)}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showDebug ? "Hide" : "Show"} save payload preview (first 10 rows)
                </button>
                {showDebug && (
                  <div className="mt-2 overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 text-left font-medium">#</th>
                          <th className="px-2 py-1 text-left font-medium">product</th>
                          <th className="px-2 py-1 text-left font-medium">qty</th>
                          <th className="px-2 py-1 text-left font-medium">gross_inc_vat</th>
                          <th className="px-2 py-1 text-left font-medium">month</th>
                          <th className="px-2 py-1 text-left font-medium">import_type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debugPreview.map(r => (
                          <tr key={r.rowNum} className={r.missingProduct ? "bg-red-50" : ""}>
                            <td className="px-2 py-1 text-muted-foreground">{r.rowNum}</td>
                            <td className={`px-2 py-1 max-w-[200px] truncate ${r.missingProduct ? "text-red-600 font-medium" : ""}`}>
                              {r.product || <span className="text-red-500 font-medium">⚠ MISSING</span>}
                            </td>
                            <td className="px-2 py-1">{r.qty ?? "—"}</td>
                            <td className="px-2 py-1">{r.gross_inc_vat ?? "—"}</td>
                            <td className="px-2 py-1">{r.month}</td>
                            <td className="px-2 py-1 text-muted-foreground">{r.import_type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Save error */}
            {saveError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Import failed: </span>{saveError}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button
                onClick={handleSave}
                disabled={saving || !canSave}
                className="bg-[#611111] hover:bg-[#450A0A] text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : needsFallbackMonth ? "Select fallback month first" : `Save Import Batch (${rows.length} rows)`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={saving}>Cancel</Button>
              {!canSave && validation && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground text-xs"
                  onClick={() => {
                    handleRecordFailed();
                    reset();
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Dismiss & fix mapping
                </Button>
              )}
            </div>
          </>
        )}

        {/* STAGE: done */}
        {stage === "done" && result && (
          result.success ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Import successful</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {result.rowCount} rows saved · 0 errors
                  {result.months?.length > 0 && (
                    <span className="ml-1">· months: {result.months.join(", ")}</span>
                  )}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reset}>Import another</Button>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">Import blocked</p>
                <p className="text-xs text-red-700 mt-0.5">
                  0 rows saved · {result.errorCount} errors found. Fix the errors before importing.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={reset}>Try again</Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}