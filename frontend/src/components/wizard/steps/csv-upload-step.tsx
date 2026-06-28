"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Plus } from "lucide-react";
import { useWizard } from "../wizard-context";
import { CsvFileCard } from "./csv-file-card";
import { autoDetectConfig } from "@/lib/local-engine/csv-parser-generic";
import { importGenericCsv } from "@/lib/local-engine/importer";
import { getStore } from "@/lib/local-engine";

export function CsvUploadStep() {
  const { csvFiles, addCsvFile, updateCsvFile, removeCsvFile, nextStep } =
    useWizard();
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList) => {
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".csv")) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const cleanText = text.startsWith("﻿") ? text.slice(1) : text;
          const { headers, sampleRows, config } = autoDetectConfig(
            cleanText,
            "checking"
          );

          addCsvFile({
            id: crypto.randomUUID(),
            file,
            rawContent: cleanText,
            headers,
            sampleRows,
            mapping: config,
            account: null,
            imported: false,
            importResult: null,
          });
        };
        reader.readAsText(file);
      }
      setError(null);
    },
    [addCsvFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleImportAll = async () => {
    const store = getStore();
    setImporting(true);
    setError(null);

    try {
      for (const csvFile of csvFiles) {
        if (csvFile.imported) continue;
        if (!csvFile.account || !csvFile.account.name.trim()) {
          setError(`Please provide an account name for ${csvFile.file.name}`);
          setImporting(false);
          return;
        }

        const account = store.addAccount({
          name: csvFile.account.name,
          institution: csvFile.account.institution,
          account_type: csvFile.account.type,
          owner_type: "joint",
          household_member_id: null,
        });

        const encoder = new TextEncoder();
        const buffer = encoder.encode(csvFile.rawContent).buffer as ArrayBuffer;

        const result = await importGenericCsv(
          store,
          buffer,
          csvFile.file.name,
          account.id,
          csvFile.mapping
        );

        updateCsvFile(csvFile.id, {
          imported: true,
          importResult: result,
        });
      }

      nextStep();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const allReady = csvFiles.length > 0 && csvFiles.every((f) => {
    if (f.imported) return true;
    const m = f.mapping.mapping;
    return (
      f.account?.name?.trim() &&
      m.dateColumn &&
      m.descriptionColumn &&
      (f.mapping.amountMode === "single"
        ? m.amountColumn
        : m.debitColumn || m.creditColumn)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Import your transactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Drop your bank CSV files below. We&apos;ll auto-detect the columns —
          you can adjust the mapping if needed.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mb-2 size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop CSV files here or click to browse
        </p>
      </div>

      {csvFiles.length > 0 && (
        <div className="space-y-4">
          {csvFiles.map((csvFile) => (
            <CsvFileCard
              key={csvFile.id}
              csvFile={csvFile}
              onUpdate={(updates) => updateCsvFile(csvFile.id, updates)}
              onRemove={() => removeCsvFile(csvFile.id)}
            />
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="mr-1.5 size-4" />
            Add another file
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleImportAll} disabled={!allReady || importing}>
          {importing ? "Importing..." : "Import & Continue"}
        </Button>
      </div>
    </div>
  );
}
