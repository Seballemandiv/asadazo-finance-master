import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * targetFields: [{ key, label, required }]
 * fileHeaders: string[]
 * mapping: { [key]: headerName }
 * onChange: (newMapping) => void
 */
export default function ColumnMapper({ targetFields, fileHeaders, mapping, onChange }) {
  const set = (key, val) => onChange({ ...mapping, [key]: val === "__none__" ? "" : val });

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Column Mapping</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {targetFields.map(field => (
          <div key={field.key} className="flex items-center gap-2">
            <span className={`text-xs w-36 flex-shrink-0 ${field.required ? "font-medium" : "text-muted-foreground"}`}>
              {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            <Select value={mapping[field.key] || "__none__"} onValueChange={v => set(field.key, v)}>
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue placeholder="— skip —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— skip —</SelectItem>
                {fileHeaders.map(h => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}