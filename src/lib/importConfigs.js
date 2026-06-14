/**
 * Configuration for each import type:
 * - targetFields: the fields we want to extract
 * - autoMap: attempt to auto-detect file headers → target fields
 * - dateField: which target field contains the date
 * - requiredFields: minimum fields needed for validation
 * - numericFields: fields that should be parsed as numbers
 */

export const IMPORT_CONFIGS = {
  sumup_sales: {
    label: "SumUp Sales Report",
    description: "Export from SumUp → Reports → Sales",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "transaction_id", label: "Transaction ID" },
      { key: "payment_method", label: "Payment Method" },
      { key: "gross_inc_vat", label: "Gross Amount (inc VAT)" },
      { key: "vat", label: "VAT Amount" },
      { key: "net_ex_vat", label: "Net Amount (ex VAT)" },
      { key: "discount", label: "Discount" },
      { key: "currency", label: "Currency" },
      { key: "order_id", label: "Order ID" },
    ],
    dateField: "date",
    requiredFields: ["date", "gross_inc_vat"],
    numericFields: ["gross_inc_vat", "vat", "net_ex_vat", "discount"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "transaction date": "date",
      "transactiedatum": "date",
      "transactie-id": "transaction_id",
      "transaction id": "transaction_id",
      "transaction-id": "transaction_id",
      "transactieid": "transaction_id",
      "betaalmethode": "payment_method",
      "payment method": "payment_method",
      "betaaltype": "payment_method",
      "bruto": "gross_inc_vat",
      "bruto (incl. btw)": "gross_inc_vat",
      "gross": "gross_inc_vat",
      "gross amount": "gross_inc_vat",
      "bedrag": "gross_inc_vat",
      "amount": "gross_inc_vat",
      "totaal": "gross_inc_vat",
      "total": "gross_inc_vat",
      "total (eur)": "gross_inc_vat",
      "total eur": "gross_inc_vat",
      "brutto": "gross_inc_vat",
      "btw": "vat",
      "vat": "vat",
      "vat amount": "vat",
      "tax": "vat",
      "mwst": "vat",
      "tax amount": "vat",
      "netto": "net_ex_vat",
      "netto (excl. btw)": "net_ex_vat",
      "net": "net_ex_vat",
      "net amount": "net_ex_vat",
      "amount excluding vat": "net_ex_vat",
      "korting": "discount",
      "discount": "discount",
      "valuta": "currency",
      "currency": "currency",
      "order id": "order_id",
      "bestelling-id": "order_id",
      "bestelling id": "order_id",
      "referentie": "order_id",
      "reference": "order_id",
    },
  },

  sumup_articles: {
    label: "SumUp Article Report",
    description: "Export from SumUp → Reports → Items / Articles",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "transaction_id", label: "Transaction ID" },
      { key: "product", label: "Product Name", required: true },
      { key: "sku", label: "SKU" },
      { key: "qty", label: "Quantity", required: true },
      { key: "gross_inc_vat", label: "Gross Price (inc VAT)", required: true },
      { key: "net_ex_vat", label: "Net Price (ex VAT)" },
      { key: "vat", label: "VAT" },
      { key: "vat_rate", label: "VAT Rate" },
      { key: "discount", label: "Discount" },
      { key: "payment_method", label: "Payment Method" },
    ],
    dateField: "date",
    requiredFields: ["date", "product", "qty", "gross_inc_vat"],
    numericFields: ["qty", "gross_inc_vat", "net_ex_vat", "vat", "discount"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "transaction date": "date",
      "transactiedatum": "date",
      "transactie-id": "transaction_id",
      "transaction id": "transaction_id",
      "transaction-id": "transaction_id",
      "beschrijving": "product",
      "description": "product",
      "artikel": "product",
      "product": "product",
      "product name": "product",
      "productnaam": "product",
      "naam": "product",
      "name": "product",
      "item": "product",
      "sku": "sku",
      "aantal": "qty",
      "qty": "qty",
      "quantity": "qty",
      "anzahl": "qty",
      "menge": "qty",
      "prijs": "gross_inc_vat",
      "price": "gross_inc_vat",
      "gross": "gross_inc_vat",
      "bruto": "gross_inc_vat",
      "brutto": "gross_inc_vat",
      "bedrag": "gross_inc_vat",
      "amount": "gross_inc_vat",
      "totaal": "gross_inc_vat",
      "total": "gross_inc_vat",
      "netto": "net_ex_vat",
      "net": "net_ex_vat",
      "btw": "vat",
      "vat": "vat",
      "mwst": "vat",
      "btw-tarief": "vat_rate",
      "vat rate": "vat_rate",
      "tax rate": "vat_rate",
      "korting": "discount",
      "discount": "discount",
      "betaalmethode": "payment_method",
      "payment method": "payment_method",
    },
  },

  sumup_transactions: {
    label: "SumUp Transaction Report",
    description: "Export from SumUp → Reports → Transactions / Payouts",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "transaction_id", label: "Transaction ID" },
      { key: "status", label: "Status" },
      { key: "payment_method", label: "Payment Type" },
      { key: "gross_inc_vat", label: "Amount", required: true },
      { key: "net_ex_vat", label: "Net Amount" },
      { key: "vat", label: "Fee / VAT" },
    ],
    dateField: "date",
    requiredFields: ["date", "gross_inc_vat"],
    numericFields: ["gross_inc_vat", "net_ex_vat", "vat"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "transaction date": "date",
      "transactiedatum": "date",
      "transactie-id": "transaction_id",
      "transaction id": "transaction_id",
      "transaction-id": "transaction_id",
      "status": "status",
      "betaalmethode": "payment_method",
      "payment method": "payment_method",
      "betaaltype": "payment_method",
      "type": "payment_method",
      "payment type": "payment_method",
      "bedrag": "gross_inc_vat",
      "amount": "gross_inc_vat",
      "total": "gross_inc_vat",
      "bruto": "gross_inc_vat",
      "netto": "net_ex_vat",
      "net amount": "net_ex_vat",
      "btw": "vat",
      "fee": "vat",
      "kosten": "vat",
    },
  },

  bank_transactions: {
    label: "Business Bank Transactions",
    description: "Export from your bank — CSV/Excel statement",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "counterparty", label: "Counterparty / Name", required: true },
      { key: "description", label: "Description / Reference" },
      { key: "amount_out", label: "Amount Out (debit)" },
      { key: "amount_in", label: "Amount In (credit)" },
      { key: "amount", label: "Amount (single column)" },
      { key: "balance", label: "Balance" },
    ],
    dateField: "date",
    requiredFields: ["date", "counterparty"],
    numericFields: ["amount_out", "amount_in", "amount", "balance"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "boekingsdatum": "date",
      "valutadatum": "date",
      "buchungsdatum": "date",
      "naam": "counterparty",
      "name": "counterparty",
      "tegenpartij": "counterparty",
      "counterparty": "counterparty",
      "begunstigde": "counterparty",
      "empfanger": "counterparty",
      "omschrijving": "description",
      "description": "description",
      "mededeling": "description",
      "reference": "description",
      "referentie": "description",
      "verwendungszweck": "description",
      "af": "amount_out",
      "debet": "amount_out",
      "debit": "amount_out",
      "bedrag af": "amount_out",
      "amount out": "amount_out",
      "bij": "amount_in",
      "credit": "amount_in",
      "bedrag bij": "amount_in",
      "amount in": "amount_in",
      "bedrag": "amount",
      "amount": "amount",
      "betrag": "amount",
      "saldo": "balance",
      "balance": "balance",
    },
  },

  supplier_documents: {
    label: "Supplier Documents",
    description: "Invoices or delivery notes from meat/product suppliers",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "supplier", label: "Supplier Name" },
      { key: "description", label: "Product / Description" },
      { key: "qty", label: "Quantity / Weight (kg)" },
      { key: "unit_price", label: "Unit Price / Price per kg" },
      { key: "amount", label: "Total Amount" },
      { key: "vat", label: "VAT" },
      { key: "invoice_number", label: "Invoice Number" },
    ],
    dateField: "date",
    requiredFields: ["date", "amount"],
    numericFields: ["qty", "unit_price", "amount", "vat"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "leverancier": "supplier",
      "supplier": "supplier",
      "omschrijving": "description",
      "description": "description",
      "product": "description",
      "artikel": "description",
      "aantal": "qty",
      "qty": "qty",
      "kg": "qty",
      "weight": "qty",
      "gewicht": "qty",
      "quantity": "qty",
      "prijs per kg": "unit_price",
      "unit price": "unit_price",
      "price per kg": "unit_price",
      "preis": "unit_price",
      "totaal": "amount",
      "total": "amount",
      "bedrag": "amount",
      "amount": "amount",
      "btw": "vat",
      "vat": "vat",
      "mwst": "vat",
      "factuurnummer": "invoice_number",
      "invoice number": "invoice_number",
      "invoice": "invoice_number",
    },
  },

  logistics_documents: {
    label: "Logistics / Transport Documents",
    description: "Invoices from transport or logistics providers",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "provider", label: "Provider / Carrier" },
      { key: "description", label: "Description" },
      { key: "amount", label: "Total Amount" },
      { key: "vat", label: "VAT" },
      { key: "invoice_number", label: "Invoice / Reference Number" },
      { key: "tracking", label: "Tracking / Shipment ID" },
    ],
    dateField: "date",
    requiredFields: ["date", "amount"],
    numericFields: ["amount", "vat"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "vervoerder": "provider",
      "provider": "provider",
      "carrier": "provider",
      "omschrijving": "description",
      "description": "description",
      "bedrag": "amount",
      "amount": "amount",
      "total": "amount",
      "totaal": "amount",
      "btw": "vat",
      "vat": "vat",
      "mwst": "vat",
      "factuurnummer": "invoice_number",
      "invoice number": "invoice_number",
      "reference": "invoice_number",
      "referentie": "invoice_number",
      "tracking": "tracking",
      "shipment id": "tracking",
    },
  },
};

/**
 * Auto-detect column mapping by matching file headers against autoMap dictionary.
 * Tries exact match first, then partial match.
 */
export function autoDetectMapping(headers, importType) {
  const config = IMPORT_CONFIGS[importType];
  if (!config) return {};
  const mapping = {};
  for (const header of headers) {
    const key = header.toLowerCase().trim();
    const exact = config.autoMap[key];
    if (exact && !mapping[exact]) {
      mapping[exact] = header;
      continue;
    }
    // Partial match: check if any autoMap key is contained in header or vice versa
    for (const [mapKey, targetField] of Object.entries(config.autoMap)) {
      if (mapping[targetField]) continue; // already mapped
      if (key.includes(mapKey) || mapKey.includes(key)) {
        mapping[targetField] = header;
        break;
      }
    }
  }
  return mapping;
}

/**
 * Validate that required fields are mapped
 */
export function validateMapping(mapping, importType) {
  const config = IMPORT_CONFIGS[importType];
  if (!config) return [];
  const missing = [];
  for (const field of config.targetFields.filter(f => f.required)) {
    if (!mapping[field.key]) missing.push(field.label);
  }
  return missing; // [] = valid
}