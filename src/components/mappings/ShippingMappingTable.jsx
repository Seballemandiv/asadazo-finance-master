import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];

export default function ShippingMappingTable() {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ShippingMapping.list().then(r => { setRecords(r); setLoading(false); });
  }, []);

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => setEditingId(null);
  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const saveEdit = async () => {
    await base44.entities.ShippingMapping.update(editingId, editForm);
    setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...editForm } : r));
    setEditingId(null);
  };

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        {loading ? <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                {["Product Name", "Method", "Channel", "Status", ""].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => editingId === r.id ? (
                <tr key={r.id} className="border-t bg-blue-50">
                  <td className="px-3 py-2 text-xs">{r.product_name}</td>
                  <td className="px-3 py-1.5"><Select value={editForm.method || ""} onValueChange={v => set("method", v)}>
                    <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Method" /></SelectTrigger>
                    <SelectContent>{["Standard", "Express", "Pickup"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select></td>
                  <td className="px-3 py-1.5"><Select value={editForm.channel || ""} onValueChange={v => set("channel", v)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select></td>
                  <td className="px-3 py-1.5"><Select value={editForm.status || "OK"} onValueChange={v => set("status", v)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select></td>
                  <td className="px-3 py-1.5"><div className="flex gap-1">
                    <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
                  </div></td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => startEdit(r)}>
                  <td className="px-3 py-2 text-xs font-medium">{r.product_name}</td>
                  <td className="px-3 py-2 text-xs">{r.method}</td>
                  <td className="px-3 py-2 text-xs">{r.channel}</td>
                  <td className="px-3 py-2 text-xs">{r.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">Edit</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}