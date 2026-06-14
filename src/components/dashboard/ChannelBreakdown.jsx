import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = { "Online Shop": "#3b82f6", "Event": "#f59e0b", "Wholesale": "#10b981", "Other": "#94a3b8" };

export default function ChannelBreakdown({ sales }) {
  const data = useMemo(() => {
    const byChannel = {};
    for (const r of sales) {
      if (r.mapping_status === "Ignore") continue;
      const ch = r.channel || "Other";
      byChannel[ch] = (byChannel[ch] || 0) + (r.net_ex_vat || 0);
    }
    return Object.entries(byChannel).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [sales]);

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue by Channel</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No channel data
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Revenue by Channel (ex VAT)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `€${v}`} />
            <Tooltip formatter={(v) => `€${v.toFixed(2)}`} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => <Cell key={i} fill={COLORS[d.name] || "#94a3b8"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}