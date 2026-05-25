"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn, formatCents } from "@/lib/utils";
import type { Transaction, TargetAssessment } from "@/types";

interface TargetTransactionsDialogProps {
  assessment: TargetAssessment | null;
  year: number;
  month: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TargetTransactionsDialog({
  assessment,
  year,
  month,
  open,
  onOpenChange,
}: TargetTransactionsDialogProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !assessment) return;
    setLoading(true);
    api.dashboard
      .getTargetTransactions(assessment.target_id, year, month)
      .then((data) => {
        setTransactions(data.transactions);
      })
      .catch(() => {
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, [open, assessment, year, month]);

  if (!assessment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{assessment.target_name}</DialogTitle>
          <DialogDescription>
            {assessment.actual_display} / {assessment.target_display} — {transactions.length} transactions
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto -mx-4 px-4">
          {loading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matching transactions found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.date}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {tx.description}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm font-medium tabular-nums",
                        tx.amount_cents > 0 ? "text-green-400" : "text-foreground"
                      )}
                    >
                      {tx.amount_display}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
