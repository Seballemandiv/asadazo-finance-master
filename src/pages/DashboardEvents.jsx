import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Package, TrendingDown, TrendingUp, ShoppingBag, Plus } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import { computeEventMetrics } from "@/lib/financeCalc";

function rowNet(r) {
  if (r.net_amount_ex_vat != null) return Number(r.net_amount_ex_vat) || 0;
  if (r.net_ex_vat != null) return Number(r.net_ex_vat) || 0;
  return Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0) - Number(r.vat_amount || r.vat || 0);
}
function dateLabel(date) {
  if (!date) return "No date";
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function sortEvents(a, b) { return String(a.event_date || "9999-99-99").localeCompare(String(b.event_date || "9999-99-99")); }
function isEventSale(r) { return r.mapping_status !== "Ignore" && (r.revenue_type === "Event" || r.channel === "Event"); }
function isEventCost(r) { return r.review_status === "OK" && (r.cost_type === "Event Cost" || r.channel === "Event"); }
function belongsToEvent(row, eventId) {
  if (!eventId || eventId === "all") return true;
  if (eventId === "unassigned") return !row.event_id && !row.event_name;
  return row.event_id === eventId;
}

export default function DashboardEvents() {
  const [events, setEvents] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [sumupTransactions, setSumupTransactions] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [allBatches, sales, bank, transactions, eventRows] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.SalesRecord.list("-date", 5000),
      base44.entities.BankTransaction.list("-date", 5000),
      base44.entities.SumUpTransactionRecord.list(undefined, 5000),
      base44.entities.AsadazoEvent ? base44.entities.AsadazoEvent.list("event_date", 500) : [],
    ]);
    const salesBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id));
    const bankBatchIds = new Set(allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
    const transactionBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_transactions").map(b => b.id));
    setSalesRecords(sales.filter(r => r.is_active !== false && r.import_batch_id && salesBatchIds.has(r.import_batch_id)));
    setBankTransactions(bank.filter(r => r.is_active !== false && r.import_batch_id && bankBatchIds.has(r.import_batch_id)));
    setSumupTransactions(transactions.filter(r => r.is_active !== false && r.import_batch_id && transactionBatchIds.has(r.import_batch_id)));
    const activeEvents = eventRows.filter(e => e.is_active !== false).sort(sortEvents);
    setEvents(activeEvents);
    if (selectedEventId === "all" && activeEvents.length === 1) setSelectedEventId(activeEvents[0].id);
    setLoading(false);
  };
  useEffect(() => { loadData(); }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const eventSalesAll = useMemo(() => salesRecords.filter(isEventSale), [salesRecords]);
  const eventCostsAll = useMemo(() => bankTransactions.filter(isEventCost), [bankTransactions]);
  const eventSales = useMemo(() => eventSalesAll.filter(r => belongsToEvent(r, selectedEventId)), [eventSalesAll, selectedEventId]);
  const eventCosts = useMemo(() => eventCostsAll.filter(r => belongsToEvent(r, selectedEventId)), [eventCostsAll, selectedEventId]);
  const metrics = useMemo(() => computeEventMetrics(eventSales, eventCosts, sumupTransactions), [eventSales, eventCosts, sumupTransactions]);
  const unassignedCount = eventSalesAll.filter(r => !r.event_id && !r.event_name).length + eventCostsAll.filter(r => !r.event_id && !r.event_name).length;

  const assignSalesEvent = async (row, eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updates = { event_id: event.id, event_name: event.name, channel: "Event", revenue_type: "Event", mapping_status: "OK" };
    await base44.entities.SalesRecord.update(row.id, updates);
    setSalesRecords(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
  };
  const assignBankEvent = async (row, eventId) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const updates = { event_id: event.id, event_name: event.name, channel: "Event", cost_type: "Event Cost", review_status: "OK" };
    await base44.entities.BankTransaction.update(row.id, updates);
    setBankTransactions(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
  };

  const handleAddEvent = async () => {
    const name = window.prompt("Event name", "Latin Food Experience");
    if (!name) return;
    const event_date = window.prompt("Event date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10)) || "";
    const end_date = window.prompt("End date (optional, YYYY-MM-DD)", "") || "";
    const location = window.prompt("Location", "Amsterdam") || "";
    const created = await base44.entities.AsadazoEvent.create({ name, event_date, end_date, location, status: "Planned", is_active: true });
    setEvents(prev => [...prev, created].sort(sortEvents));
    setSelectedEventId(created.id);
  };
  const handleSeedEvents = async () => {
    const defaults = [["Argentina vs Austria", "2026-06-22", "Atelier Code Noir, Amsterdam"], ["Latin Food Experience", "2026-06-26", "Amsterdam"], ["BounceSpace", "2026-07-03", "Amsterdam"], ["Festival Macumba", "2026-07-18", "Amsterdam"], ["El Asadazo - 2nd Edition", "2026-08-29", "Amsterdam"]];
    const existing = new Set(events.map(e => e.name.toLowerCase()));
    const created = [];
    for (const [name, event_date, location] of defaults) if (!existing.has(name.toLowerCase())) created.push(await base44.entities.AsadazoEvent.create({ name, event_date, location, status: "Planned", is_active: true }));
    setEvents(prev => [...prev, ...created].sort(sortEvents));
    if (created[0]) setSelectedEventId(created[0].id);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-foreground">Dashboard Events</h1><p className="text-muted-foreground text-sm mt-1">Asadazo · Event P&L and calendar</p></div>
        <div className="flex flex-wrap gap-2"><Select value={selectedEventId} onValueChange={setSelectedEventId}><SelectTrigger className="w-72"><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent><SelectItem value="all">All events</SelectItem><SelectItem value="unassigned">Unassigned event rows</SelectItem>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={handleAddEvent}><Plus className="w-4 h-4 mr-2" /> Add Event</Button>{events.length === 0 && <Button variant="outline" onClick={handleSeedEvents}>Seed 2026 Events</Button>}</div>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Event rows are linked to an event, not only to a month. You can assign unassigned sales/costs directly in the tables below. Unassigned event rows: <strong>{unassignedCount}</strong>.</div>
      {selectedEvent && <div className="rounded-lg border bg-card px-4 py-3 text-sm"><strong>{selectedEvent.name}</strong> · {dateLabel(selectedEvent.event_date)}{selectedEvent.end_date ? ` → ${dateLabel(selectedEvent.end_date)}` : ""}{selectedEvent.location ? ` · ${selectedEvent.location}` : ""} · {selectedEvent.status || "Planned"}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard title="Event Revenue" value={`€${metrics.revenue.toFixed(2)}`} icon={TrendingUp} color="green" /><MetricCard title="Event Total Costs" value={`€${metrics.totalCosts.toFixed(2)}`} icon={TrendingDown} color="red" /><MetricCard title="Event Profit" value={`€${metrics.eventProfit.toFixed(2)}`} icon={Calendar} color={metrics.eventProfit >= 0 ? "green" : "red"} subtitle={`Margin: ${metrics.marginPct.toFixed(1)}%`} /><MetricCard title="Gross Profit after Event COGS" value={`€${metrics.grossProfit.toFixed(2)}`} icon={Package} color={metrics.grossProfit >= 0 ? "green" : "red"} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard title="Event Meat COGS" value={`€${metrics.cogs.toFixed(2)}`} icon={Package} color="orange" small /><MetricCard title="Event Bank Costs" value={`€${metrics.costs.toFixed(2)}`} icon={TrendingDown} color="slate" small /><MetricCard title="Payment Fees" value={`€${metrics.paymentFees.toFixed(2)}`} icon={TrendingDown} color="slate" small /><MetricCard title="Event Sales Rows" value={`${metrics.eventRows}`} icon={ShoppingBag} color="slate" small /></div>

      <div className="border rounded-lg bg-card p-4"><h2 className="font-semibold mb-3">Future Events Calendar</h2><div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">{events.map(e => <button key={e.id} onClick={() => setSelectedEventId(e.id)} className={`text-left rounded-lg border p-3 hover:bg-muted/40 ${selectedEventId === e.id ? "border-[#611111] bg-[#FFF7EA]" : ""}`}><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground mt-1">{dateLabel(e.event_date)}{e.location ? ` · ${e.location}` : ""}</div><div className="text-xs mt-1">{e.status || "Planned"}</div></button>)}{!events.length && <p className="text-sm text-muted-foreground">No events created yet. Add an event or seed the known 2026 events.</p>}</div></div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg bg-card p-4"><h2 className="font-semibold mb-3">Event Sales Lines</h2><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Event</th><th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-right">Net ex VAT</th><th className="px-2 py-2 text-right">COGS</th></tr></thead><tbody>{eventSales.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.transaction_date || r.date || "").slice(0, 10)}</td><td className="px-2 py-2 min-w-[170px]"><Select value={r.event_id || ""} onValueChange={v => assignSalesEvent(r, v)}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign event" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></td><td className="px-2 py-2 max-w-[220px] truncate">{r.product_name || r.product}</td><td className="px-2 py-2 text-right">€{rowNet(r).toFixed(2)}</td><td className="px-2 py-2 text-right">€{Number(r.meat_cogs || 0).toFixed(2)}</td></tr>)}</tbody></table>{!eventSales.length && <p className="text-sm text-muted-foreground text-center py-8">No event sales rows.</p>}</div></div>
        <div className="border rounded-lg bg-card p-4"><h2 className="font-semibold mb-3">Event Bank Costs</h2><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Event</th><th className="px-2 py-2 text-left">Reference</th><th className="px-2 py-2 text-right">Amount</th></tr></thead><tbody>{eventCosts.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.date || "").slice(0, 10)}</td><td className="px-2 py-2 min-w-[170px]"><Select value={r.event_id || ""} onValueChange={v => assignBankEvent(r, v)}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign event" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></td><td className="px-2 py-2 max-w-[260px] truncate">{r.reference || r.payment_ref}</td><td className="px-2 py-2 text-right">€{Number(r.event_cost || r.amount_out || 0).toFixed(2)}</td></tr>)}</tbody></table>{!eventCosts.length && <p className="text-sm text-muted-foreground text-center py-8">No event bank costs.</p>}</div></div>
      </div>
    </div>
  );
}
