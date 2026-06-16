import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Barcode, Car, Edit2, Package, Plus, RefreshCw, Search, Trash2, Truck, X } from "lucide-react";

const SUPPLIERS = ["Adrian", "La Maxima", "Other"];
const money = (v) => `€${Number(v || 0).toFixed(2)}`;
const num = (v) => Number(String(v || 0).replace(",", ".")) || 0;
const belowZero = (...values) => values.some((v) => Number(String(v || 0).replace(",", ".")) < 0);
const today = () => new Date().toISOString().slice(0, 10);
const monthFromDate = (d) => String(d || "").slice(0, 7);
const makeBatchRef = (supplier, date) => `${supplier === "La Maxima" ? "LM" : supplier === "Adrian" ? "A" : "BATCH"}-${String(date || today()).slice(0, 10)}`;
const emptySku = { sku: "", public_name: "", supplier: "Adrian", product_family: "", kg_per_unit: "1", default_sale_price_inc_vat: "0", current_fca_cost_per_kg: "0", current_landed_cost_per_kg: "0" };
const emptyBatch = { supplier: "Adrian", arrival_date: today(), invoice_date: today(), batch_ref: "", supplier_invoice_no: "", total_kg_received: "0", supplier_fca_total: "0", transport_to_girona: "0", transport_to_nl: "0", vehicle_cost: "0", handling_cost: "0", other_landed_cost: "0" };
const emptyLine = { batch_ref: "", sku: "", public_name: "", kg_received: "0", units_received: "0", fca_cost_per_kg: "0" };

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
  const [batchSearch, setBatchSearch] = useState("");
  const [batchSupplierFilter, setBatchSupplierFilter] = useState("all");
  const [batchForm, setBatchForm] = useState(emptyBatch);
  const [lineForm, setLineForm] = useState(emptyLine);

  const load = async () => {
    setLoading(true);
    const [skuRows, batchRows, lineRows, tripRows] = await Promise.all([
      base44.entities.ProductSku ? base44.entities.ProductSku.list("sku", 1000) : [],
      base44.entities.StockBatch ? base44.entities.StockBatch.list("-arrival_date", 1000) : [],
      base44.entities.StockBatchLine ? base44.entities.StockBatchLine.list("batch_ref", 2000) : [],
      base44.entities.VehicleTrip ? base44.entities.VehicleTrip.list("-trip_date", 1000) : [],
    ]);
    setSkus(skuRows.filter((r) => r.status !== "Inactive"));
    setBatches(batchRows.filter((r) => r.is_active !== false));
    setLines(lineRows);
    setTrips(tripRows.filter((r) => r.is_active !== false));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => ({
    skuCount: skus.length,
    stockKg: lines.reduce((s, r) => s + num(r.kg_remaining || r.kg_received), 0),
    stockValue: lines.reduce((s, r) => s + num(r.kg_remaining || r.kg_received) * num(r.landed_cost_per_kg), 0),
    landedCash: batches.reduce((s, r) => s + num(r.total_landed_cost), 0),
    vehicleNet: trips.reduce((s, r) => s + num(r.net_cost), 0),
  }), [skus, lines, batches, trips]);

  const filteredSkus = useMemo(() => skus.filter((s) => {
    const text = `${s.sku || ""} ${s.public_name || ""} ${s.product_family || ""}`.toLowerCase();
    return (!skuSearch || text.includes(skuSearch.toLowerCase())) && (supplierFilter === "all" || s.supplier === supplierFilter);
  }), [skus, skuSearch, supplierFilter]);

  const filteredBatches = useMemo(() => batches.filter((b) => {
    const text = `${b.batch_ref || ""} ${b.supplier_invoice_no || ""} ${b.notes || ""} ${b.status || ""}`.toLowerCase();
    return (!batchSearch || text.includes(batchSearch.toLowerCase())) && (batchSupplierFilter === "all" || b.supplier === batchSupplierFilter);
  }), [batches, batchSearch, batchSupplierFilter]);

  const visibleSkuIds = filteredSkus.map((s) => s.id);
  const allVisibleSelected = visibleSkuIds.length > 0 && visibleSkuIds.every((id) => selectedSkuIds.includes(id));

  const setSkuField = (key, value) => setSkuForm((prev) => ({ ...prev, [key]: value }));
  const resetSkuForm = () => { setSkuForm(emptySku); setEditingSkuId(null); };
  const editSku = (row) => {
    setEditingSkuId(row.id);
    setSkuForm({ sku: row.sku || "", public_name: row.public_name || "", supplier: row.supplier || "Other", product_family: row.product_family || row.cut || "", kg_per_unit: String(row.kg_per_unit || 0), default_sale_price_inc_vat: String(row.default_sale_price_inc_vat || 0), current_fca_cost_per_kg: String(row.current_fca_cost_per_kg || 0), current_landed_cost_per_kg: String(row.current_landed_cost_per_kg || 0) });
  };
  const saveSku = async (event) => {
    event.preventDefault();
    if (!skuForm.sku || !skuForm.public_name) return alert("SKU and public name are required.");
    if (belowZero(skuForm.kg_per_unit, skuForm.default_sale_price_inc_vat, skuForm.current_fca_cost_per_kg, skuForm.current_landed_cost_per_kg)) return alert("SKU values cannot be below zero.");
    const payload = { sku: skuForm.sku.trim(), public_name: skuForm.public_name.trim(), supplier: skuForm.supplier, product_family: skuForm.product_family.trim(), cut: skuForm.product_family.trim(), kg_per_unit: num(skuForm.kg_per_unit), units_per_pack: 1, default_sale_price_inc_vat: num(skuForm.default_sale_price_inc_vat), current_fca_cost_per_kg: num(skuForm.current_fca_cost_per_kg), current_landed_cost_per_kg: num(skuForm.current_landed_cost_per_kg), status: "Active" };
    if (editingSkuId) {
      await base44.entities.ProductSku.update(editingSkuId, payload);
      setSkus((prev) => prev.map((s) => s.id === editingSkuId ? { ...s, ...payload } : s).sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
    } else {
      const created = await base44.entities.ProductSku.create(payload);
      setSkus((prev) => [...prev, created].sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
    }
    resetSkuForm();
  };
  const toggleSku = (id) => setSelectedSkuIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleVisible = () => setSelectedSkuIds((prev) => allVisibleSelected ? prev.filter((id) => !visibleSkuIds.includes(id)) : Array.from(new Set([...prev, ...visibleSkuIds])));
  const deleteSelectedSkus = async () => {
    if (!selectedSkuIds.length || !window.confirm(`Archive ${selectedSkuIds.length} selected SKU(s)?`)) return;
    for (const id of selectedSkuIds) await base44.entities.ProductSku.update(id, { status: "Inactive" });
    setSkus((prev) => prev.filter((s) => !selectedSkuIds.includes(s.id)));
    setSelectedSkuIds([]);
  };

  const setBatchField = (key, value) => setBatchForm((prev) => ({ ...prev, [key]: value }));
  const batchTotal = num(batchForm.supplier_fca_total) + num(batchForm.transport_to_girona) + num(batchForm.transport_to_nl) + num(batchForm.vehicle_cost) + num(batchForm.handling_cost) + num(batchForm.other_landed_cost);
  const batchCostPerKg = num(batchForm.total_kg_received) > 0 ? batchTotal / num(batchForm.total_kg_received) : 0;
  const saveBatch = async (event) => {
    event.preventDefault();
    if (belowZero(batchForm.total_kg_received, batchForm.supplier_fca_total, batchForm.transport_to_girona, batchForm.transport_to_nl, batchForm.vehicle_cost, batchForm.handling_cost, batchForm.other_landed_cost)) return alert("Batch kg and money values cannot be below zero.");
    if (num(batchForm.total_kg_received) <= 0) return alert("Batch kg received must be greater than zero.");
    const ref = batchForm.batch_ref || makeBatchRef(batchForm.supplier, batchForm.arrival_date);
    const payload = { batch_ref: ref, supplier: batchForm.supplier, origin: batchForm.supplier === "La Maxima" ? "Malaga" : batchForm.supplier === "Adrian" ? "Valencia" : "", supplier_invoice_no: batchForm.supplier_invoice_no, invoice_date: batchForm.invoice_date, arrival_date: batchForm.arrival_date, accounting_month: monthFromDate(batchForm.arrival_date), total_kg_received: num(batchForm.total_kg_received), supplier_fca_total: num(batchForm.supplier_fca_total), transport_to_girona: num(batchForm.transport_to_girona), transport_to_nl: num(batchForm.transport_to_nl), vehicle_cost: num(batchForm.vehicle_cost), handling_cost: num(batchForm.handling_cost), other_landed_cost: num(batchForm.other_landed_cost), total_landed_cost: batchTotal, landed_cost_per_kg: batchCostPerKg, status: "Draft", is_active: true };
    const created = await base44.entities.StockBatch.create(payload);
    setBatches((prev) => [created, ...prev]);
    setBatchForm(emptyBatch);
  };

  const setLineField = (key, value) => {
    if (key === "sku") {
      const sku = skus.find((s) => s.sku === value);
      setLineForm((prev) => ({ ...prev, sku: value, public_name: sku?.public_name || "", fca_cost_per_kg: String(sku?.current_fca_cost_per_kg || 0) }));
      return;
    }
    setLineForm((prev) => ({ ...prev, [key]: value }));
  };
  const selectedBatch = batches.find((b) => b.batch_ref === lineForm.batch_ref);
  const selectedSku = skus.find((s) => s.sku === lineForm.sku);
  const lineKg = num(lineForm.kg_received);
  const lineFcaTotal = lineKg * num(lineForm.fca_cost_per_kg);
  const batchKg = num(selectedBatch?.total_kg_received);
  const assignedKg = lines.filter((l) => l.batch_ref === lineForm.batch_ref).reduce((sum, l) => sum + num(l.kg_received), 0);
  const remainingKg = Math.max(0, batchKg - assignedKg);
  const lineShare = batchKg > 0 ? lineKg / batchKg : 0;
  const lineAllocatedTransport = lineShare * (num(selectedBatch?.transport_to_girona) + num(selectedBatch?.transport_to_nl));
  const lineAllocatedHandling = lineShare * num(selectedBatch?.handling_cost);
  const lineAllocatedVehicle = lineShare * num(selectedBatch?.vehicle_cost);
  const lineAllocatedOther = lineShare * num(selectedBatch?.other_landed_cost);
  const lineLandedTotal = lineFcaTotal + lineAllocatedTransport + lineAllocatedHandling + lineAllocatedVehicle + lineAllocatedOther;
  const lineLandedPerKg = lineKg > 0 ? lineLandedTotal / lineKg : 0;
  const saveLine = async (event) => {
    event.preventDefault();
    if (!selectedBatch) return alert("Choose a stock batch first.");
    if (!lineForm.sku) return alert("Choose a SKU first.");
    if (belowZero(lineForm.kg_received, lineForm.units_received, lineForm.fca_cost_per_kg)) return alert("Line kg, units and money values cannot be below zero.");
    if (batchKg <= 0) return alert("Selected batch has 0 kg. Fix the stock batch first.");
    if (lineKg <= 0) return alert("Line kg received must be greater than zero.");
    if (lineKg > remainingKg) return alert(`This line exceeds the remaining batch kg. Remaining: ${remainingKg.toFixed(1)} kg.`);
    const payload = { batch_id: selectedBatch.id, batch_ref: selectedBatch.batch_ref, sku: lineForm.sku, public_name: lineForm.public_name || selectedSku?.public_name || lineForm.sku, supplier: selectedSku?.supplier || selectedBatch.supplier || "Other", cut: selectedSku?.cut || selectedSku?.product_family || lineForm.public_name || lineForm.sku, kg_received: lineKg, units_received: num(lineForm.units_received), pack_size_label: selectedSku?.pack_size_label || "", fca_cost_per_kg: num(lineForm.fca_cost_per_kg), fca_total: lineFcaTotal, allocated_transport: lineAllocatedTransport, allocated_handling: lineAllocatedHandling, allocated_vehicle: lineAllocatedVehicle, allocated_other: lineAllocatedOther, landed_total: lineLandedTotal, landed_cost_per_kg: lineLandedPerKg, kg_remaining: lineKg, status: "Draft" };
    const created = await base44.entities.StockBatchLine.create(payload);
    setLines((prev) => [...prev, created]);
    setLineForm({ ...emptyLine, batch_ref: selectedBatch.batch_ref });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-foreground">Stock & Costing</h1><p className="text-muted-foreground text-sm mt-1">Product SKUs, stock batches, landed cost and vehicle trip allocation.</p></div><Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button></div>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4"><SummaryCard label="Product SKUs" value={summary.skuCount} icon={Barcode} /><SummaryCard label="Stock kg" value={`${summary.stockKg.toFixed(1)} kg`} icon={Package} /><SummaryCard label="Inventory value" value={money(summary.stockValue)} icon={Package} /><SummaryCard label="Batch landed cash" value={money(summary.landedCash)} icon={Truck} /><SummaryCard label="Vehicle net cost" value={money(summary.vehicleNet)} icon={Car} /></div>
    <div className="flex flex-wrap gap-2 border-b pb-2"><Tab active={tab === "skus"} onClick={() => setTab("skus")}>Product SKU Master</Tab><Tab active={tab === "batches"} onClick={() => setTab("batches")}>Stock Batches</Tab><Tab active={tab === "lines"} onClick={() => setTab("lines")}>Batch Lines</Tab><Tab active={tab === "trips"} onClick={() => setTab("trips")}>Vehicle Trips</Tab></div>

    {tab === "skus" && <Panel title="Product SKU Master"><form onSubmit={saveSku} className="rounded-lg border bg-background p-4 mb-4 space-y-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-medium">{editingSkuId ? "Edit SKU" : "Add SKU"}</div>{editingSkuId && <Button type="button" size="sm" variant="outline" onClick={resetSkuForm}><X className="w-4 h-4 mr-1" /> Cancel edit</Button>}</div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Internal SKU"><Input value={skuForm.sku} onChange={(e) => setSkuField("sku", e.target.value)} placeholder="A-VACIO-1KG" /></Field><Field label="Public name"><Input value={skuForm.public_name} onChange={(e) => setSkuField("public_name", e.target.value)} placeholder="Vacío parrillero - 1kg" /></Field><Field label="Supplier"><Select value={skuForm.supplier} onValueChange={(v) => setSkuField("supplier", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field><Field label="Family / cut"><Input value={skuForm.product_family} onChange={(e) => setSkuField("product_family", e.target.value)} placeholder="Vacío" /></Field><Field label="Kg/unit"><Input type="number" min="0" value={skuForm.kg_per_unit} onChange={(e) => setSkuField("kg_per_unit", e.target.value)} /></Field><Field label="Sale price inc VAT"><Input type="number" min="0" value={skuForm.default_sale_price_inc_vat} onChange={(e) => setSkuField("default_sale_price_inc_vat", e.target.value)} /></Field><Field label="FCA €/kg"><Input type="number" min="0" value={skuForm.current_fca_cost_per_kg} onChange={(e) => setSkuField("current_fca_cost_per_kg", e.target.value)} /></Field><Field label="Landed €/kg"><Input type="number" min="0" value={skuForm.current_landed_cost_per_kg} onChange={(e) => setSkuField("current_landed_cost_per_kg", e.target.value)} /></Field></div><div className="flex justify-end"><Button size="sm" type="submit"><Plus className="w-4 h-4 mr-1" /> {editingSkuId ? "Update SKU" : "Save SKU"}</Button></div></form><div className="flex flex-wrap items-center gap-2 mb-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-72" placeholder="Filter SKU, name, family..." value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)} /></div><Select value={supplierFilter} onValueChange={setSupplierFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All suppliers</SelectItem>{SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={toggleVisible}>{allVisibleSelected ? "Clear visible" : "Select visible"}</Button>{selectedSkuIds.length > 0 && <Button size="sm" variant="destructive" onClick={deleteSelectedSkus}><Trash2 className="w-4 h-4 mr-1" /> Delete selected ({selectedSkuIds.length})</Button>}</div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th>{["SKU", "Public name", "Supplier", "Family", "Kg/unit", "Sale price", "FCA €/kg", "Landed €/kg", "Status", "Edit"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead><tbody>{filteredSkus.map((s) => <tr key={s.id} className="border-t"><td className="px-3 py-2"><input type="checkbox" checked={selectedSkuIds.includes(s.id)} onChange={() => toggleSku(s.id)} /></td><Td strong>{s.sku}</Td><Td>{s.public_name}</Td><Td>{s.supplier}</Td><Td>{s.product_family || s.cut}</Td><Td>{num(s.kg_per_unit).toFixed(2)}</Td><Td>{money(s.default_sale_price_inc_vat)}</Td><Td>{money(s.current_fca_cost_per_kg)}</Td><Td>{money(s.current_landed_cost_per_kg)}</Td><Td>{s.status}</Td><td className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => editSku(s)}><Edit2 className="w-4 h-4" /></Button></td></tr>)}</tbody></table>{filteredSkus.length === 0 && <Empty />}</div></Panel>}

    {tab === "batches" && <Panel title="Stock Batches"><form onSubmit={saveBatch} className="rounded-lg border bg-background p-4 mb-4 space-y-3"><div className="text-sm font-medium">Add Stock Batch · total {money(batchTotal)} · {money(batchCostPerKg)}/kg</div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Supplier"><Select value={batchForm.supplier} onValueChange={(v) => setBatchField("supplier", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field><Field label="Arrival date"><Input type="date" value={batchForm.arrival_date} onChange={(e) => setBatchField("arrival_date", e.target.value)} /></Field><Field label="Invoice date"><Input type="date" value={batchForm.invoice_date} onChange={(e) => setBatchField("invoice_date", e.target.value)} /></Field><Field label="Batch ref"><Input value={batchForm.batch_ref || makeBatchRef(batchForm.supplier, batchForm.arrival_date)} onChange={(e) => setBatchField("batch_ref", e.target.value)} /></Field><Field label="Invoice no"><Input value={batchForm.supplier_invoice_no} onChange={(e) => setBatchField("supplier_invoice_no", e.target.value)} /></Field><Field label="Kg received"><Input type="number" min="0" value={batchForm.total_kg_received} onChange={(e) => setBatchField("total_kg_received", e.target.value)} /></Field><Field label="Supplier FCA total"><Input type="number" min="0" value={batchForm.supplier_fca_total} onChange={(e) => setBatchField("supplier_fca_total", e.target.value)} /></Field><Field label="Transport to Girona"><Input type="number" min="0" value={batchForm.transport_to_girona} onChange={(e) => setBatchField("transport_to_girona", e.target.value)} /></Field><Field label="Transport to NL"><Input type="number" min="0" value={batchForm.transport_to_nl} onChange={(e) => setBatchField("transport_to_nl", e.target.value)} /></Field><Field label="Vehicle pickup"><Input type="number" min="0" value={batchForm.vehicle_cost} onChange={(e) => setBatchField("vehicle_cost", e.target.value)} /></Field><Field label="Handling"><Input type="number" min="0" value={batchForm.handling_cost} onChange={(e) => setBatchField("handling_cost", e.target.value)} /></Field><Field label="Other landed"><Input type="number" min="0" value={batchForm.other_landed_cost} onChange={(e) => setBatchField("other_landed_cost", e.target.value)} /></Field></div><div className="flex justify-end"><Button size="sm" type="submit"><Plus className="w-4 h-4 mr-1" /> Save batch</Button></div></form><div className="flex flex-wrap items-center gap-2 mb-3"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-72" placeholder="Filter batch, invoice, notes..." value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} /></div><Select value={batchSupplierFilter} onValueChange={setBatchSupplierFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All suppliers</SelectItem>{SUPPLIERS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><Table headers={["Batch", "Supplier", "Arrival", "Kg", "FCA", "Transport", "Vehicle", "Total landed", "€/kg", "Status"]} rows={filteredBatches.map((b) => [b.batch_ref, b.supplier, b.arrival_date, num(b.total_kg_received).toFixed(1), money(b.supplier_fca_total), money(num(b.transport_to_girona) + num(b.transport_to_nl)), money(b.vehicle_cost), money(b.total_landed_cost), money(b.landed_cost_per_kg), b.status])} /></Panel>}

    {tab === "lines" && <Panel title="Batch Lines"><form onSubmit={saveLine} className="rounded-lg border bg-background p-4 mb-4 space-y-3"><div className="text-sm font-medium">Add Batch Line · landed {money(lineLandedTotal)} · {money(lineLandedPerKg)}/kg</div>{selectedBatch && <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Batch total: {batchKg.toFixed(1)} kg · Assigned: {assignedKg.toFixed(1)} kg · Remaining: {remainingKg.toFixed(1)} kg</div>}<div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Field label="Batch"><Select value={lineForm.batch_ref} onValueChange={(v) => setLineField("batch_ref", v)}><SelectTrigger><SelectValue placeholder="Choose batch" /></SelectTrigger><SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.batch_ref}>{b.batch_ref}</SelectItem>)}</SelectContent></Select></Field><Field label="SKU"><Select value={lineForm.sku} onValueChange={(v) => setLineField("sku", v)}><SelectTrigger><SelectValue placeholder="Choose SKU" /></SelectTrigger><SelectContent>{skus.map((s) => <SelectItem key={s.id} value={s.sku}>{s.sku}</SelectItem>)}</SelectContent></Select></Field><Field label="Product"><Input value={lineForm.public_name} onChange={(e) => setLineField("public_name", e.target.value)} /></Field><Field label="Kg received"><Input type="number" min="0" value={lineForm.kg_received} onChange={(e) => setLineField("kg_received", e.target.value)} /></Field><Field label="Packs / units"><Input type="number" min="0" value={lineForm.units_received} onChange={(e) => setLineField("units_received", e.target.value)} /></Field><Field label="FCA €/kg"><Input type="number" min="0" value={lineForm.fca_cost_per_kg} onChange={(e) => setLineField("fca_cost_per_kg", e.target.value)} /></Field><Field label="Allocated shared costs"><Input readOnly value={money(lineAllocatedTransport + lineAllocatedHandling + lineAllocatedVehicle + lineAllocatedOther)} /></Field><Field label="Landed €/kg"><Input readOnly value={money(lineLandedPerKg)} /></Field></div><div className="flex justify-end"><Button size="sm" type="submit"><Plus className="w-4 h-4 mr-1" /> Save line</Button></div></form><Table headers={["Batch", "SKU", "Product", "Supplier", "Kg", "FCA €/kg", "Allocated cost", "Landed total", "Landed €/kg", "Remaining"]} rows={lines.map((l) => [l.batch_ref, l.sku, l.public_name, l.supplier, num(l.kg_received).toFixed(1), money(l.fca_cost_per_kg), money(num(l.allocated_transport) + num(l.allocated_handling) + num(l.allocated_vehicle) + num(l.allocated_other)), money(l.landed_total), money(l.landed_cost_per_kg), `${num(l.kg_remaining).toFixed(1)} kg`])} /></Panel>}
    {tab === "trips" && <Panel title="Vehicle Trips"><Table headers={["Trip", "Provider", "Date", "Purpose", "Out", "Refund", "Net", "Stock", "Delivery", "Event", "Km"]} rows={trips.map((t) => [t.trip_ref, t.provider, t.trip_date, t.purpose, money(t.amount_out_total), money(t.amount_in_total), money(t.net_cost), money(t.stock_cost), money(t.delivery_cost), money(t.event_cost), num(t.total_km).toFixed(0)])} /></Panel>}
  </div>;
}
function Tab({ active, onClick, children }) { return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{children}</button>; }
function SummaryCard({ label, value, icon: Icon }) { return <div className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold mt-1">{value}</p></div><div className="rounded-lg bg-primary/30 text-primary-foreground p-2"><Icon className="w-5 h-5" /></div></div></div>; }
function Panel({ title, children }) { return <section className="rounded-lg border bg-card"><div className="px-4 py-3 border-b"><h2 className="font-semibold">{title}</h2></div><div className="p-4">{children}</div></section>; }
function Field({ label, children }) { return <label className="space-y-1"><div className="text-xs font-medium text-muted-foreground">{label}</div>{children}</label>; }
function Th({ children }) { return <th className="px-3 py-2 text-left font-medium whitespace-nowrap">{children}</th>; }
function Td({ children, strong }) { return <td className={`px-3 py-2 whitespace-nowrap ${strong ? "font-medium" : ""}`}>{children || "—"}</td>; }
function Empty() { return <div className="text-sm text-muted-foreground py-8 text-center">No rows match the current filters.</div>; }
function Table({ headers, rows }) { if (!rows.length) return <div className="text-sm text-muted-foreground py-8 text-center">No rows yet.</div>; return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{headers.map((h) => <Th key={h}>{h}</Th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <Td key={j}>{cell}</Td>)}</tr>)}</tbody></table></div>; }
