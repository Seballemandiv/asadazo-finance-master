import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import ImportSection from "@/components/import/ImportSection";
import ImportHistoryTable from "@/components/import/ImportHistoryTable";
import PdfUploadSection from "@/components/import/PdfUploadSection";
import { base44 } from "@/api/base44Client";

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

// Map import type → entity name (for cleanup)
const ENTITY_FOR_TYPE = {
  sumup_sales: "SalesRecord",
  sumup_articles: "ArticleRecord",
  sumup_transactions: "SumUpTransactionRecord",
  bank_transactions: "BankTransaction",
};

export default function ImportCenter() {
  const [activeTab, setActiveTab] = useState("sumup_sales");
  const [historyKey, setHistoryKey] = useState(0);
  const [cleanupMsg, setCleanupMsg] = useState(null); // { type: 'success'|'warning', text }
  const [cleaning, setCleaning] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refresh = () => setHistoryKey(k => k + 1);

  const handleCleanReverted = async () => {
    if (!confirm("Find all reverted import batches and hard-delete their child rows. Continue?")) return;
    setCleaning(true);
    setCleanupMsg(null);

    const batches = await base44.entities.ImportBatch.filter({ status: "reverted" });
    let deletedSales = 0;
    let deletedBank = 0;
    let noLinkWarning = false;

    let totalDeleted = 0;
    for (const batch of batches) {
      const entityName = ENTITY_FOR_TYPE[batch.import_type];
      if (entityName && base44.entities[entityName]) {
        const entity = base44.entities[entityName];
        const recs = await entity.filter({ import_batch_id: batch.id });
        if (recs.length === 0 && (batch.rows_saved || batch.row_count || 0) > 0) noLinkWarning = true;
        for (const r of recs) {
          await entity.delete(r.id);
          totalDeleted++;
        }
      }
    }

    setCleaning(false);
    refresh();

    if (noLinkWarning) {
      setCleanupMsg({
        type: "warning",
        text: `Cleaned ${totalDeleted} rows from reverted batches. ⚠ Some old records had no import_batch_id — use "Reset All" for a full clear.`,
      });
    } else {
      setCleanupMsg({
        type: "success",
        text: `Reverted import data cleaned: ${totalDeleted} rows deleted.`,
      });
    }
  };

  const handleResetAll = async () => {
    if (!confirm("This will DELETE all imported rows (SalesRecord, ArticleRecord, SumUpTransactionRecord, BankTransaction). ProductMapping, BankRule, and mappings are kept. Cannot be undone. Continue?")) return;
    setResetting(true);
    setCleanupMsg(null);

    // Delete all transactional records
    const transactionalEntities = ["SalesRecord", "ArticleRecord", "SumUpTransactionRecord", "BankTransaction"];
    for (const name of transactionalEntities) {
      if (!base44.entities[name]) continue;
      let page = await base44.entities[name].list(undefined, 500);
      while (page.length > 0) {
        for (const r of page) await base44.entities[name].delete(r.id);
        page = await base44.entities[name].list(undefined, 500);
      }
    }

    // Mark all ImportBatches as reverted
    const allBatches = await base44.entities.ImportBatch.list(undefined, 500);
    for (const b of allBatches) {
      if (b.status === "imported") {
        await base44.entities.ImportBatch.update(b.id, { status: "reverted" });
      }
    }

    setResetting(false);
    refresh();
    setCleanupMsg({ type: "success", text: "All imported transactional data has been reset. Mappings and rules are preserved." });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Import Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload CSV or Excel files to import data. Preview before saving.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-300 hover:bg-amber-50 text-xs"
            onClick={handleCleanReverted}
            disabled={cleaning || resetting}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {cleaning ? "Cleaning…" : "Clean reverted data"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-700 border-red-300 hover:bg-red-50 text-xs"
            onClick={handleResetAll}
            disabled={cleaning || resetting}
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {resetting ? "Resetting…" : "Reset all imported data"}
          </Button>
        </div>
      </div>

      {/* Cleanup feedback */}
      {cleanupMsg && (
        <div className={`flex items-start gap-2 text-sm rounded-lg border px-4 py-3 ${
          cleanupMsg.type === "success"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {cleanupMsg.type === "success"
            ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          <span>{cleanupMsg.text}</span>
          <button className="ml-auto text-xs opacity-60 hover:opacity-100" onClick={() => setCleanupMsg(null)}>✕</button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {IMPORT_TYPES.map(type => (
            <TabsTrigger key={type} value={type} className="text-xs">
              {TAB_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>

        {IMPORT_TYPES.map(type => (
          <TabsContent key={type} value={type} className="mt-4 space-y-4">
            {["supplier_documents", "logistics_documents"].includes(type) ? (
              <PdfUploadSection
                importType={type}
                refreshKey={historyKey}
                onImportDone={refresh}
              />
            ) : (
              <>
                <ImportSection
                  importType={type}
                  onImportDone={refresh}
                />
                <ImportHistoryTable
                  refreshKey={historyKey}
                  importType={type}
                />
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}