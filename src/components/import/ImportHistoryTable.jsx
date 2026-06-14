import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw } from "lucide-react";
import { IMPORT_CONFIGS } from "@/lib/importConfigs";

export default function ImportHistoryTable({ refreshKey }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState(null);

  const load = async () => {
    setLoading(true);
    const b = await base44.entities.ImportBatch.list("-import_date", 100);
    setBatches(b);
    setLoading(false);
  };

  useEffect(() => { load(); }, [refreshKey]);

  const handleRevert = async (batch) => {
    if (!confirm(`Revert "${batch.filename}" (${batch.row_count} rows)? All imported rows from this batch will be deleted.`)) return;
    setReverting(batch.id);
    try {
      const isBankType = ["bank_transactions", "supplier_documents", "logistics_documents"].includes(batch.import_type);
      if (isBankType) {
        const recs = await base44.entities.BankTransaction.filter({ import_batch_id: batch.id });
        await Promise.all(recs.map(r => base44.entities.BankTransaction.delete(r.id)));
      } else {
        const recs = await base44.entities.SalesRecord.filter({ import_batch_id: batch.id });
        await Promise.all(recs.map(r => base44.entities.SalesRecord.delete(r.id)));
      }
      await base44.entities.ImportBatch.update(batch.id, { status: "reverted" });
      setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: "reverted" } : b));
    } finally {
      setReverting(null);
    }
  };

  const statusBadge = (status) => {
    if (status === "imported") return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Imported</Badge>;
    return <Badge className="bg-red-100 text-red-700 border-0 text-xs">Reverted</Badge>;
  };

  return (
    <Card className="shadow-none border">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Import History</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="h-20 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : !batches.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {["File Name", "Type", "Month", "Rows", "Errors", "Import Date", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map(b => (
                  <tr key={b.id} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 max-w-[200px] truncate font-medium" title={b.filename}>{b.filename}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{IMPORT_CONFIGS[b.import_type]?.label || b.import_type}</td>
                    <td className="px-3 py-2 font-mono">{b.month}</td>
                    <td className="px-3 py-2 tabular-nums">{b.row_count ?? "—"}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {b.error_count > 0
                        ? <span className="text-red-600 font-medium">{b.error_count}</span>
                        : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{b.import_date}</td>
                    <td className="px-3 py-2">{statusBadge(b.status)}</td>
                    <td className="px-3 py-2">
                      {b.status === "imported" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          disabled={reverting === b.id}
                          onClick={() => handleRevert(b)}
                        >
                          <Trash2 className="w-3 h-3" />
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