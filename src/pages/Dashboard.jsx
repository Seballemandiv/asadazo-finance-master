import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, ShoppingBag, Package, Truck, Calendar } from "lucide-react";
import MetricCard from "@/components/dashboard/MetricCard";
import RevenueBreakdown from "@/components/dashboard/RevenueBreakdown";
import ChannelBreakdown from "@/components/dashboard/ChannelBreakdown";
import ReviewAlert from "@/components/dashboard/ReviewAlert";
import { computeMetrics } from "@/lib/financeCalc";

export default function Dashboard() {
  const [salesRecords, setSalesRecords] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load active ImportBatch IDs (status = "imported" only)
      const [allBatches, sales, bank] = await Promise.all([
        base44.entities.ImportBatch.filter({ status: "imported" }),
        base44.entities.SalesRecord.list("-date", 5000),
        base44.entities.BankTransaction.list("-date", 5000),
      ]);

      // Build set of active batch IDs
      // Only batches that come from sumup_sales drive revenue
      const salesBatchIds = new Set(
        allBatches.filter(b => b.import_type === "sumup_sales").map(b => b.id)
      );
      const bankBatchIds = new Set(
        allBatches.filter(b => b.import_type === "bank_transactions").map(b => b.id)
      );

      // Filter: only rows from active imported batches + is_active not false
      const activeSales = sales.filter(r =>
        r.is_active !== false &&
        (!r.import_batch_id || salesBatchIds.has(r.import_batch_id))
      );
      const activeBank = bank.filter(r =>
        r.is_active !== false &&
        (!r.import_batch_id || bankBatchIds.has(r.import_batch_id))
      );

      setSalesRecords(activeSales);
      setBankTransactions(activeBank);
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
    if (selectedMonth === "all") return salesRecords;
    return salesRecords.filter(r =>
      (r.accounting_month || r.month) === selectedMonth
    );
  }, [salesRecords, selectedMonth]);

  const filteredBank = useMemo(() => {
    if (selectedMonth === "all") return bankTransactions;
    return bankTransactions.filter(r =>
      (r.accounting_month || r.month) === selectedMonth
    );
  }, [bankTransactions, selectedMonth]);

  const metrics = useMemo(() => computeMetrics(filteredSales, filteredBank), [filteredSales, filteredBank]);

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
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {availableMonths.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Review alerts */}
      {(metrics.salesPendingReview > 0 || metrics.bankPendingReview > 0) && (
        <ReviewAlert salesCount={metrics.salesPendingReview} bankCount={metrics.bankPendingReview} />
      )}

      {/* COGS incomplete warning */}
      {metrics.unmappedCogs > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ COGS incomplete: {metrics.unmappedCogs} sales row(s) have Meat/Box revenue type but missing kg_per_unit — go to Review Sales to fix.
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
    </div>
  );
}