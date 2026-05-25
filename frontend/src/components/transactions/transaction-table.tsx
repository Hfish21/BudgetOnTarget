"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Transaction, Category, Target } from "@/types";

interface TransactionTableProps {
  transactions: Transaction[];
  onCategorize?: (
    transactionId: number,
    categoryId: number
  ) => Promise<void>;
}

export function TransactionTable({
  transactions,
  onCategorize,
}: TransactionTableProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.categories.list(), api.targets.list()])
      .then(([cats, tgts]) => {
        setCategories(cats);
        setTargets(tgts);
      })
      .catch(() => {
        /* non-critical */
      });
  }, []);

  const categorySpendGroup = useMemo(() => {
    const map: Record<number, string> = {};
    for (const t of targets) {
      if (t.category_id !== null) {
        map[t.category_id] = t.spend_group;
      }
    }
    return map;
  }, [targets]);

  const handleCategoryChange = async (
    transactionId: number,
    categoryId: number
  ) => {
    if (onCategorize) {
      await onCategorize(transactionId, categoryId);
    }
    setEditingId(null);
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No transactions found for the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-28 text-right">Amount</TableHead>
            <TableHead className="w-40">Category</TableHead>
            <TableHead className="w-28">Lane</TableHead>
            <TableHead className="w-28">Person</TableHead>
            <TableHead className="w-36">Account</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="text-xs text-muted-foreground">
                {tx.date}
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm font-medium">
                {tx.description}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-sm font-medium tabular-nums",
                  tx.amount_cents > 0
                    ? "text-green-400"
                    : "text-foreground"
                )}
              >
                {tx.amount_display}
              </TableCell>
              <TableCell>
                {editingId === tx.id ? (
                  <select
                    autoFocus
                    value={tx.category_id ?? ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCategoryChange(tx.id, Number(e.target.value));
                      }
                    }}
                    onBlur={() => setEditingId(null)}
                    className="h-7 w-full rounded border border-input bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setEditingId(tx.id)}
                    className="text-left"
                  >
                    {tx.category_name ? (
                      <Badge variant="secondary" className="text-xs">
                        {tx.category_name}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-dashed text-xs text-muted-foreground"
                      >
                        Uncategorized
                      </Badge>
                    )}
                  </button>
                )}
              </TableCell>
              <TableCell>
                {(() => {
                  const group = tx.category_id ? categorySpendGroup[tx.category_id] : null;
                  if (!group) return <span className="text-xs text-muted-foreground">-</span>;
                  const colors: Record<string, string> = {
                    income: "bg-green-500/15 text-green-400 border-green-500/30",
                    necessary: "bg-blue-500/15 text-blue-400 border-blue-500/30",
                    discretionary: "bg-violet-500/15 text-violet-400 border-violet-500/30",
                    anomalous: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                  };
                  const labels: Record<string, string> = {
                    income: "Income",
                    necessary: "Necessary",
                    discretionary: "Discr.",
                    anomalous: "Anomalous",
                  };
                  return (
                    <Badge variant="outline" className={cn("text-[10px] border", colors[group])}>
                      {labels[group] || group}
                    </Badge>
                  );
                })()}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {tx.household_member_name || "-"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {tx.account_name}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
