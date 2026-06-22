"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { ImportRecord } from "@/types";

interface ImportHistoryProps {
  imports: ImportRecord[];
  loading: boolean;
  onDeleted?: () => void;
}

export function ImportHistory({ imports, loading, onDeleted }: ImportHistoryProps) {
  const [deleteTarget, setDeleteTarget] = useState<ImportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await api.imports.delete(deleteTarget.id);
      setDeleteTarget(null);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete import");
    } finally {
      setDeleting(false);
    }
  };

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
    <>
      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead>Imported At</TableHead>
              <TableHead className="w-10" />
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
                <TableCell className="py-1 px-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setDeleteTarget(imp)}
                    aria-label={`Delete import ${imp.filename}`}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Import</DialogTitle>
            <DialogDescription>
              This removes &ldquo;{deleteTarget?.filename}&rdquo; and the{" "}
              {deleteTarget?.new_transaction_count ?? 0} transaction
              {deleteTarget?.new_transaction_count === 1 ? "" : "s"} it added to{" "}
              {deleteTarget?.account_name}. Your categories, rules, targets, and
              all other transactions are unaffected. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
