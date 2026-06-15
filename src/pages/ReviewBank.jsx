import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Wand2, RotateCcw, Plus, Trash2 } from "lucide-react";
import BankRowEditor from "@/components/review/BankRowEditor";
import { applyBankRule, buildLearnedBankRules } from "@/lib/bankRulesEngine";

const BATCH_LIMIT = 100;
const EVENT_TYPES = ["Event Cost"];
const NO_CHANGE = "__no_change__";
const COST_TYPES = ["Car rental NL", "Event Cost", "Expense Refund", "Ignore", "Loan In / Payback", "Loan Out", "Manual Review", "Meat Purchase", "Operating Expense", "Owner Payment", "Payment Employees", "Payment Processor Payout", "Refund", "Shipping Cost", "Transfer / Reconciliation", "Transport Spain to Amsterdam"];
const MODULES = ["Online Shop", "Event", "Wholesale", "Other"];
const CHANNELS = ["Admin", "Car rental NL", "Chef Table Experience", "Marketing", "Other", "Payment Employees", "Private Dining", "Product", "Shipping", "Stock / Supplier", "Tools & Equipment", "Transport Spain to Amsterdam"];
const STATUSES = ["OK", "To review", "Ignore"];

function hasChanged(record, updates) { return Object.entries(updates).some(([k, v]) => String(record[k] ?? "") !== String(v ?? "")); }
function monthFromDate(date) { return String(date || "").slice(0, 7); }
function eventSort(a, b) { return String(a.event_date || "9999-99-99").localeCompare(String(b.event_date || "9999-99-99")); }
function rowModule(r) { if (r.module) return r.module; if (r.channel === "Event" || r.cost_type === "Event Cost" || r.event_id) return "Event"; if (r.channel === "Online Shop") return "Online Shop"; if (r.channel === "Wholesale") return "Wholesale"; return "Other"; }
function rowChannel(r) { if (r.channel && !["Online Shop", "Event", "Wholesale"].includes(r.channel)) return r.channel; if (r.cost_type === "Payment Employees") return "Payment Employees"; if (r.cost_type === "Shipping Cost") return "Shipping"; if (r.cost_type === "Meat Purchase") return "Stock / Supplier"; if (r.cost_type === "Car rental NL") return "Car rental NL"; if (r.cost_type === "Transport Spain to Amsterdam") return "Transport Spain to Amsterdam"; return "Other"; }
function financialFields(costType, amountIn, amountOut) {
  const expenseRefund = costType === "Expense Refund" ? amountIn : 0;
  const carRental = costType === "Car rental NL" ? amountOut - amountIn : 0;
  const spainTransport = costType === "Transport Spain to Amsterdam" ? amountOut - amountIn : 0;
  const employeePayment = costType === "Payment Employees" ? amountOut : 0;
  return {
    counted_expense: ["Operating Expense", "Shipping Cost", "Event Cost", "Payment Employees", "Car rental NL", "Transport Spain to Amsterdam"].includes(costType) ? amountOut : (costType === "Expense Refund" ? -expenseRefund : 0),
    shipping_cost: costType === "Shipping Cost" ? amountOut : 0,
    operating_expenses: costType === "Operating Expense" || costType === "Payment Employees" ? amountOut : (costType === "Expense Refund" ? -expenseRefund : 0),
    car_rental_nl: carRental,
    transport_spain_to_amsterdam: spainTransport,
    event_cost: costType === "Event Cost" ? amountOut : 0,
    employee_payment: employeePayment,
    meat_purchase: costType === "Meat Purchase" ? amountOut : 0,
    refund_amount: costType === "Refund" ? amountOut : 0,
    expense_refund_amount: expenseRefund || (["Car rental NL", "Transport Spain to Amsterdam"].includes(costType) ? amountIn : 0),
  };
}

export default function ReviewBank() {
  const [records, setRecords] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState("To review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulk, setBulk] = useState({ cost_type: NO_CHANGE, module: NO_CHANGE, channel: NO_CHANGE, event_id: NO_CHANGE, review_status: NO_CHANGE });

  const load = async () => {
    setLoading(true);
    const [activeBatches, recs, eventRows] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.BankTransaction.list("-date", 5000),
      base44.entities.AsadazoEvent ? base44.entities.AsadazoEvent.list("event_date", 500) : [],
    ]);
    const activeBatchIds = new Set(activeBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
    const activeRecs = recs.filter(r => r.is_active !== false && (!r.import_batch_id || activeBatchIds.has(r.import_batch_id)));
    setRecords(activeRecs);
    setEvents(eventRows.filter(e => e.is_active !== false).sort(eventSort));
    const months = Array.from(new Set(activeRecs.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse();
    if ((selectedMonth === "all" || !selectedMonth) && months.length > 0) setSelectedMonth(months[0]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const learnedRules = useMemo(() => buildLearnedBankRules(records), [records]);
  const sortedEvents = useMemo(() => [...events].sort(eventSort), [events]);
  const availableMonths = useMemo(() => Array.from(new Set(records.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse(), [records]);
  const filtered = useMemo(() => records.filter(r => {
    const recMonth = r.accounting_month || r.month;
    const monthOk = selectedMonth === "all" || recMonth === selectedMonth;
    const statusOk = statusFilter === "all" || r.review_status === statusFilter;
    const text = `${r.reference || ""} ${r.payment_ref || ""} ${r.counterparty || ""} ${r.cost_type || ""} ${rowModule(r)} ${rowChannel(r)} ${r.event_name || ""}`.toLowerCase();
    return monthOk && statusOk && (!search || text.includes(search.toLowerCase()));
  }), [records, selectedMonth, statusFilter, search]);

  const selectedRows = useMemo(() => records.filter(r => selectedIds.includes(r.id)), [records, selectedIds]);
  const visibleIds = filtered.map(r => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const toggleOne = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleVisible = () => setSelectedIds(prev => allVisibleSelected ? prev.filter(id => !visibleIds.includes(id)) : Array.from(new Set([...prev, ...visibleIds])));
  const setBulkField = (k, v) => setBulk(prev => ({ ...prev, [k]: v }));

  const handleUpdate = async (id, updates) => { await base44.entities.BankTransaction.update(id, updates); setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r)); setEditingId(null); };
  const handleRemoveFromFinance = async (id) => {
    if (!window.confirm("Remove this bank row from finance?")) return;
    const updates = { is_active: false, review_status: "Ignore", cost_type: "Ignore", counted_expense: 0, shipping_cost: 0, operating_expenses: 0, car_rental_nl: 0, transport_spain_to_amsterdam: 0, event_cost: 0, employee_payment: 0, meat_purchase: 0, refund_amount: 0, expense_refund_amount: 0 };
    await base44.entities.BankTransaction.update(id, updates);
    setRecords(prev => prev.filter(r => r.id !== id));
    setSelectedIds(prev => prev.filter(x => x !== id));
    setEditingId(null);
  };

  const removeSelectedFromFinance = async () => {
    if (!selectedRows.length) return;
    if (!window.confirm(`Remove ${selectedRows.length} selected bank row(s) from finance?`)) return;
    const updates = { is_active: false, review_status: "Ignore", cost_type: "Ignore", counted_expense: 0, shipping_cost: 0, operating_expenses: 0, car_rental_nl: 0, transport_spain_to_amsterdam: 0, event_cost: 0, employee_payment: 0, meat_purchase: 0, refund_amount: 0, expense_refund_amount: 0 };
    setApplying(true);
    for (const row of selectedRows) await base44.entities.BankTransaction.update(row.id, updates);
    setRecords(prev => prev.filter(r => !selectedIds.includes(r.id)));
    setSelectedIds([]);
    setApplyMessage({ type: "success", text: `Removed ${selectedRows.length} selected row(s) from finance.` });
    setApplying(false);
  };

  const applyBulk = async () => {
    if (!selectedRows.length) return;
    const event = sortedEvents.find(e => e.id === bulk.event_id);
    setApplying(true);
    const changedRows = [];
    for (const row of selectedRows) {
      const updates = {};
      if (bulk.cost_type !== NO_CHANGE) Object.assign(updates, { cost_type: bulk.cost_type }, financialFields(bulk.cost_type, Number(row.amount_in || 0), Number(row.amount_out || 0)));
      if (bulk.module !== NO_CHANGE) updates.module = bulk.module;
      if (bulk.channel !== NO_CHANGE) updates.channel = bulk.channel;
      if (bulk.review_status !== NO_CHANGE) updates.review_status = bulk.review_status;
      if (bulk.event_id !== NO_CHANGE) Object.assign(updates, { module: "Event", event_id: event?.id || "", event_name: event?.name || "", review_status: event ? (updates.review_status || "OK") : "To review" });
      if (Object.keys(updates).length === 0 || !hasChanged(row, updates)) continue;
      await base44.entities.BankTransaction.update(row.id, updates);
      changedRows.push({ id: row.id, updates });
    }
    setRecords(prev => prev.map(r => { const u = changedRows.find(x => x.id === r.id); return u ? { ...r, ...u.updates } : r; }));
    setSelectedIds([]);
    setApplyMessage({ type: "success", text: `Updated ${changedRows.length} selected row(s).` });
    setApplying(false);
  };

  const handleAddManualRow = async () => {
    const defaultDate = selectedMonth && selectedMonth !== "all" ? `${selectedMonth}-01` : new Date().toISOString().slice(0, 10);
    const date = window.prompt("Manual row date (YYYY-MM-DD)", defaultDate); if (!date) return;
    const amountRaw = window.prompt("Amount: positive = money in/refund, negative = money out/expense", "187.79"); if (!amountRaw) return;
    const amount = Number(String(amountRaw).replace(",", ".")); if (!Number.isFinite(amount) || amount === 0) return alert("Invalid amount.");
    const reference = window.prompt("Description / reference", "Manual bank adjustment") || "Manual bank adjustment";
    const costType = window.prompt("Cost / cash type", amount > 0 ? "Expense Refund" : "Operating Expense") || (amount > 0 ? "Expense Refund" : "Operating Expense");
    const module = window.prompt("Module: Online Shop, Event, Wholesale, Other", costType === "Event Cost" ? "Event" : "Other") || "Other";
    const channel = window.prompt("Channel", costType === "Payment Employees" ? "Payment Employees" : "Other") || "Other";
    const event = module === "Event" ? sortedEvents.find(e => e.name === window.prompt("Event name", sortedEvents[0]?.name || "")) : null;
    const amountIn = amount > 0 ? Math.abs(amount) : 0;
    const amountOut = amount < 0 ? Math.abs(amount) : 0;
    const month = monthFromDate(date) || selectedMonth;
    const payload = { date, accounting_month: month, month, reference, payment_ref: reference, type: "Manual Adjustment", amount_in: amountIn, amount_out: amountOut, cost_type: costType, module, channel, event_id: event?.id || "", event_name: event?.name || "", review_status: module === "Event" && !event ? "To review" : "OK", is_active: true, ...financialFields(costType, amountIn, amountOut) };
    const created = await base44.entities.BankTransaction.create(payload);
    setRecords(prev => [created, ...prev]);
  };

  const runClassification = async ({ includeOldIgnored = false } = {}) => {
    if (selectedMonth === "all") { setApplyMessage({ type: "error", text: "Select one month first." }); return; }
    setApplying(true); setApplyMessage(null);
    const candidates = filtered.filter(r => r.cost_type !== "Manual Review" && (r.review_status === "To review" || (includeOldIgnored && r.review_status === "Ignore" && (!r.cost_type || r.cost_type === "Ignore")))).slice(0, BATCH_LIMIT);
    let ok = 0, ignored = 0, stillReview = 0, unchanged = 0;
    const updatedRows = [];
    try {
      for (const record of candidates) {
        const updates = applyBankRule(record, learnedRules);
        if ((EVENT_TYPES.includes(updates.cost_type) || updates.module === "Event") && !record.event_id && !updates.event_id) updates.review_status = "To review";
        if (updates.review_status === "OK") ok++; else if (updates.review_status === "Ignore") ignored++; else stillReview++;
        if (!hasChanged(record, updates)) { unchanged++; continue; }
        await base44.entities.BankTransaction.update(record.id, updates);
        updatedRows.push({ id: record.id, updates });
      }
      setRecords(prev => prev.map(r => { const u = updatedRows.find(x => x.id === r.id); return u ? { ...r, ...u.updates } : r; }));
      setApplyMessage({ type: stillReview > 0 ? "warning" : "success", text: `Processed ${candidates.length}. Updated ${updatedRows.length}. OK ${ok}. Manual review ${stillReview}. Unchanged ${unchanged}.` });
    } catch (err) { setApplyMessage({ type: "error", text: err?.message || "Failed to classify bank rows." }); }
    finally { setApplying(false); }
  };

  const statusBadge = { "OK": "bg-green-100 text-green-800", "To review": "bg-yellow-100 text-yellow-800", "Ignore": "bg-slate-100 text-slate-600" };
  const summary = useMemo(() => { const visible = selectedMonth === "all" ? records : records.filter(r => (r.accounting_month || r.month) === selectedMonth); return { rows: visible.length, ok: visible.filter(r => r.review_status === "OK").length, review: visible.filter(r => r.review_status === "To review").length, employee: visible.reduce((s, r) => s + Number(r.employee_payment || (r.cost_type === "Payment Employees" ? r.amount_out : 0) || 0), 0), carRental: visible.reduce((s, r) => s + Number(r.car_rental_nl || 0), 0), spainTransport: visible.reduce((s, r) => s + Number(r.transport_spain_to_amsterdam || 0), 0), event: visible.reduce((s, r) => s + Number(r.event_cost || 0), 0), payouts: visible.filter(r => r.cost_type === "Payment Processor Payout").reduce((s, r) => s + Number(r.amount_in || 0), 0) }; }, [records, selectedMonth]);

  return <div className="p-6 max-w-7xl mx-auto space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Review Bank Transactions</h1><p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown · {selectedIds.length} selected</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={handleAddManualRow}><Plus className="w-4 h-4 mr-2" /> Add Manual Row</Button><Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: false })} disabled={applying || records.length === 0 || selectedMonth === "all"}><Wand2 className="w-4 h-4 mr-2" /> {applying ? "Classifying…" : `Classify Next ${BATCH_LIMIT}`}</Button><Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: true })} disabled={applying || records.length === 0 || selectedMonth === "all"}><RotateCcw className="w-4 h-4 mr-2" /> Reprocess Next {BATCH_LIMIT}</Button><Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button></div></div>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm"><Metric label="Rows" value={summary.rows} /><Metric label="OK" value={summary.ok} green /><Metric label="To review" value={summary.review} amber /><Metric label="Employee payments" value={`€${summary.employee.toFixed(2)}`} /><Metric label="Payouts cash" value={`€${summary.payouts.toFixed(2)}`} /><Metric label="Car rental NL" value={`€${summary.carRental.toFixed(2)}`} /><Metric label="Transport Spain → AMS" value={`€${summary.spainTransport.toFixed(2)}`} /><Metric label="Event" value={`€${summary.event.toFixed(2)}`} /></div>
    {applyMessage && <div className={`rounded-lg border px-4 py-3 text-sm ${applyMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" : applyMessage.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{applyMessage.text}</div>}
    <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-700">Use Module for the business area: Online Shop, Event, Wholesale or Other. Use Channel for what the expense was for. If Module is Event, select the event.</div>
    {selectedIds.length > 0 && <div className="rounded-lg border bg-card p-3 space-y-3"><div className="text-sm font-medium">Bulk edit {selectedIds.length} selected row(s)</div><div className="grid grid-cols-1 md:grid-cols-6 gap-2"><Select value={bulk.cost_type} onValueChange={v => setBulkField("cost_type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_CHANGE}>Keep type</SelectItem>{COST_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Select value={bulk.module} onValueChange={v => setBulkField("module", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_CHANGE}>Keep module</SelectItem>{MODULES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Select value={bulk.channel} onValueChange={v => setBulkField("channel", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_CHANGE}>Keep channel</SelectItem>{CHANNELS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Select value={bulk.event_id} onValueChange={v => setBulkField("event_id", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_CHANGE}>Keep event</SelectItem>{sortedEvents.map(e => <SelectItem key={e.id} value={e.id}>{e.event_date ? `${e.event_date} · ${e.name}` : e.name}</SelectItem>)}</SelectContent></Select><Select value={bulk.review_status} onValueChange={v => setBulkField("review_status", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={NO_CHANGE}>Keep status</SelectItem>{STATUSES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><div className="flex gap-2"><Button onClick={applyBulk} disabled={applying}>Apply</Button><Button variant="destructive" onClick={removeSelectedFromFinance} disabled={applying}><Trash2 className="w-4 h-4" /></Button></div></div></div>}
    <div className="flex flex-wrap gap-3"><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="all">All months</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="To review">To review</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="Ignore">Ignore</SelectItem></SelectContent></Select><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-64" placeholder="Search reference/type/module/channel/event..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
    <Card><CardContent className="p-0 overflow-hidden"><table className="w-full table-fixed text-sm" style={{ minWidth: 0 }}><thead className="bg-muted text-muted-foreground text-xs"><tr><th className="px-2 py-2 w-10"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} /></th>{["Date", "Reference", "Amount", "Cost / Cash Type", "Module", "Channel", "Event", "Status", ""].map(h => <th key={h} className="px-2 py-2 text-left font-medium truncate">{h}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={10} className="h-32 text-center text-sm text-muted-foreground">Loading...</td></tr> : filtered.map(r => editingId === r.id ? <BankRowEditor key={r.id} record={r} eventOptions={sortedEvents} onSave={updates => handleUpdate(r.id, updates)} onRemove={handleRemoveFromFinance} onCancel={() => setEditingId(null)} /> : <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)}><td className="px-2 py-2" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleOne(r.id)} /></td><td className="px-2 py-2 text-xs truncate">{r.date}</td><td className="px-2 py-2 text-xs truncate" title={r.reference || r.payment_ref}>{r.reference || r.payment_ref}</td><td className="px-2 py-2 text-xs truncate">{r.amount_out > 0 ? `-€${Number(r.amount_out || 0).toFixed(2)}` : r.amount_in > 0 ? `€${Number(r.amount_in || 0).toFixed(2)}` : ""}</td><td className="px-2 py-2 text-xs truncate">{r.cost_type}</td><td className="px-2 py-2 text-xs truncate">{rowModule(r)}</td><td className="px-2 py-2 text-xs truncate">{rowChannel(r)}</td><td className="px-2 py-2 text-xs truncate">{r.event_name || "—"}</td><td className="px-2 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.review_status] || ""}`}>{r.review_status}</span></td><td className="px-2 py-2 text-xs text-muted-foreground">Edit</td></tr>)}</tbody></table></CardContent></Card>
  </div>;
}

function Metric({ label, value, green, amber }) { return <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">{label}</div><div className={`font-semibold ${green ? "text-green-700" : amber ? "text-yellow-700" : ""}`}>{value}</div></div>; }
