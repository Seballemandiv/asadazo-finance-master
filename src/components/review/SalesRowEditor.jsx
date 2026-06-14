import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { getSalesNetExVat, getSalesProductName, getSalesQuantity } from "@/lib/cogsEngine";

const REVENUE_TYPES = ["Meat", "Box", "Shipping", "Event", "Custom Revenue", "Other Revenue"];
const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];

export default function SalesRowEditor({ record, mappings, cutCosts, onSave, onCancel }) {
  const [form, setForm] = useState({
    revenue_type: record.revenue_type || "",
    channel: record.channel || "",
    cut: record.cut || "",
    kg_per_unit: record.kg_per_unit ?? 0,
    cost_per_kg: record.cost_per_kg ?? 0,
    mapping_status: record.mapping_status || "To review",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const qty = getSalesQuantity(record);
  const net = getSalesNetExVat(record);
  const needsCogs = ["Meat", "Box", "Event"].includes(form.revenue_type);
  const previewCogs = needsCogs
    ? qty * (parseFloat(form.kg_per_unit) || 0) * (parseFloat(form.cost_per_kg) || 0)
    : 0;

  const handleSave = () => {
    const revenueType = form.revenue_type;
    const meatCogs = ["Meat", "Box", "Event"].includes(revenueType)
      ? qty * (parseFloat(form.kg_per_unit) || 0) * (parseFloat(form.cost_per_kg) || 0)
      : 0;

    const productRevenue = ["Meat", "Box", "Custom Revenue"].includes(revenueType) ? net : 0;
    const shippingRevenue = revenueType === "Shipping" ? net : 0;
    const eventRevenue = revenueType === "Event" ? net : 0;
    const otherRevenue = revenueType === "Other Revenue" ? net : 0;

    onSave({
      ...form,
      kg_per_unit: parseFloat(form.kg_per_unit) || 0,
      cost_per_kg: parseFloat(form.cost_per_kg) || 0,
      meat_cogs: meatCogs,
      product_revenue_ex_vat: form.mapping_status === "Ignore" ? 0 : productRevenue,
      shipping_revenue_ex_vat: form.mapping_status === "Ignore" ? 0 : shippingRevenue,
      event_revenue_ex_vat: form.mapping_status === "Ignore" ? 0 : eventRevenue,
      other_revenue_ex_vat: form.mapping_status === "Ignore" ? 0 : otherRevenue,
      review_flag: form.mapping_status === "OK" ? 0 : 1,
    });
  };

  return (
    <tr className="border-t bg-blue-50">
      <td className="px-3 py-2 text-xs whitespace-nowrap">{(record.transaction_date || record.date)?.slice(0, 10)}</td>
      <td className="px-3 py-2 text-xs max-w-[180px] truncate">{getSalesProductName(record)}</td>
      <td className="px-3 py-2 text-xs">{qty}</td>
      <td className="px-3 py-2 text-xs">€{net.toFixed(2)}</td>
      <td className="px-3 py-2">
        <Select value={form.channel} onValueChange={v => set("channel", v)}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select value={form.revenue_type} onValueChange={v => set("revenue_type", v)}>
          <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{REVENUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input className="h-7 text-xs w-24" value={form.cut} onChange={e => set("cut", e.target.value)} placeholder="Cut" />
      </td>
      <td className="px-3 py-2">
        <Input className="h-7 text-xs w-16" type="number" step="0.01" value={form.kg_per_unit} onChange={e => set("kg_per_unit", e.target.value)} />
      </td>
      <td className="px-3 py-2">
        <Input className="h-7 text-xs w-20" type="number" step="0.01" value={form.cost_per_kg} onChange={e => set("cost_per_kg", e.target.value)} />
      </td>
      <td className="px-3 py-2 text-xs">
        €{previewCogs.toFixed(2)}
      </td>
      <td className="px-3 py-2">
        <Select value={form.mapping_status} onValueChange={v => set("mapping_status", v)}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button size="icon" className="h-7 w-7" onClick={handleSave}><Check className="w-3 h-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}><X className="w-3 h-3" /></Button>
        </div>
      </td>
    </tr>
  );
}
