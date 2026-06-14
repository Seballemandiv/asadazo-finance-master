import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const colorMap = {
  green: "text-green-600 bg-green-50",
  red: "text-red-600 bg-red-50",
  orange: "text-orange-600 bg-orange-50",
  blue: "text-blue-600 bg-blue-50",
  slate: "text-slate-600 bg-slate-100",
};

export default function MetricCard({ title, value, icon: Icon, color = "slate", subtitle, small }) {
  const colors = colorMap[color] || colorMap.slate;
  return (
    <Card className={small ? "shadow-none border" : "shadow-sm"}>
      <CardContent className={small ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-muted-foreground truncate ${small ? "text-xs" : "text-sm"}`}>{title}</p>
            <p className={`font-bold tabular-nums mt-1 ${small ? "text-lg" : "text-2xl"}`}>{value}</p>
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