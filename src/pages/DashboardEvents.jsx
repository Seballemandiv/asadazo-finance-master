import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Package, TrendingDown, TrendingUp, ShoppingBag } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import { computeEventMetrics } from "@/lib/financeCalc";

function formatMonth(m) {
  if (!m || !m.match(/^\d{4}-\d{2}$/)) return m;
  const [year, month] = m.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function rowNet(r) {
  if (r.net_amount_ex_vat != null) return Number(r.net_amount_ex_vat) || 0;
  if (r.net_ex_vat != null) return Number(r.net_ex_vat) || 0;
  return Number(r.gross_amount_inc_vat || r.gross_inc_vat || 0) - Number(r.vat_amount || r.vat || 0);
}

export default function DashboardEvents() {
  const [salesRecords, setSalesRecords] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [sumupTransactions, setSumupTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const [allBatches, sales, bank, transactions] = await Promise.all([
        base44.entities.ImportBatch.filter({ status: "imported" }),
        base44.entities.SalesRecord.list("-date", 5000),
        base44.entities.BankTransaction.list("-date", 5000),
        base44.entities.SumUpTransactionRecord.list(undefined, 5000),
      ]);

      const salesBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id));
      const bankBatchIds = new Set(allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
      const transactionBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_transactions").map(b => b.id));

      const activeSales = sales.filter(r => r.is_active !== false && r.import_batch_id && salesBatchIds.has(r.import_batch_id));
      const activeBank = bank.filter(r => r.is_active !== false && r.import_batch_id && bankBatchIds.has(r.import_batch_id));
      const activeTransactions = transactions.filter(r => r.is_active !== false && r.import_batch_id && transactionBatchIds.has(r.import_batch_id));

      setSalesRecords(activeSales);
      setBankTransactions(activeBank);
      setSumupTransactions(activeTransactions);

      const months = Array.from(new Set([
        ...activeSales.map(r => r.accounting_month || r.month).filter(Boolean),
        ...activeBank.map(r => r.accounting_month || r.month).filter(Boolean),
      ])).sort().reverse();
      setSelectedMonth(months.length > 0 ? months[0] : "all");
      setLoading(false);
    };
    loadData();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set([
      ...salesRecords.map(r => r.accounting_month || r.month).filter(Boolean),
      ...bankTransactions.map(r => r.accounting_month || r.month).filter(Boolean),
      ...sumupTransactions.map(r => r.accounting_month || r.month).filter(Boolean),
    ]);
    return Array.from(months).sort().reverse();
  }, [salesRecords, bankTransactions, sumupTransactions]);

  const filteredSales = useMemo(() => selectedMonth === "all" ? salesRecords : salesRecords.filter(r => (r.accounting_month || r.month) === selectedMonth), [salesRecords, selectedMonth]);
  const filteredBank = useMemo(() => selectedMonth === "all" ? bankTransactions : bankTransactions.filter(r => (r.accounting_month || r.month) === selectedMonth), [bankTransactions, selectedMonth]);
  const filteredTransactions = useMemo(() => selectedMonth === "all" ? sumupTransactions : sumupTransactions.filter(r => (r.accounting_month || r.month) === selectedMonth), [sumupTransactions, selectedMonth]);

  const metrics = useMemo(() => computeEventMetrics(filteredSales, filteredBank, filteredTransactions), [filteredSales, filteredBank, filteredTransactions]);

  const eventSales = useMemo(() => filteredSales.filter(r => r.mapping_status !== "Ignore" && (r.revenue_type === "Event" || r.channel === "Event")), [filteredSales]);
  const eventCosts = useMemo(() => filteredBank.filter(r => r.review_status === "OK" && (r.cost_type === "Event Cost" || r.channel === "Event")), [filteredBank]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Events</h1>
          <p className="text-muted-foreground text-sm mt-1">Asadazo · Event Revenue & Cost Overview</p>
        </div>
        <Select value={selectedMonth || "all"} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Select month" /></SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
            <SelectItem value="all">All months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Event results are separated from the online-shop dashboard. Use this view for event P&L, deposits, venue costs, event stock use, and event-specific profitability.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Event Revenue" value={`€${metrics.revenue.toFixed(2)}`} icon={TrendingUp} color="green" />
        <MetricCard title="Event Total Costs" value={`€${metrics.totalCosts.toFixed(2)}`} icon={TrendingDown} color="red" />
        <MetricCard title="Event Profit" value={`€${metrics.eventProfit.toFixed(2)}`} icon={Calendar} color={metrics.eventProfit >= 0 ? "green" : "red"} subtitle={`Margin: ${metrics.marginPct.toFixed(1)}%`} />
        <MetricCard title="Gross Profit after Event COGS" value={`€${metrics.grossProfit.toFixed(2)}`} icon={Package} color={metrics.grossProfit >= 0 ? "green" : "red"} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Event Meat COGS" value={`€${metrics.cogs.toFixed(2)}`} icon={Package} color="orange" small />
        <MetricCard title="Event Bank Costs" value={`€${metrics.costs.toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Payment Fees" value={`€${metrics.paymentFees.toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Event Sales Rows" value={`${metrics.eventRows}`} icon={ShoppingBag} color="slate" small />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg bg-card p-4">
          <h2 className="font-semibold mb-3">Event Sales Lines</h2>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Product</th><th className="px-2 py-2 text-right">Net ex VAT</th><th className="px-2 py-2 text-right">COGS</th></tr></thead>
              <tbody>{eventSales.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.transaction_date || r.date || "").slice(0, 10)}</td><td className="px-2 py-2 max-w-[220px] truncate">{r.product_name || r.product}</td><td className="px-2 py-2 text-right">€{rowNet(r).toFixed(2)}</td><td className="px-2 py-2 text-right">€{Number(r.meat_cogs || 0).toFixed(2)}</td></tr>)}</tbody>
            </table>
            {!eventSales.length && <p className="text-sm text-muted-foreground text-center py-8">No event sales rows for this month.</p>}
          </div>
        </div>

        <div className="border rounded-lg bg-card p-4">
          <h2 className="font-semibold mb-3">Event Bank Costs</h2>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Date</th><th className="px-2 py-2 text-left">Reference</th><th className="px-2 py-2 text-right">Amount</th></tr></thead>
              <tbody>{eventCosts.map(r => <tr key={r.id} className="border-t"><td className="px-2 py-2">{(r.date || "").slice(0, 10)}</td><td className="px-2 py-2 max-w-[260px] truncate">{r.reference || r.payment_ref}</td><td className="px-2 py-2 text-right">€{Number(r.event_cost || r.amount_out || 0).toFixed(2)}</td></tr>)}</tbody>
            </table>
            {!eventCosts.length && <p className="text-sm text-muted-foreground text-center py-8">No event bank costs for this month.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
