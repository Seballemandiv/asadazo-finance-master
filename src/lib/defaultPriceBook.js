import { normalizeProductName } from "./cogsEngine";

const TRANSPORT_DEFAULT = 1.61036492333859;
const PACKAGING_DEFAULT = 2.7;

function row({
  product_name,
  package_label,
  sku,
  provider = "Adrian",
  cut,
  kg_per_unit,
  cost_fca = 0,
  transport_per_unit = TRANSPORT_DEFAULT,
  packaging_per_unit = PACKAGING_DEFAULT,
  cost_per_kg,
  sale_price_inc_vat = 0,
  vat_amount = 0,
  notes = "",
}) {
  const kg = Number(kg_per_unit || 0);
  const cogsPerKg = Number(cost_per_kg || 0);
  return {
    product_name,
    provider,
    package_label,
    sku,
    cut,
    kg_per_unit: kg,
    cost_fca: Number(cost_fca || 0),
    transport_per_unit: Number(transport_per_unit || 0),
    packaging_per_unit: Number(packaging_per_unit || 0),
    landed_cost_per_unit: kg > 0 ? cogsPerKg * kg : cogsPerKg,
    landed_cost_per_kg: cogsPerKg,
    cost_per_kg: cogsPerKg,
    sale_price_inc_vat: Number(sale_price_inc_vat || 0),
    vat_amount: Number(vat_amount || 0),
    source: "Prices updated.xlsx seed",
    status: "OK",
    notes,
  };
}

// Important COGS convention:
// cost_per_kg = Cost DAP AMS per kg from the price sheet.
// COGS = quantity sold × kg_per_unit × cost_per_kg.
// This avoids the previous mistake where a 0.360kg chorizo pack used 10.81 / 0.36 = 30.03 €/kg.
export const DEFAULT_PRICE_BOOK_ROWS = [
  // Adrian / standard Asadazo products
  row({ product_name: "Asado BANDERITA", package_label: "1 KG", sku: "ASA001", provider: "Adrian", cut: "Asado banderita", kg_per_unit: 1, cost_fca: 11.88, transport_per_unit: 0, cost_per_kg: 14.58, sale_price_inc_vat: 30.8, vat_amount: 2.772 }),
  row({ product_name: "Asado banderita - 1.2 Kg aprox.", package_label: "1.2 KG", sku: "ASA001", provider: "Adrian", cut: "Asado banderita", kg_per_unit: 1.2, cost_fca: 11.88, cost_per_kg: 16.19, sale_price_inc_vat: 30.8, vat_amount: 2.772, notes: "Alias for SumUp product name." }),
  row({ product_name: "Bife de Chorizo", package_label: "0.5 KG", sku: "ASA002", provider: "Adrian", cut: "Bife de chorizo", kg_per_unit: 0.5, cost_fca: 9.95, cost_per_kg: 14.26, sale_price_inc_vat: 29.99, vat_amount: 2.6991 }),
  row({ product_name: "Colita de Cuadril", package_label: "1 KG", sku: "ASA003", provider: "Adrian", cut: "Colita de cuadril", kg_per_unit: 1, cost_fca: 22.26, cost_per_kg: 26.57, sale_price_inc_vat: 42.8, vat_amount: 3.852 }),
  row({ product_name: "Entraña", package_label: "0.5 KG", sku: "ASA004", provider: "Adrian", cut: "Entraña", kg_per_unit: 0.5, cost_fca: 12.9, cost_per_kg: 17.21, sale_price_inc_vat: 29.4, vat_amount: 2.646 }),
  row({ product_name: "Entraña - 0,500 Kg aprox.", package_label: "0.5 KG", sku: "ASA004", provider: "Adrian", cut: "Entraña", kg_per_unit: 0.5, cost_fca: 12.9, cost_per_kg: 17.21, sale_price_inc_vat: 29.4, vat_amount: 2.646, notes: "Alias for SumUp product name." }),
  row({ product_name: "Entraña -1 Kg aprox", package_label: "1 KG", sku: "ASA004", provider: "Adrian", cut: "Entraña", kg_per_unit: 1, cost_fca: 12.9, cost_per_kg: 17.21, sale_price_inc_vat: 29.4, vat_amount: 2.646, notes: "Alias for SumUp product name." }),
  row({ product_name: "Bola de lomo", package_label: "1 KG", sku: "ASA017", provider: "Adrian", cut: "Bola de lomo", kg_per_unit: 1, cost_fca: 15.9, cost_per_kg: 20.21, sale_price_inc_vat: 30.6, vat_amount: 2.754 }),
  row({ product_name: "Bola de lomo para Milanesa - 1 Kg aprox.", package_label: "1 KG", sku: "ASA017", provider: "Adrian", cut: "Bola de lomo", kg_per_unit: 1, cost_fca: 15.9, cost_per_kg: 20.21, sale_price_inc_vat: 30.6, vat_amount: 2.754, notes: "Alias for SumUp product name." }),
  row({ product_name: "Nalga", package_label: "1 KG", sku: "ASA005", provider: "Adrian", cut: "Nalga", kg_per_unit: 1, cost_fca: 15.9, cost_per_kg: 20.21, sale_price_inc_vat: 30.8, vat_amount: 2.772 }),
  row({ product_name: "Matambre de novillo", package_label: "1 KG", sku: "ASA006", provider: "Adrian", cut: "Matambre", kg_per_unit: 1, cost_fca: 15.84, cost_per_kg: 20.15, sale_price_inc_vat: 40, vat_amount: 3.6 }),
  row({ product_name: "Milanesa de bola de lomo - 1 Kg aprox (10 - 12 pieces)", package_label: "1 KG", sku: "ASA008", provider: "Adrian", cut: "Milanesa", kg_per_unit: 1, cost_fca: 17.11, cost_per_kg: 21.42, sale_price_inc_vat: 35.9, vat_amount: 3.231 }),
  row({ product_name: "Milanesa de entraña - 1Kg", package_label: "1 KG", sku: "ASA009", provider: "Adrian", cut: "Milanesa", kg_per_unit: 1, cost_fca: 17.11, cost_per_kg: 21.42, sale_price_inc_vat: 35.9, vat_amount: 3.231 }),
  row({ product_name: "Vacio", package_label: "1.2 KG", sku: "ASA010", provider: "Adrian", cut: "Vacío", kg_per_unit: 1.2, cost_fca: 11.88, cost_per_kg: 16.19, sale_price_inc_vat: 30.8, vat_amount: 2.772 }),
  row({ product_name: "Vacío parrillero - 1.2 Kg aprox.", package_label: "1.2 KG", sku: "ASA010", provider: "Adrian", cut: "Vacío", kg_per_unit: 1.2, cost_fca: 11.88, cost_per_kg: 16.19, sale_price_inc_vat: 30.8, vat_amount: 2.772, notes: "Alias for SumUp product name." }),
  row({ product_name: "Vacio", package_label: "2 KG", sku: "ASA017", provider: "Adrian", cut: "Vacío", kg_per_unit: 2, cost_fca: 19.8, cost_per_kg: 24.11, sale_price_inc_vat: 50.8, vat_amount: 4.572 }),
  row({ product_name: "Vacío Parrillero - 2 Kg aprox", package_label: "2 KG", sku: "ASA017", provider: "Adrian", cut: "Vacío", kg_per_unit: 2, cost_fca: 19.8, cost_per_kg: 24.11, sale_price_inc_vat: 50.8, vat_amount: 4.572, notes: "Alias for SumUp product name." }),
  row({ product_name: "Matambre de Cerdo", package_label: "1 KG", sku: "ASA011", provider: "Adrian", cut: "Matambre", kg_per_unit: 1, cost_fca: 13.86, cost_per_kg: 18.17, sale_price_inc_vat: 32.2, vat_amount: 2.898 }),
  row({ product_name: "Matambre de cerdo - 1.4 Kg aprox.", package_label: "1.4 KG", sku: "ASA011", provider: "Adrian", cut: "Matambre", kg_per_unit: 1.4, cost_fca: 13.86, cost_per_kg: 18.17, sale_price_inc_vat: 32.2, vat_amount: 2.898, notes: "Alias for SumUp product name." }),
  row({ product_name: "Chorizo criollo adrian 1 KG", package_label: "1 KG", sku: "ASA012", provider: "Adrian", cut: "Chorizo criollo", kg_per_unit: 1, cost_fca: 6.5, cost_per_kg: 10.81, sale_price_inc_vat: 21.33, vat_amount: 1.9197 }),
  row({ product_name: "Chorizo criollo Argentino - 0.360 Kg aprox.", package_label: "0.360 KG", sku: "ASA012", provider: "Adrian", cut: "Chorizo criollo", kg_per_unit: 0.36, cost_fca: 6.5, cost_per_kg: 10.81, sale_price_inc_vat: 21.33, vat_amount: 1.9197, notes: "Alias for SumUp product name. Cost is 10.81 €/kg, not 10.81 per 0.360kg pack." }),
  row({ product_name: "Salchicha Parrillera", package_label: "1 KG", sku: "ASA013", provider: "Adrian", cut: "Salchicha parrillera", kg_per_unit: 1, cost_fca: 6.5, cost_per_kg: 10.81, sale_price_inc_vat: 19.6, vat_amount: 1.764 }),
  row({ product_name: "Chinchu", package_label: "0.5 KG", sku: "ASA014", provider: "Adrian", cut: "Chinchulín", kg_per_unit: 0.5, cost_fca: 3.95, cost_per_kg: 8.26, sale_price_inc_vat: 18.93, vat_amount: 1.7037 }),
  row({ product_name: "Chinchulin - 1 Kg aprox.", package_label: "1 KG", sku: "ASA014", provider: "Adrian", cut: "Chinchulín", kg_per_unit: 1, cost_fca: 3.95, cost_per_kg: 8.26, sale_price_inc_vat: 18.93, vat_amount: 1.7037, notes: "Alias for SumUp product name." }),
  row({ product_name: "Molleja de Corazon", package_label: "0.5 KG", sku: "ASA015", provider: "Adrian", cut: "Molleja", kg_per_unit: 0.5, cost_fca: 8.95, cost_per_kg: 13.26, sale_price_inc_vat: 25, vat_amount: 2.25 }),
  row({ product_name: "Molleja de corazón - 0.500 Kg aprox.", package_label: "0.5 KG", sku: "ASA015", provider: "Adrian", cut: "Molleja", kg_per_unit: 0.5, cost_fca: 8.95, cost_per_kg: 13.26, sale_price_inc_vat: 25, vat_amount: 2.25, notes: "Alias for SumUp product name." }),
  row({ product_name: "Morcilla Argentina", package_label: "0.5 KG", sku: "ASA016", provider: "Adrian", cut: "Morcilla", kg_per_unit: 0.5, cost_fca: 6.5, cost_per_kg: 10.81, sale_price_inc_vat: 19.6, vat_amount: 1.764 }),
  row({ product_name: "Morcilla Argentina - 0.500 Kg aprox.", package_label: "0.5 KG", sku: "ASA016", provider: "Adrian", cut: "Morcilla", kg_per_unit: 0.5, cost_fca: 6.5, cost_per_kg: 10.81, sale_price_inc_vat: 19.6, vat_amount: 1.764, notes: "Alias for SumUp product name." }),

  // La Maxima products kept separate by provider/name.
  row({ product_name: "Costillar 7C LA MAXIMA", package_label: "4.5 KG", sku: "ASLM001", provider: "La Maxima", cut: "Costillar", kg_per_unit: 4.5, cost_fca: 53.55, cost_per_kg: 12.86, sale_price_inc_vat: 180, vat_amount: 16.2, notes: "Large pack: DAP 57.86 per unit / 4.5kg." }),
  row({ product_name: "Medialuna de vacio LA MAXIMA", package_label: "1 KG", sku: "ASLM002", provider: "La Maxima", cut: "Vacío", kg_per_unit: 1, cost_fca: 21.5, cost_per_kg: 25.81, sale_price_inc_vat: 46.8, vat_amount: 4.212 }),
  row({ product_name: "Chorizo Criollo LA MAXIMA", package_label: "0.36 KG", sku: "ASLM003", provider: "La Maxima", cut: "Chorizo criollo", kg_per_unit: 0.36, cost_fca: 7.25, cost_per_kg: 11.56, sale_price_inc_vat: 21.33, vat_amount: 1.9197 }),
  row({ product_name: "Molleja de corazon LA MAXIMA", package_label: "0.5 KG", sku: "ASLM004", provider: "La Maxima", cut: "Molleja", kg_per_unit: 0.5, cost_fca: 11.5, cost_per_kg: 15.81, sale_price_inc_vat: 32.5, vat_amount: 2.925 }),
  row({ product_name: "Morcilla LA MAXIMA", package_label: "1 KG", sku: "ASLM005", provider: "La Maxima", cut: "Morcilla", kg_per_unit: 1, cost_fca: 5.65, cost_per_kg: 9.96, sale_price_inc_vat: 21, vat_amount: 1.89 }),
  row({ product_name: "Bife de chorizo LA MAXIMA", package_label: "0.250 KG", sku: "ASLM010", provider: "La Maxima", cut: "Bife de chorizo", kg_per_unit: 0.25, cost_fca: 13.4, cost_per_kg: 17.71, sale_price_inc_vat: 39.9, vat_amount: 3.591 }),
  row({ product_name: "Asado banderita LA MAXIMA", package_label: "1 KG", sku: "ASLM011", provider: "La Maxima", cut: "Asado banderita", kg_per_unit: 1, cost_fca: 14.8, cost_per_kg: 19.11, sale_price_inc_vat: 40, vat_amount: 3.6 }),
  row({ product_name: "Matambre de cerdo LA MAXIMA", package_label: "1 KG", sku: "ASLM012", provider: "La Maxima", cut: "Matambre", kg_per_unit: 1, cost_fca: 12.75, cost_per_kg: 17.06, sale_price_inc_vat: 36.9, vat_amount: 3.321 }),
  row({ product_name: "chinchulin LA MAXIMA", package_label: "1 KG", sku: "ASLM013", provider: "La Maxima", cut: "Chinchulín", kg_per_unit: 1, cost_fca: 7.9, cost_per_kg: 12.21, sale_price_inc_vat: 42.9, vat_amount: 3.861 }),
  row({ product_name: "Entraña fina uruguay LA MAXIMA", package_label: "1.5 KG", sku: "ASLM014", provider: "La Maxima", cut: "Entraña", kg_per_unit: 1.5, cost_fca: 22.9, cost_per_kg: 27.21, sale_price_inc_vat: 64.9, vat_amount: 5.841 }),

  // Boxes: cost_per_kg is total box cost divided by box kg.
  row({ product_name: "ACHURAS BOX", package_label: "4 KG", sku: "AB001", provider: "Mixed", cut: "Box", kg_per_unit: 4, transport_per_unit: 0, packaging_per_unit: 0, cost_per_kg: 64.66218954 / 4, sale_price_inc_vat: 119, vat_amount: 10.71 }),
  row({ product_name: "MILANESA BOX", package_label: "6 KG", sku: "AB003", provider: "Mixed", cut: "Box", kg_per_unit: 6, transport_per_unit: 0, packaging_per_unit: 0, cost_per_kg: 84.84145969 / 6, sale_price_inc_vat: 199, vat_amount: 17.91 }),
  row({ product_name: "PREMIUM PARRILLA BOX", package_label: "7 KG", sku: "AB004", provider: "Mixed", cut: "Box", kg_per_unit: 7, transport_per_unit: 0, packaging_per_unit: 0, cost_per_kg: 120.3432843 / 7, sale_price_inc_vat: 259, vat_amount: 23.31 }),
];

export function withMonth(rows, month) {
  return rows.map(r => ({ ...r, month }));
}

export function samePriceKey(a, b) {
  return normalizeProductName(a.product_name) === normalizeProductName(b.product_name)
    && String(a.month || "") === String(b.month || "")
    && String(a.package_label || "") === String(b.package_label || "")
    && String(a.provider || "") === String(b.provider || "");
}
