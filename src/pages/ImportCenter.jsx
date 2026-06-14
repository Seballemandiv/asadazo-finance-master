import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ImportSection from "@/components/import/ImportSection";
import ImportHistoryTable from "@/components/import/ImportHistoryTable";

const IMPORT_TYPES = [
  "sumup_sales",
  "sumup_articles",
  "sumup_transactions",
  "bank_transactions",
  "supplier_documents",
  "logistics_documents",
];

const TAB_LABELS = {
  sumup_sales: "SumUp Sales",
  sumup_articles: "SumUp Articles",
  sumup_transactions: "SumUp Transactions",
  bank_transactions: "Bank",
  supplier_documents: "Suppliers",
  logistics_documents: "Logistics",
};

export default function ImportCenter() {
  const [historyKey, setHistoryKey] = useState(0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Import Center</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload CSV or Excel files to import data. Preview before saving.
        </p>
      </div>

      <Tabs defaultValue="sumup_sales">
        <TabsList className="flex-wrap h-auto gap-1">
          {IMPORT_TYPES.map(type => (
            <TabsTrigger key={type} value={type} className="text-xs">
              {TAB_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {IMPORT_TYPES.map(type => (
          <TabsContent key={type} value={type} className="mt-4">
            <ImportSection
              importType={type}
              onImportDone={() => setHistoryKey(k => k + 1)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ImportHistoryTable refreshKey={historyKey} />
    </div>
  );
}