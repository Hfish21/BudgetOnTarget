"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { Upload, FileText, X } from "lucide-react";
import type { Account } from "@/types";

interface CsvUploadProps {
  onUploadComplete: () => void;
}

export function CsvUpload({ onUploadComplete }: CsvUploadProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(
    null
  );
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    new_transactions: number;
    duplicate_transactions: number;
    categorized_count: number;
    uncategorized_count: number;
    total_rows: number;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.accounts
      .list()
      .then((data) => {
        setAccounts(data);
        if (data.length > 0) {
          setSelectedAccountId(data[0].id);
        }
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }
    setFile(f);
    setError(null);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file || !selectedAccountId) return;

    setUploading(true);
    setError(null);

    try {
      const uploadResult = await api.imports.upload(file, selectedAccountId);
      setResult(uploadResult);
      setFile(null);
      onUploadComplete();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Account selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Account:</label>
        <select
          value={selectedAccountId ?? ""}
          onChange={(e) =>
            setSelectedAccountId(Number(e.target.value) || null)
          }
          className="h-8 rounded-lg border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {accounts.length === 0 && (
            <option value="">No accounts available</option>
          )}
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.institution})
            </option>
          ))}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-muted-foreground"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        {file ? (
          <div className="flex items-center gap-3">
            <FileText className="size-8 text-primary" />
            <div>
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="rounded p-1 hover:bg-muted"
            >
              <X className="size-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="mb-2 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a CSV file here or click to browse
            </p>
          </>
        )}
      </div>

      {/* Upload button */}
      <Button
        onClick={handleUpload}
        disabled={!file || !selectedAccountId || uploading}
        className="w-full"
      >
        {uploading ? "Uploading..." : "Upload CSV"}
      </Button>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="mb-3 text-sm font-semibold text-green-400">
              Import Complete
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Rows</p>
                <p className="font-medium">{result.total_rows}</p>
              </div>
              <div>
                <p className="text-muted-foreground">New Transactions</p>
                <p className="font-medium text-green-400">
                  {result.new_transactions}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Duplicates Skipped</p>
                <p className="font-medium text-yellow-400">
                  {result.duplicate_transactions}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Auto-categorized</p>
                <p className="font-medium">
                  {result.categorized_count} /{" "}
                  {result.categorized_count + result.uncategorized_count}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
