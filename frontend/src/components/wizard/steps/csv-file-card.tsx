"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, FileText, Trash2 } from "lucide-react";
import { FieldMapper } from "./field-mapper";
import { CsvPreviewTable } from "./csv-preview-table";
import type { WizardCsvFile } from "../wizard-context";
import type { AccountType } from "@/lib/local-engine/types";
import type { FieldMappingConfig } from "@/lib/local-engine/csv-parser-generic";

interface CsvFileCardProps {
  csvFile: WizardCsvFile;
  onUpdate: (updates: Partial<WizardCsvFile>) => void;
  onRemove: () => void;
}

export function CsvFileCard({ csvFile, onUpdate, onRemove }: CsvFileCardProps) {
  const [expanded, setExpanded] = useState(true);

  const account = csvFile.account ?? {
    name: "",
    institution: "",
    type: "checking" as AccountType,
  };

  function updateAccount(updates: Partial<typeof account>) {
    onUpdate({ account: { ...account, ...updates } });
  }

  function updateMapping(config: FieldMappingConfig) {
    onUpdate({ mapping: config });
  }

  const isValid =
    account.name.trim() !== "" &&
    csvFile.mapping.mapping.dateColumn &&
    csvFile.mapping.mapping.descriptionColumn &&
    (csvFile.mapping.amountMode === "single"
      ? csvFile.mapping.mapping.amountColumn
      : csvFile.mapping.mapping.debitColumn || csvFile.mapping.mapping.creditColumn);

  return (
    <Card className={csvFile.imported ? "border-green-500/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="size-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-sm">{csvFile.file.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {(csvFile.file.size / 1024).toFixed(1)} KB &middot;{" "}
                {csvFile.headers.length} columns &middot;{" "}
                {csvFile.sampleRows.length}+ rows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {csvFile.imported && (
              <Badge variant="secondary" className="text-green-400">
                Imported
              </Badge>
            )}
            {isValid && !csvFile.imported && (
              <Badge variant="secondary">Ready</Badge>
            )}
            <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
              {expanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
            {!csvFile.imported && (
              <Button variant="ghost" size="icon" onClick={onRemove}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Account</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Account name<span className="text-destructive ml-0.5">*</span>
                </Label>
                <Input
                  value={account.name}
                  onChange={(e) => updateAccount({ name: e.target.value })}
                  placeholder="e.g. Checking"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Institution</Label>
                <Input
                  value={account.institution}
                  onChange={(e) => updateAccount({ institution: e.target.value })}
                  placeholder="e.g. Chase"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account type</Label>
                <select
                  value={account.type}
                  onChange={(e) =>
                    updateAccount({ type: e.target.value as AccountType })
                  }
                  className="h-8 w-full rounded-lg border border-input bg-card px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="checking">Checking</option>
                  <option value="credit">Credit Card</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Column mapping</h4>
            <FieldMapper
              headers={csvFile.headers}
              config={csvFile.mapping}
              onChange={updateMapping}
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium">Preview</h4>
            <CsvPreviewTable
              sampleRows={csvFile.sampleRows}
              config={csvFile.mapping}
            />
          </div>

          {csvFile.importResult && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <p className="text-sm font-medium text-green-400 mb-2">
                Import Complete
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Total rows: </span>
                  {csvFile.importResult.total_rows}
                </div>
                <div>
                  <span className="text-muted-foreground">New: </span>
                  <span className="text-green-400">
                    {csvFile.importResult.new_transactions}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Duplicates: </span>
                  {csvFile.importResult.duplicate_transactions}
                </div>
                <div>
                  <span className="text-muted-foreground">Categorized: </span>
                  {csvFile.importResult.categorized_count}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
