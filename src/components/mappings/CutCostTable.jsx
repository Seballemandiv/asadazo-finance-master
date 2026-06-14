import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export default function CutCostTable() {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.CutCost.list().then(r => { setRecords(r); setLoading(false); });
  }, []);

  const startEdit = (r) => { setEditingId(r.id); setEditForm({ ...r }); };
  const cancelEdit = () => setEditingId(null);
  const set = (k, v) => setEditForm(f => ({ ...f, [k]: v }));

  const saveEdit = async () => {
    await base44.entities.CutCost.update(editingId, editForm);
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
                {["Cut", "Cost/kg (€)", "Selling Price/kg (€)", "Source", "Notes", ""].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => editingId === r.id ? (
                <tr key={r.id} className="border-t bg-blue-50">
                  <td className="px-3 py-2 text-xs font-medium">{r.cut}</td>
                  <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" type="number" step="0.01" value={editForm.cost_per_kg ?? 0} onChange={e => set("cost_per_kg", parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-3 py-1.5"><Input className="h-7 text-xs w-24" type="number" step="0.01" value={editForm.selling_price_per_kg ?? 0} onChange={e => set("selling_price_per_kg", parseFloat(e.target.value) || 0)} /></td>
                  <td className="px-3 py-1.5"><Input className="h-7 text-xs w-28" value={editForm.source || ""} onChange={e => set("source", e.target.value)} /></td>
                  <td className="px-3 py-1.5"><Input className="h-7 text-xs w-40" value={editForm.notes || ""} onChange={e => set("notes", e.target.value)} /></td>
                  <td className="px-3 py-1.5"><div className="flex gap-1">
                    <Button size="icon" className="h-7 w-7" onClick={saveEdit}><Check className="w-3 h-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
                  </div></td>
                </tr>
              ) : (
                <tr key={r.id} className="border-t hover:bg-muted/20 cursor-pointer" onClick={() => startEdit(r)}>
                  <td className="px-3 py-2 text-xs font-medium">{r.cut}</td>
                  <td className="px-3 py-2 text-xs">€{r.cost_per_kg?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs">€{r.selling_price_per_kg?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs">{r.source}</td>
                  <td className="px-3 py-2 text-xs">{r.notes}</td>
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