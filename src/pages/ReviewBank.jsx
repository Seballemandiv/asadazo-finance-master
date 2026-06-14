import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Wand2, RotateCcw, Plus } from "lucide-react";
import BankRowEditor from "@/components/review/BankRowEditor";
import { applyBankRule, buildLearnedBankRules } from "@/lib/bankRulesEngine";

const BATCH_LIMIT = 10;
const EVENT_TYPES = ["Event Cost"];

function hasChanged(record, updates) {
  return Object.entries(updates).some(([k, v]) => String(record[k] ?? "") !== String(v ?? ""));
}
function monthFromDate(date) { return String(date || "").slice(0, 7); }
function financialFields(costType, amountIn, amountOut) {
  const expenseRefund = costType === "Expense Refund" ? amountIn : 0;
  const carRental = costType === "Car rental NL" ? amountOut - amountIn : 0;
  const spainTransport = costType === "Transport Spain to Amsterdam" ? amountOut - amountIn : 0;
  return {
    counted_expense: ["Operating Expense", "Shipping Cost", "Event Cost", "Car rental NL", "Transport Spain to Amsterdam"].includes(costType) ? amountOut : (costType === "Expense Refund" ? -expenseRefund : 0),
    shipping_cost: costType === "Shipping Cost" ? amountOut : 0,
    operating_expenses: costType === "Operating Expense" ? amountOut : (costType === "Expense Refund" ? -expenseRefund : 0),
    car_rental_nl: carRental,
    transport_spain_to_amsterdam: spainTransport,
    event_cost: costType === "Event Cost" ? amountOut : 0,
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
    setEvents(eventRows.filter(e => e.is_active !== false));
    const months = Array.from(new Set(activeRecs.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse();
    if ((selectedMonth === "all" || !selectedMonth) && months.length > 0) setSelectedMonth(months[0]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const learnedRules = useMemo(() => buildLearnedBankRules(records), [records]);
  const availableMonths = useMemo(() => Array.from(new Set(records.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse(), [records]);
  const filtered = useMemo(() => records.filter(r => {
    const recMonth = r.accounting_month || r.month;
    const monthOk = selectedMonth === "all" || recMonth === selectedMonth;
    const statusOk = statusFilter === "all" || r.review_status === statusFilter;
    const text = `${r.reference || ""} ${r.payment_ref || ""} ${r.counterparty || ""} ${r.cost_type || ""} ${r.event_name || ""}`.toLowerCase();
    const searchOk = !search || text.includes(search.toLowerCase());
    return monthOk && statusOk && searchOk;
  }), [records, selectedMonth, statusFilter, search]);

  const handleUpdate = async (id, updates) => {
    await base44.entities.BankTransaction.update(id, updates);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setEditingId(null);
  };
  const handleRemoveFromFinance = async (id) => {
    if (!window.confirm("Remove this bank row from finance?")) return;
    const updates = { is_active: false, review_status: "Ignore", cost_type: "Ignore", counted_expense: 0, shipping_cost: 0, operating_expenses: 0, car_rental_nl: 0, transport_spain_to_amsterdam: 0, event_cost: 0, meat_purchase: 0, refund_amount: 0, expense_refund_amount: 0 };
    await base44.entities.BankTransaction.update(id, updates);
    setRecords(prev => prev.filter(r => r.id !== id));
    setEditingId(null);
  };
  const handleAddManualRow = async () => {
    const defaultDate = selectedMonth && selectedMonth !== "all" ? `${selectedMonth}-01` : new Date().toISOString().slice(0, 10);
    const date = window.prompt("Manual row date (YYYY-MM-DD)", defaultDate); if (!date) return;
    const amountRaw = window.prompt("Amount: positive = money in/refund, negative = money out/expense", "187.79"); if (!amountRaw) return;
    const amount = Number(String(amountRaw).replace(",", ".")); if (!Number.isFinite(amount) || amount === 0) return alert("Invalid amount.");
    const reference = window.prompt("Description / reference", "Manual Diks refund to personal account") || "Manual bank adjustment";
    const costType = window.prompt("Cost / cash type", amount > 0 ? "Expense Refund" : "Operating Expense") || (amount > 0 ? "Expense Refund" : "Operating Expense");
    const channel = costType === "Event Cost" ? "Event" : (window.prompt("Channel", "Other") || "Other");
    const event = costType === "Event Cost" ? events.find(e => e.name === window.prompt("Event name", events[0]?.name || "")) : null;
    const amountIn = amount > 0 ? Math.abs(amount) : 0;
    const amountOut = amount < 0 ? Math.abs(amount) : 0;
    const month = monthFromDate(date) || selectedMonth;
    const payload = { date, accounting_month: month, month, reference, payment_ref: reference, type: "Manual Adjustment", amount_in: amountIn, amount_out: amountOut, cost_type: costType, channel, event_id: event?.id || "", event_name: event?.name || "", review_status: costType === "Event Cost" && !event ? "To review" : "OK", is_active: true, ...financialFields(costType, amountIn, amountOut) };
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
        if ((EVENT_TYPES.includes(updates.cost_type) || updates.channel === "Event") && !record.event_id && !updates.event_id) updates.review_status = "To review";
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
  const summary = useMemo(() => {
    const visible = selectedMonth === "all" ? records : records.filter(r => (r.accounting_month || r.month) === selectedMonth);
    return { rows: visible.length, ok: visible.filter(r => r.review_status === "OK").length, review: visible.filter(r => r.review_status === "To review").length, ignore: visible.filter(r => r.review_status === "Ignore").length, operating: visible.reduce((s, r) => s + Number(r.operating_expenses || 0), 0), carRental: visible.reduce((s, r) => s + Number(r.car_rental_nl || 0), 0), spainTransport: visible.reduce((s, r) => s + Number(r.transport_spain_to_amsterdam || 0), 0), shipping: visible.reduce((s, r) => s + Number(r.shipping_cost || 0), 0), event: visible.reduce((s, r) => s + Number(r.event_cost || 0), 0), purchases: visible.reduce((s, r) => s + Number(r.meat_purchase || 0), 0), payouts: visible.filter(r => r.cost_type === "Payment Processor Payout").reduce((s, r) => s + Number(r.amount_in || 0), 0), transfers: visible.filter(r => r.cost_type === "Transfer / Reconciliation").reduce((s, r) => s + Number(r.amount_in || 0) + Number(r.amount_out || 0), 0) };
  }, [records, selectedMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold">Review Bank Transactions</h1><p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={handleAddManualRow}><Plus className="w-4 h-4 mr-2" /> Add Manual Row</Button><Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: false })} disabled={applying || records.length === 0 || selectedMonth === "all"}><Wand2 className="w-4 h-4 mr-2" /> {applying ? "Classifying…" : `Classify Next ${BATCH_LIMIT}`}</Button><Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: true })} disabled={applying || records.length === 0 || selectedMonth === "all"}><RotateCcw className="w-4 h-4 mr-2" /> Reprocess Next {BATCH_LIMIT}</Button><Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm"><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Rows</div><div className="font-semibold">{summary.rows}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">OK</div><div className="font-semibold text-green-700">{summary.ok}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">To review</div><div className="font-semibold text-yellow-700">{summary.review}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Payouts cash</div><div className="font-semibold">€{summary.payouts.toFixed(2)}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Car rental NL</div><div className="font-semibold">€{summary.carRental.toFixed(2)}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Transport Spain → AMS</div><div className="font-semibold">€{summary.spainTransport.toFixed(2)}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Operating</div><div className="font-semibold">€{summary.operating.toFixed(2)}</div></div><div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Event</div><div className="font-semibold">€{summary.event.toFixed(2)}</div></div></div>
      {applyMessage && <div className={`rounded-lg border px-4 py-3 text-sm ${applyMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" : applyMessage.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>{applyMessage.text}</div>}
      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-700">If a row is Event Cost or Channel = Event, select which event it belongs to. Unassigned event rows stay To review.</div>
      <div className="flex flex-wrap gap-3"><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent>{availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}<SelectItem value="all">All months</SelectItem></SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="To review">To review</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="Ignore">Ignore</SelectItem></SelectContent></Select><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input className="pl-9 w-64" placeholder="Search reference/category/event..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
      <Card><CardContent className="overflow-x-auto p-0">{loading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div> : <table className="w-full text-sm"><thead className="bg-muted text-muted-foreground text-xs"><tr>{["Date", "Type", "Reference", "Amount Out", "Amount In", "Cost / Cash Type", "Channel", "Event", "Status", ""].map(h => <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{filtered.map(r => editingId === r.id ? <BankRowEditor key={r.id} record={r} eventOptions={events} onSave={updates => handleUpdate(r.id, updates)} onRemove={handleRemoveFromFinance} onCancel={() => setEditingId(null)} /> : <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)}><td className="px-3 py-2 whitespace-nowrap text-xs">{r.date}</td><td className="px-3 py-2 text-xs">{r.type}</td><td className="px-3 py-2 max-w-[220px] truncate text-xs">{r.reference}</td><td className="px-3 py-2 text-destructive text-xs">{r.amount_out > 0 ? `€${r.amount_out?.toFixed(2)}` : ""}</td><td className="px-3 py-2 text-green-700 text-xs">{r.amount_in > 0 ? `€${r.amount_in?.toFixed(2)}` : ""}</td><td className="px-3 py-2 text-xs">{r.cost_type}</td><td className="px-3 py-2 text-xs">{r.channel}</td><td className="px-3 py-2 text-xs max-w-[160px] truncate">{r.event_name || "—"}</td><td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.review_status] || ""}`}>{r.review_status}</span></td><td className="px-3 py-2 text-xs text-muted-foreground">Edit</td></tr>)}</tbody></table>}</CardContent></Card>
    </div>
  );
}
