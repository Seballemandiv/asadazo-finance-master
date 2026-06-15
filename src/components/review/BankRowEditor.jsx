import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, X, Trash2 } from "lucide-react";

const COST_TYPES = ["Operating Expense", "Car rental NL", "Transport Spain to Amsterdam", "Expense Refund", "Shipping Cost", "Event Cost", "Meat Purchase", "Payment Employees", "Payment Processor Payout", "Refund", "Owner Payment", "Loan In / Payback", "Loan Out", "Transfer / Reconciliation", "Manual Review", "Ignore"];
const MODULES = ["Online Shop", "Event", "Wholesale", "Other"];
const CHANNELS = ["Product", "Shipping", "Marketing", "Car rental NL", "Transport Spain to Amsterdam", "Payment Employees", "Chef Table Experience", "Private Dining", "Stock / Supplier", "Tools & Equipment", "Admin", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];
const PNL_TYPES = ["Operating Expense", "Shipping Cost", "Event Cost", "Payment Employees", "Car rental NL", "Transport Spain to Amsterdam"];

function inferModule(record) {
  if (record.module) return record.module;
  if (record.channel === "Event" || record.cost_type === "Event Cost" || record.event_id) return "Event";
  if (record.channel === "Wholesale") return "Wholesale";
  if (record.channel === "Online Shop") return "Online Shop";
  return "Other";
}

function inferChannel(record) {
  if (record.channel && !["Online Shop", "Event", "Wholesale"].includes(record.channel)) return record.channel;
  if (record.cost_type === "Payment Employees") return "Payment Employees";
  if (record.cost_type === "Shipping Cost") return "Shipping";
  if (record.cost_type === "Meat Purchase") return "Stock / Supplier";
  if (record.cost_type === "Car rental NL") return "Car rental NL";
  if (record.cost_type === "Transport Spain to Amsterdam") return "Transport Spain to Amsterdam";
  return "Other";
}

export default function BankRowEditor({ record, eventOptions = [], onSave, onCancel, onRemove }) {
  const amountOut = Number(record.amount_out || 0);
  const amountIn = Number(record.amount_in || 0);
  const [form, setForm] = useState({ cost_type: record.cost_type || "", module: inferModule(record), channel: inferChannel(record), event_id: record.event_id || "", review_status: record.review_status || "To review" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const needsEvent = form.module === "Event" || form.cost_type === "Event Cost";
  const selectedEvent = eventOptions.find(e => e.id === form.event_id);

  const handleSave = () => {
    const expenseRefund = form.cost_type === "Expense Refund" ? amountIn : 0;
    const eventCost = form.cost_type === "Event Cost" || form.module === "Event" ? amountOut : 0;
    const employeePayment = form.cost_type === "Payment Employees" || form.channel === "Payment Employees" ? amountOut : 0;
    const nextStatus = needsEvent && !selectedEvent ? "To review" : form.review_status;
    onSave({
      cost_type: form.cost_type,
      module: form.module,
      channel: form.channel,
      event_id: selectedEvent?.id || "",
      event_name: selectedEvent?.name || "",
      review_status: nextStatus,
      counted_expense: PNL_TYPES.includes(form.cost_type) ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      shipping_cost: form.cost_type === "Shipping Cost" ? amountOut : 0,
      operating_expenses: form.cost_type === "Operating Expense" || form.cost_type === "Payment Employees" ? amountOut : (form.cost_type === "Expense Refund" ? -expenseRefund : 0),
      car_rental_nl: form.cost_type === "Car rental NL" ? amountOut - amountIn : 0,
      transport_spain_to_amsterdam: form.cost_type === "Transport Spain to Amsterdam" ? amountOut - amountIn : 0,
      event_cost: eventCost,
      employee_payment: employeePayment,
      meat_purchase: form.cost_type === "Meat Purchase" ? amountOut : 0,
      refund_amount: form.cost_type === "Refund" ? amountOut : 0,
      expense_refund_amount: expenseRefund || (["Car rental NL", "Transport Spain to Amsterdam"].includes(form.cost_type) ? amountIn : 0),
    });
  };

  return (
    <tr className="border-t bg-blue-50/70">
      <td colSpan={9} className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 rounded-lg border bg-card p-3">
          <div className="md:col-span-3 text-xs text-muted-foreground"><div className="font-medium text-foreground truncate">{record.reference || record.payment_ref || "Bank row"}</div><div>{record.date} · out €{amountOut.toFixed(2)} · in €{amountIn.toFixed(2)}</div></div>
          <Field label="Cost / Cash Type" className="md:col-span-2"><Select value={form.cost_type} onValueChange={v => set("cost_type", v)}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent>{COST_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Module" className="md:col-span-2"><Select value={form.module} onValueChange={v => set("module", v)}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Module" /></SelectTrigger><SelectContent>{MODULES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Channel" className="md:col-span-2"><Select value={form.channel} onValueChange={v => set("channel", v)}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Channel" /></SelectTrigger><SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Event" className="md:col-span-2">{needsEvent ? <Select value={form.event_id || ""} onValueChange={v => set("event_id", v)}><SelectTrigger className="h-10 text-xs"><SelectValue placeholder="Select event" /></SelectTrigger><SelectContent>{eventOptions.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select> : <div className="h-10 flex items-center text-xs text-muted-foreground">Only for Event module</div>}</Field>
          <Field label="Status" className="md:col-span-1"><Select value={form.review_status} onValueChange={v => set("review_status", v)}><SelectTrigger className="h-10 text-xs"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></Field>
          <div className="md:col-span-12 flex justify-end gap-2"><Button size="sm" onClick={handleSave}><Check className="w-4 h-4 mr-1" /> Save</Button>{onRemove && <Button size="sm" variant="destructive" onClick={() => onRemove(record.id)}><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>}<Button size="sm" variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-1" /> Cancel</Button></div>
        </div>
      </td>
    </tr>
  );
}

function Field({ label, children, className = "" }) {
  return <label className={`space-y-1 ${className}`}><div className="text-[11px] font-medium text-muted-foreground">{label}</div>{children}</label>;
}
