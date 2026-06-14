import { normalizeProductName } from "./cogsEngine";

const TRANSPORT_DEFAULT = 1.61036492333859;
const PACKAGING_DEFAULT = 2.7;

function row({ product_name, package_label, sku, cut, kg_per_unit, cost_fca = 0, transport_per_unit = TRANSPORT_DEFAULT, packaging_per_unit = PACKAGING_DEFAULT, landed_cost_per_unit, sale_price_inc_vat = 0, vat_amount = 0, notes = "" }) {
  const landed = Number(landed_cost_per_unit || 0);
  const kg = Number(kg_per_unit || 0);
  const landedKg = landed > 0 && kg > 0 ? landed / kg : 0;
  return {
    product_name,
    package_label,
    sku,
    cut,
    kg_per_unit: kg,
    cost_fca: Number(cost_fca || 0),
    transport_per_unit: Number(transport_per_unit || 0),
    packaging_per_unit: Number(packaging_per_unit || 0),
    landed_cost_per_unit: landed,
    landed_cost_per_kg: landedKg,
    cost_per_kg: landedKg,
    sale_price_inc_vat: Number(sale_price_inc_vat || 0),
    vat_amount: Number(vat_amount || 0),
    source: "prices.xlsx seed",
    status: "OK",
    notes,
  };
}

// Seeded from the uploaded prices.xlsx file. These are editable in the app after seeding.
// COGS uses landed_cost_per_kg = landed_cost_per_unit / kg_per_unit.
export const DEFAULT_PRICE_BOOK_ROWS = [
  row({ product_name: "Asado BANDERITA", package_label: "1.2 KG", sku: "ASA001", cut: "Asado banderita", kg_per_unit: 1.2, cost_fca: 11.88, landed_cost_per_unit: 16.19036492333859, sale_price_inc_vat: 30.8, vat_amount: 2.772, notes: "Asado banderita package. Landed unit cost corrected from price sheet formula references." }),
  row({ product_name: "Bife de Chorizo", package_label: "0.5 KG", sku: "ASA002", cut: "Bife de chorizo", kg_per_unit: 0.5, cost_fca: 9.95, landed_cost_per_unit: 14.260364923338586, sale_price_inc_vat: 29.99, vat_amount: 2.6991 }),
  row({ product_name: "Colita de Cuadril", package_label: "1 KG", sku: "ASA003", cut: "Colita de cuadril", kg_per_unit: 1, cost_fca: 22.26, landed_cost_per_unit: 26.570364923338586, sale_price_inc_vat: 42.8, vat_amount: 3.852 }),
  row({ product_name: "Entraña", package_label: "0.5 KG", sku: "ASA004", cut: "Entraña", kg_per_unit: 0.5, cost_fca: 12.9, landed_cost_per_unit: 17.21036492333859, sale_price_inc_vat: 29.4, vat_amount: 2.646 }),
  row({ product_name: "Bola de lomo", package_label: "1 KG", sku: "ASA017", cut: "Bola de lomo", kg_per_unit: 1, cost_fca: 15.9, landed_cost_per_unit: 20.21036492333859, sale_price_inc_vat: 30.6, vat_amount: 2.754 }),
  row({ product_name: "Nalga", package_label: "1 KG", sku: "ASA005", cut: "Nalga", kg_per_unit: 1, cost_fca: 15.9, landed_cost_per_unit: 20.210364923338586, sale_price_inc_vat: 30.8, vat_amount: 2.772 }),
  row({ product_name: "Matambre de novillo", package_label: "1 KG", sku: "ASA006", cut: "Matambre", kg_per_unit: 1, cost_fca: 15.84, landed_cost_per_unit: 20.15036492333859, sale_price_inc_vat: 40, vat_amount: 3.6 }),
  row({ product_name: "Vacio", package_label: "1.2 KG", sku: "ASA010", cut: "Vacío", kg_per_unit: 1.2, cost_fca: 11.88, landed_cost_per_unit: 16.19036492333859, sale_price_inc_vat: 30.8, vat_amount: 2.772 }),
  row({ product_name: "Vacio", package_label: "2 KG", sku: "ASA017", cut: "Vacío", kg_per_unit: 2, cost_fca: 19.8, landed_cost_per_unit: 24.110364923338586, sale_price_inc_vat: 50.8, vat_amount: 4.572 }),
  row({ product_name: "Matambre de Cerdo", package_label: "1 KG", sku: "ASA011", cut: "Matambre", kg_per_unit: 1, cost_fca: 13.86, landed_cost_per_unit: 18.17036492333859, sale_price_inc_vat: 32.2, vat_amount: 2.898 }),
  row({ product_name: "Chorizo criollo adrian", package_label: "1 KG", sku: "ASA012", cut: "Chorizo criollo", kg_per_unit: 1, cost_fca: 6.5, landed_cost_per_unit: 10.810364923338586, sale_price_inc_vat: 21.33, vat_amount: 1.9197 }),
  row({ product_name: "Chorizo criollo Argentino", package_label: "0.360 KG", sku: "ASA012", cut: "Chorizo criollo", kg_per_unit: 0.36, cost_fca: 6.5, landed_cost_per_unit: 10.810364923338586, sale_price_inc_vat: 21.33, vat_amount: 1.9197, notes: "Alias for SumUp chorizo product name." }),
  row({ product_name: "Salchicha Parrillera", package_label: "1 KG", sku: "ASA013", cut: "Salchicha parrillera", kg_per_unit: 1, cost_fca: 6.5, landed_cost_per_unit: 10.81036492333859, sale_price_inc_vat: 19.6, vat_amount: 1.764 }),
  row({ product_name: "Chinchu", package_label: "0.5 KG", sku: "ASA014", cut: "Chinchulín", kg_per_unit: 0.5, cost_fca: 3.95, landed_cost_per_unit: 8.260364923338586, sale_price_inc_vat: 18.93, vat_amount: 1.7037 }),
  row({ product_name: "Chinchulin", package_label: "0.5 KG", sku: "ASA014", cut: "Chinchulín", kg_per_unit: 0.5, cost_fca: 3.95, landed_cost_per_unit: 8.260364923338586, sale_price_inc_vat: 18.93, vat_amount: 1.7037, notes: "Alias for SumUp chinchulín product name." }),
  row({ product_name: "Molleja de Corazon", package_label: "0.5 KG", sku: "ASA015", cut: "Molleja", kg_per_unit: 0.5, cost_fca: 8.95, landed_cost_per_unit: 13.26036492333859, sale_price_inc_vat: 25, vat_amount: 2.25 }),
  row({ product_name: "Morcilla Argentina", package_label: "0.5 KG", sku: "ASA016", cut: "Morcilla", kg_per_unit: 0.5, cost_fca: 6.5, landed_cost_per_unit: 10.810364923338586, sale_price_inc_vat: 19.6, vat_amount: 1.764 }),

  row({ product_name: "Costillar 7C LA MAXIMA", package_label: "4.5 KG", sku: "ASLM001", cut: "Costillar", kg_per_unit: 4.5, cost_fca: 53.55, landed_cost_per_unit: 57.860364923338586, sale_price_inc_vat: 180, vat_amount: 16.2 }),
  row({ product_name: "Asado LA MAXIMA", package_label: "4.5 KG", sku: "ASLM001", cut: "Costillar", kg_per_unit: 4.5, cost_fca: 53.55, landed_cost_per_unit: 57.860364923338586, sale_price_inc_vat: 180, vat_amount: 16.2, notes: "Alias for La Maxima costillar/asado row." }),
  row({ product_name: "Medialuna de vacio LA MAXIMA", package_label: "1 KG", sku: "ASLM002", cut: "Vacío", kg_per_unit: 1, cost_fca: 21.5, landed_cost_per_unit: 25.81036492333859, sale_price_inc_vat: 46.8, vat_amount: 4.212 }),
  row({ product_name: "VACIO LA MAXIMA", package_label: "1 KG", sku: "ASLM002", cut: "Vacío", kg_per_unit: 1, cost_fca: 21.5, landed_cost_per_unit: 25.81036492333859, sale_price_inc_vat: 46.8, vat_amount: 4.212 }),
  row({ product_name: "Chorizo Criollo LA MAXIMA", package_label: "0.36 KG", sku: "ASLM003", cut: "Chorizo criollo", kg_per_unit: 0.36, cost_fca: 7.25, landed_cost_per_unit: 11.56036492333859, sale_price_inc_vat: 21.33, vat_amount: 1.9197 }),
  row({ product_name: "Molleja de corazon LA MAXIMA", package_label: "0.5 KG", sku: "ASLM004", cut: "Molleja", kg_per_unit: 0.5, cost_fca: 11.5, landed_cost_per_unit: 15.81036492333859, sale_price_inc_vat: 32.5, vat_amount: 2.925 }),
  row({ product_name: "Morcilla LA MAXIMA", package_label: "1 KG", sku: "ASLM005", cut: "Morcilla", kg_per_unit: 1, cost_fca: 5.65, landed_cost_per_unit: 9.96036492333859, sale_price_inc_vat: 21, vat_amount: 1.89 }),
  row({ product_name: "Hamburguesa LA MAXIMA", package_label: "0.2 KG", sku: "ASLM006", cut: "Hamburguesa", kg_per_unit: 0.2, cost_fca: 13.15, landed_cost_per_unit: 17.46036492333859, sale_price_inc_vat: 26.95, vat_amount: 2.4255 }),
  row({ product_name: "Provoleta LA MAXIMA", package_label: "0.2 KG", sku: "ASLM007", cut: "Provoleta", kg_per_unit: 0.2, cost_fca: 5.3, landed_cost_per_unit: 9.61036492333859, sale_price_inc_vat: 15, vat_amount: 1.35 }),
  row({ product_name: "Peceto LA MAXIMA", package_label: "2 KG", sku: "ASLM008", cut: "Peceto", kg_per_unit: 2, cost_fca: 29, landed_cost_per_unit: 33.310364923338586, sale_price_inc_vat: 60, vat_amount: 5.4 }),
  row({ product_name: "Milanesa LA MAXIMA", package_label: "1 KG", sku: "ASLM009", cut: "Milanesa", kg_per_unit: 1, cost_fca: 16.9, landed_cost_per_unit: 21.210364923338586, sale_price_inc_vat: 35.9, vat_amount: 3.231 }),
  row({ product_name: "Bife de chorizo LA MAXIMA", package_label: "0.250 KG", sku: "ASLM010", cut: "Bife de chorizo", kg_per_unit: 0.25, cost_fca: 13.4, landed_cost_per_unit: 17.710364923338586, sale_price_inc_vat: 39.9, vat_amount: 3.591 }),
  row({ product_name: "Asado banderita LA MAXIMA", package_label: "1 KG", sku: "ASLM011", cut: "Asado banderita", kg_per_unit: 1, cost_fca: 14.8, landed_cost_per_unit: 19.110364923338586, sale_price_inc_vat: 40, vat_amount: 3.6 }),
  row({ product_name: "Matambre de cerdo LA MAXIMA", package_label: "1 KG", sku: "ASLM012", cut: "Matambre", kg_per_unit: 1, cost_fca: 12.75, landed_cost_per_unit: 17.06036492333859, sale_price_inc_vat: 36.9, vat_amount: 3.321 }),
  row({ product_name: "chinchulin LA MAXIMA", package_label: "1 KG", sku: "ASLM013", cut: "Chinchulín", kg_per_unit: 1, cost_fca: 7.9, landed_cost_per_unit: 12.21036492333859, sale_price_inc_vat: 42.9, vat_amount: 3.861 }),
  row({ product_name: "Entraña fina uruguay LA MAXIMA", package_label: "1.5 KG", sku: "ASLM014", cut: "Entraña", kg_per_unit: 1.5, cost_fca: 22.9, landed_cost_per_unit: 27.21036492333859, sale_price_inc_vat: 64.9, vat_amount: 5.841 }),

  row({ product_name: "ACHURAS BOX", package_label: "4 KG", sku: "AB001", cut: "Box", kg_per_unit: 4, transport_per_unit: 0, packaging_per_unit: 0, landed_cost_per_unit: 64.66218954, sale_price_inc_vat: 119, vat_amount: 10.71 }),
  row({ product_name: "MILANESA BOX", package_label: "6 KG", sku: "AB003", cut: "Box", kg_per_unit: 6, transport_per_unit: 0, packaging_per_unit: 0, landed_cost_per_unit: 84.84145969, sale_price_inc_vat: 199, vat_amount: 17.91 }),
  row({ product_name: "PREMIUM PARRILLA BOX", package_label: "7 KG", sku: "AB004", cut: "Box", kg_per_unit: 7, transport_per_unit: 0, packaging_per_unit: 0, landed_cost_per_unit: 120.3432843, sale_price_inc_vat: 259, vat_amount: 23.31 }),
];

export function withMonth(rows, month) {
  return rows.map(r => ({ ...r, month }));
}

export function samePriceKey(a, b) {
  return normalizeProductName(a.product_name) === normalizeProductName(b.product_name)
    && String(a.month || "") === String(b.month || "")
    && String(a.package_label || "") === String(b.package_label || "");
}
