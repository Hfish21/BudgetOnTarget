"use client";

import { useState, useEffect } from "react";
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
import type { Transaction, Category } from "@/types";

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
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    api.categories
      .list()
      .then(setCategories)
      .catch(() => {
        /* non-critical */
      });
  }, []);

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
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No transactions found for the selected filters.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-28 text-right">Amount</TableHead>
            <TableHead className="w-40">Category</TableHead>
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
                    ? "text-green-600"
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
                    className="h-7 w-full rounded border border-input bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
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
