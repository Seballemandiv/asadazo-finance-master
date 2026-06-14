import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, X, Trash2 } from "lucide-react";

const COST_TYPES = ["Operating Expense","Car rental NL","Transport Spain to Amsterdam","Expense Refund","Shipping Cost","Event Cost","Meat Purchase","Payment Processor Payout","Refund","Owner Payment","Loan In / Payback","Loan Out","Transfer / Reconciliation","Manual Review","Ignore"];
const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];
const PNL_TYPES = ["Operating Expense", "Shipping Cost", "Event Cost", "Car rental NL", "Transport Spain to Amsterdam"];

export default function BankRowEditor({ record, eventOptions = [], onSave, onCancel, onRemove }) {
  const amountOut = Number(record.amount_out || 0);
  const amountIn = Number(record.amount_in || 0);
  const [form, setForm] = useState({
    cost_type: record.cost_type || "",
    channel: record.channel || "",
    event_id: record.event_id || "",
    review_status: record.review_status || "To review",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const needsEvent = form.cost_type === "Event Cost" || form.channel === "Event";
  const selectedEvent = eventOptions.find(e => e.id === form.event_id);

  const handleSave = () => {
    const expenseRefund = form.cost_type === "Expense Refund" ? amountIn : 0;
    const eventCost = form.cost_type === "Event Cost" ? amountOut : 0;
    const nextStatus = needsEvent && !selectedEvent ? "To review" : form.review_status;
    onSave({
      cost_type: form.cost_type,
      channel: form.channel,
      event_id: selectedEvent?.id || "",
      event_name: selectedEvent?.name || "",
      review_status: nextStatus,
      counted_expense: PNL_TYPES.includes(form.cost_type) ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      shipping_cost: form.cost_type === "Shipping Cost" ? amountOut : 0,
      operating_expenses: form.cost_type === "Operating Expense" ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      car_rental_nl: form.cost_type === "Car rental NL" ? amountOut - amountIn : 0,
      transport_spain_to_amsterdam: form.cost_type === "Transport Spain to Amsterdam" ? amountOut - amountIn : 0,
      event_cost: eventCost,
      meat_purchase: form.cost_type === "Meat Purchase" ? amountOut : 0,
      refund_amount: form.cost_type === "Refund" ? amountOut : 0,
      expense_refund_amount: expenseRefund || (["Car rental NL", "Transport Spain to Amsterdam"].includes(form.cost_type) ? amountIn : 0),
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
      <td className="px-3 py-2"><Select value={form.cost_type} onValueChange={v => set("cost_type", v)}><SelectTrigger className="h-7 text-xs w-56"><SelectValue placeholder="Cost / cash type" /></SelectTrigger><SelectContent>{COST_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></td>
      <td className="px-3 py-2"><Select value={form.channel} onValueChange={v => set("channel", v)}><SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="Channel" /></SelectTrigger><SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></td>
      <td className="px-3 py-2">{needsEvent ? <Select value={form.event_id || ""} onValueChange={v => set("event_id", v)}><SelectTrigger className="h-7 text-xs w-52"><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent>{eventOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select> : <span className="text-xs text-muted-foreground">—</span>}</td>
      <td className="px-3 py-2"><Select value={form.review_status} onValueChange={v => set("review_status", v)}><SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></td>
      <td className="px-3 py-2"><div className="flex gap-1"><Button size="icon" className="h-7 w-7" onClick={handleSave}><Check className="w-3 h-3" /></Button>{onRemove && <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => onRemove(record.id)}><Trash2 className="w-3 h-3" /></Button>}<Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}><X className="w-3 h-3" /></Button></div></td>
    </tr>
  );
}
