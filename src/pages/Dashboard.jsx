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
  const [selectedMonth, setSelectedMonth] = useState(null); // null = not yet set
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
        base44.entities.SumUpTransactionRecord.list(undefined, 1000),
      ]);

      // Strict: only rows from active sumup_sales batches
      const salesBatchIds = new Set(
        allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id)
      );
      const bankBatchIds = new Set(
        allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id)
      );

      setRawSalesAll(sales);

      // Strict filter — must have a batch ID that belongs to an active sumup_sales batch
      const activeSales = sales.filter(r =>
        r.is_active !== false &&
        r.import_batch_id &&
        salesBatchIds.has(r.import_batch_id)
      );
      const activeBank = bank.filter(r =>
        r.is_active !== false &&
        r.import_batch_id &&
        bankBatchIds.has(r.import_batch_id)
      );

      const revertedCount = sales.filter(r =>
        r.import_batch_id && !salesBatchIds.has(r.import_batch_id)
      ).length;

      setDebugInfo({
        salesBatchCount: salesBatchIds.size,
        bankBatchCount: bankBatchIds.size,
        totalSalesRows: sales.length,
        activeSalesRows: activeSales.length,
        articleRows: articles.length,
        transactionRows: transactions.length,
        bankRows: activeBank.length,
        revertedRows: revertedCount,
        noMonthRows: activeSales.filter(r => !(r.accounting_month || r.month)).length,
      });

      setSalesRecords(activeSales);
      setBankTransactions(activeBank);

      // Default to latest month from active sales
      const months = Array.from(
        new Set(activeSales.map(r => r.accounting_month || r.month).filter(Boolean))
      ).sort().reverse();
      if (months.length > 0) {
        setSelectedMonth(months[0]);
      } else {
        setSelectedMonth("all");
      }

      setLoading(false);
    };
    loadData();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set([
      ...salesRecords.map(r => r.accounting_month || r.month).filter(Boolean),
      ...bankTransactions.map(r => r.accounting_month || r.month).filter(Boolean),
    ]);
    return Array.from(months).sort().reverse();
  }, [salesRecords, bankTransactions]);

  const filteredSales = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return salesRecords;
    return salesRecords.filter(r =>
      (r.accounting_month || r.month) === selectedMonth
    );
  }, [salesRecords, selectedMonth]);

  const filteredBank = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return bankTransactions;
    return bankTransactions.filter(r =>
      (r.accounting_month || r.month) === selectedMonth
    );
  }, [bankTransactions, selectedMonth]);

  const metrics = useMemo(() => computeMetrics(filteredSales, filteredBank), [filteredSales, filteredBank]);

  // Debug computed values
  const debugComputed = useMemo(() => {
    const matching = filteredSales;
    const netSum = matching.reduce((s, r) => s + (r.net_amount_ex_vat || r.net_ex_vat || 0), 0);
    const grossSum = matching.reduce((s, r) => s + (r.gross_amount_inc_vat || r.gross_inc_vat || 0), 0);
    const vatSum = matching.reduce((s, r) => s + (r.vat_amount || r.vat || 0), 0);
    const noNetField = matching.filter(r => !(r.net_amount_ex_vat || r.net_ex_vat)).length;

    return { matchingCount: matching.length, netSum, grossSum, vatSum, noNetField };
  }, [filteredSales, selectedMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Asadazo · Revenue & Cost Overview</p>
        </div>
        <Select value={selectedMonth || "all"} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => (
              <SelectItem key={m} value={m}>{formatMonth(m)}</SelectItem>
            ))}
            <SelectItem value="all">All months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Review alerts */}
      {(metrics.salesPendingReview > 0 || metrics.bankPendingReview > 0) && (
        <ReviewAlert salesCount={metrics.salesPendingReview} bankCount={metrics.bankPendingReview} />
      )}

      {/* COGS incomplete warning */}
      {filteredSales.length > 0 && metrics.unmappedCogs > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ COGS incomplete — {metrics.unmappedCogs} sales row(s) have Meat/Box revenue type but missing kg or cost mapping. Go to Review Sales to fix.
        </div>
      )}

      {/* No active sales warning */}
      {filteredSales.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No active sales data for {selectedMonth && selectedMonth !== "all" ? formatMonth(selectedMonth) : "any month"}. Import a SumUp Sales Report in the Import Center.
        </div>
      )}

      {/* Top metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue (ex VAT)"
          value={`€${metrics.totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Total Costs"
          value={`€${metrics.totalCosts.toFixed(2)}`}
          icon={TrendingDown}
          color="red"
        />
        <MetricCard
          title="Gross Profit"
          value={`€${metrics.grossProfit.toFixed(2)}`}
          icon={ShoppingBag}
          color={metrics.grossProfit >= 0 ? "green" : "red"}
          subtitle={`Margin: ${metrics.marginPct.toFixed(1)}%`}
        />
        <MetricCard
          title="Meat COGS"
          value={`€${metrics.meatCogs.toFixed(2)}`}
          icon={Package}
          color="orange"
        />
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Product Revenue" value={`€${metrics.productRevenue.toFixed(2)}`} icon={ShoppingBag} color="blue" small />
        <MetricCard title="Shipping Revenue" value={`€${metrics.shippingRevenue.toFixed(2)}`} icon={Truck} color="blue" small />
        <MetricCard title="Event Revenue" value={`€${metrics.eventRevenue.toFixed(2)}`} icon={Calendar} color="blue" small />
        <MetricCard title="Other Revenue" value={`€${metrics.otherRevenue.toFixed(2)}`} icon={TrendingUp} color="blue" small />
      </div>

      {/* Cost breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Operating Expenses" value={`€${metrics.operatingExpenses.toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Shipping Costs" value={`€${metrics.shippingCosts.toFixed(2)}`} icon={Truck} color="slate" small />
        <MetricCard title="Event Costs" value={`€${metrics.eventCosts.toFixed(2)}`} icon={Calendar} color="slate" small />
        <MetricCard title="Meat Purchases" value={`€${metrics.meatPurchases.toFixed(2)}`} icon={Package} color="slate" small />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdown metrics={metrics} />
        <ChannelBreakdown sales={filteredSales} />
      </div>

      {/* Data Source Debug Panel */}
      <div className="border rounded-lg overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
          onClick={() => setShowDebug(v => !v)}
        >
          <span>🔍 Data Source Debug</span>
          {showDebug ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showDebug && (
          <div className="px-4 py-4 text-xs font-mono space-y-1 bg-white text-slate-700">
            <p className="font-semibold text-slate-900 mb-2">Entity counts (active imported batches)</p>
            <p>Active sumup_sales batches found: <strong>{debugInfo.salesBatchCount}</strong></p>
            <p>Active bank_transactions batches found: <strong>{debugInfo.bankBatchCount}</strong></p>
            <p>Total SalesRecord rows in DB: <strong>{debugInfo.totalSalesRows}</strong></p>
            <p>Active SumUp Sales rows (batch matched): <strong>{debugInfo.activeSalesRows}</strong></p>
            <p>Rows excluded (reverted/wrong batch): <strong>{debugInfo.revertedRows}</strong></p>
            <p>Active Article rows: <strong>{debugInfo.articleRows}</strong></p>
            <p>Active SumUp Transaction rows: <strong>{debugInfo.transactionRows}</strong></p>
            <p>Active Bank rows: <strong>{debugInfo.bankRows}</strong></p>
            <div className="border-t mt-2 pt-2">
              <p className="font-semibold text-slate-900 mb-1">Month filter</p>
              <p>Selected month: <strong>{selectedMonth || "(none yet)"}</strong></p>
              <p>Available months: <strong>{availableMonths.join(", ") || "(none)"}</strong></p>
              <p>Sales rows matching selected month: <strong>{debugComputed.matchingCount}</strong></p>
              <p>Rows with no month field: <strong>{debugInfo.noMonthRows}</strong></p>
            </div>
            <div className="border-t mt-2 pt-2">
              <p className="font-semibold text-slate-900 mb-1">Revenue fields (filtered rows)</p>
              <p>Sum of net_amount_ex_vat / net_ex_vat: <strong>€{debugComputed.netSum.toFixed(2)}</strong></p>
              <p>Sum of gross_amount_inc_vat / gross_inc_vat: <strong>€{debugComputed.grossSum.toFixed(2)}</strong></p>
              <p>Sum of vat_amount / vat: <strong>€{debugComputed.vatSum.toFixed(2)}</strong></p>
              <p>Rows missing net amount field: <strong>{debugComputed.noNetField}</strong></p>
              <p>Dashboard revenue source: <strong>SalesRecord.net_amount_ex_vat (with fallback to net_ex_vat)</strong></p>
              <p>Dashboard total revenue shown: <strong>€{metrics.totalRevenue.toFixed(2)}</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}