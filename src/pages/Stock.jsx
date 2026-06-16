import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Plus, RefreshCw, Truck, Car, Barcode } from "lucide-react";

const SUPPLIERS = ["Adrian", "La Maxima", "Other"];
const TRIP_PURPOSES = ["Direct customer delivery", "Inbound stock pickup", "Event transport", "Mixed inbound + deliveries", "Mixed event + deliveries", "Operating/admin", "Personal / Ignore"];

function money(value) { return `€${Number(value || 0).toFixed(2)}`; }
function monthFromDate(date) { return String(date || "").slice(0, 7); }
function numberValue(value) { return Number(String(value || 0).replace(",", ".")) || 0; }
function today() { return new Date().toISOString().slice(0, 10); }
function defaultBatchRef(supplier, date) { return `${supplier === "La Maxima" ? "LM" : supplier === "Adrian" ? "A" : "BATCH"}-${String(date || today()).slice(0, 10)}`; }
function allocationFromPurpose(purpose) {
  if (purpose === "Inbound stock pickup") return { stock_allocation_pct: 100, delivery_allocation_pct: 0, event_allocation_pct: 0 };
  if (purpose === "Direct customer delivery") return { stock_allocation_pct: 0, delivery_allocation_pct: 100, event_allocation_pct: 0 };
  if (purpose === "Event transport") return { stock_allocation_pct: 0, delivery_allocation_pct: 0, event_allocation_pct: 100 };
  if (purpose === "Personal / Ignore") return { stock_allocation_pct: 0, delivery_allocation_pct: 0, event_allocation_pct: 0 };
  return { stock_allocation_pct: 70, delivery_allocation_pct: 30, event_allocation_pct: 0 };
}
function buildTripFinancials(amountOut, amountIn, purpose, override = {}) {
  const netCost = Math.max(0, numberValue(amountOut) - numberValue(amountIn));
  const pct = { ...allocationFromPurpose(purpose), ...override };
  return {
    net_cost: netCost,
    stock_allocation_pct: numberValue(pct.stock_allocation_pct),
    delivery_allocation_pct: numberValue(pct.delivery_allocation_pct),
    event_allocation_pct: numberValue(pct.event_allocation_pct),
    stock_cost: netCost * numberValue(pct.stock_allocation_pct) / 100,
    delivery_cost: netCost * numberValue(pct.delivery_allocation_pct) / 100,
    event_cost: netCost * numberValue(pct.event_allocation_pct) / 100,
  };
}

export default function Stock() {
  const [tab, setTab] = useState("batches");
  const [skus, setSkus] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchLines, setBatchLines] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setBatchLines(lineRows);
    setTrips(tripRows.filter(r => r.is_active !== false));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    return {
      skuCount: skus.length,
      stockKg: batchLines.reduce((s, r) => s + numberValue(r.kg_remaining || r.kg_received), 0),
      stockValue: batchLines.reduce((s, r) => s + numberValue(r.kg_remaining || r.kg_received) * numberValue(r.landed_cost_per_kg), 0),
      landedCash: batches.reduce((s, r) => s + numberValue(r.total_landed_cost), 0),
      vehicleNet: trips.reduce((s, r) => s + numberValue(r.net_cost), 0),
    };
  }, [skus, batchLines, batches, trips]);

  const createSku = async () => {
    const sku = window.prompt("Internal SKU, e.g. A-VACIO-1KG or LM-CHORIZO-108KG-3PACKS");
    if (!sku) return;
    const public_name = window.prompt("Public product name", "Vacío parrillero - 1kg") || sku;
    const supplier = window.prompt("Supplier: Adrian, La Maxima, Other", sku.toUpperCase().startsWith("LM-") ? "La Maxima" : "Adrian") || "Other";
    const product_family = window.prompt("Product family / cut", public_name.split("-")[0].trim()) || "Meat";
    const kg_per_unit = numberValue(window.prompt("Kg per unit", "1"));
    const default_sale_price_inc_vat = numberValue(window.prompt("Default sale price inc VAT", "0"));
    const payload = { sku, public_name, supplier: SUPPLIERS.includes(supplier) ? supplier : "Other", product_family, cut: product_family, kg_per_unit, units_per_pack: 1, default_sale_price_inc_vat, status: "Active" };
    const created = await base44.entities.ProductSku.create(payload);
    setSkus(prev => [...prev, created].sort((a, b) => String(a.sku).localeCompare(String(b.sku))));
  };

  const createBatch = async () => {
    const supplier = window.prompt("Supplier: Adrian, La Maxima, Other", "Adrian") || "Other";
    const arrival_date = window.prompt("Stock arrival date (YYYY-MM-DD)", today()) || today();
    const batch_ref = window.prompt("Batch reference", defaultBatchRef(supplier, arrival_date)) || defaultBatchRef(supplier, arrival_date);
    const supplier_invoice_no = window.prompt("Supplier invoice/proforma number", "") || "";
    const total_kg_received = numberValue(window.prompt("Total kg received", "0"));
    const supplier_fca_total = numberValue(window.prompt("Supplier FCA total €", "0"));
    const transport_to_girona = numberValue(window.prompt("Transport to Girona €", "0"));
    const transport_to_nl = numberValue(window.prompt("Transport to NL €", "0"));
    const vehicle_cost = numberValue(window.prompt("Vehicle pickup cost allocated €", "0"));
    const handling_cost = numberValue(window.prompt("Handling cost allocated €", "0"));
    const other_landed_cost = numberValue(window.prompt("Other landed cost €", "0"));
    const total_landed_cost = supplier_fca_total + transport_to_girona + transport_to_nl + vehicle_cost + handling_cost + other_landed_cost;
    const landed_cost_per_kg = total_kg_received > 0 ? total_landed_cost / total_kg_received : 0;
    const payload = { batch_ref, supplier: SUPPLIERS.includes(supplier) ? supplier : "Other", origin: supplier === "La Maxima" ? "Malaga" : supplier === "Adrian" ? "Valencia" : "", supplier_invoice_no, invoice_date: arrival_date, arrival_date, accounting_month: monthFromDate(arrival_date), total_kg_received, supplier_fca_total, transport_to_girona, transport_to_nl, vehicle_cost, handling_cost, other_landed_cost, total_landed_cost, landed_cost_per_kg, status: "Draft", is_active: true };
    const created = await base44.entities.StockBatch.create(payload);
    setBatches(prev => [created, ...prev]);
  };

  const createBatchLine = async () => {
    if (!batches.length) return alert("Create a stock batch first.");
    const batchRef = window.prompt("Batch reference", batches[0]?.batch_ref || "");
    if (!batchRef) return;
    const batch = batches.find(b => b.batch_ref === batchRef);
    const sku = window.prompt("Internal SKU", skus[0]?.sku || "") || "";
    const skuRow = skus.find(s => s.sku === sku);
    const public_name = window.prompt("Product name", skuRow?.public_name || "") || sku;
    const kg_received = numberValue(window.prompt("Kg received", "0"));
    const fca_cost_per_kg = numberValue(window.prompt("FCA cost/kg", String(skuRow?.current_fca_cost_per_kg || 0)));
    const fca_total = kg_received * fca_cost_per_kg;
    const batchKg = numberValue(batch?.total_kg_received || kg_received || 0);
    const allocationShare = batchKg > 0 ? kg_received / batchKg : 0;
    const allocated_transport = allocationShare * (numberValue(batch?.transport_to_girona) + numberValue(batch?.transport_to_nl));
    const allocated_handling = allocationShare * numberValue(batch?.handling_cost);
    const allocated_vehicle = allocationShare * numberValue(batch?.vehicle_cost);
    const allocated_other = allocationShare * numberValue(batch?.other_landed_cost);
    const landed_total = fca_total + allocated_transport + allocated_handling + allocated_vehicle + allocated_other;
    const landed_cost_per_kg = kg_received > 0 ? landed_total / kg_received : 0;
    const payload = { batch_id: batch?.id || "", batch_ref: batchRef, sku, public_name, supplier: skuRow?.supplier || batch?.supplier || "Other", cut: skuRow?.cut || skuRow?.product_family || public_name, kg_received, units_received: 0, pack_size_label: skuRow?.pack_size_label || "", fca_cost_per_kg, fca_total, allocated_transport, allocated_handling, allocated_vehicle, allocated_other, landed_total, landed_cost_per_kg, kg_remaining: kg_received, status: "Draft" };
    const created = await base44.entities.StockBatchLine.create(payload);
    setBatchLines(prev => [...prev, created]);
  };

  const createVehicleTrip = async () => {
    const provider = window.prompt("Provider: Diks, Free2Move, Other", "Diks") || "Other";
    const trip_date = window.prompt("Trip date (YYYY-MM-DD)", today()) || today();
    const trip_ref = window.prompt("Trip reference", `${provider}-${trip_date}`) || `${provider}-${trip_date}`;
    const purpose = window.prompt("Purpose", "Mixed inbound + deliveries") || "Mixed inbound + deliveries";
    const amount_out_total = numberValue(window.prompt("Total money out / blocked", "0"));
    const amount_in_total = numberValue(window.prompt("Total money back / refund", "0"));
    const pctDefaults = allocationFromPurpose(purpose);
    const stock_allocation_pct = numberValue(window.prompt("% to stock/inbound", String(pctDefaults.stock_allocation_pct)));
    const delivery_allocation_pct = numberValue(window.prompt("% to deliveries", String(pctDefaults.delivery_allocation_pct)));
    const event_allocation_pct = numberValue(window.prompt("% to event", String(pctDefaults.event_allocation_pct)));
    const start_km = numberValue(window.prompt("Start km", "0"));
    const end_km = numberValue(window.prompt("End km", "0"));
    const total_km = end_km > start_km ? end_km - start_km : 0;
    const financials = buildTripFinancials(amount_out_total, amount_in_total, purpose, { stock_allocation_pct, delivery_allocation_pct, event_allocation_pct });
    const payload = { trip_ref, provider: ["Diks", "Free2Move", "Other"].includes(provider) ? provider : "Other", trip_date, accounting_month: monthFromDate(trip_date), purpose: TRIP_PURPOSES.includes(purpose) ? purpose : "To review", amount_out_total, amount_in_total, start_km, end_km, total_km, ...financials, status: "Draft", is_active: true };
    const created = await base44.entities.VehicleTrip.create(payload);
    setTrips(prev => [created, ...prev]);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock & Costing</h1>
          <p className="text-muted-foreground text-sm mt-1">Product SKUs, stock batches, landed cost and vehicle trip allocation.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard label="Product SKUs" value={summary.skuCount} icon={Barcode} />
        <SummaryCard label="Stock kg" value={`${summary.stockKg.toFixed(1)} kg`} icon={Package} />
        <SummaryCard label="Inventory value" value={money(summary.stockValue)} icon={Package} />
        <SummaryCard label="Batch landed cash" value={money(summary.landedCash)} icon={Truck} />
        <SummaryCard label="Vehicle net cost" value={money(summary.vehicleNet)} icon={Car} />
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        <Tab active={tab === "batches"} onClick={() => setTab("batches")}>Stock Batches</Tab>
        <Tab active={tab === "lines"} onClick={() => setTab("lines")}>Batch Lines</Tab>
        <Tab active={tab === "skus"} onClick={() => setTab("skus")}>Product SKU Master</Tab>
        <Tab active={tab === "trips"} onClick={() => setTab("trips")}>Vehicle Trips</Tab>
      </div>

      {tab === "batches" && <Panel title="Stock Batches" action={<Button size="sm" onClick={createBatch}><Plus className="w-4 h-4 mr-1" /> Add batch</Button>}><Table headers={["Batch", "Supplier", "Arrival", "Kg", "FCA", "Transport", "Vehicle", "Total landed", "€/kg", "Status"]} rows={batches.map(b => [b.batch_ref, b.supplier, b.arrival_date, numberValue(b.total_kg_received).toFixed(1), money(b.supplier_fca_total), money(numberValue(b.transport_to_girona) + numberValue(b.transport_to_nl)), money(b.vehicle_cost), money(b.total_landed_cost), money(b.landed_cost_per_kg), b.status])} /></Panel>}
      {tab === "lines" && <Panel title="Batch Lines" action={<Button size="sm" onClick={createBatchLine}><Plus className="w-4 h-4 mr-1" /> Add line</Button>}><Table headers={["Batch", "SKU", "Product", "Supplier", "Kg", "FCA €/kg", "Allocated cost", "Landed total", "Landed €/kg", "Remaining"]} rows={batchLines.map(l => [l.batch_ref, l.sku, l.public_name, l.supplier, numberValue(l.kg_received).toFixed(1), money(l.fca_cost_per_kg), money(numberValue(l.allocated_transport) + numberValue(l.allocated_handling) + numberValue(l.allocated_vehicle) + numberValue(l.allocated_other)), money(l.landed_total), money(l.landed_cost_per_kg), `${numberValue(l.kg_remaining).toFixed(1)} kg`])} /></Panel>}
      {tab === "skus" && <Panel title="Product SKU Master" action={<Button size="sm" onClick={createSku}><Plus className="w-4 h-4 mr-1" /> Add SKU</Button>}><Table headers={["SKU", "Public name", "Supplier", "Family", "Kg/unit", "Sale price", "FCA €/kg", "Landed €/kg", "Status"]} rows={skus.map(s => [s.sku, s.public_name, s.supplier, s.product_family || s.cut, numberValue(s.kg_per_unit).toFixed(2), money(s.default_sale_price_inc_vat), money(s.current_fca_cost_per_kg), money(s.current_landed_cost_per_kg), s.status])} /></Panel>}
      {tab === "trips" && <Panel title="Vehicle Trips" action={<Button size="sm" onClick={createVehicleTrip}><Plus className="w-4 h-4 mr-1" /> Add trip</Button>}><Table headers={["Trip", "Provider", "Date", "Purpose", "Out", "Refund", "Net", "Stock", "Delivery", "Event", "Km"]} rows={trips.map(t => [t.trip_ref, t.provider, t.trip_date, t.purpose, money(t.amount_out_total), money(t.amount_in_total), money(t.net_cost), money(t.stock_cost), money(t.delivery_cost), money(t.event_cost), numberValue(t.total_km).toFixed(0)])} /></Panel>}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return <button onClick={onClick} className={`px-3 py-2 rounded-lg text-sm font-medium ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{children}</button>;
}
function SummaryCard({ label, value, icon: Icon }) {
  return <div className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-bold mt-1">{value}</p></div><div className="rounded-lg bg-primary/30 text-primary-foreground p-2"><Icon className="w-5 h-5" /></div></div></div>;
}
function Panel({ title, action, children }) {
  return <section className="rounded-lg border bg-card"><div className="flex items-center justify-between gap-3 px-4 py-3 border-b"><h2 className="font-semibold">{title}</h2>{action}</div><div className="p-4">{children}</div></section>;
}
function Table({ headers, rows }) {
  if (!rows.length) return <div className="text-sm text-muted-foreground py-8 text-center">No rows yet.</div>;
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="px-3 py-2 whitespace-nowrap">{cell || "—"}</td>)}</tr>)}</tbody></table></div>;
}
