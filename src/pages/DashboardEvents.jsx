import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Package, TrendingDown, TrendingUp, ShoppingBag, Plus, Trash2, Pencil } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import EventPlanner from "@/components/events/EventPlanner";
import { computeEventMetrics } from "@/lib/financeCalc";

const EVENT_STATUSES = ["Planned", "Confirmed", "Completed", "Cancelled"];
const TASK_CATEGORIES = ["To buy", "To bring", "To prepare", "Staff", "Logistics", "Admin", "Other"];

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

function sortEvents(a, b) {
  return String(a.event_date || "9999-99-99").localeCompare(String(b.event_date || "9999-99-99"));
}

function isEventSale(r) {
  return r.mapping_status !== "Ignore" && (r.revenue_type === "Event" || r.channel === "Event");
}

function isEventCost(r) {
  return r.review_status === "OK" && (r.cost_type === "Event Cost" || r.channel === "Event");
}

function belongsToEvent(row, eventId) {
  if (!eventId || eventId === "all") return true;
  if (eventId === "unassigned") return !row.event_id && !row.event_name;
  return row.event_id === eventId;
}

async function quietUpdate(entity, id, updates) {
  try { await entity.update(id, updates); }
  catch (e) { console.warn("Could not update linked event label", e); }
}

export default function DashboardEvents() {
  const [events, setEvents] = useState([]);
  const [eventTasks, setEventTasks] = useState([]);
  const [salesRecords, setSalesRecords] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [sumupTransactions, setSumupTransactions] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [allBatches, sales, bank, transactions, eventRows, tasks] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.SalesRecord.list("-date", 5000),
      base44.entities.BankTransaction.list("-date", 5000),
      base44.entities.SumUpTransactionRecord.list(undefined, 5000),
      base44.entities.AsadazoEvent ? base44.entities.AsadazoEvent.list("event_date", 500) : [],
      base44.entities.EventTask ? base44.entities.EventTask.list("due_date", 1000) : [],
    ]);

    const salesBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id));
    const bankBatchIds = new Set(allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
    const transactionBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_transactions").map(b => b.id));

    setSalesRecords(sales.filter(r => r.is_active !== false && r.import_batch_id && salesBatchIds.has(r.import_batch_id)));
    setBankTransactions(bank.filter(r => r.is_active !== false && r.import_batch_id && bankBatchIds.has(r.import_batch_id)));
    setSumupTransactions(transactions.filter(r => r.is_active !== false && r.import_batch_id && transactionBatchIds.has(r.import_batch_id)));

    const activeEvents = eventRows.filter(e => e.is_active !== false).sort(sortEvents);
    setEvents(activeEvents);
    setEventTasks(tasks.filter(t => t.is_active !== false));
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
  const selectedTasks = useMemo(() => eventTasks.filter(t => t.event_id === selectedEventId), [eventTasks, selectedEventId]);
  const openTasks = selectedTasks.filter(t => t.status !== "Done" && t.status !== "Cancelled").length;

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

  const updateEventStatus = async (event, status) => {
    await base44.entities.AsadazoEvent.update(event.id, { status });
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, status } : e));
  };

  const editEventDetails = async (event) => {
    const name = window.prompt("Event name", event.name || "");
    if (name === null) return;
    const event_date = window.prompt("Event date (YYYY-MM-DD)", event.event_date || "");
    if (event_date === null) return;
    const end_date = window.prompt("End date (optional, YYYY-MM-DD)", event.end_date || "");
    if (end_date === null) return;
    const location = window.prompt("Location", event.location || "");
    if (location === null) return;
    const statusInput = window.prompt("Status: Planned, Confirmed, Completed, Cancelled", event.status || "Planned");
    if (statusInput === null) return;
    const expectedRaw = window.prompt("Expected guests / visitors", String(event.expected_guests || 0));
    if (expectedRaw === null) return;
    const targetRaw = window.prompt("Revenue target (€)", String(event.revenue_target || 0));
    if (targetRaw === null) return;
    const notes = window.prompt("Notes", event.notes || "");
    if (notes === null) return;

    const newName = name.trim() || event.name;
    const status = EVENT_STATUSES.includes(statusInput) ? statusInput : (event.status || "Planned");
    const updates = {
      name: newName,
      event_date: event_date.trim(),
      end_date: end_date.trim(),
      location: location.trim(),
      status,
      expected_guests: Number(String(expectedRaw).replace(",", ".")) || 0,
      revenue_target: Number(String(targetRaw).replace(",", ".")) || 0,
      notes: notes.trim(),
    };

    await base44.entities.AsadazoEvent.update(event.id, updates);
    setEvents(prev => prev.map(e => e.id === event.id ? { ...e, ...updates } : e).sort(sortEvents));

    if (newName !== event.name) {
      setSalesRecords(prev => prev.map(r => r.event_id === event.id ? { ...r, event_name: newName } : r));
      setBankTransactions(prev => prev.map(r => r.event_id === event.id ? { ...r, event_name: newName } : r));
      setEventTasks(prev => prev.map(t => t.event_id === event.id ? { ...t, event_name: newName } : t));
      salesRecords.filter(r => r.event_id === event.id).slice(0, 25).forEach(r => quietUpdate(base44.entities.SalesRecord, r.id, { event_name: newName }));
      bankTransactions.filter(r => r.event_id === event.id).slice(0, 25).forEach(r => quietUpdate(base44.entities.BankTransaction, r.id, { event_name: newName }));
      eventTasks.filter(t => t.event_id === event.id).slice(0, 25).forEach(t => quietUpdate(base44.entities.EventTask, t.id, { event_name: newName }));
    }
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
    for (const [name, event_date, location] of defaults) {
      if (!existing.has(name.toLowerCase())) created.push(await base44.entities.AsadazoEvent.create({ name, event_date, location, status: "Planned", is_active: true }));
    }
    setEvents(prev => [...prev, ...created].sort(sortEvents));
    if (created[0]) setSelectedEventId(created[0].id);
  };

  const handleAddTask = async () => {
    if (!selectedEvent) return alert("Select one event first.");
    const title = window.prompt("Task / item", "Buy charcoal");
    if (!title) return;
    const category = window.prompt("Category: To buy, To bring, To prepare, Staff, Logistics, Admin, Other", "To buy") || "Other";
    const responsible_person = window.prompt("Responsible person (optional)", "") || "";
    const due_date = window.prompt("Due date (optional, YYYY-MM-DD)", selectedEvent.event_date || "") || "";
    const created = await base44.entities.EventTask.create({ event_id: selectedEvent.id, event_name: selectedEvent.name, title, category: TASK_CATEGORIES.includes(category) ? category : "Other", responsible_person, due_date, status: "Open", is_active: true });
    setEventTasks(prev => [...prev, created]);
  };

  const toggleTask = async (task) => {
    const status = task.status === "Done" ? "Open" : "Done";
    await base44.entities.EventTask.update(task.id, { status });
    setEventTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
  };

  const deleteTask = async (task) => {
    await base44.entities.EventTask.update(task.id, { is_active: false, status: "Cancelled" });
    setEventTasks(prev => prev.filter(t => t.id !== task.id));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-foreground">Event Calendar</h1><p className="text-muted-foreground text-sm mt-1">Asadazo · Events, tasks, forecast and event P&L</p></div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}><SelectTrigger className="w-72"><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent><SelectItem value="all">All events</SelectItem><SelectItem value="unassigned">Unassigned event rows</SelectItem>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" onClick={handleAddEvent}><Plus className="w-4 h-4 mr-2" /> Add Event</Button>
          {events.length === 0 && <Button variant="outline" onClick={handleSeedEvents}>Seed 2026 Events</Button>}
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Event rows are linked to an event, not only to a month. Assign unassigned sales/costs in the tables below. Unassigned event rows: <strong>{unassignedCount}</strong>.</div>

      <div className="border rounded-lg bg-card p-4">
        <h2 className="font-semibold mb-3">Event Calendar</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {events.map(e => (
            <div key={e.id} onClick={() => setSelectedEventId(e.id)} className={`text-left rounded-lg border p-3 hover:bg-muted/40 cursor-pointer ${selectedEventId === e.id ? "border-[#611111] bg-[#FFF7EA]" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-medium">{e.name}</div><div className="text-xs text-muted-foreground mt-1">{dateLabel(e.event_date)}{e.location ? ` · ${e.location}` : ""}</div>{e.expected_guests ? <div className="text-xs text-muted-foreground mt-1">Expected: {e.expected_guests}</div> : null}</div>
                <div className="flex gap-1"><Button size="sm" variant="outline" onClick={(ev) => { ev.stopPropagation(); editEventDetails(e); }}><Pencil className="w-3 h-3 mr-1" /> Edit</Button><Button size="sm" variant="outline" onClick={(ev) => { ev.stopPropagation(); setSelectedEventId(e.id); }}>Open</Button></div>
              </div>
              <div className="mt-3" onClick={ev => ev.stopPropagation()}><Select value={e.status || "Planned"} onValueChange={status => updateEventStatus(e, status)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            </div>
          ))}
          {!events.length && <p className="text-sm text-muted-foreground">No events created yet. Add an event or seed the known 2026 events.</p>}
        </div>
      </div>

      {selectedEvent && <div className="grid grid-cols-1 lg:grid-cols-3 gap-4"><div className="lg:col-span-1 border rounded-lg bg-card p-4"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{selectedEvent.name}</h2><Button size="sm" variant="outline" onClick={() => editEventDetails(selectedEvent)}><Pencil className="w-3 h-3 mr-1" /> Edit</Button></div><p className="text-sm text-muted-foreground mt-1">{dateLabel(selectedEvent.event_date)}{selectedEvent.end_date ? ` → ${dateLabel(selectedEvent.end_date)}` : ""}{selectedEvent.location ? ` · ${selectedEvent.location}` : ""}</p>{selectedEvent.expected_guests ? <p className="text-xs text-muted-foreground mt-2">Expected guests/visitors: <strong>{selectedEvent.expected_guests}</strong></p> : null}{selectedEvent.revenue_target ? <p className="text-xs text-muted-foreground mt-1">Revenue target: <strong>€{Number(selectedEvent.revenue_target || 0).toFixed(2)}</strong></p> : null}{selectedEvent.notes ? <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{selectedEvent.notes}</p> : null}<div className="mt-3"><Select value={selectedEvent.status || "Planned"} onValueChange={status => updateEventStatus(selectedEvent, status)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EVENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><p className="text-xs text-muted-foreground mt-3">Open checklist items: <strong>{openTasks}</strong></p></div><div className="lg:col-span-2 border rounded-lg bg-card p-4"><div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-semibold">Event Checklist</h2><Button size="sm" variant="outline" onClick={handleAddTask}><Plus className="w-4 h-4 mr-2" /> Add Item</Button></div><div className="space-y-2 max-h-72 overflow-auto">{selectedTasks.map(task => <div key={task.id} className="flex items-start gap-3 rounded-lg border p-3"><Checkbox checked={task.status === "Done"} onCheckedChange={() => toggleTask(task)} className="mt-1" /><div className="flex-1 min-w-0"><div className={`font-medium text-sm ${task.status === "Done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</div><div className="text-xs text-muted-foreground mt-0.5">{task.category || "Other"}{task.responsible_person ? ` · RP: ${task.responsible_person}` : ""}{task.due_date ? ` · Due: ${dateLabel(task.due_date)}` : ""}</div></div><Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task)}><Trash2 className="w-3 h-3" /></Button></div>)}{!selectedTasks.length && <p className="text-sm text-muted-foreground text-center py-8">No checklist items yet. Add things to buy, bring, prepare, staff tasks, logistics, or admin tasks.</p>}</div></div></div>}

      {selectedEvent && <EventPlanner event={selectedEvent} actualMetrics={metrics} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard title="Actual Event Revenue" value={`€${metrics.revenue.toFixed(2)}`} icon={TrendingUp} color="green" /><MetricCard title="Actual Event Total Costs" value={`€${metrics.totalCosts.toFixed(2)}`} icon={TrendingDown} color="red" /><MetricCard title="Actual Event Profit" value={`€${metrics.eventProfit.toFixed(2)}`} icon={Calendar} color={metrics.eventProfit >= 0 ? "green" : "red"} subtitle={`Margin: ${metrics.marginPct.toFixed(1)}%`} /><MetricCard title="Actual Gross Profit after COGS" value={`€${metrics.grossProfit.toFixed(2)}`} icon={Package} color={metrics.grossProfit >= 0 ? "green" : "red"} /></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard title="Actual Event Meat COGS" value={`€${metrics.cogs.toFixed(2)}`} icon={Package} color="orange" small /><MetricCard title="Actual Event Bank Costs" value={`€${metrics.costs.toFixed(2)}`} icon={TrendingDown} color="slate" small /><MetricCard title="Payment Fees" value={`€${metrics.paymentFees.toFixed(2)}`} icon={TrendingDown} color="slate" small /><MetricCard title="Event Sales Rows" value={`${metrics.eventRows}`} icon={ShoppingBag} color="slate" small /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><div className="border rounded-lg bg-card p-4"><h2 className="font-semibold mb-3">Event Sales Lines</h2><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Event</th><th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-right">Net ex VAT</th><th className="px-2 py-2 text-right">COGS</th></tr></thead><tbody>{eventSales.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.transaction_date || r.date || "").slice(0, 10)}</td><td className="px-2 py-2 min-w-[170px]"><Select value={r.event_id || ""} onValueChange={v => assignSalesEvent(r, v)}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign event" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></td><td className="px-2 py-2 max-w-[220px] truncate">{r.product_name || r.product}</td><td className="px-2 py-2 text-right">€{rowNet(r).toFixed(2)}</td><td className="px-2 py-2 text-right">€{Number(r.meat_cogs || 0).toFixed(2)}</td></tr>)}</tbody></table>{!eventSales.length && <p className="text-sm text-muted-foreground text-center py-8">No event sales rows.</p>}</div></div><div className="border rounded-lg bg-card p-4"><h2 className="font-semibold mb-3">Event Bank Costs</h2><div className="overflow-x-auto max-h-80"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Event</th><th className="px-2 py-2 text-left">Reference</th><th className="px-2 py-2 text-right">Amount</th></tr></thead><tbody>{eventCosts.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.date || "").slice(0, 10)}</td><td className="px-2 py-2 min-w-[170px]"><Select value={r.event_id || ""} onValueChange={v => assignBankEvent(r, v)}><SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Assign event" /></SelectTrigger><SelectContent>{events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select></td><td className="px-2 py-2 max-w-[260px] truncate">{r.reference || r.payment_ref}</td><td className="px-2 py-2 text-right">€{Number(r.event_cost || r.amount_out || 0).toFixed(2)}</td></tr>)}</tbody></table>{!eventCosts.length && <p className="text-sm text-muted-foreground text-center py-8">No event bank costs.</p>}</div></div></div>
    </div>
  );
}
