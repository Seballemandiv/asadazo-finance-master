import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import BankRowEditor from "@/components/review/BankRowEditor";

export default function ReviewBank() {
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState("To review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [activeBatches, recs] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.BankTransaction.list("-date", 5000),
    ]);
    const activeBatchIds = new Set(
      activeBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id)
    );
    const activeRecs = recs.filter(r =>
      r.is_active !== false &&
      (!r.import_batch_id || activeBatchIds.has(r.import_batch_id))
    );
    setRecords(activeRecs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const availableMonths = useMemo(() => {
    const months = new Set(records.map(r => r.accounting_month || r.month).filter(Boolean));
    return Array.from(months).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      const recMonth = r.accounting_month || r.month;
      const monthOk = selectedMonth === "all" || recMonth === selectedMonth;
      const statusOk = statusFilter === "all" || r.review_status === statusFilter;
      const searchOk = !search ||
        r.reference?.toLowerCase().includes(search.toLowerCase()) ||
        r.payment_ref?.toLowerCase().includes(search.toLowerCase()) ||
        r.counterparty?.toLowerCase().includes(search.toLowerCase());
      return monthOk && statusOk && searchOk;
    });
  }, [records, selectedMonth, statusFilter, search]);

  const handleUpdate = async (id, updates) => {
    await base44.entities.BankTransaction.update(id, updates);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setEditingId(null);
  };

  const statusBadge = {
    "OK": "bg-green-100 text-green-800",
    "To review": "bg-yellow-100 text-yellow-800",
    "Ignore": "bg-slate-100 text-slate-600",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review Bank Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="To review">To review</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="Ignore">Ignore</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 w-56"
            placeholder="Search reference..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  {["Date", "Type", "Reference", "Payment Ref", "Amount Out", "Amount In", "Cost Type", "Channel", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  editingId === r.id ? (
                    <BankRowEditor
                      key={r.id}
                      record={r}
                      onSave={updates => handleUpdate(r.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{r.date}</td>
                      <td className="px-3 py-2 text-xs">{r.type}</td>
                      <td className="px-3 py-2 max-w-[180px] truncate text-xs">{r.reference}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate text-xs">{r.payment_ref}</td>
                      <td className="px-3 py-2 text-destructive text-xs">{r.amount_out > 0 ? `€${r.amount_out?.toFixed(2)}` : ""}</td>
                      <td className="px-3 py-2 text-green-700 text-xs">{r.amount_in > 0 ? `€${r.amount_in?.toFixed(2)}` : ""}</td>
                      <td className="px-3 py-2 text-xs">{r.cost_type}</td>
                      <td className="px-3 py-2 text-xs">{r.channel}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.review_status] || ""}`}>
                          {r.review_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">Edit</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}