import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Search } from "lucide-react";

const REVENUE_TYPES = ["Meat", "Box", "Shipping", "Event", "Custom Revenue", "Other Revenue"];
const CHANNELS = ["Online Shop", "Event", "Wholesale", "Other"];
const STATUSES = ["OK", "To review", "Ignore"];

export default function ProductMappingTable() {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ProductMapping.list().then(r => { setRecords(r); setLoading(false); });
  }, []);

  const filtered = records.filter(r =>
    !search || r.product_name?.toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    await base44.entities.ProductMapping.update(editingId, editForm);
    setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...editForm } : r));
    setEditingId(null);
  };

  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const statusColor = { "OK": "text-green-700", "To review": "text-yellow-600", "Ignore": "text-slate-500" };

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search product..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {loading ? <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">Loading…</div> : (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  {["Product Name", "Revenue Type", "Channel", "Cut", "kg/unit", "Cost/kg", "Status", ""].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => editingId === r.id ? (
                  <tr key={r.id} className="border-t bg-blue-50">
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate">{r.product_name}</td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.revenue_type || ""} onValueChange={v => set("revenue_type", v)}>
                        <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{REVENUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.channel || ""} onValueChange={v => set("channel", v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" value={editForm.cut || ""} onChange={e => set("cut", e.target.value)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-16" type="number" step="0.01" value={editForm.kg_per_unit ?? 0} onChange={e => set("kg_per_unit", parseFloat(e.target.value) || 0)} /></td>
                    <td className="px-3 py-1.5"><Input className="h-7 text-xs w-20" type="number" step="0.01" value={editForm.cost_per_kg ?? 0} onChange={e => set("cost_per_kg", parseFloat(e.target.value) || 0)} /></td>
                    <td className="px-3 py-1.5">
                      <Select value={editForm.status || "To review"} onValueChange={v => set("status", v)}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-1">
                        <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => startEdit(r)}>
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate font-medium">{r.product_name}</td>
                    <td className="px-3 py-2 text-xs">{r.revenue_type}</td>
                    <td className="px-3 py-2 text-xs">{r.channel}</td>
                    <td className="px-3 py-2 text-xs">{r.cut}</td>
                    <td className="px-3 py-2 text-xs">{r.kg_per_unit}</td>
                    <td className="px-3 py-2 text-xs">{r.cost_per_kg}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`font-medium ${statusColor[r.status] || ""}`}>{r.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Edit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}