import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MONTHS = Array.from({ length: 24 }, (_, i) => {
  const d = new Date();
  d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
});

const SUPPLIER_DOC_TYPES = ["Proforma", "Invoice", "Credit note", "Receipt", "Packing list", "Other"];
const LOGISTICS_DOC_TYPES = ["Transport invoice", "DHL invoice", "Delivery receipt", "Vehicle rental invoice", "Other"];

const BUSINESS_AREAS = ["Online Shop", "Event", "Wholesale", "General", "Inventory / Stock", "Transport / Logistics"];
const COST_TYPES = ["Meat Purchase", "Transport / Logistics", "Operating Expense", "Event Cost", "Other"];

export default function PdfUploadSection({ importType, refreshKey, onImportDone }) {
  const isSupplier = importType === "supplier_documents";
  const label = isSupplier ? "Supplier Document" : "Logistics Document";
  const docTypes = isSupplier ? SUPPLIER_DOC_TYPES : LOGISTICS_DOC_TYPES;

  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(MONTHS[0]);

  const loadDocs = async () => {
    setLoadingDocs(true);
    const all = await base44.entities.SupplierDocument.filter({ import_type: importType });
    setDocs(all.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setLoadingDocs(false);
  };

  useEffect(() => { loadDocs(); }, [refreshKey, importType]);

  const handleFile = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const allowed = ["pdf", "csv", "xls", "xlsx", "jpg", "jpeg", "png"];
    if (!allowed.includes(ext)) {
      setUploadResult({ success: false, message: `Unsupported file type: .${ext}` });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const batchId = crypto.randomUUID();
    const importDate = new Date().toISOString().slice(0, 10);

    // Create ImportBatch record
    await base44.entities.ImportBatch.create({
      import_type: importType,
      filename: file.name,
      import_date: importDate,
      month,
      row_count: 1,
      status: "imported",
    });

    // Create SupplierDocument record
    const doc = await base44.entities.SupplierDocument.create({
      import_type: importType,
      filename: file.name,
      file_url,
      import_batch_id: batchId,
      month,
      review_status: "needs_review",
    });

    setUploading(false);
    setUploadResult({ success: true, message: `"${file.name}" uploaded successfully.` });
    setDocs(prev => [doc, ...prev]);
    onImportDone?.();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const startEdit = (doc) => {
    setEditingId(doc.id);
    setEditForm({
      supplier_name: doc.supplier_name || "",
      document_type: doc.document_type || "",
      document_number: doc.document_number || "",
      document_date: doc.document_date || "",
      due_date: doc.due_date || "",
      currency: doc.currency || "EUR",
      net_amount: doc.net_amount ?? "",
      vat_amount: doc.vat_amount ?? "",
      gross_amount: doc.gross_amount ?? "",
      business_area: doc.business_area || "",
      cost_type: doc.cost_type || "",
      linked_shipment: doc.linked_shipment || "",
      notes: doc.notes || "",
      review_status: doc.review_status || "needs_review",
    });
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    const updated = await base44.entities.SupplierDocument.update(editingId, {
      ...editForm,
      net_amount: editForm.net_amount !== "" ? parseFloat(editForm.net_amount) : null,
      vat_amount: editForm.vat_amount !== "" ? parseFloat(editForm.vat_amount) : null,
      gross_amount: editForm.gross_amount !== "" ? parseFloat(editForm.gross_amount) : null,
    });
    setDocs(prev => prev.map(d => d.id === editingId ? { ...d, ...updated } : d));
    setEditingId(null);
    setSaving(false);
  };

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    await base44.entities.SupplierDocument.delete(doc.id);
    setDocs(prev => prev.filter(d => d.id !== doc.id));
  };

  const reviewBadge = (status) => {
    if (status === "OK") return <Badge className="bg-green-100 text-green-800 border-0 text-xs">OK</Badge>;
    if (status === "Ignore") return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Ignore</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Needs Review</Badge>;
  };

  const isPdf = (filename) => filename?.toLowerCase().endsWith(".pdf");

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <Card className="shadow-none border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upload {label}</CardTitle>
          <p className="text-xs text-muted-foreground">Accepts PDF, CSV, XLS, XLSX, JPG, PNG</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Accounting month:</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div
            className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById(`pdf-upload-${importType}`).click()}
          >
            <Upload className="w-7 h-7 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-sm">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, CSV, XLS, XLSX, JPG, PNG</p>
            </div>
            <input
              id={`pdf-upload-${importType}`}
              type="file"
              accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
              className="hidden"
              onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); }}
            />
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading…
            </div>
          )}
          {uploadResult && (
            <div className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 ${
              uploadResult.success ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {uploadResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {uploadResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document list */}
      <Card className="shadow-none border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{label} Records</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadDocs} disabled={loadingDocs}>
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingDocs ? (
            <div className="h-16 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>
          ) : (
            <div className="divide-y">
              {docs.map(doc => (
                <div key={doc.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">{doc.month}</span>
                          {doc.document_type && <span className="text-xs text-muted-foreground">· {doc.document_type}</span>}
                          {doc.supplier_name && <span className="text-xs text-muted-foreground">· {doc.supplier_name}</span>}
                          {doc.gross_amount && <span className="text-xs font-mono">· €{Number(doc.gross_amount).toFixed(2)}</span>}
                          {reviewBadge(doc.review_status)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Open file">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(doc)} title="Edit">
                        ✏️
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(doc)} title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Edit form */}
                  {editingId === doc.id && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit Document Details</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground">Supplier / Provider</label>
                          <Input className="h-7 text-xs mt-0.5" value={editForm.supplier_name}
                            onChange={e => setEditForm(f => ({ ...f, supplier_name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Document Type</label>
                          <Select value={editForm.document_type} onValueChange={v => setEditForm(f => ({ ...f, document_type: v }))}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Document Number</label>
                          <Input className="h-7 text-xs mt-0.5" value={editForm.document_number}
                            onChange={e => setEditForm(f => ({ ...f, document_number: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Document Date</label>
                          <Input type="date" className="h-7 text-xs mt-0.5" value={editForm.document_date}
                            onChange={e => setEditForm(f => ({ ...f, document_date: e.target.value }))} />
                        </div>
                        {isSupplier && (
                          <div>
                            <label className="text-xs text-muted-foreground">Due Date</label>
                            <Input type="date" className="h-7 text-xs mt-0.5" value={editForm.due_date}
                              onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} />
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground">Currency</label>
                          <Input className="h-7 text-xs mt-0.5" value={editForm.currency}
                            onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Net Amount</label>
                          <Input type="number" step="0.01" className="h-7 text-xs mt-0.5" value={editForm.net_amount}
                            onChange={e => setEditForm(f => ({ ...f, net_amount: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">VAT Amount</label>
                          <Input type="number" step="0.01" className="h-7 text-xs mt-0.5" value={editForm.vat_amount}
                            onChange={e => setEditForm(f => ({ ...f, vat_amount: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Gross Amount</label>
                          <Input type="number" step="0.01" className="h-7 text-xs mt-0.5" value={editForm.gross_amount}
                            onChange={e => setEditForm(f => ({ ...f, gross_amount: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Business Area</label>
                          <Select value={editForm.business_area} onValueChange={v => setEditForm(f => ({ ...f, business_area: v }))}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{BUSINESS_AREAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Cost Type</label>
                          <Select value={editForm.cost_type} onValueChange={v => setEditForm(f => ({ ...f, cost_type: v }))}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue placeholder="Select…" /></SelectTrigger>
                            <SelectContent>{COST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {!isSupplier && (
                          <div>
                            <label className="text-xs text-muted-foreground">Linked Shipment / Route</label>
                            <Input className="h-7 text-xs mt-0.5" value={editForm.linked_shipment}
                              onChange={e => setEditForm(f => ({ ...f, linked_shipment: e.target.value }))} />
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground">Review Status</label>
                          <Select value={editForm.review_status} onValueChange={v => setEditForm(f => ({ ...f, review_status: v }))}>
                            <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="needs_review">Needs Review</SelectItem>
                              <SelectItem value="OK">OK</SelectItem>
                              <SelectItem value="Ignore">Ignore</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 md:col-span-3">
                          <label className="text-xs text-muted-foreground">Notes</label>
                          <Input className="h-7 text-xs mt-0.5" value={editForm.notes}
                            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="bg-[#611111] hover:bg-[#450A0A] text-white h-7 text-xs"
                          onClick={handleSaveEdit} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}