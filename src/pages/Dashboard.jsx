import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ShoppingBag, Package, Truck, Calendar, AlertCircle } from "lucide-react";
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
      // Load active batch IDs first, then filter child records
      const [allBatches, sales, bank] = await Promise.all([
        base44.entities.ImportBatch.filter({ status: "imported" }),
        base44.entities.SalesRecord.list("-date", 5000),
        base44.entities.BankTransaction.list("-date", 5000),
      ]);
      const activeBatchIds = new Set(allBatches.map(b => b.id));
      // Only include records that belong to an active batch (or have no batch id = legacy, keep until reset)
      const activeSales = sales.filter(r => !r.import_batch_id || activeBatchIds.has(r.import_batch_id));
      const activeBank = bank.filter(r => !r.import_batch_id || activeBatchIds.has(r.import_batch_id));
      setSalesRecords(activeSales);
      setBankTransactions(activeBank);
      setLoading(false);
    };
    loadData();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set([
      ...salesRecords.map(r => r.month).filter(Boolean),
      ...bankTransactions.map(r => r.month).filter(Boolean),
    ]);
    return Array.from(months).sort().reverse();
  }, [salesRecords, bankTransactions]);

  const filteredSales = useMemo(() =>
    selectedMonth === "all" ? salesRecords : salesRecords.filter(r => r.month === selectedMonth),
    [salesRecords, selectedMonth]
  );

  const filteredBank = useMemo(() =>
    selectedMonth === "all" ? bankTransactions : bankTransactions.filter(r => r.month === selectedMonth),
    [bankTransactions, selectedMonth]
  );

  const metrics = useMemo(() => computeMetrics(filteredSales, filteredBank), [filteredSales, filteredBank]);

  const reviewCount = useMemo(() => ({
    sales: filteredSales.filter(r => r.mapping_status === "To review").length,
    bank: filteredBank.filter(r => r.review_status === "To review").length,
  }), [filteredSales, filteredBank]);

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
        <div className="flex items-center gap-2">
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
      </div>

      {/* Review alerts */}
      {(reviewCount.sales > 0 || reviewCount.bank > 0) && (
        <ReviewAlert salesCount={reviewCount.sales} bankCount={reviewCount.bank} />
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

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Product Revenue" value={`€${metrics.productRevenue.toFixed(2)}`} icon={ShoppingBag} color="blue" small />
        <MetricCard title="Shipping Revenue" value={`€${metrics.shippingRevenue.toFixed(2)}`} icon={Truck} color="blue" small />
        <MetricCard title="Event Revenue" value={`€${metrics.eventRevenue.toFixed(2)}`} icon={Calendar} color="blue" small />
        <MetricCard title="Other Revenue" value={`€${metrics.otherRevenue.toFixed(2)}`} icon={TrendingUp} color="blue" small />
      </div>

      {/* Costs breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Operating Expenses" value={`€${metrics.operatingExpenses.toFixed(2)}`} icon={TrendingDown} color="slate" small />
        <MetricCard title="Shipping Costs" value={`€${metrics.shippingCosts.toFixed(2)}`} icon={Truck} color="slate" small />
        <MetricCard title="Event Costs" value={`€${metrics.eventCosts.toFixed(2)}`} icon={Calendar} color="slate" small />
        <MetricCard title="Meat Purchases" value={`€${metrics.meatPurchases.toFixed(2)}`} icon={Package} color="slate" small />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueBreakdown metrics={metrics} />
        <ChannelBreakdown sales={filteredSales} />
      </div>
    </div>
  );
}