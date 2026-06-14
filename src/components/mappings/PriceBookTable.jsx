import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, Copy, Search, Upload, X } from "lucide-react";
import { DEFAULT_PRICE_BOOK_ROWS, samePriceKey, withMonth } from "@/lib/defaultPriceBook";

const STATUSES = ["OK", "To review", "Inactive"];

const MONTHS = Array.from({ length: 36 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toMoney(n) {
  return `€${Number(n || 0).toFixed(2)}`;
}

export default function PriceBookTable() {
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [message, setMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    const rows = await base44.entities.MonthlyProductPrice.list("-month", 5000);
    setRecords(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const availableMonths = useMemo(() => {
    const set = new Set([...MONTHS, ...records.map(r => r.month).filter(Boolean)]);
    return Array.from(set).sort().reverse();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter(r => {
      const monthOk = selectedMonth === "all" || r.month === selectedMonth;
      const product = `${r.product_name || ""} ${r.cut || ""} ${r.sku || ""}`.toLowerCase();
      const searchOk = !search || product.includes(search.toLowerCase());
      return monthOk && searchOk;
    });
  }, [records, selectedMonth, search]);

  const startEdit = (r) => {
    setEditingId(r.id);
    setEditForm({ ...r });
  };
  const cancelEdit = () => setEditingId(null);
  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const saveEdit = async () => {
    const kg = Number(editForm.kg_per_unit || 0);
    const unitCost = Number(editForm.landed_cost_per_unit || 0);
    const perKg = kg > 0 && unitCost > 0 ? unitCost / kg : Number(editForm.landed_cost_per_kg || editForm.cost_per_kg || 0);
    const updates = {
      ...editForm,
      kg_per_unit: kg,
      cost_fca: Number(editForm.cost_fca || 0),
      transport_per_unit: Number(editForm.transport_per_unit || 0),
      packaging_per_unit: Number(editForm.packaging_per_unit || 0),
      landed_cost_per_unit: unitCost,
      landed_cost_per_kg: perKg,
      cost_per_kg: perKg,
      sale_price_inc_vat: Number(editForm.sale_price_inc_vat || 0),
      vat_amount: Number(editForm.vat_amount || 0),
    };
    await base44.entities.MonthlyProductPrice.update(editingId, updates);
    setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...updates } : r));
    setEditingId(null);
  };

  const seedDefaultPrices = async () => {
    if (!selectedMonth || selectedMonth === "all") {
      setMessage({ type: "error", text: "Select a specific month before seeding prices." });
      return;
    }
    setSeeding(true);
    setMessage(null);
    try {
      const existing = await base44.entities.MonthlyProductPrice.filter({ month: selectedMonth });
      const payloads = withMonth(DEFAULT_PRICE_BOOK_ROWS, selectedMonth);
      let created = 0;
      let updated = 0;

      for (const payload of payloads) {
        const match = existing.find(r => samePriceKey(r, payload));
        if (match) {
          await base44.entities.MonthlyProductPrice.update(match.id, payload);
          updated++;
        } else {
          await base44.entities.MonthlyProductPrice.create(payload);
          created++;
        }
      }

      await load();
      setMessage({ type: "success", text: `Seeded ${selectedMonth}: ${created} created, ${updated} updated from prices.xlsx.` });
    } catch (err) {
      console.error("Failed to seed default prices", err);
      setMessage({ type: "error", text: err?.message || "Failed to seed monthly prices." });
    } finally {
      setSeeding(false);
    }
  };

  const copyPreviousMonth = async () => {
    if (!selectedMonth || selectedMonth === "all") return;
    const previousMonths = records
      .map(r => r.month)
      .filter(m => m && m < selectedMonth)
      .sort()
      .reverse();
    const sourceMonth = previousMonths[0];
    if (!sourceMonth) {
      setMessage({ type: "error", text: "No previous month found to copy from." });
      return;
    }

    setSeeding(true);
    setMessage(null);
    try {
      const sourceRows = records.filter(r => r.month === sourceMonth);
      const existingTarget = await base44.entities.MonthlyProductPrice.filter({ month: selectedMonth });
      let created = 0;
      for (const r of sourceRows) {
        const payload = { ...r, month: selectedMonth, source: `Copied from ${sourceMonth}` };
        delete payload.id;
        delete payload.created_date;
        delete payload.updated_date;
        delete payload.created_by;
        if (!existingTarget.find(x => samePriceKey(x, payload))) {
          await base44.entities.MonthlyProductPrice.create(payload);
          created++;
        }
      }
      await load();
      setMessage({ type: "success", text: `Copied ${created} price row(s) from ${sourceMonth} to ${selectedMonth}.` });
    } catch (err) {
      setMessage({ type: "error", text: err?.message || "Failed to copy previous month prices." });
    } finally {
      setSeeding(false);
    }
  };

  const statusColor = { "OK": "text-green-700", "To review": "text-yellow-600", "Inactive": "text-slate-500" };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-700">
        Monthly Prices are the cost layer for COGS. Product Mapping says what the SumUp product is; Monthly Prices say what that product/cut cost in that sales month. COGS uses the sale month first, then the latest previous price if exact month is missing.
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              <SelectItem value="all">All months</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search product/cut/SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={seedDefaultPrices} disabled={seeding || selectedMonth === "all"}>
            <Upload className="w-4 h-4 mr-2" /> {seeding ? "Seeding…" : "Seed prices.xlsx prices"}
          </Button>
          <Button variant="outline" size="sm" onClick={copyPreviousMonth} disabled={seeding || selectedMonth === "all"}>
            <Copy className="w-4 h-4 mr-2" /> Copy previous month
          </Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading…</div> : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  {["Month", "Product", "SKU", "Cut", "Pkg", "kg/unit", "DAP cost/unit", "Cost/kg", "Sale inc VAT", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => editingId === r.id ? (
                  <tr key={r.id} className="border-t bg-blue-50">
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" value={editForm.month || ""} onChange={e => set("month", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-56" value={editForm.product_name || ""} onChange={e => set("product_name", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-20" value={editForm.sku || ""} onChange={e => set("sku", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" value={editForm.cut || ""} onChange={e => set("cut", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-20" value={editForm.package_label || ""} onChange={e => set("package_label", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-16" type="number" step="0.01" value={editForm.kg_per_unit ?? 0} onChange={e => set("kg_per_unit", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" type="number" step="0.01" value={editForm.landed_cost_per_unit ?? 0} onChange={e => set("landed_cost_per_unit", e.target.value)} /></td>
                    <td className="px-3 py-1.5 text-xs">{toMoney((Number(editForm.landed_cost_per_unit || 0) / (Number(editForm.kg_per_unit || 0) || 1)))}</td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" type="number" step="0.01" value={editForm.sale_price_inc_vat ?? 0} onChange={e => set("sale_price_inc_vat", e.target.value)} /></td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.status || "OK"} onValueChange={v => set("status", v)}>
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
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{r.month}</td>
                    <td className="px-3 py-2 text-xs max-w-[260px] truncate font-medium">{r.product_name}</td>
                    <td className="px-3 py-2 text-xs">{r.sku}</td>
                    <td className="px-3 py-2 text-xs">{r.cut}</td>
                    <td className="px-3 py-2 text-xs">{r.package_label}</td>
                    <td className="px-3 py-2 text-xs">{r.kg_per_unit}</td>
                    <td className="px-3 py-2 text-xs">{toMoney(r.landed_cost_per_unit)}</td>
                    <td className="px-3 py-2 text-xs">{toMoney(r.landed_cost_per_kg || r.cost_per_kg)}</td>
                    <td className="px-3 py-2 text-xs">{toMoney(r.sale_price_inc_vat)}</td>
                    <td className="px-3 py-2 text-xs"><span className={`font-medium ${statusColor[r.status] || ""}`}>{r.status}</span></td>
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
