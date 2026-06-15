import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

const BUDGET_CATEGORIES = ["Food", "Drinks", "Grill", "Serving", "Setup", "Staff", "Transport", "Marketing", "Cleaning", "Safety", "Venue", "Other"];
const BUDGET_STATUSES = ["To buy", "To confirm", "Ordered", "Paid", "Delivered", "Done", "Cancelled"];

const DEFAULT_MENU = [
  { menu_item: "Choripan", selling_price_inc_vat: 13, vat_rate: 9 },
  { menu_item: "Bondiola sandwich", selling_price_inc_vat: 14, vat_rate: 9 },
  { menu_item: "Vacio sandwich", selling_price_inc_vat: 15, vat_rate: 9 },
  { menu_item: "Veggie plate", selling_price_inc_vat: 13, vat_rate: 9 },
  { menu_item: "Tasting plate chico", selling_price_inc_vat: 25, vat_rate: 9 },
  { menu_item: "Tasting plate grande", selling_price_inc_vat: 35, vat_rate: 9 },
  { menu_item: "Chori veggie", selling_price_inc_vat: 13, vat_rate: 9 },
  { menu_item: "Chocotorta", selling_price_inc_vat: 6, vat_rate: 9 },
];

const DEFAULT_RECIPES = [
  { menu_item: "Choripan", cut: "Chorizo", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 10.81 },
  { menu_item: "Bondiola sandwich", cut: "Bondiola", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 6.50 },
  { menu_item: "Vacio sandwich", cut: "Vacio", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 14.58 },
  { menu_item: "Tasting plate chico", cut: "Chorizo", provider: "Adrian", grams_per_unit: 60, cost_per_kg: 10.81 },
  { menu_item: "Tasting plate chico", cut: "Bondiola", provider: "Adrian", grams_per_unit: 60, cost_per_kg: 6.50 },
  { menu_item: "Tasting plate chico", cut: "Vacio", provider: "Adrian", grams_per_unit: 60, cost_per_kg: 14.58 },
  { menu_item: "Tasting plate grande", cut: "Chorizo", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 10.81 },
  { menu_item: "Tasting plate grande", cut: "Bondiola", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 6.50 },
  { menu_item: "Tasting plate grande", cut: "Vacio", provider: "Adrian", grams_per_unit: 120, cost_per_kg: 14.58 },
];

function n(value) {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}
function money(value) { return `€${Number(value || 0).toFixed(2)}`; }
function exVatFromInc(priceInc, vatRate) { return n(priceInc) / (1 + n(vatRate) / 100); }
function ask(label, current = "") { return window.prompt(label, current ?? ""); }
function normalize(value) { return String(value || "").trim().toLowerCase(); }

export default function EventPlanner({ event, actualMetrics }) {
  const [budgetItems, setBudgetItems] = useState([]);
  const [menuRows, setMenuRows] = useState([]);
  const [recipeRows, setRecipeRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadPlanner = async () => {
    if (!event?.id) return;
    setLoading(true);
    const [budget, menu, recipes] = await Promise.all([
      base44.entities.EventBudgetItem ? base44.entities.EventBudgetItem.filter({ event_id: event.id }) : [],
      base44.entities.EventMenuForecast ? base44.entities.EventMenuForecast.filter({ event_id: event.id }) : [],
      base44.entities.EventRecipeItem ? base44.entities.EventRecipeItem.filter({ event_id: event.id }) : [],
    ]);
    setBudgetItems(budget.filter(r => r.is_active !== false));
    setMenuRows(menu.filter(r => r.is_active !== false));
    setRecipeRows(recipes.filter(r => r.is_active !== false));
    setLoading(false);
  };

  useEffect(() => { loadPlanner(); }, [event?.id]);

  const menuByName = useMemo(() => {
    const map = new Map();
    for (const row of menuRows) map.set(normalize(row.menu_item), row);
    return map;
  }, [menuRows]);

  const forecast = useMemo(() => {
    const budgetExVat = budgetItems.reduce((s, r) => s + n(r.unit_price_ex_vat) * n(r.quantity), 0);
    const budgetIncVat = budgetItems.reduce((s, r) => s + n(r.unit_price_ex_vat) * n(r.quantity) * (1 + n(r.vat_rate) / 100), 0);
    const expectedRevenueExVat = menuRows.reduce((s, r) => s + n(r.expected_units) * exVatFromInc(r.selling_price_inc_vat, r.vat_rate), 0);
    const expectedRevenueIncVat = menuRows.reduce((s, r) => s + n(r.expected_units) * n(r.selling_price_inc_vat), 0);
    const actualManualRevenueExVat = menuRows.reduce((s, r) => s + n(r.actual_units) * exVatFromInc(r.selling_price_inc_vat, r.vat_rate), 0);
    const meatRows = recipeRows.map(recipe => {
      const menu = menuByName.get(normalize(recipe.menu_item));
      const expectedUnits = n(menu?.expected_units);
      const requiredKg = expectedUnits * n(recipe.grams_per_unit) / 1000;
      const cogs = requiredKg * n(recipe.cost_per_kg);
      return { ...recipe, expectedUnits, requiredKg, cogs };
    });
    const meatCogs = meatRows.reduce((s, r) => s + r.cogs, 0);
    const meatByCut = new Map();
    for (const row of meatRows) {
      const key = `${row.cut || "Unknown"}${row.provider ? ` · ${row.provider}` : ""}`;
      const prev = meatByCut.get(key) || { cut: row.cut || "Unknown", provider: row.provider || "", requiredKg: 0, cogs: 0 };
      prev.requiredKg += row.requiredKg;
      prev.cogs += row.cogs;
      meatByCut.set(key, prev);
    }
    const grossProfit = expectedRevenueExVat - meatCogs;
    const forecastProfit = expectedRevenueExVat - meatCogs - budgetExVat;
    return { budgetExVat, budgetIncVat, expectedRevenueExVat, expectedRevenueIncVat, actualManualRevenueExVat, meatRows, meatByCut: Array.from(meatByCut.values()), meatCogs, grossProfit, forecastProfit };
  }, [budgetItems, menuRows, recipeRows, menuByName]);

  const ownersActual = n(actualMetrics?.eventProfit) / 3;
  const ownersForecast = forecast.forecastProfit / 3;

  const seedDefaults = async () => {
    if (!event?.id) return;
    const existingMenu = new Set(menuRows.map(r => normalize(r.menu_item)));
    const existingRecipe = new Set(recipeRows.map(r => `${normalize(r.menu_item)}|${normalize(r.cut)}`));
    const createdMenu = [];
    const createdRecipes = [];
    for (const item of DEFAULT_MENU) {
      if (existingMenu.has(normalize(item.menu_item))) continue;
      createdMenu.push(await base44.entities.EventMenuForecast.create({ ...item, event_id: event.id, event_name: event.name, expected_units: 0, actual_units: 0, is_active: true }));
    }
    for (const recipe of DEFAULT_RECIPES) {
      const key = `${normalize(recipe.menu_item)}|${normalize(recipe.cut)}`;
      if (existingRecipe.has(key)) continue;
      createdRecipes.push(await base44.entities.EventRecipeItem.create({ ...recipe, event_id: event.id, event_name: event.name, is_active: true }));
    }
    setMenuRows(prev => [...prev, ...createdMenu]);
    setRecipeRows(prev => [...prev, ...createdRecipes]);
  };

  const addBudgetItem = async () => {
    const item = ask("Budget/checklist item", "Charcoal"); if (!item) return;
    const category = ask(`Category (${BUDGET_CATEGORIES.join(", ")})`, "Food") || "Other";
    const unit_price_ex_vat = n(ask("Unit price ex VAT", "0"));
    const quantity = n(ask("Quantity / hours", "1"));
    const vat_rate = n(ask("VAT %", "21"));
    const supplier = ask("Supplier / from", "") || "";
    const payment_method = ask("Payment method", "") || "";
    const status = ask(`Status (${BUDGET_STATUSES.join(", ")})`, "To buy") || "To buy";
    const responsible_person = ask("Responsible person", "") || "";
    const notes = ask("Notes", "") || "";
    const row = await base44.entities.EventBudgetItem.create({ event_id: event.id, event_name: event.name, item, category: BUDGET_CATEGORIES.includes(category) ? category : "Other", unit_price_ex_vat, quantity, vat_rate, supplier, payment_method, status: BUDGET_STATUSES.includes(status) ? status : "To buy", responsible_person, notes, is_active: true });
    setBudgetItems(prev => [...prev, row]);
  };

  const editBudgetItem = async (row) => {
    const item = ask("Budget/checklist item", row.item); if (item === null) return;
    const category = ask(`Category (${BUDGET_CATEGORIES.join(", ")})`, row.category || "Other"); if (category === null) return;
    const unit_price_ex_vat = n(ask("Unit price ex VAT", row.unit_price_ex_vat));
    const quantity = n(ask("Quantity / hours", row.quantity));
    const vat_rate = n(ask("VAT %", row.vat_rate));
    const supplier = ask("Supplier / from", row.supplier || "") || "";
    const payment_method = ask("Payment method", row.payment_method || "") || "";
    const status = ask(`Status (${BUDGET_STATUSES.join(", ")})`, row.status || "To buy") || "To buy";
    const responsible_person = ask("Responsible person", row.responsible_person || "") || "";
    const notes = ask("Notes", row.notes || "") || "";
    const updates = { item, category: BUDGET_CATEGORIES.includes(category) ? category : "Other", unit_price_ex_vat, quantity, vat_rate, supplier, payment_method, status: BUDGET_STATUSES.includes(status) ? status : "To buy", responsible_person, notes };
    await base44.entities.EventBudgetItem.update(row.id, updates);
    setBudgetItems(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
  };

  const deleteBudgetItem = async (row) => {
    await base44.entities.EventBudgetItem.update(row.id, { is_active: false, status: "Cancelled" });
    setBudgetItems(prev => prev.filter(r => r.id !== row.id));
  };

  const addMenuItem = async () => {
    const menu_item = ask("Menu item", "Choripan"); if (!menu_item) return;
    const selling_price_inc_vat = n(ask("Selling price inc VAT", "13"));
    const vat_rate = n(ask("VAT %", "9"));
    const expected_units = n(ask("Expected units", "0"));
    const actual_units = n(ask("Actual units (optional)", "0"));
    const row = await base44.entities.EventMenuForecast.create({ event_id: event.id, event_name: event.name, menu_item, selling_price_inc_vat, vat_rate, expected_units, actual_units, is_active: true });
    setMenuRows(prev => [...prev, row]);
  };

  const editMenuItem = async (row) => {
    const menu_item = ask("Menu item", row.menu_item); if (menu_item === null) return;
    const selling_price_inc_vat = n(ask("Selling price inc VAT", row.selling_price_inc_vat));
    const vat_rate = n(ask("VAT %", row.vat_rate));
    const expected_units = n(ask("Expected units", row.expected_units));
    const actual_units = n(ask("Actual units", row.actual_units));
    const updates = { menu_item, selling_price_inc_vat, vat_rate, expected_units, actual_units };
    await base44.entities.EventMenuForecast.update(row.id, updates);
    setMenuRows(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
  };

  const deleteMenuItem = async (row) => {
    await base44.entities.EventMenuForecast.update(row.id, { is_active: false });
    setMenuRows(prev => prev.filter(r => r.id !== row.id));
  };

  const addRecipeItem = async () => {
    const menu_item = ask("Menu item this recipe belongs to", menuRows[0]?.menu_item || "Choripan"); if (!menu_item) return;
    const cut = ask("Meat cut", "Chorizo"); if (!cut) return;
    const provider = ask("Provider", "Adrian") || "";
    const grams_per_unit = n(ask("Grams per unit", "120"));
    const cost_per_kg = n(ask("Cost per kg", "0"));
    const row = await base44.entities.EventRecipeItem.create({ event_id: event.id, event_name: event.name, menu_item, cut, provider, grams_per_unit, cost_per_kg, is_active: true });
    setRecipeRows(prev => [...prev, row]);
  };

  const editRecipeItem = async (row) => {
    const menu_item = ask("Menu item this recipe belongs to", row.menu_item); if (menu_item === null) return;
    const cut = ask("Meat cut", row.cut); if (cut === null) return;
    const provider = ask("Provider", row.provider || "") || "";
    const grams_per_unit = n(ask("Grams per unit", row.grams_per_unit));
    const cost_per_kg = n(ask("Cost per kg", row.cost_per_kg));
    const updates = { menu_item, cut, provider, grams_per_unit, cost_per_kg };
    await base44.entities.EventRecipeItem.update(row.id, updates);
    setRecipeRows(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
  };

  const deleteRecipeItem = async (row) => {
    await base44.entities.EventRecipeItem.update(row.id, { is_active: false });
    setRecipeRows(prev => prev.filter(r => r.id !== row.id));
  };

  if (!event?.id) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Forecast Revenue ex VAT</div><div className="text-lg font-semibold">{money(forecast.expectedRevenueExVat)}</div><div className="text-xs text-muted-foreground">inc VAT {money(forecast.expectedRevenueIncVat)}</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Forecast Meat COGS</div><div className="text-lg font-semibold">{money(forecast.meatCogs)}</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Budget Costs ex VAT</div><div className="text-lg font-semibold">{money(forecast.budgetExVat)}</div><div className="text-xs text-muted-foreground">inc VAT {money(forecast.budgetIncVat)}</div></div>
        <div className="rounded-lg border bg-card p-4"><div className="text-xs text-muted-foreground">Forecast Event Profit</div><div className={`text-lg font-semibold ${forecast.forecastProfit >= 0 ? "text-green-700" : "text-red-700"}`}>{money(forecast.forecastProfit)}</div></div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold">Owners Profit Distribution</h2><p className="text-xs text-muted-foreground">This is shown after profit. It is not subtracted as a cost.</p></div></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Actual Event Profit</div><div className="font-semibold">{money(actualMetrics?.eventProfit || 0)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Seba</div><div className="font-semibold">{money(ownersActual)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Javi</div><div className="font-semibold">{money(ownersActual)}</div></div>
          <div className="rounded-lg border p-3"><div className="text-muted-foreground text-xs">Asadazo</div><div className="font-semibold">{money(ownersActual)}</div></div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Forecast split per part: {money(ownersForecast)} each.</p>
      </div>

      <div className="border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold">Sales Forecast</h2><p className="text-xs text-muted-foreground">Expected units × selling price. Use Seed Template to create the standard Asadazo event menu.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={seedDefaults}>Seed Forecast Template</Button><Button size="sm" variant="outline" onClick={addMenuItem}><Plus className="w-4 h-4 mr-1" /> Add Menu Item</Button><Button size="sm" variant="ghost" onClick={loadPlanner}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button></div></div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Menu Item</th><th className="px-2 py-2 text-right">Price inc VAT</th><th className="px-2 py-2 text-right">VAT %</th><th className="px-2 py-2 text-right">Expected Units</th><th className="px-2 py-2 text-right">Expected Rev ex VAT</th><th className="px-2 py-2 text-right">Actual Units</th><th className="px-2 py-2 text-right">Manual Actual Rev</th><th className="px-2 py-2"></th></tr></thead><tbody>{menuRows.map(row => <tr key={row.id} className="border-t"><td className="px-2 py-2">{row.menu_item}</td><td className="px-2 py-2 text-right">{money(row.selling_price_inc_vat)}</td><td className="px-2 py-2 text-right">{n(row.vat_rate).toFixed(0)}%</td><td className="px-2 py-2 text-right">{n(row.expected_units)}</td><td className="px-2 py-2 text-right">{money(n(row.expected_units) * exVatFromInc(row.selling_price_inc_vat, row.vat_rate))}</td><td className="px-2 py-2 text-right">{n(row.actual_units)}</td><td className="px-2 py-2 text-right">{money(n(row.actual_units) * exVatFromInc(row.selling_price_inc_vat, row.vat_rate))}</td><td className="px-2 py-2 text-right"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editMenuItem(row)}><Pencil className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMenuItem(row)}><Trash2 className="w-3 h-3" /></Button></td></tr>)}</tbody></table>{!menuRows.length && <p className="text-sm text-muted-foreground text-center py-8">No forecast menu yet.</p>}</div>
      </div>

      <div className="border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold">Meat Forecast</h2><p className="text-xs text-muted-foreground">Expected units × grams per recipe = required kilos. Tasting chico defaults to 180g total; grande to 360g total.</p></div><Button size="sm" variant="outline" onClick={addRecipeItem}><Plus className="w-4 h-4 mr-1" /> Add Recipe Row</Button></div>
        <div className="grid md:grid-cols-3 gap-3 mb-4">{forecast.meatByCut.map(row => <div key={`${row.cut}-${row.provider}`} className="rounded-lg border p-3"><div className="font-medium text-sm">{row.cut}{row.provider ? ` · ${row.provider}` : ""}</div><div className="text-xs text-muted-foreground mt-1">Required kg</div><div className="font-semibold">{row.requiredKg.toFixed(2)} kg</div><div className="text-xs text-muted-foreground mt-1">Forecast COGS: {money(row.cogs)}</div></div>)}</div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Menu Item</th><th className="px-2 py-2 text-left">Cut</th><th className="px-2 py-2 text-left">Provider</th><th className="px-2 py-2 text-right">g/unit</th><th className="px-2 py-2 text-right">Expected Units</th><th className="px-2 py-2 text-right">Required kg</th><th className="px-2 py-2 text-right">Cost/kg</th><th className="px-2 py-2 text-right">COGS</th><th className="px-2 py-2"></th></tr></thead><tbody>{forecast.meatRows.map(row => <tr key={row.id} className="border-t"><td className="px-2 py-2">{row.menu_item}</td><td className="px-2 py-2">{row.cut}</td><td className="px-2 py-2">{row.provider}</td><td className="px-2 py-2 text-right">{n(row.grams_per_unit)}</td><td className="px-2 py-2 text-right">{row.expectedUnits}</td><td className="px-2 py-2 text-right">{row.requiredKg.toFixed(2)}</td><td className="px-2 py-2 text-right">{money(row.cost_per_kg)}</td><td className="px-2 py-2 text-right">{money(row.cogs)}</td><td className="px-2 py-2 text-right"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editRecipeItem(row)}><Pencil className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRecipeItem(row)}><Trash2 className="w-3 h-3" /></Button></td></tr>)}</tbody></table>{!recipeRows.length && <p className="text-sm text-muted-foreground text-center py-8">No recipe rows yet.</p>}</div>
      </div>

      <div className="border rounded-lg bg-card p-4">
        <div className="flex items-center justify-between gap-3 mb-3"><div><h2 className="font-semibold">Budget / Checklist</h2><p className="text-xs text-muted-foreground">Based on the Excel budget logic: category, item, quantity/hours, VAT, supplier, payment, status and RP.</p></div><Button size="sm" variant="outline" onClick={addBudgetItem}><Plus className="w-4 h-4 mr-1" /> Add Budget Item</Button></div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="px-2 py-2 text-left">Category</th><th className="px-2 py-2 text-left">Item</th><th className="px-2 py-2 text-right">Unit ex VAT</th><th className="px-2 py-2 text-right">Qty/Hrs</th><th className="px-2 py-2 text-right">Total ex VAT</th><th className="px-2 py-2 text-right">Total inc VAT</th><th className="px-2 py-2 text-left">Supplier</th><th className="px-2 py-2 text-left">Status</th><th className="px-2 py-2 text-left">RP</th><th className="px-2 py-2"></th></tr></thead><tbody>{budgetItems.map(row => { const totalEx = n(row.unit_price_ex_vat) * n(row.quantity); const totalInc = totalEx * (1 + n(row.vat_rate) / 100); return <tr key={row.id} className="border-t"><td className="px-2 py-2">{row.category}</td><td className="px-2 py-2 max-w-[220px] truncate">{row.item}</td><td className="px-2 py-2 text-right">{money(row.unit_price_ex_vat)}</td><td className="px-2 py-2 text-right">{n(row.quantity)}</td><td className="px-2 py-2 text-right">{money(totalEx)}</td><td className="px-2 py-2 text-right">{money(totalInc)}</td><td className="px-2 py-2">{row.supplier}</td><td className="px-2 py-2">{row.status}</td><td className="px-2 py-2">{row.responsible_person}</td><td className="px-2 py-2 text-right"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editBudgetItem(row)}><Pencil className="w-3 h-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteBudgetItem(row)}><Trash2 className="w-3 h-3" /></Button></td></tr>; })}</tbody></table>{!budgetItems.length && <p className="text-sm text-muted-foreground text-center py-8">No budget/checklist items yet.</p>}</div>
      </div>
    </div>
  );
}
