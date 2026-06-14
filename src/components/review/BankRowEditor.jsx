import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, X, Trash2 } from "lucide-react";

const COST_TYPES = [
  "Operating Expense",
  "Expense Refund",
  "Shipping Cost",
  "Event Cost",
  "Meat Purchase",
  "Payment Processor Payout",
  "Refund",
  "Owner Payment",
  "Loan In / Payback",
  "Loan Out",
  "Transfer / Reconciliation",
  "Manual Review",
  "Ignore",
];
const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];

function isPnlExpense(costType) {
  return ["Operating Expense", "Shipping Cost", "Event Cost"].includes(costType);
}

export default function BankRowEditor({ record, onSave, onCancel, onRemove }) {
  const amountOut = Number(record.amount_out || 0);
  const amountIn = Number(record.amount_in || 0);
  const [form, setForm] = useState({
    cost_type: record.cost_type || "",
    channel: record.channel || "",
    review_status: record.review_status || "To review",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const expenseRefund = form.cost_type === "Expense Refund" ? amountIn : 0;

    onSave({
      ...form,
      counted_expense: isPnlExpense(form.cost_type) ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      shipping_cost: form.cost_type === "Shipping Cost" ? amountOut : 0,
      operating_expenses: form.cost_type === "Operating Expense" ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      event_cost: form.cost_type === "Event Cost" ? amountOut : 0,
      meat_purchase: form.cost_type === "Meat Purchase" ? amountOut : 0,
      refund_amount: form.cost_type === "Refund" ? amountOut : 0,
      expense_refund_amount: expenseRefund,
    });
  };

  return (
    <tr className="border-t bg-blue-50">
      <td className="px-3 py-2 text-xs whitespace-nowrap">{record.date}</td>
      <td className="px-3 py-2 text-xs">{record.type}</td>
      <td className="px-3 py-2 text-xs max-w-[160px] truncate">{record.reference}</td>
      <td className="px-3 py-2 text-xs max-w-[140px] truncate">{record.payment_ref}</td>
      <td className="px-3 py-2 text-xs text-destructive">{amountOut > 0 ? `€${amountOut.toFixed(2)}` : ""}</td>
      <td className="px-3 py-2 text-xs text-green-700">{amountIn > 0 ? `€${amountIn.toFixed(2)}` : ""}</td>
      <td className="px-3 py-2">
        <Select value={form.cost_type} onValueChange={v => set("cost_type", v)}>
          <SelectTrigger className="h-7 text-xs w-52"><SelectValue placeholder="Cost / cash type" /></SelectTrigger>
          <SelectContent>{COST_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select value={form.channel} onValueChange={v => set("channel", v)}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select value={form.review_status} onValueChange={v => set("review_status", v)}>
          <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button size="icon" className="h-7 w-7" onClick={handleSave} title="Save"><Check className="w-3 h-3" /></Button>
          {onRemove && <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onRemove(record.id)} title="Remove from finance"><Trash2 className="w-3 h-3" /></Button>}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel} title="Cancel"><X className="w-3 h-3" /></Button>
        </div>
      </td>
    </tr>
  );
}
