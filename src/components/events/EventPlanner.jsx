import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, RefreshCw, X } from "lucide-react";

const MENU = [["Choripan", 13], ["Bondiola sandwich", 14], ["Vacio sandwich", 15], ["Veggie plate", 13], ["Tasting plate chico", 25], ["Tasting plate grande", 35], ["Chori veggie", 13], ["Chocotorta", 6]];
const RECIPES = [["Choripan", "Chorizo", "Adrian", 120, 10.81], ["Bondiola sandwich", "Bondiola", "Adrian", 120, 6.50], ["Vacio sandwich", "Vacio", "Adrian", 120, 14.58], ["Tasting plate chico", "Chorizo", "Adrian", 60, 10.81], ["Tasting plate chico", "Bondiola", "Adrian", 60, 6.50], ["Tasting plate chico", "Vacio", "Adrian", 60, 14.58], ["Tasting plate grande", "Chorizo", "Adrian", 120, 10.81], ["Tasting plate grande", "Bondiola", "Adrian", 120, 6.50], ["Tasting plate grande", "Vacio", "Adrian", 120, 14.58]];
const CATS = ["Food", "Drinks", "Grill", "Serving", "Setup", "Staff", "Transport", "Marketing", "Cleaning", "Safety", "Venue", "Other"];
const STS = ["To buy", "To confirm", "Ordered", "Paid", "Delivered", "Done", "Cancelled"];
const n = v => { const x = Number(String(v ?? 0).replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const money = v => `€${n(v).toFixed(2)}`;
const exVat = (inc, vat = 9) => n(inc) / (1 + n(vat) / 100);
const norm = v => String(v || "").trim().toLowerCase();

export default function EventPlanner({ event, actualMetrics }) {
  const [budget, setBudget] = useState([]);
  const [menu, setMenu] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  async function load() {
    if (!event?.id) return;
    setLoading(true);
    const [b, m, r] = await Promise.all([
      base44.entities.EventBudgetItem?.filter({ event_id: event.id }) || [],
      base44.entities.EventMenuForecast?.filter({ event_id: event.id }) || [],
      base44.entities.EventRecipeItem?.filter({ event_id: event.id }) || [],
    ]);
    setBudget(b.filter(x => x.is_active !== false));
    setMenu(m.filter(x => x.is_active !== false));
    setRecipes(r.filter(x => x.is_active !== false));
    setLoading(false);
  }
  useEffect(() => { load(); }, [event?.id]);

  const calc = useMemo(() => {
    const menuMap = new Map(menu.map(x => [norm(x.menu_item), x]));
    const revenueEx = menu.reduce((s, x) => s + n(x.expected_units) * exVat(x.selling_price_inc_vat, x.vat_rate), 0);
    const budgetEx = budget.reduce((s, x) => s + n(x.unit_price_ex_vat) * n(x.quantity), 0);
    const budgetInc = budget.reduce((s, x) => s + n(x.unit_price_ex_vat) * n(x.quantity) * (1 + n(x.vat_rate) / 100), 0);
    const meatRows = recipes.map(x => { const units = n(menuMap.get(norm(x.menu_item))?.expected_units); const kg = units * n(x.grams_per_unit) / 1000; const cogs = kg * n(x.cost_per_kg); return { ...x, units, kg, cogs }; });
    const meatCogs = meatRows.reduce((s, x) => s + x.cogs, 0);
    const byCutMap = new Map();
    for (const x of meatRows) { const key = `${x.cut || "Unknown"} · ${x.provider || ""}`; const row = byCutMap.get(key) || { cut: x.cut || "Unknown", provider: x.provider || "", kg: 0, cogs: 0 }; row.kg += x.kg; row.cogs += x.cogs; byCutMap.set(key, row); }
    return { revenueEx, budgetEx, budgetInc, meatRows, byCut: [...byCutMap.values()], meatCogs, forecastProfit: revenueEx - meatCogs - budgetEx };
  }, [budget, menu, recipes]);

  async function seed() {
    const existingMenu = new Set(menu.map(x => norm(x.menu_item)));
    const existingRecipe = new Set(recipes.map(x => `${norm(x.menu_item)}|${norm(x.cut)}`));
    const newMenu = [];
    const newRecipes = [];
    for (const [menu_item, price] of MENU) if (!existingMenu.has(norm(menu_item))) newMenu.push(await base44.entities.EventMenuForecast.create({ event_id: event.id, event_name: event.name, menu_item, selling_price_inc_vat: price, vat_rate: 9, expected_units: 0, actual_units: 0, is_active: true }));
    for (const [menu_item, cut, provider, grams_per_unit, cost_per_kg] of RECIPES) if (!existingRecipe.has(`${norm(menu_item)}|${norm(cut)}`)) newRecipes.push(await base44.entities.EventRecipeItem.create({ event_id: event.id, event_name: event.name, menu_item, cut, provider, grams_per_unit, cost_per_kg, is_active: true }));
    setMenu(p => [...p, ...newMenu]); setRecipes(p => [...p, ...newRecipes]);
  }

  async function saveMenu(payload, row) { if (row) { await base44.entities.EventMenuForecast.update(row.id, payload); setMenu(p => p.map(x => x.id === row.id ? { ...x, ...payload } : x)); } else { const created = await base44.entities.EventMenuForecast.create({ ...payload, event_id: event.id, event_name: event.name, is_active: true }); setMenu(p => [...p, created]); } setEditing(null); }
  async function saveRecipe(payload, row) { if (row) { await base44.entities.EventRecipeItem.update(row.id, payload); setRecipes(p => p.map(x => x.id === row.id ? { ...x, ...payload } : x)); } else { const created = await base44.entities.EventRecipeItem.create({ ...payload, event_id: event.id, event_name: event.name, is_active: true }); setRecipes(p => [...p, created]); } setEditing(null); }
  async function saveBudget(payload, row) { if (row) { await base44.entities.EventBudgetItem.update(row.id, payload); setBudget(p => p.map(x => x.id === row.id ? { ...x, ...payload } : x)); } else { const created = await base44.entities.EventBudgetItem.create({ ...payload, event_id: event.id, event_name: event.name, is_active: true }); setBudget(p => [...p, created]); } setEditing(null); }
  async function delMenu(row) { await base44.entities.EventMenuForecast.update(row.id, { is_active: false }); setMenu(p => p.filter(x => x.id !== row.id)); }
  async function delRecipe(row) { await base44.entities.EventRecipeItem.update(row.id, { is_active: false }); setRecipes(p => p.filter(x => x.id !== row.id)); }
  async function delBudget(row) { await base44.entities.EventBudgetItem.update(row.id, { is_active: false, status: "Cancelled" }); setBudget(p => p.filter(x => x.id !== row.id)); }

  if (!event?.id) return null;
  const actualPart = n(actualMetrics?.eventProfit) / 3;
  const forecastPart = calc.forecastProfit / 3;

  return <div className="space-y-6">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4"><Box label="Forecast Revenue ex VAT" value={money(calc.revenueEx)} sub="From expected units" /><Box label="Forecast Meat COGS" value={money(calc.meatCogs)} /><Box label="Budget Costs ex VAT" value={money(calc.budgetEx)} sub={`inc VAT ${money(calc.budgetInc)}`} /><Box label="Forecast Event Profit" value={money(calc.forecastProfit)} tone={calc.forecastProfit >= 0 ? "green" : "red"} /></div>
    <div className="rounded-lg border bg-card p-4"><h2 className="font-semibold">Owners Profit Distribution</h2><p className="text-xs text-muted-foreground mb-3">Shown after profit; not subtracted as a cost.</p><div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm"><Box label="Actual Event Profit" value={money(actualMetrics?.eventProfit || 0)} /><Box label="Seba" value={money(actualPart)} /><Box label="Javi" value={money(actualPart)} /><Box label="Asadazo" value={money(actualPart)} /></div><p className="text-xs text-muted-foreground mt-2">Forecast split per part: {money(forecastPart)} each.</p></div>
    <Panel title="Sales Forecast" help="Expected units × selling price. Seed creates the standard Asadazo event menu."><div className="flex flex-wrap gap-2 mb-3"><Button size="sm" variant="outline" onClick={seed}>Seed Forecast Template</Button><Button size="sm" variant="outline" onClick={() => setEditing({ type: "menu" })}><Plus className="w-4 h-4 mr-1" /> Add Menu Item</Button><Button size="sm" variant="ghost" onClick={load}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button></div><Table heads={["Menu Item", "Price inc VAT", "Expected Units", "Expected Rev ex VAT", "Actual Units", "Actions"]}>{menu.map(row => <tr key={row.id} className="border-t"><Td>{row.menu_item}</Td><Td right>{money(row.selling_price_inc_vat)}</Td><Td right>{n(row.expected_units)}</Td><Td right>{money(n(row.expected_units) * exVat(row.selling_price_inc_vat, row.vat_rate))}</Td><Td right>{n(row.actual_units)}</Td><Actions onEdit={() => setEditing({ type: "menu", row })} onDelete={() => delMenu(row)} /></tr>)}</Table></Panel>
    <Panel title="Meat Forecast" help="Expected units × recipe grams = required kilos. Chico = 180g total; grande = 360g total."><div className="flex justify-end mb-3"><Button size="sm" variant="outline" onClick={() => setEditing({ type: "recipe" })}><Plus className="w-4 h-4 mr-1" /> Add Recipe Row</Button></div><div className="grid md:grid-cols-3 gap-3 mb-4">{calc.byCut.map(row => <div key={`${row.cut}-${row.provider}`} className="rounded-lg border p-3"><div className="font-medium text-sm">{row.cut}{row.provider ? ` · ${row.provider}` : ""}</div><div className="text-xs text-muted-foreground">Required</div><div className="font-semibold">{row.kg.toFixed(2)} kg</div><div className="text-xs text-muted-foreground">COGS {money(row.cogs)}</div></div>)}</div><Table heads={["Menu Item", "Cut", "Provider", "g/unit", "Required kg", "Cost/kg", "COGS", "Actions"]}>{calc.meatRows.map(row => <tr key={row.id} className="border-t"><Td>{row.menu_item}</Td><Td>{row.cut}</Td><Td>{row.provider}</Td><Td right>{n(row.grams_per_unit)}</Td><Td right>{row.kg.toFixed(2)}</Td><Td right>{money(row.cost_per_kg)}</Td><Td right>{money(row.cogs)}</Td><Actions onEdit={() => setEditing({ type: "recipe", row })} onDelete={() => delRecipe(row)} /></tr>)}</Table></Panel>
    <Panel title="Budget / Checklist" help="Budget logic from the Excel: category, item, qty/hours, VAT, supplier, payment, status and RP."><div className="flex justify-end mb-3"><Button size="sm" variant="outline" onClick={() => setEditing({ type: "budget" })}><Plus className="w-4 h-4 mr-1" /> Add Budget Item</Button></div><Table heads={["Category", "Item", "Unit ex VAT", "Qty/Hrs", "Total ex VAT", "Total inc VAT", "Supplier", "Status", "RP", "Actions"]}>{budget.map(row => { const totalEx = n(row.unit_price_ex_vat) * n(row.quantity); const totalInc = totalEx * (1 + n(row.vat_rate) / 100); return <tr key={row.id} className="border-t"><Td>{row.category}</Td><Td>{row.item}</Td><Td right>{money(row.unit_price_ex_vat)}</Td><Td right>{n(row.quantity)}</Td><Td right>{money(totalEx)}</Td><Td right>{money(totalInc)}</Td><Td>{row.supplier}</Td><Td>{row.status}</Td><Td>{row.responsible_person}</Td><Actions onEdit={() => setEditing({ type: "budget", row })} onDelete={() => delBudget(row)} /></tr>; })}</Table></Panel>
    {editing?.type === "menu" && <MenuForm row={editing.row} onCancel={() => setEditing(null)} onSave={payload => saveMenu(payload, editing.row)} />}
    {editing?.type === "recipe" && <RecipeForm row={editing.row} menu={menu} onCancel={() => setEditing(null)} onSave={payload => saveRecipe(payload, editing.row)} />}
    {editing?.type === "budget" && <BudgetForm row={editing.row} onCancel={() => setEditing(null)} onSave={payload => saveBudget(payload, editing.row)} />}
  </div>;
}

function Box({ label, value, sub, tone }) { return <div className="rounded-lg border bg-card p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-lg font-semibold ${tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : ""}`}>{value}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>; }
function Panel({ title, help, children }) { return <div className="border rounded-lg bg-card p-4"><h2 className="font-semibold">{title}</h2>{help && <p className="text-xs text-muted-foreground mb-3">{help}</p>}{children}</div>; }
function Table({ heads, children }) { return <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr>{heads.map(h => <th key={h} className="px-2 py-2 text-left font-medium whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
function Td({ children, right }) { return <td className={`px-2 py-2 ${right ? "text-right" : ""}`}>{children}</td>; }
function Actions({ onEdit, onDelete }) { return <td className="px-2 py-2 text-right whitespace-nowrap"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}><Pencil className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button></td>; }
function Sheet({ title, onCancel, children }) { return <div className="fixed inset-0 z-[80] bg-black/40 flex items-end md:items-center md:justify-center"><div className="bg-card w-full md:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl md:rounded-2xl border shadow-xl p-4 md:p-6"><div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">{title}</h3><Button size="icon" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button></div>{children}</div></div>; }
function Field({ label, children }) { return <label className="block text-sm font-medium space-y-1"><span>{label}</span>{children}</label>; }
function MenuForm({ row, onSave, onCancel }) { const [v, setV] = useState({ menu_item: row?.menu_item || "", selling_price_inc_vat: row?.selling_price_inc_vat ?? 0, vat_rate: row?.vat_rate ?? 9, expected_units: row?.expected_units ?? 0, actual_units: row?.actual_units ?? 0 }); const set = (k, x) => setV(p => ({ ...p, [k]: x })); return <Sheet title={row ? "Edit menu forecast" : "Add menu forecast"} onCancel={onCancel}><div className="grid gap-3"><Field label="Menu item"><Input value={v.menu_item} onChange={e => set("menu_item", e.target.value)} /></Field><Field label="Selling price inc VAT"><Input type="number" value={v.selling_price_inc_vat} onChange={e => set("selling_price_inc_vat", e.target.value)} /></Field><Field label="VAT %"><Input type="number" value={v.vat_rate} onChange={e => set("vat_rate", e.target.value)} /></Field><Field label="Expected units"><Input type="number" value={v.expected_units} onChange={e => set("expected_units", e.target.value)} /></Field><Field label="Actual units"><Input type="number" value={v.actual_units} onChange={e => set("actual_units", e.target.value)} /></Field><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave({ menu_item: v.menu_item, selling_price_inc_vat: n(v.selling_price_inc_vat), vat_rate: n(v.vat_rate), expected_units: n(v.expected_units), actual_units: n(v.actual_units) })}>Save</Button></div></div></Sheet>; }
function RecipeForm({ row, menu, onSave, onCancel }) { const [v, setV] = useState({ menu_item: row?.menu_item || menu[0]?.menu_item || "Choripan", cut: row?.cut || "", provider: row?.provider || "Adrian", grams_per_unit: row?.grams_per_unit ?? 120, cost_per_kg: row?.cost_per_kg ?? 0 }); const set = (k, x) => setV(p => ({ ...p, [k]: x })); return <Sheet title={row ? "Edit recipe row" : "Add recipe row"} onCancel={onCancel}><div className="grid gap-3"><Field label="Menu item"><Input value={v.menu_item} onChange={e => set("menu_item", e.target.value)} /></Field><Field label="Cut"><Input value={v.cut} onChange={e => set("cut", e.target.value)} /></Field><Field label="Provider"><Input value={v.provider} onChange={e => set("provider", e.target.value)} /></Field><Field label="Grams per unit"><Input type="number" value={v.grams_per_unit} onChange={e => set("grams_per_unit", e.target.value)} /></Field><Field label="Cost per kg"><Input type="number" value={v.cost_per_kg} onChange={e => set("cost_per_kg", e.target.value)} /></Field><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave({ menu_item: v.menu_item, cut: v.cut, provider: v.provider, grams_per_unit: n(v.grams_per_unit), cost_per_kg: n(v.cost_per_kg) })}>Save</Button></div></div></Sheet>; }
function BudgetForm({ row, onSave, onCancel }) { const [v, setV] = useState({ item: row?.item || "", category: row?.category || "Food", unit_price_ex_vat: row?.unit_price_ex_vat ?? 0, quantity: row?.quantity ?? 1, vat_rate: row?.vat_rate ?? 21, supplier: row?.supplier || "", payment_method: row?.payment_method || "", status: row?.status || "To buy", responsible_person: row?.responsible_person || "", notes: row?.notes || "" }); const set = (k, x) => setV(p => ({ ...p, [k]: x })); return <Sheet title={row ? "Edit budget/checklist item" : "Add budget/checklist item"} onCancel={onCancel}><div className="grid gap-3"><Field label="Item"><Input value={v.item} onChange={e => set("item", e.target.value)} /></Field><Field label="Category"><Select value={v.category} onValueChange={x => set("category", x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Unit price ex VAT"><Input type="number" value={v.unit_price_ex_vat} onChange={e => set("unit_price_ex_vat", e.target.value)} /></Field><Field label="Quantity / hours"><Input type="number" value={v.quantity} onChange={e => set("quantity", e.target.value)} /></Field><Field label="VAT %"><Input type="number" value={v.vat_rate} onChange={e => set("vat_rate", e.target.value)} /></Field><Field label="Supplier"><Input value={v.supplier} onChange={e => set("supplier", e.target.value)} /></Field><Field label="Payment method"><Input value={v.payment_method} onChange={e => set("payment_method", e.target.value)} /></Field><Field label="Status"><Select value={v.status} onValueChange={x => set("status", x)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Responsible person"><Input value={v.responsible_person} onChange={e => set("responsible_person", e.target.value)} /></Field><Field label="Notes"><Input value={v.notes} onChange={e => set("notes", e.target.value)} /></Field><div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={() => onSave({ ...v, unit_price_ex_vat: n(v.unit_price_ex_vat), quantity: n(v.quantity), vat_rate: n(v.vat_rate) })}>Save</Button></div></div></Sheet>; }
