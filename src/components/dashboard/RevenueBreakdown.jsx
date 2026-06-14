import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"];

export default function RevenueBreakdown({ metrics }) {
  const data = [
    { name: "Product", value: metrics.productRevenue },
    { name: "Shipping", value: metrics.shippingRevenue },
    { name: "Event", value: metrics.eventRevenue },
    { name: "Other", value: metrics.otherRevenue },
    { name: "Unmapped / review", value: metrics.unmappedRevenue || 0 },
  ].filter(d => d.value > 0);

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue Breakdown</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No revenue data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue Breakdown (ex VAT)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => `€${Number(v).toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
