import React, { useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FileUploadZone({ onFile, accept = ".csv,.xls,.xlsx" }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handle = (file) => {
    if (!file) return;
    onFile(file);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
    >
      <Upload className="w-8 h-8 text-muted-foreground" />
      <div className="text-center">
        <p className="font-medium text-sm">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">Supports CSV, XLS, XLSX</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handle(e.target.files[0])}
      />
    </div>
  );
}