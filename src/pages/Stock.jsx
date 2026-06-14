import React from "react";
import { Package } from "lucide-react";

export default function Stock() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stock</h1>
        <p className="text-muted-foreground text-sm mt-1">Asadazo · Inventory module</p>
      </div>

      <div className="rounded-lg border bg-card p-10 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="rounded-full bg-[#FFF7EA] border border-[#F4BE6E]/60 p-4 mb-4">
          <Package className="w-8 h-8 text-[#611111]" />
        </div>
        <h2 className="text-lg font-semibold">Stock module coming next</h2>
        <p className="text-sm text-muted-foreground max-w-xl mt-2">
          This page is intentionally empty for now. The next version can connect meat purchases, monthly prices, supplier invoices, stock received, stock sold, and remaining inventory by product/provider.
        </p>
      </div>
    </div>
  );
}
