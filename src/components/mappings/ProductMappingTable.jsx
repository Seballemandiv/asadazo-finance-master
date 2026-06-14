import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Search, Wand2 } from "lucide-react";
import { createMissingMappingPayloads } from "@/lib/cogsEngine";

const REVENUE_TYPES = ["Meat", "Box", "Shipping", "Event", "Custom Revenue", "Other Revenue"];
const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];

export default function ProductMappingTable() {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    const r = await base44.entities.ProductMapping.list();
    setRecords(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = records.filter(r =>
    !search || r.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    await base44.entities.ProductMapping.update(editingId, editForm);
    setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...editForm } : r));
    setEditingId(null);
  };

  const handleCreateMissingFromSales = async () => {
    setSeeding(true);
    setMessage(null);
    try {
      const [activeBatches, sales, maps, priceRows] = await Promise.all([
        base44.entities.ImportBatch.filter({ status: "imported" }),
        base44.entities.SalesRecord.list("-date", 5000),
        base44.entities.ProductMapping.list(),
        base44.entities.MonthlyProductPrice.list("-month", 5000),
      ]);

      const activeSalesBatchIds = new Set(
        activeBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id)
      );
      const activeSales = sales.filter(r =>
        r.is_active !== false && r.import_batch_id && activeSalesBatchIds.has(r.import_batch_id)
      );

      const payloads = createMissingMappingPayloads(activeSales, maps, priceRows);
      if (payloads.length === 0) {
        setMessage({ type: "success", text: "No missing product mappings found for active sales imports." });
        setRecords(maps);
        return;
      }

      const created = [];
      for (const payload of payloads) {
        const rec = await base44.entities.ProductMapping.create(payload);
        created.push(rec);
      }

      setRecords([...maps, ...created]);
      setMessage({
        type: "warning",
        text: `Created ${created.length} missing product mapping(s). Rows with kg and Monthly Prices can now be applied to COGS; incomplete rows remain To review.`,
      });
    } catch (err) {
      console.error("Failed to create product mappings", err);
      setMessage({ type: "error", text: err?.message || "Failed to create product mappings." });
    } finally {
      setSeeding(false);
    }
  };

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const statusColor = { "OK": "text-green-700", "To review": "text-yellow-600", "Ignore": "text-slate-500" };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={handleCreateMissingFromSales} disabled={seeding}>
          <Wand2 className="w-4 h-4 mr-2" /> {seeding ? "Creating…" : "Create Missing Mappings from Sales"}
        </Button>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
          message.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {message.text}
        </div>
      )}

      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Workflow: seed Monthly Prices first → create missing mappings from imported Sales → review kg/unit and set Status = OK → go to Review Sales and click Apply Product Mappings. Monthly Prices supply the cost/kg by sales month.
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading…</div> : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  {["Product Name", "Revenue Type", "Channel", "Cut", "kg/unit", "Fallback Cost/kg", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => editingId === r.id ? (
                  <tr key={r.id} className="border-t bg-blue-50">
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.product_name}</td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.revenue_type || ""} onValueChange={v => set("revenue_type", v)}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{REVENUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.channel || ""} onValueChange={v => set("channel", v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" value={editForm.cut || ""} onChange={e => set("cut", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-16" type="number" step="0.01" value={editForm.kg_per_unit ?? 0} onChange={e => set("kg_per_unit", parseFloat(e.target.value) || 0)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-20" type="number" step="0.01" value={editForm.cost_per_kg ?? 0} onChange={e => set("cost_per_kg", parseFloat(e.target.value) || 0)} /></td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.status || "To review"} onValueChange={v => set("status", v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => startEdit(r)}>
                    <td className="px-3 py-2 text-xs max-w-[260px] truncate font-medium">{r.product_name}</td>
                    <td className="px-3 py-2 text-xs">{r.revenue_type}</td>
                    <td className="px-3 py-2 text-xs">{r.channel}</td>
                    <td className="px-3 py-2 text-xs">{r.cut}</td>
                    <td className="px-3 py-2 text-xs">{r.kg_per_unit}</td>
                    <td className="px-3 py-2 text-xs">{r.cost_per_kg}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`font-medium ${statusColor[r.status] || ""}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Edit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
