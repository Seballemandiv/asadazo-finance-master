import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingBag, Package, Truck, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import RevenueBreakdown from "@/components/dashboard/RevenueBreakdown";
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown";
import ReviewAlert from "@/components/dashboard/ReviewAlert";
import { computeMetrics } from "@/lib/financeCalc";

function formatMonth(m) {
  if (!m || !m.match(/^\d{4}-\d{2}$/)) return m;
  const [year, month] = m.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export default function Dashboard() {
  const [salesRecords, setSalesRecords] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [sumupTransactions, setSumupTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [rawSalesAll, setRawSalesAll] = useState([]);
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const [allBatches, sales, bank, articles, transactions] = await Promise.all([
        base44.entities.ImportBatch.filter({ status: "imported" }),
        base44.entities.SalesRecord.list("-date", 5000),
        base44.entities.BankTransaction.list("-date", 5000),
        base44.entities.ArticleRecord.list(undefined, 1000),
        base44.entities.SumUpTransactionRecord.list(undefined, 5000),
      ]);

      const salesBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id));
      const bankBatchIds = new Set(allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id));
      const transactionBatchIds = new Set(allBatches.filter(b => b.import_type === "sumup_transactions").map(b => b.id));

      setRawSalesAll(sales);

      const activeSales = sales.filter(r => r.is_active !== false && r.import_batch_id && salesBatchIds.has(r.import_batch_id));
      const activeBank = bank.filter(r => r.is_active !== false && r.import_batch_id && bankBatchIds.has(r.import_batch_id));
      const activeTransactions = transactions.filter(r => r.is_active !== false && r.import_batch_id && transactionBatchIds.has(r.import_batch_id));

      const revertedCount = sales.filter(r => r.import_batch_id && !salesBatchIds.has(r.import_batch_id)).length;

      setDebugInfo({
        salesBatchCount: salesBatchIds.size,
        bankBatchCount: bankBatchIds.size,
        transactionBatchCount: transactionBatchIds.size,
        totalSalesRows: sales.length,
        activeSalesRows: activeSales.length,
        articleRows: articles.length,
        transactionRows: activeTransactions.length,
        bankRows: activeBank.length,
        revertedRows: revertedCount,
        noMonthRows: activeSales.filter(r => !(r.accounting_month || r.month)).length,
      });

      setSalesRecords(activeSales);
      setBankTransactions(activeBank);
      setSumupTransactions(activeTransactions);

      const months = Array.from(new Set(activeSales.map(r => r.accounting_month || r.month).filter(Boolean))).sort().reverse();
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

  const filteredSales = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return salesRecords;
    return salesRecords.filter(r => (r.accounting_month || r.month) === selectedMonth);
  }, [salesRecords, selectedMonth]);

  const filteredBank = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return bankTransactions;
    return bankTransactions.filter(r => (r.accounting_month || r.month) === selectedMonth);
  }, [bankTransactions, selectedMonth]);

  const filteredTransactions = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return sumupTransactions;
    return sumupTransactions.filter(r => (r.accounting_month || r.month) === selectedMonth);
  }, [sumupTransactions, selectedMonth]);

  const metrics = useMemo(() => computeMetrics(filteredSales, filteredBank, filteredTransactions), [filteredSales, filteredBank, filteredTransactions]);

  const debugComputed = useMemo(() => {
    const matching = filteredSales;
    const netSum = matching.reduce((s, r) => s + (r.net_amount_ex_vat || r.net_ex_vat || 0), 0);
    const grossSum = matching.reduce((s, r) => s + (r.gross_amount_inc_vat || r.gross_inc_vat || 0), 0);
    const vatSum = matching.reduce((s, r) => s + (r.vat_amount || r.vat || 0), 0);
    const noNetField = matching.filter(r => !(r.net_amount_ex_vat || r.net_ex_vat)).length;
    const feeSum = filteredTransactions.reduce((s, r) => s + Math.abs(Number(r.transaction_fee || 0)), 0);
    return { matchingCount: matching.length, netSum, grossSum, vatSum, noNetField, feeSum };
  }, [filteredSales, filteredTransactions]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Online-shop</h1>
          <p className="text-muted-foreground text-sm mt-1">Asadazo · Online Shop Revenue & Cost Overview</p>
        </div>
        <Select value={selectedMonth || "all"} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Select month" /></SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>)}
            <SelectItem value="all">All months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(metrics.salesPendingReview > 0 || metrics.bankPendingReview > 0) && <ReviewAlert salesCount={metrics.salesPendingReview} bankCount={metrics.bankPendingReview} />}

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Events are excluded from this online-shop profit view. Excluded this month: event revenue €{(metrics.eventRevenueExcluded || 0).toFixed(2)} and event costs €{(metrics.eventCostsExcluded || 0).toFixed(2)}. Use Dashboard Events for event profitability.
      </div>

      {filteredSales.length > 0 && metrics.unmappedCogs > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ COGS incomplete — {metrics.unmappedCogs} online-shop sales row(s) have Meat/Box revenue type but missing kg or cost mapping. Go to Review Sales to fix.
        </div>
      )}

      {filteredSales.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No active sales data for {selectedMonth && selectedMonth !== "all" ? formatMonth(selectedMonth) : "any month"}. Import a SumUp Sales Report in the Import Center.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Net Revenue (ex VAT)" value={`€${metrics.totalRevenue.toFixed(2)}`} icon={TrendingUp} color="green" />
        <MetricCard title="Total Online P&L Costs" value={`€${metrics.totalCosts.toFixed(2)}`} icon={TrendingDown} color="red" />
        <MetricCard title="Online Operating Profit" value={`€${metrics.operatingProfit.toFixed(2)}`} icon={ShoppingBag} color={metrics.operatingProfit >= 0 ? "green" : "red"} subtitle={`Margin: ${metrics.marginPct.toFixed(1)}%`} />
        <MetricCard title="Gross Profit after COGS" value={`€${metrics.grossProfit.toFixed(2)}`} icon={Package} color={metrics.grossProfit >= 0 ? "green" : "red"} subtitle={`Gross margin: ${metrics.grossMarginPct.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Product Revenue" value={`€${metrics.productRevenue.toFixed(2)}`} icon={ShoppingBag} color="blue" small />
        <MetricCard title="Shipping Revenue" value={`€${metrics.shippingRevenue.toFixed(2)}`} icon={Truck} color="blue" small />
        <MetricCard title="Refunds / Adjustments" value={`€${(metrics.refunds || 0).toFixed(2)}`} icon={TrendingDown} color="red" small />
        <MetricCard title="Other Revenue" value={`€${metrics.otherRevenue.toFixed(2)}`} icon={TrendingUp} color="blue" small />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Meat COGS" value={`€${metrics.meatCogs.toFixed(2)}`} icon={Package} color="orange" small />
        <MetricCard title="Payment Fees" value={`€${(metrics.paymentFees || 0).toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Car rental NL" value={`€${(metrics.carRentalNL || 0).toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Transport Spain → AMS" value={`€${(metrics.transportSpainToAmsterdam || 0).toFixed(2)}`} icon={Truck} color="slate" small />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Shipping Costs" value={`€${metrics.shippingCosts.toFixed(2)}`} icon={Truck} color="slate" small />
        <MetricCard title="Operating Expenses" value={`€${metrics.operatingExpenses.toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Meat Purchases (cash)" value={`€${metrics.meatPurchases.toFixed(2)}`} icon={Package} color="slate" small />
        <MetricCard title="Processor Payouts (cash)" value={`€${(metrics.paymentProcessorPayouts || 0).toFixed(2)}`} icon={TrendingUp} color="slate" small />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Loans / Paybacks (cash)" value={`€${(metrics.loanInPayback || 0).toFixed(2)}`} icon={TrendingUp} color="slate" small />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdown metrics={metrics} />
        <ChannelBreakdown sales={filteredSales.filter(r => r.channel !== "Event" && r.revenue_type !== "Event")} />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={() => setShowDebug(v => !v)}>
          <span>🔍 Data Source Debug</span>
          {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDebug && (
          <div className="px-4 py-4 text-xs font-mono space-y-1 bg-white text-slate-700">
            <p className="font-semibold text-slate-900 mb-2">Entity counts (active imported batches)</p>
            <p>Active sumup_sales batches found: <strong>{debugInfo.salesBatchCount}</strong></p>
            <p>Active bank_transactions batches found: <strong>{debugInfo.bankBatchCount}</strong></p>
            <p>Active sumup_transactions batches found: <strong>{debugInfo.transactionBatchCount}</strong></p>
            <p>Total SalesRecord rows in DB: <strong>{debugInfo.totalSalesRows}</strong></p>
            <p>Active SumUp Sales rows: <strong>{debugInfo.activeSalesRows}</strong></p>
            <p>Active SumUp Transaction rows: <strong>{debugInfo.transactionRows}</strong></p>
            <p>Active Bank rows: <strong>{debugInfo.bankRows}</strong></p>
            <p>Rows excluded (reverted/wrong batch): <strong>{debugInfo.revertedRows}</strong></p>
            <p>Active Article rows: <strong>{debugInfo.articleRows}</strong></p>
            <div className="border-t mt-2 pt-2">
              <p className="font-semibold text-slate-900 mb-1">Month filter</p>
              <p>Selected month: <strong>{selectedMonth || "(none yet)"}</strong></p>
              <p>Available months: <strong>{availableMonths.join(", ") || "(none)"}</strong></p>
              <p>Sales rows matching selected month: <strong>{debugComputed.matchingCount}</strong></p>
              <p>Rows with no month field: <strong>{debugInfo.noMonthRows}</strong></p>
            </div>
            <div className="border-t mt-2 pt-2">
              <p className="font-semibold text-slate-900 mb-1">Revenue and fees</p>
              <p>Sum net sales: <strong>€{debugComputed.netSum.toFixed(2)}</strong></p>
              <p>Sum gross sales: <strong>€{debugComputed.grossSum.toFixed(2)}</strong></p>
              <p>Sum VAT: <strong>€{debugComputed.vatSum.toFixed(2)}</strong></p>
              <p>Sum SumUp transaction fees: <strong>€{debugComputed.feeSum.toFixed(2)}</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
