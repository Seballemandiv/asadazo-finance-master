import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, Wand2, RotateCcw } from "lucide-react";
import BankRowEditor from "@/components/review/BankRowEditor";
import { applyBankRule } from "@/lib/bankRulesEngine";

export default function ReviewBank() {
  const [records, setRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [statusFilter, setStatusFilter] = useState("To review");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState(null);

  const load = async () => {
    setLoading(true);
    const [activeBatches, recs] = await Promise.all([
      base44.entities.ImportBatch.filter({ status: "imported" }),
      base44.entities.BankTransaction.list("-date", 5000),
    ]);
    const activeBatchIds = new Set(activeBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
    const activeRecs = recs.filter(r => r.is_active !== false && (!r.import_batch_id || activeBatchIds.has(r.import_batch_id)));
    setRecords(activeRecs);
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
      const statusOk = statusFilter === "all" || r.review_status === statusFilter;
      const text = `${r.reference || ""} ${r.payment_ref || ""} ${r.counterparty || ""} ${r.cost_type || ""}`.toLowerCase();
      const searchOk = !search || text.includes(search.toLowerCase());
      return monthOk && statusOk && searchOk;
    });
  }, [records, selectedMonth, statusFilter, search]);

  const handleUpdate = async (id, updates) => {
    await base44.entities.BankTransaction.update(id, updates);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setEditingId(null);
  };

  const runClassification = async ({ includeOldIgnored = false } = {}) => {
    setApplying(true);
    setApplyMessage(null);

    const targetRecords = records.filter(r => {
      const recMonth = r.accounting_month || r.month;
      const monthOk = selectedMonth === "all" || recMonth === selectedMonth;
      if (!monthOk) return false;

      if (r.review_status === "To review") return true;

      // Reclassify old rows that were previously hidden as generic Ignore.
      // Rows already reviewed as a specific type stay untouched.
      if (includeOldIgnored) {
        return r.review_status === "Ignore" && (!r.cost_type || r.cost_type === "Ignore");
      }
      return false;
    });

    let ok = 0;
    let ignored = 0;
    let stillReview = 0;
    let updatedRows = [];

    try {
      for (const record of targetRecords) {
        const updates = applyBankRule(record);
        await base44.entities.BankTransaction.update(record.id, updates);
        updatedRows.push({ id: record.id, updates });
        if (updates.review_status === "OK") ok++;
        else if (updates.review_status === "Ignore") ignored++;
        else stillReview++;
      }

      setRecords(prev => prev.map(r => {
        const u = updatedRows.find(x => x.id === r.id);
        return u ? { ...r, ...u.updates } : r;
      }));

      setApplyMessage({
        type: stillReview > 0 ? "warning" : "success",
        text: `${includeOldIgnored ? "Reprocessed" : "Classified"} ${targetRecords.length} bank row(s). OK: ${ok}, Ignored: ${ignored}, Still to review: ${stillReview}.`,
      });
    } catch (err) {
      console.error("Failed to classify bank rows", err);
      setApplyMessage({ type: "error", text: err?.message || "Failed to classify bank rows." });
    } finally {
      setApplying(false);
    }
  };

  const statusBadge = {
    "OK": "bg-green-100 text-green-800",
    "To review": "bg-yellow-100 text-yellow-800",
    "Ignore": "bg-slate-100 text-slate-600",
  };

  const summary = useMemo(() => {
    const visible = selectedMonth === "all" ? records : records.filter(r => (r.accounting_month || r.month) === selectedMonth);
    return {
      rows: visible.length,
      ok: visible.filter(r => r.review_status === "OK").length,
      review: visible.filter(r => r.review_status === "To review").length,
      ignore: visible.filter(r => r.review_status === "Ignore").length,
      oldGenericIgnore: visible.filter(r => r.review_status === "Ignore" && (!r.cost_type || r.cost_type === "Ignore")).length,
      operating: visible.reduce((s, r) => s + Number(r.operating_expenses || 0), 0),
      shipping: visible.reduce((s, r) => s + Number(r.shipping_cost || 0), 0),
      event: visible.reduce((s, r) => s + Number(r.event_cost || 0), 0),
      purchases: visible.reduce((s, r) => s + Number(r.meat_purchase || 0), 0),
      payouts: visible.filter(r => r.cost_type === "Payment Processor Payout").reduce((s, r) => s + Number(r.amount_in || 0), 0),
      loansIn: visible.filter(r => r.cost_type === "Loan In / Payback").reduce((s, r) => s + Number(r.amount_in || 0), 0),
      transfers: visible.filter(r => r.cost_type === "Transfer / Reconciliation").reduce((s, r) => s + Number(r.amount_in || 0) + Number(r.amount_out || 0), 0),
    };
  }, [records, selectedMonth]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Review Bank Transactions</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} records shown</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: false })} disabled={applying || records.length === 0}>
            <Wand2 className="w-4 h-4 mr-2" /> {applying ? "Classifying…" : "Classify To Review"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => runClassification({ includeOldIgnored: true })} disabled={applying || records.length === 0}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reprocess Old Ignores
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Rows</div><div className="font-semibold">{summary.rows}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">OK</div><div className="font-semibold text-green-700">{summary.ok}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">To review</div><div className="font-semibold text-yellow-700">{summary.review}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Old generic ignore</div><div className="font-semibold text-amber-700">{summary.oldGenericIgnore}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Payouts cash</div><div className="font-semibold">€{summary.payouts.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Loans/paybacks</div><div className="font-semibold">€{summary.loansIn.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Operating</div><div className="font-semibold">€{summary.operating.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Meat purchases</div><div className="font-semibold">€{summary.purchases.toFixed(2)}</div></div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Ignored total</div><div className="font-semibold text-slate-600">{summary.ignore}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Shipping</div><div className="font-semibold">€{summary.shipping.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Event</div><div className="font-semibold">€{summary.event.toFixed(2)}</div></div>
        <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Transfers/recon</div><div className="font-semibold">€{summary.transfers.toFixed(2)}</div></div>
      </div>

      {applyMessage && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          applyMessage.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
          applyMessage.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {applyMessage.text}
        </div>
      )}

      <div className="rounded-lg border bg-slate-50 px-4 py-3 text-xs text-slate-700">
        Bank rows are cash movements. Card payouts should be “Payment Processor Payout” for reconciliation, not revenue. SumUp fees come from the SumUp Transaction Report. Loan/payback rows affect cash but not profit.
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="To review">To review</SelectItem>
            <SelectItem value="OK">OK</SelectItem>
            <SelectItem value="Ignore">Ignore</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9 w-56" placeholder="Search reference/category..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  {["Date", "Type", "Reference", "Payment Ref", "Amount Out", "Amount In", "Cost / Cash Type", "Channel", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => editingId === r.id ? (
                  <BankRowEditor key={r.id} record={r} onSave={updates => handleUpdate(r.id, updates)} onCancel={() => setEditingId(null)} />
                ) : (
                  <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => setEditingId(r.id)}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{r.date}</td>
                    <td className="px-3 py-2 text-xs">{r.type}</td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-xs">{r.reference}</td>
                    <td className="px-3 py-2 max-w-[160px] truncate text-xs">{r.payment_ref}</td>
                    <td className="px-3 py-2 text-destructive text-xs">{r.amount_out > 0 ? `€${r.amount_out?.toFixed(2)}` : ""}</td>
                    <td className="px-3 py-2 text-green-700 text-xs">{r.amount_in > 0 ? `€${r.amount_in?.toFixed(2)}` : ""}</td>
                    <td className="px-3 py-2 text-xs">{r.cost_type}</td>
                    <td className="px-3 py-2 text-xs">{r.channel}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.review_status] || ""}`}>{r.review_status}</span></td>
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
