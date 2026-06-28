"use client";

import { Label } from "@/components/ui/label";
import type { FieldMappingConfig, ColumnMapping } from "@/lib/local-engine/csv-parser-generic";

interface FieldMapperProps {
  headers: string[];
  config: FieldMappingConfig;
  onChange: (config: FieldMappingConfig) => void;
}

function ColumnSelect({
  label,
  value,
  headers,
  onChange,
  required,
}: {
  label: string;
  value: string | null;
  headers: string[];
  onChange: (v: string | null) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— Select —</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FieldMapper({ headers, config, onChange }: FieldMapperProps) {
  const { mapping, amountMode, signConvention, dateFormat } = config;

  function updateMapping(updates: Partial<ColumnMapping>) {
    onChange({ ...config, mapping: { ...mapping, ...updates } });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <ColumnSelect
          label="Date column"
          value={mapping.dateColumn}
          headers={headers}
          onChange={(v) => updateMapping({ dateColumn: v })}
          required
        />
        <ColumnSelect
          label="Description column"
          value={mapping.descriptionColumn}
          headers={headers}
          onChange={(v) => updateMapping({ descriptionColumn: v })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Amount format</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={amountMode === "single"}
              onChange={() => onChange({ ...config, amountMode: "single" })}
              className="accent-primary"
            />
            Single amount column
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={amountMode === "split"}
              onChange={() => onChange({ ...config, amountMode: "split" })}
              className="accent-primary"
            />
            Separate debit/credit
          </label>
        </div>
      </div>

      {amountMode === "single" ? (
        <ColumnSelect
          label="Amount column"
          value={mapping.amountColumn}
          headers={headers}
          onChange={(v) => updateMapping({ amountColumn: v })}
          required
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <ColumnSelect
            label="Debit column"
            value={mapping.debitColumn}
            headers={headers}
            onChange={(v) => updateMapping({ debitColumn: v })}
          />
          <ColumnSelect
            label="Credit column"
            value={mapping.creditColumn}
            headers={headers}
            onChange={(v) => updateMapping({ creditColumn: v })}
          />
        </div>
      )}

      {amountMode === "single" && (
        <div className="space-y-2">
          <Label className="text-xs">Sign convention</Label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={signConvention === "negative_expense"}
                onChange={() =>
                  onChange({ ...config, signConvention: "negative_expense" })
                }
                className="accent-primary"
              />
              Negative = expense
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={signConvention === "positive_expense"}
                onChange={() =>
                  onChange({ ...config, signConvention: "positive_expense" })
                }
                className="accent-primary"
              />
              Positive = expense
            </label>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Date format</Label>
        <select
          value={dateFormat}
          onChange={(e) =>
            onChange({
              ...config,
              dateFormat: e.target.value as FieldMappingConfig["dateFormat"],
            })
          }
          className="h-8 rounded-lg border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="auto">Auto-detect</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          <option value="YYYY-MM-DD">YYYY-MM-DD</option>
        </select>
      </div>

      <ColumnSelect
        label="Category column (optional)"
        value={mapping.categoryColumn}
        headers={headers}
        onChange={(v) => updateMapping({ categoryColumn: v })}
      />
    </div>
  );
}
