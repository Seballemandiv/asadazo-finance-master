import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw } from "lucide-react";
import { IMPORT_CONFIGS } from "@/lib/importConfigs";

const BANK_TYPES = new Set(["sumup_transactions", "bank_transactions", "supplier_documents", "logistics_documents"]);

export default function ImportHistoryTable({ refreshKey, importType }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(null);

  const load = async () => {
    setLoading(true);
    const all = await base44.entities.ImportBatch.list("-import_date", 500);
    setBatches(all);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  // Filter to only this tab's import type
  const filtered = useMemo(() =>
    importType ? batches.filter(b => b.import_type === importType) : batches,
    [batches, importType]
  );

  // Per-tab counters
  const counters = useMemo(() => {
    const active = filtered.filter(b => b.status === "imported");
    const reverted = filtered.filter(b => b.status === "reverted");
    const failed = filtered.filter(b => b.status === "failed_validation");
    const activeRows = active.reduce((sum, b) => sum + (b.row_count || 0), 0);
    return { active: active.length, reverted: reverted.length, failed: failed.length, activeRows };
  }, [filtered]);

  const handleRevert = async (batch) => {
    if (!confirm(`Revert "${batch.filename}" (${batch.row_count} rows)? All rows from this batch will be hard-deleted.`)) return;
    setReverting(batch.id);

    if (batch.status !== "failed_validation") {
      const isBankType = BANK_TYPES.has(batch.import_type);
      if (isBankType) {
        const recs = await base44.entities.BankTransaction.filter({ import_batch_id: batch.id });
        for (const r of recs) await base44.entities.BankTransaction.delete(r.id);
      } else {
        const recs = await base44.entities.SalesRecord.filter({ import_batch_id: batch.id });
        for (const r of recs) await base44.entities.SalesRecord.delete(r.id);
      }
    }

    await base44.entities.ImportBatch.update(batch.id, { status: "reverted" });
    setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: "reverted" } : b));
    setReverting(null);
  };

  const getMonths = (batch) => {
    if (batch.notes?.startsWith("Months:")) return batch.notes.replace("Months:", "").trim();
    return batch.month || "—";
  };

  const statusBadge = (status) => {
    switch (status) {
      case "imported":
        return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Imported</Badge>;
      case "failed_validation":
        return <Badge className="bg-red-100 text-red-800 border-0 text-xs">Failed</Badge>;
      case "reverted":
        return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Reverted</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">{status}</Badge>;
    }
  };

  const label = importType ? (IMPORT_CONFIGS[importType]?.label || importType) : "All";

  return (
    <Card className="shadow-none border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base">{label} Import History</CardTitle>
          {importType && (
            <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="text-green-700 font-medium">{counters.active} active</span>
              <span>{counters.activeRows} rows saved</span>
              <span className="text-gray-500">{counters.reverted} reverted</span>
              {counters.failed > 0 && <span className="text-red-500">{counters.failed} failed</span>}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : !filtered.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {["File Name", "Accounting Months", "Rows", "Import Date", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} className={`border-t hover:bg-muted/20 ${b.status === "reverted" ? "opacity-50" : ""}`}>
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium" title={b.filename}>{b.filename}</td>
                    <td className="px-3 py-2 font-mono text-xs">{getMonths(b)}</td>
                    <td className="px-3 py-2 tabular-nums">{b.row_count ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.import_date}</td>
                    <td className="px-3 py-2">{statusBadge(b.status)}</td>
                    <td className="px-3 py-2">
                      {b.status === "imported" && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          disabled={reverting === b.id}
                          onClick={() => handleRevert(b)}
                          title="Revert / delete this import"
                        >
                          {reverting === b.id
                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}