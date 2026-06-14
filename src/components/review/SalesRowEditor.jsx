import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

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

  const handleSave = () => {
    const meatCogs = form.revenue_type === "Meat"
      ? (record.qty || 1) * (parseFloat(form.kg_per_unit) || 0) * (parseFloat(form.cost_per_kg) || 0)
      : 0;

    const net = record.net_ex_vat || 0;
    const productRevenue = ["Meat", "Box", "Custom Revenue"].includes(form.revenue_type) ? net : 0;
    const shippingRevenue = form.revenue_type === "Shipping" ? net : 0;
    const eventRevenue = form.revenue_type === "Event" ? net : 0;
    const otherRevenue = form.revenue_type === "Other Revenue" ? net : 0;

    onSave({
      ...form,
      kg_per_unit: parseFloat(form.kg_per_unit) || 0,
      cost_per_kg: parseFloat(form.cost_per_kg) || 0,
      meat_cogs: meatCogs,
      product_revenue_ex_vat: productRevenue,
      shipping_revenue_ex_vat: shippingRevenue,
      event_revenue_ex_vat: eventRevenue,
      other_revenue_ex_vat: otherRevenue,
    });
  };

  return (
    <tr className="border-t bg-blue-50">
      <td className="px-3 py-2 text-xs whitespace-nowrap">{record.date?.slice(0, 10)}</td>
      <td className="px-3 py-2 text-xs max-w-[160px] truncate">{record.product}</td>
      <td className="px-3 py-2 text-xs">{record.qty}</td>
      <td className="px-3 py-2 text-xs">€{record.net_ex_vat?.toFixed(2)}</td>
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
      <td className="px-3 py-2 text-xs">
        €{(form.revenue_type === "Meat" ? (record.qty || 1) * (parseFloat(form.kg_per_unit) || 0) * (parseFloat(form.cost_per_kg) || 0) : 0).toFixed(2)}
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