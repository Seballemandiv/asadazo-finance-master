import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { parseFile } from "@/lib/fileParser";

/**
 * An accordion-style fallback that lets the user paste raw text.
 * onParsed({ headers, rows }) is called when the user submits.
 */
export default function PasteTextFallback({ onParsed }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const handleParse = () => {
    setError("");
    if (!text.trim()) { setError("Paste some data first."); return; }
    // Create a virtual CSV file
    const blob = new Blob([text], { type: "text/plain" });
    const file = new File([blob], "pasted.csv", { type: "text/plain" });
    parseFile(file).then(result => {
      if (!result.rows.length) { setError("No rows found. Check your data."); return; }
      onParsed(result);
      setOpen(false);
      setText("");
    }).catch(e => setError(String(e)));
  };

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Advanced: paste raw text instead
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            className="w-full h-36 text-xs font-mono border rounded-md p-2 bg-muted/20 resize-y"
            placeholder="Paste CSV or tab-separated data here..."
            value={text}
            onChange={e => setText(e.target.value)}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button size="sm" variant="outline" onClick={handleParse}>Parse pasted text</Button>
        </div>
      )}
    </div>
  );
}