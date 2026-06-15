import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Wand2 } from "lucide-react";
import SalesRowEditor from "@/components/review/SalesRowEditor";
import { buildMappingIndex, calculateSalesMappingUpdates, findProductMapping, getSalesNetExVat } from "@/lib/cogsEngine";

const BATCH_LIMIT = 100;

function hasChanged(record, updates) {
  return Object.entries(updates).some(([k, v]) => String(record[k] ?? "") !== String(v ?? ""));
}

export default function ReviewSales() {
  const [records, setRecords] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [priceRows, setPriceRows] = useState([]);
  const [cutCosts, setCutCosts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState("To review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    const [activeBatches, recs, maps, prices, cuts] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.SalesRecord.list("-date", 5000),
      base44.entities.ProductMapping.list(),
      base44.entities.MonthlyProductPrice.list("-month", 5000),
      base44.entities.CutCost.list(),
    ]);
    const activeBatchIds = new Set(activeBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id));
    const activeRecs = recs.filter(r => r.is_active !== false && r.import_batch_id && activeBatchIds.has(r.import_batch_id));
    setRecords(activeRecs);
    setMappings(maps);
    setPriceRows(prices);
    setCutCosts(cuts);

    const months = Array.from(new Set(activeRecs.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse();
    if ((selectedMonth === "all" || !selectedMonth) && months.length > 0) setSelectedMonth(months[0]);
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

  const handleApplyProductMappings = async () => {
    if (selectedMonth === "all") {
      setApplyMessage({ type: "error", text: "Select one month first. Mappings are applied month by month so COGS uses the correct price month." });
      return;
    }

    setApplying(true);
    setApplyMessage(null);

    const mappingIndex = buildMappingIndex(mappings);
    const candidates = filtered.filter(r => r.mapping_status !== "OK").slice(0, BATCH_LIMIT);

    let matched = 0, ok = 0, toReview = 0, ignored = 0, noMapping = 0, skippedNoChange = 0;
    const updatedRows = [];

    try {
      for (const record of candidates) {
        const mapping = findProductMapping(record, mappingIndex);
        if (!mapping) { noMapping++; continue; }

        const updates = calculateSalesMappingUpdates(record, mapping, priceRows);
        matched++;
        if (updates.mapping_status === "OK") ok++;
        else if (updates.mapping_status === "Ignore") ignored++;
        else toReview++;

        if (!hasChanged(record, updates)) { skippedNoChange++; continue; }

        await base44.entities.SalesRecord.update(record.id, updates);
        updatedRows.push({ id: record.id, updates });
      }

      setRecords(prev => prev.map(r => {
        const u = updatedRows.find(x => x.id === r.id);
        return u ? { ...r, ...u.updates } : r;
      }));

      const remaining = Math.max(0, filtered.filter(r => r.mapping_status !== "OK").length - candidates.length);
      setApplyMessage({
        type: remaining > 0 || noMapping > 0 || toReview > 0 ? "warning" : "success",
        text: `Processed ${candidates.length} row(s) for ${selectedMonth}. Updated: ${updatedRows.length}, OK: ${ok}, To review: ${toReview}, Ignored: ${ignored}, No mapping: ${noMapping}, unchanged: ${skippedNoChange}. ${remaining > 0 ? `${remaining} row(s) remain — click again to continue.` : "Done for the current filter."}`,
      });
    } catch (err) {
      console.error("Failed to apply product mappings", err);
      setApplyMessage({ type: "error", text: `${err?.message || "Failed to apply product mappings."} Try again in 30 seconds; up to ${BATCH_LIMIT} rows are processed per click now.` });
    } finally {
      setApplying(false);
    }
  };

  const statusBadge = { "OK": "bg-green-100 text-green-800", "To review": "bg-yellow-100 text-yellow-800", "Ignore": "bg-slate-100 text-slate-600" };

  const summary = useMemo(() => {
    const visible = selectedMonth === "all" ? records : records.filter(r => (r.accounting_month || r.month) === selectedMonth);
    return {
      total: visible.length,
      ok: visible.filter(r => r.mapping_status === "OK").length,
      review: visible.filter(r => r.mapping_status === "To review").length,
      ignore: visible.filter(r => r.mapping_status === "Ignore").length,
      cogs: visible.reduce((s, r) => s + (r.meat_cogs || 0), 0),
      revenue: visible.reduce((s, r) => s + getSalesNetExVat(r), 0),
    };
  }, [records, selectedMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold">Review Sales Records</h1><p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleApplyProductMappings} disabled={applying || records.length === 0 || selectedMonth === "all"}>
            <Wand2 className="w-4 h-4 mr-2" /> {applying ? "Applying…" : `Apply Next ${BATCH_LIMIT}`}
          </Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Rows</div><div className="font-semibold">{summary.total}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">OK</div><div className="font-semibold text-green-700">{summary.ok}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">To review</div><div className="font-semibold text-yellow-700">{summary.review}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Revenue ex VAT</div><div className="font-semibold">€{summary.revenue.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Meat COGS</div><div className="font-semibold">€{summary.cogs.toFixed(2)}</div></div>
      </div>

      {selectedMonth === "all" && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Select one month before applying mappings. This keeps COGS linked to the correct month.</div>}

      {applyMessage && <div className={`rounded-lg border px-4 py-3 text-sm ${applyMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" : applyMessage.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{applyMessage.text}</div>}

      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="all">All months</SelectItem></SelectContent></Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="To review">To review</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="Ignore">Ignore</SelectItem></SelectContent></Select>
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-56" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      <Card><CardContent className="overflow-x-auto p-0">{loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div> : <table className="w-full text-sm"><thead className="bg-muted text-muted-foreground text-xs"><tr>{["Date", "Product", "Qty", "Net (ex VAT)", "Channel", "Rev Type", "Cut", "kg/unit", "Cost/kg", "Price Month", "COGS", "Status", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{filtered.map(r => editingId === r.id ? <SalesRowEditor key={r.id} record={r} mappings={mappings} cutCosts={cutCosts} onSave={updates => handleUpdate(r.id, updates)} onCancel={() => setEditingId(null)} /> : <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)} title={r.cost_source || ""}><td className="px-3 py-2 whitespace-nowrap text-xs">{(r.transaction_date || r.date)?.slice(0, 10)}</td><td className="px-3 py-2 max-w-[200px] truncate">{r.product_name || r.product}</td><td className="px-3 py-2">{r.quantity ?? r.qty}</td><td className="px-3 py-2">€{getSalesNetExVat(r).toFixed(2)}</td><td className="px-3 py-2">{r.channel}</td><td className="px-3 py-2">{r.revenue_type}</td><td className="px-3 py-2">{r.cut}</td><td className="px-3 py-2">{r.kg_per_unit}</td><td className="px-3 py-2">€{Number(r.cost_per_kg || 0).toFixed(2)}</td><td className="px-3 py-2">{r.price_month}</td><td className="px-3 py-2">€{(r.meat_cogs || 0).toFixed(2)}</td><td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.mapping_status] || ""}`}>{r.mapping_status}</span></td><td className="px-3 py-2 text-xs text-muted-foreground">Edit</td></tr>)}</tbody></table>}</CardContent></Card>
    </div>
  );
}
