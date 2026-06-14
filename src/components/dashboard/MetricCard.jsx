import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const colorMap = {
  green: "text-[#611111] bg-[#FFF7EA] border border-[#F4BE6E]/60",
  red: "text-[#611111] bg-[#F4BE6E]/25 border border-[#611111]/20",
  orange: "text-[#450A0A] bg-[#F4BE6E]/35 border border-[#F4BE6E]/70",
  blue: "text-[#611111] bg-[#FFF7EA] border border-[#F4BE6E]/60",
  slate: "text-[#171111] bg-[#FFF7EA] border border-[#F4BE6E]/40",
};

export default function MetricCard({ title, value, icon: Icon, color = "slate", subtitle, small }) {
  const colors = colorMap[color] || colorMap.slate;
  return (
    <Card className={small ? "shadow-none border bg-card" : "shadow-sm border bg-card"}>
      <CardContent className={small ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-muted-foreground truncate ${small ? "text-xs" : "text-sm"}`}>{title}</p>
            <p className={`font-bold tabular-nums mt-1 text-[#171111] ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`rounded-lg p-2 flex-shrink-0 ${colors}`}>
            <Icon className={small ? "w-4 h-4" : "w-5 h-5"} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
