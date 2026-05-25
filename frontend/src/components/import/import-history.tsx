"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportRecord } from "@/types";

interface ImportHistoryProps {
  imports: ImportRecord[];
  loading: boolean;
}

export function ImportHistory({ imports, loading }: ImportHistoryProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          No imports yet. Upload a CSV file to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead className="text-right">New</TableHead>
            <TableHead>Imported At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {imports.map((imp) => (
            <TableRow key={imp.id}>
              <TableCell className="text-sm font-medium">
                {imp.filename}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {imp.account_name}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {imp.row_count}
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {imp.new_transaction_count}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(imp.imported_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
