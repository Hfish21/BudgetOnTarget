"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { CsvUpload } from "@/components/import/csv-upload";
import { ImportHistory } from "@/components/import/import-history";
import type { ImportRecord } from "@/types";

export default function ImportPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.imports.list();
      setImports(data);
    } catch {
      /* non-critical */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImports();
  }, [fetchImports]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Import</h2>
        <p className="text-sm text-muted-foreground">
          Upload CSV files from your bank to import transactions.
        </p>
      </div>

      <div className="max-w-xl">
        <CsvUpload onUploadComplete={fetchImports} />
      </div>

      <section>
        <h3 className="mb-4 text-lg font-semibold">Import History</h3>
        <ImportHistory imports={imports} loading={loading} />
      </section>
    </div>
  );
}
