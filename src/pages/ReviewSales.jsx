import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import SalesRowEditor from "@/components/review/SalesRowEditor";

export default function ReviewSales() {
  const [records, setRecords] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [cutCosts, setCutCosts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState("To review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const [activeBatches, recs, maps, cuts] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.SalesRecord.list("-date", 5000),
      base44.entities.ProductMapping.list(),
      base44.entities.CutCost.list(),
    ]);
    // Only sumup_sales batches drive Review Sales
    const activeBatchIds = new Set(
      activeBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id)
    );
    const activeRecs = recs.filter(r =>
      r.is_active !== false &&
      r.import_batch_id &&
      activeBatchIds.has(r.import_batch_id)
    );
    setRecords(activeRecs);
    setMappings(maps);
    setCutCosts(cuts);
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
      const statusOk = statusFilter === "all" || r.mapping_status === statusFilter;
      const prod = r.product_name || r.product || "";
      const searchOk = !search || prod.toLowerCase().includes(search.toLowerCase());
      return monthOk && statusOk && searchOk;
    });
  }, [records, selectedMonth, statusFilter, search]);

  const handleUpdate = async (id, updates) => {
    await base44.entities.SalesRecord.update(id, updates);
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
          <h1 className="text-2xl font-bold">Review Sales Records</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
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
            placeholder="Search product..."
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
                  {["Date", "Product", "Qty", "Net (ex VAT)", "Channel", "Rev Type", "Cut", "kg/unit", "COGS", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  editingId === r.id ? (
                    <SalesRowEditor
                      key={r.id}
                      record={r}
                      mappings={mappings}
                      cutCosts={cutCosts}
                      onSave={updates => handleUpdate(r.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)}>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{(r.transaction_date || r.date)?.slice(0, 10)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{r.product_name || r.product}</td>
                      <td className="px-3 py-2">{r.quantity ?? r.qty}</td>
                      <td className="px-3 py-2">€{(r.net_amount_ex_vat ?? r.net_ex_vat ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2">{r.channel}</td>
                      <td className="px-3 py-2">{r.revenue_type}</td>
                      <td className="px-3 py-2">{r.cut}</td>
                      <td className="px-3 py-2">{r.kg_per_unit}</td>
                      <td className="px-3 py-2">€{r.meat_cogs?.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.mapping_status] || ""}`}>
                          {r.mapping_status}
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