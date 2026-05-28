"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Upload, FileCheck, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function DataPortability() {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const blob = await api.budgetFile.export();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);
      a.href = url;
      a.download = `budget-${stamp}.budget`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
      setExportResult(`Exported ${sizeMB} MB`);
      setTimeout(() => setExportResult(null), 5000);
    } catch (err) {
      setExportResult(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setConfirmOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (!pendingFile) return;
    setConfirmOpen(false);
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const result = await api.budgetFile.import(pendingFile);
      setImportResult(result.imported);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Data Portability</h3>
        <p className="text-xs text-muted-foreground">
          Export all your data as a portable .budget file, or import one to restore.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <Download className="size-4.5 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Export</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Download all transactions, categories, rules, targets, and
                  accounts as a single .budget file.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? "Exporting..." : exportResult ?? "Download .budget file"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
                <Upload className="size-4.5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Import</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Restore data from a .budget file. Only works on an empty
                  database to prevent conflicts.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".budget,.json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? "Importing..." : "Choose .budget file"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {importResult && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex items-start gap-3 p-4">
            <FileCheck className="mt-0.5 size-4 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-emerald-400">Import successful</p>
              <p className="mt-1 text-muted-foreground">
                {Object.entries(importResult)
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
                  .join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {importError && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 text-destructive shrink-0" />
            <div className="text-xs">
              <p className="font-medium text-destructive">Import failed</p>
              <p className="mt-1 text-muted-foreground">{importError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Import Budget File</DialogTitle>
            <DialogDescription>
              Import &ldquo;{pendingFile?.name}&rdquo;? This will load all data
              from the file into the database. Import only works when the
              database is empty.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingFile(null); }}>
              Cancel
            </Button>
            <Button onClick={handleImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
