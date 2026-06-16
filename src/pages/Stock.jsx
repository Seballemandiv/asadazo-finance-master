import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, RefreshCw, Truck, Car, Barcode, Search, Edit2, Trash2, X } from "lucide-react";

const SUPPLIERS = ["Adrian", "La Maxima", "Other"];
const money = v => `€${Number(v || 0).toFixed(2)}`;
const n = v => Number(String(v || 0).replace(",", ".")) || 0;
const emptySku = { sku: "", public_name: "", supplier: "Adrian", product_family: "", kg_per_unit: "1", default_sale_price_inc_vat: "0", current_fca_cost_per_kg: "0", current_landed_cost_per_kg: "0" };

export default function Stock() {
  const [tab, setTab] = useState("skus");
  const [skus, setSkus] = useState([]);
  const [batches, setBatches] = useState([]);
  const [lines, setLines] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [skuForm, setSkuForm] = useState(emptySku);
  const [editingSkuId, setEditingSkuId] = useState(null);
  const [selectedSkuIds, setSelectedSkuIds] = useState([]);
  const [skuSearch, setSkuSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const [skuRows, batchRows, lineRows, tripRows] = await Promise.all([
      base44.entities.ProductSku ? base44.entities.ProductSku.list("sku", 1000) : [],
      base44.entities.StockBatch ? base44.entities.StockBatch.list("-arrival_date", 1000) : [],
      base44.entities.StockBatchLine ? base44.entities.StockBatchLine.list("batch_ref", 2000) : [],
      base44.entities.VehicleTrip ? base44.entities.VehicleTrip.list("-trip_date", 1000) : [],
    ]);
    setSkus(skuRows.filter(r => r.status !== "Inactive"));
    setBatches(batchRows.filter(r => r.is_active !== false));
    setLines(lineRows);
    setTrips(tripRows.filter(r => r.is_active !== false));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    skuCount: skus.length,
    stockKg: lines.reduce((s, r) => s + n(r.kg_remaining || r.kg_received), 0),
    stockValue: lines.reduce((s, r) => s + n(r.kg_remaining || r.kg_received) * n(r.landed_cost_per_kg), 0),
    landedCash: batches.reduce((s, r) => s + n(r.total_landed_cost), 0),
    vehicleNet: trips.reduce((s, r) => s + n(r.net_cost), 0),
  }), [skus, lines, batches, trips]);

  const filteredSkus = useMemo(() => skus.filter(s => {
    const text = `${s.sku || ""} ${s.public_name || ""} ${s.product_family || ""}`.toLowerCase();
    return (!skuSearch || text.includes(skuSearch.toLowerCase())) && (supplierFilter === "all" || s.supplier === supplierFilter);
  }), [skus, skuSearch, supplierFilter]);
  const visibleSkuIds = filteredSkus.map(s => s.id);
  const allVisibleSelected = visibleSkuIds.length > 0 && visibleSkuIds.every(id => selectedSkuIds.includes(id));

  const setSku = (key, value) => setSkuForm(prev => ({ ...prev, [key]: value }));
  const resetSkuForm = () => { setSkuForm(emptySku); setEditingSkuId(null); };
  const editSku = row => {
    setEditingSkuId(row.id);
    setSkuForm({ sku: row.sku || "", public_name: row.public_name || "", supplier: row.supplier || "Other", product_family: row.product_family || row.cut || "", kg_per_unit: String(row.kg_per_unit || 0), default_sale_price_inc_vat: String(row.default_sale_price_inc_vat || 0), current_fca_cost_per_kg: String(row.current_fca_cost_per_kg || 0), current_landed_cost_per_kg: String(row.current_landed_cost_per_kg || 0) });
  };
  const saveSku = async event => {
    event.preventDefault();
    if (!skuForm.sku || !skuForm.public_name) return alert("SKU and public name are required.");
    const payload = { sku: skuForm.sku.trim(), public_name: skuForm.public_name.trim(), supplier: skuForm.supplier, product_family: skuForm.product_family.trim(), cut: skuForm.product_family.trim(), kg_per_unit: n(skuForm.kg_per_unit), units_per_pack: 1, default_sale_price_inc_vat: n(skuForm.default_sale_price_inc_vat), current_fca_cost_per_kg: n(skuForm.current_fca_cost_per_kg), current_landed_cost_per_kg: n(skuForm.current_landed_cost_per_kg), status: "Active" };
    if (editingSkuId) {
      await base44.entities.ProductSku.update(editingSkuId, payload);
      setSkus(prev => prev.map(s => s.id === editingSkuId ? { ...s, ...payload } : s).sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
    } else {
      const created = await base44.entities.ProductSku.create(payload);
      setSkus(prev => [...prev, created].sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
    }
    resetSkuForm();
  };
  const toggleSku = id => setSelectedSkuIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleVisibleSkus = () => setSelectedSkuIds(prev => allVisibleSelected ? prev.filter(id => !visibleSkuIds.includes(id)) : Array.from(new Set([...prev, ...visibleSkuIds])));
  const deleteSelectedSkus = async () => {
    if (!selectedSkuIds.length || !window.confirm(`Delete ${selectedSkuIds.length} selected SKU(s)? They will be archived, not removed from old records.`)) return;
    for (const id of selectedSkuIds) await base44.entities.ProductSku.update(id, { status: "Inactive" });
    setSkus(prev => prev.filter(s => !selectedSkuIds.includes(s.id)));
    setSelectedSkuIds([]);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-foreground">Stock & Costing</h1><p className="text-muted-foreground text-sm mt-1">Product SKUs, stock batches, landed cost and vehicle trip allocation.</p></div><Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4"><SummaryCard label="Product SKUs" value={summary.skuCount} icon={Barcode} /><SummaryCard label="Stock kg" value={`${summary.stockKg.toFixed(1)} kg`} icon={Package} /><SummaryCard label="Inventory value" value={money(summary.stockValue)} icon={Package} /><SummaryCard label="Batch landed cash" value={money(summary.landedCash)} icon={Truck} /><SummaryCard label="Vehicle net cost" value={money(summary.vehicleNet)} icon={Car} /></div>
    <div className="flex flex-wrap gap-2 border-b pb-2"><Tab active={tab === "skus"} onClick={() => setTab("skus")}>Product SKU Master</Tab><Tab active={tab === "batches"} onClick={() => setTab("batches")}>Stock Batches</Tab><Tab active={tab === "lines"} onClick={() => setTab("lines")}>Batch Lines</Tab><Tab active={tab === "trips"} onClick={() => setTab("trips")}>Vehicle Trips</Tab></div>
    {tab === "skus" && <Panel title="Product SKU Master"><form onSubmit={saveSku} className="rounded-lg border bg-background p-4 mb-4 space-y-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-medium">{editingSkuId ? "Edit SKU" : "Add SKU"}</div>{editingSkuId && <Button type="button" size="sm" variant="outline" onClick={resetSkuForm}><X className="w-4 h-4 mr-1" /> Cancel edit</Button>}</div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Internal SKU"><Input value={skuForm.sku} onChange={e => setSku("sku", e.target.value)} placeholder="A-VACIO-1KG" /></Field><Field label="Public name"><Input value={skuForm.public_name} onChange={e => setSku("public_name", e.target.value)} placeholder="Vacío parrillero - 1kg" /></Field><Field label="Supplier"><Select value={skuForm.supplier} onValueChange={v => setSku("supplier", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPLIERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field><Field label="Family / cut"><Input value={skuForm.product_family} onChange={e => setSku("product_family", e.target.value)} placeholder="Vacío" /></Field><Field label="Kg/unit"><Input value={skuForm.kg_per_unit} onChange={e => setSku("kg_per_unit", e.target.value)} /></Field><Field label="Sale price inc VAT"><Input value={skuForm.default_sale_price_inc_vat} onChange={e => setSku("default_sale_price_inc_vat", e.target.value)} /></Field><Field label="FCA €/kg"><Input value={skuForm.current_fca_cost_per_kg} onChange={e => setSku("current_fca_cost_per_kg", e.target.value)} /></Field><Field label="Landed €/kg"><Input value={skuForm.current_landed_cost_per_kg} onChange={e => setSku("current_landed_cost_per_kg", e.target.value)} /></Field></div><div className="flex justify-end"><Button size="sm" type="submit"><Plus className="w-4 h-4 mr-1" /> {editingSkuId ? "Update SKU" : "Save SKU"}</Button></div></form><div className="flex flex-wrap items-center gap-2 mb-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-72" placeholder="Filter SKU, name, family..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} /></div><Select value={supplierFilter} onValueChange={setSupplierFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All suppliers</SelectItem>{SUPPLIERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={toggleVisibleSkus}>{allVisibleSelected ? "Clear visible" : "Select visible"}</Button>{selectedSkuIds.length > 0 && <Button size="sm" variant="destructive" onClick={deleteSelectedSkus}><Trash2 className="w-4 h-4 mr-1" /> Delete selected ({selectedSkuIds.length})</Button>}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisibleSkus} /></th>{["SKU", "Public name", "Supplier", "Family", "Kg/unit", "Sale price", "FCA €/kg", "Landed €/kg", "Status", "Edit"].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{filteredSkus.map(s => <tr key={s.id} className="border-t"><td className="px-3 py-2"><input type="checkbox" checked={selectedSkuIds.includes(s.id)} onChange={() => toggleSku(s.id)} /></td><td className="px-3 py-2 font-medium whitespace-nowrap">{s.sku}</td><td className="px-3 py-2 whitespace-nowrap">{s.public_name}</td><td className="px-3 py-2 whitespace-nowrap">{s.supplier}</td><td className="px-3 py-2 whitespace-nowrap">{s.product_family || s.cut}</td><td className="px-3 py-2 whitespace-nowrap">{n(s.kg_per_unit).toFixed(2)}</td><td className="px-3 py-2 whitespace-nowrap">{money(s.default_sale_price_inc_vat)}</td><td className="px-3 py-2 whitespace-nowrap">{money(s.current_fca_cost_per_kg)}</td><td className="px-3 py-2 whitespace-nowrap">{money(s.current_landed_cost_per_kg)}</td><td className="px-3 py-2 whitespace-nowrap">{s.status}</td><td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => editSku(s)}><Edit2 className="w-4 h-4" /></Button></td></tr>)}</tbody></table>{filteredSkus.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">No SKUs match the current filters.</div>}</div></Panel>}
    {tab === "batches" && <Panel title="Stock Batches"><Table headers={["Batch", "Supplier", "Arrival", "Kg", "FCA", "Transport", "Vehicle", "Total landed", "€/kg", "Status"]} rows={batches.map(b => [b.batch_ref, b.supplier, b.arrival_date, n(b.total_kg_received).toFixed(1), money(b.supplier_fca_total), money(n(b.transport_to_girona) + n(b.transport_to_nl)), money(b.vehicle_cost), money(b.total_landed_cost), money(b.landed_cost_per_kg), b.status])} /></Panel>}
    {tab === "lines" && <Panel title="Batch Lines"><Table headers={["Batch", "SKU", "Product", "Supplier", "Kg", "FCA €/kg", "Allocated cost", "Landed total", "Landed €/kg", "Remaining"]} rows={lines.map(l => [l.batch_ref, l.sku, l.public_name, l.supplier, n(l.kg_received).toFixed(1), money(l.fca_cost_per_kg), money(n(l.allocated_transport) + n(l.allocated_handling) + n(l.allocated_vehicle) + n(l.allocated_other)), money(l.landed_total), money(l.landed_cost_per_kg), `${n(l.kg_remaining).toFixed(1)} kg`])} /></Panel>}
    {tab === "trips" && <Panel title="Vehicle Trips"><Table headers={["Trip", "Provider", "Date", "Purpose", "Out", "Refund", "Net", "Stock", "Delivery", "Event", "Km"]} rows={trips.map(t => [t.trip_ref, t.provider, t.trip_date, t.purpose, money(t.amount_out_total), money(t.amount_in_total), money(t.net_cost), money(t.stock_cost), money(t.delivery_cost), money(t.event_cost), n(t.total_km).toFixed(0)])} /></Panel>}
  </div>;
}
function Tab({ active, onClick, children }) { return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{children}</button>; }
function SummaryCard({ label, value, icon: Icon }) { return <div className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold mt-1">{value}</p></div><div className="rounded-lg bg-primary/30 text-primary-foreground p-2"><Icon className="w-5 h-5" /></div></div></div>; }
function Panel({ title, children }) { return <section className="rounded-lg border bg-card"><div className="px-4 py-3 border-b"><h2 className="font-semibold">{title}</h2></div><div className="p-4">{children}</div></section>; }
function Field({ label, children }) { return <label className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{label}</div>{children}</label>; }
function Table({ headers, rows }) { if (!rows.length) return <div className="text-sm text-muted-foreground py-8 text-center">No rows yet.</div>; return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{cell || "—"}</td>)}</tr>)}</tbody></table></div>; }
