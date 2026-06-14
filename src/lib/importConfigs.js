/**
 * Import configurations for each import type.
 * Defines: targetFields, autoMap, dateField, requiredFields, numericFields.
 *
 * Each import type saves to a DIFFERENT entity:
 *   sumup_sales        → SalesRecord
 *   sumup_articles     → ArticleRecord
 *   sumup_transactions → SumUpTransactionRecord
 *   bank_transactions  → BankTransaction
 *   supplier_documents → SupplierDocument (PDF upload, not CSV)
 *   logistics_documents→ SupplierDocument (PDF upload, not CSV)
 */

export const IMPORT_CONFIGS = {

  // ─── SumUp Sales Report ────────────────────────────────────────────────
  sumup_sales: {
    label: "SumUp Sales Report",
    description: "Export from SumUp → Reports → Sales",
    entityName: "SalesRecord",
    targetFields: [
      { key: "transaction_date", label: "Date (Datum)", required: true },
      { key: "transaction_type", label: "Type" },
      { key: "transaction_id", label: "Transaction ID (Transactie-ID)", required: true },
      { key: "payment_method", label: "Payment Method (Betaalmethode)" },
      { key: "quantity", label: "Quantity (Aantal)", required: true },
      { key: "product_name", label: "Product / Description (Beschrijving)", required: true },
      { key: "source_category", label: "Category (Categorie)" },
      { key: "sku", label: "SKU" },
      { key: "currency", label: "Currency (Valuta)", required: true },
      { key: "price_before_discount", label: "Price before discount (Prijs excl. korting)" },
      { key: "discount", label: "Discount (Korting)" },
      { key: "gross_amount_inc_vat", label: "Gross Amount inc VAT (Prijs bruto)", required: true },
      { key: "net_amount_ex_vat", label: "Net Amount ex VAT (Prijs netto)", required: true },
      { key: "vat_amount", label: "VAT Amount (Btw)" },
      { key: "vat_rate", label: "VAT Rate (Btw-tarief)" },
      { key: "account", label: "Account" },
    ],
    dateField: "transaction_date",
    requiredFields: ["transaction_date", "transaction_id", "quantity", "product_name", "currency", "gross_amount_inc_vat", "net_amount_ex_vat"],
    numericFields: ["quantity", "price_before_discount", "discount", "gross_amount_inc_vat", "net_amount_ex_vat", "vat_amount"],
    autoMap: {
      // Date
      "datum": "transaction_date",
      "date": "transaction_date",
      "transaction date": "transaction_date",
      "transactiedatum": "transaction_date",
      // Type
      "type": "transaction_type",
      "transactietype": "transaction_type",
      // Transaction ID
      "transactie-id": "transaction_id",
      "transactieid": "transaction_id",
      "transaction id": "transaction_id",
      "transaction-id": "transaction_id",
      "transaction_id": "transaction_id",
      // Payment method
      "betaalmethode": "payment_method",
      "payment method": "payment_method",
      "payment_method": "payment_method",
      "betaaltype": "payment_method",
      // Quantity
      "aantal": "quantity",
      "qty": "quantity",
      "quantity": "quantity",
      "anzahl": "quantity",
      // Product
      "beschrijving": "product_name",
      "description": "product_name",
      "product": "product_name",
      "product name": "product_name",
      "productnaam": "product_name",
      "artikel": "product_name",
      "omschrijving": "product_name",
      "naam": "product_name",
      "item": "product_name",
      // Category
      "categorie": "source_category",
      "category": "source_category",
      "kategorie": "source_category",
      // SKU
      "sku": "sku",
      "artikelnummer": "sku",
      // Currency
      "valuta": "currency",
      "currency": "currency",
      "währung": "currency",
      // Price before discount
      "prijs exclusief korting": "price_before_discount",
      "price before discount": "price_before_discount",
      "prijs excl. korting": "price_before_discount",
      "prijs excl korting": "price_before_discount",
      // Discount
      "korting": "discount",
      "discount": "discount",
      "rabatt": "discount",
      // Gross
      "prijs (bruto)": "gross_amount_inc_vat",
      "prijs bruto": "gross_amount_inc_vat",
      "bruto": "gross_amount_inc_vat",
      "gross": "gross_amount_inc_vat",
      "gross amount": "gross_amount_inc_vat",
      "bedrag": "gross_amount_inc_vat",
      "amount": "gross_amount_inc_vat",
      "totaal": "gross_amount_inc_vat",
      "total": "gross_amount_inc_vat",
      "brutto": "gross_amount_inc_vat",
      // Net
      "prijs (netto)": "net_amount_ex_vat",
      "prijs netto": "net_amount_ex_vat",
      "netto": "net_amount_ex_vat",
      "net": "net_amount_ex_vat",
      "net amount": "net_amount_ex_vat",
      "nettobetrag": "net_amount_ex_vat",
      // VAT
      "btw": "vat_amount",
      "vat": "vat_amount",
      "vat amount": "vat_amount",
      "tax": "vat_amount",
      "mwst": "vat_amount",
      "tax amount": "vat_amount",
      "belastingbedrag": "vat_amount",
      // VAT rate
      "btw-tarief": "vat_rate",
      "vat rate": "vat_rate",
      "tax rate": "vat_rate",
      "btwtarief": "vat_rate",
      // Account
      "account": "account",
      "e-mail": "account",
      "email": "account",
    },
  },

  // ─── SumUp Article Report ──────────────────────────────────────────────
  sumup_articles: {
    label: "SumUp Article Report",
    description: "Export from SumUp → Reports → Items / Articles",
    entityName: "ArticleRecord",
    noDateRequired: true,
    targetFields: [
      { key: "product_name", label: "Article Name (Naam van artikel)", required: true },
      { key: "variant_name", label: "Variant (Naam van variant)" },
      { key: "source_category", label: "Category (Categorie)" },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Quantity (Aantal)", required: true },
      { key: "currency", label: "Currency (Valuta)" },
      { key: "gross_amount", label: "Amount (Bedrag)", required: true },
      { key: "article_cost", label: "Cost Price (Kostprijs)" },
      { key: "article_profit", label: "Profit (Winst)" },
      { key: "article_margin", label: "Margin (Marge)" },
    ],
    dateField: null,
    requiredFields: ["product_name", "quantity", "gross_amount"],
    numericFields: ["quantity", "gross_amount", "article_cost", "article_profit", "article_margin"],
    autoMap: {
      "naam van artikel": "product_name",
      "artikel": "product_name",
      "article name": "product_name",
      "product name": "product_name",
      "product": "product_name",
      "productnaam": "product_name",
      "item": "product_name",
      "naam van variant": "variant_name",
      "variant": "variant_name",
      "variant name": "variant_name",
      "categorie": "source_category",
      "category": "source_category",
      "sku": "sku",
      "artikelnummer": "sku",
      "aantal": "quantity",
      "qty": "quantity",
      "quantity": "quantity",
      "valuta": "currency",
      "currency": "currency",
      "bedrag": "gross_amount",
      "amount": "gross_amount",
      "bedrag (incl. btw)": "gross_amount",
      "kostprijs": "article_cost",
      "cost price": "article_cost",
      "winst": "article_profit",
      "profit": "article_profit",
      "marge": "article_margin",
      "margin": "article_margin",
    },
  },

  // ─── SumUp Transaction Report ──────────────────────────────────────────
  sumup_transactions: {
    label: "SumUp Transaction Report",
    description: "Export from SumUp → Reports → Transactions / Payouts",
    entityName: "SumUpTransactionRecord",
    targetFields: [
      { key: "transaction_date", label: "Date (Datum)", required: true },
      { key: "transaction_id", label: "Transaction ID (Transactie-ID)", required: true },
      { key: "transaction_type", label: "Transaction Type (Transactietype)", required: true },
      { key: "status", label: "Status", required: true },
      { key: "payment_method", label: "Payment Method (Betaalmethode)" },
      { key: "description", label: "Description (Beschrijving)" },
      { key: "total_amount", label: "Total Amount (Totaal bedrag)" },
      { key: "net_sales", label: "Net Sales (Netto verkoop)" },
      { key: "tax_amount", label: "Tax Amount (Belastingbedrag)" },
      { key: "transaction_fee", label: "Transaction Fee (Transactiekosten)" },
      { key: "payout_amount", label: "Payout Amount (Uitbetaling)" },
      { key: "payout_date", label: "Payout Date (Uitbetaling datum)" },
      { key: "payout_number", label: "Payout Number (Uitbetalingsnummer)" },
      { key: "reference", label: "Reference (Kenmerk)" },
      { key: "account_email", label: "Account Email (E-mail)" },
    ],
    dateField: "transaction_date",
    requiredFields: ["transaction_date", "transaction_id", "transaction_type", "status"],
    numericFields: ["total_amount", "net_sales", "tax_amount", "transaction_fee", "payout_amount"],
    autoMap: {
      "datum": "transaction_date",
      "date": "transaction_date",
      "transactiedatum": "transaction_date",
      "transactie-id": "transaction_id",
      "transaction id": "transaction_id",
      "transactieid": "transaction_id",
      "transactietype": "transaction_type",
      "transaction type": "transaction_type",
      "transactiontype": "transaction_type",
      "status": "status",
      "betaalmethode": "payment_method",
      "payment method": "payment_method",
      "invoerwijze": "payment_method",
      "beschrijving": "description",
      "description": "description",
      "totaal bedrag": "total_amount",
      "total amount": "total_amount",
      "totaalbedrag": "total_amount",
      "netto verkoop": "net_sales",
      "net sales": "net_sales",
      "nettoverkoop": "net_sales",
      "belastingbedrag": "tax_amount",
      "tax amount": "tax_amount",
      "transactiekosten": "transaction_fee",
      "transaction fee": "transaction_fee",
      "uitbetaling": "payout_amount",
      "payout": "payout_amount",
      "payout amount": "payout_amount",
      "uitbetaling datum": "payout_date",
      "payout date": "payout_date",
      "uitbetalingsdatum": "payout_date",
      "uitbetalingsnummer": "payout_number",
      "payout number": "payout_number",
      "kenmerk": "reference",
      "reference": "reference",
      "e-mail": "account_email",
      "email": "account_email",
    },
  },

  // ─── Bank Transactions ─────────────────────────────────────────────────
  bank_transactions: {
    label: "Business Bank Transactions",
    description: "Export from your bank — CSV/Excel statement",
    entityName: "BankTransaction",
    targetFields: [
      { key: "date", label: "Date", required: true },
      { key: "counterparty", label: "Counterparty / Name (optional)" },
      { key: "description", label: "Description / Reference", required: true },
      { key: "amount_out", label: "Amount Out / Debit (Factuurbedrag uit)" },
      { key: "amount_in", label: "Amount In / Credit (Factuurbedrag in)" },
      { key: "amount", label: "Amount (single signed column)" },
      { key: "balance", label: "Balance (Beschikbaar saldo)" },
    ],
    dateField: "date",
    requiredFields: ["date", "description"],
    numericFields: ["amount_out", "amount_in", "amount", "balance"],
    autoMap: {
      "datum": "date",
      "date": "date",
      "boekingsdatum": "date",
      "valutadatum": "date",
      "buchungsdatum": "date",
      "transactiedatum": "date",
      // Counterparty (optional)
      "naam": "counterparty",
      "name": "counterparty",
      "tegenpartij": "counterparty",
      "counterparty": "counterparty",
      "begunstigde": "counterparty",
      "empfanger": "counterparty",
      "naam / omschrijving": "counterparty",
      "tegenrekening naam": "counterparty",
      // Description / reference (required)
      "omschrijving": "description",
      "description": "description",
      "mededeling": "description",
      "reference": "description",
      "referentie": "description",
      "verwendungszweck": "description",
      "betalingskenmerk": "description",
      // Amounts
      "af": "amount_out",
      "debet": "amount_out",
      "debit": "amount_out",
      "bedrag af": "amount_out",
      "amount out": "amount_out",
      "factuurbedrag uit": "amount_out",
      "bedrag uit": "amount_out",
      "bij": "amount_in",
      "credit": "amount_in",
      "bedrag bij": "amount_in",
      "amount in": "amount_in",
      "factuurbedrag in": "amount_in",
      "bedrag in": "amount_in",
      "bedrag": "amount",
      "amount": "amount",
      "betrag": "amount",
      "saldo": "balance",
      "balance": "balance",
      "beschikbaar saldo": "balance",
    },
  },

  // ─── Supplier / Logistics Documents (handled by PdfUploadSection) ──────
  supplier_documents: {
    label: "Supplier Documents",
    description: "Invoices, proformas, receipts from meat/product suppliers",
    entityName: "SupplierDocument",
    pdfOnly: true,
    targetFields: [],
    dateField: null,
    requiredFields: [],
    numericFields: [],
    autoMap: {},
  },

  logistics_documents: {
    label: "Logistics / Transport Documents",
    description: "DHL, transport, vehicle rental, pallet invoices",
    entityName: "SupplierDocument",
    pdfOnly: true,
    targetFields: [],
    dateField: null,
    requiredFields: [],
    numericFields: [],
    autoMap: {},
  },
};

/**
 * Auto-detect column mapping by matching file headers against autoMap dictionary.
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
    for (const [mapKey, targetField] of Object.entries(config.autoMap)) {
      if (mapping[targetField]) continue;
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
  return missing;
}