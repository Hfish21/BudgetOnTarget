"use client";

import { Fragment, useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatCents } from "@/lib/utils";
import { Money } from "@/components/money";
import type { Transaction, Category, Target } from "@/types";

interface TransactionTableProps {
  transactions: Transaction[];
  onCategorize?: (
    transactionId: number,
    categoryId: number
  ) => Promise<void>;
  onExclude?: (transactionId: number, excluded: boolean) => Promise<void>;
}

export function TransactionTable({
  transactions,
  onCategorize,
  onExclude,
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

  const dailyTotals = useMemo(() => {
    const map: Record<string, { spent: number; earned: number }> = {};
    for (const tx of transactions) {
      if (tx.is_excluded) continue;
      if (!map[tx.date]) map[tx.date] = { spent: 0, earned: 0 };
      if (tx.amount_cents < 0) {
        map[tx.date].spent += tx.amount_cents;
      } else {
        map[tx.date].earned += tx.amount_cents;
      }
    }
    return map;
  }, [transactions]);

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
            {onExclude && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx, idx) => {
            const prevDate = idx > 0 ? transactions[idx - 1].date : null;
            const showDateHeader = tx.date !== prevDate;
            const dateObj = new Date(tx.date + "T00:00:00");
            const dateLabel = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            return (
              <Fragment key={tx.id}>
                {showDateHeader && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-t-2 border-border">
                    <TableCell colSpan={4} className="py-2">
                      <span className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                        {dateLabel}
                      </span>
                    </TableCell>
                    <TableCell colSpan={onExclude ? 4 : 3} className="py-2 text-right">
                      {dailyTotals[tx.date] && (
                        <div className="flex items-center justify-end gap-3">
                          {dailyTotals[tx.date].spent !== 0 && (
                            <span className="text-xs font-semibold text-red-400">
                              <Money>{formatCents(dailyTotals[tx.date].spent)}</Money>
                            </span>
                          )}
                          {dailyTotals[tx.date].earned !== 0 && (
                            <span className="text-xs font-semibold text-green-400">
                              <Money>+{formatCents(dailyTotals[tx.date].earned)}</Money>
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
                <TableRow
                  key={tx.id}
                  className={cn("group", tx.is_excluded && "opacity-40")}
                >
                  <TableCell className="text-xs text-muted-foreground">
                    {tx.date}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "max-w-xs truncate text-sm font-medium",
                      tx.is_excluded && "line-through"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="truncate">{tx.description}</span>
                      {tx.is_pending && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-sky-500/30 bg-sky-500/15 text-[10px] text-sky-400"
                        >
                          Pending
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right text-sm font-medium tabular-nums",
                      tx.amount_cents > 0
                        ? "text-green-400"
                        : "text-foreground",
                      tx.is_excluded && "line-through"
                    )}
                  >
                    <Money>{tx.amount_display}</Money>
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
                        onClick={() => !tx.is_excluded && setEditingId(tx.id)}
                        className="text-left"
                        disabled={tx.is_excluded}
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
                  {onExclude && (
                    <TableCell className="p-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus:opacity-100 data-[popup-open]:opacity-100"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
                          </svg>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => onExclude(tx.id, !tx.is_excluded)}
                          >
                            {tx.is_excluded ? (
                              <>
                                <Eye className="mr-2 size-3.5" />
                                Un-exclude
                              </>
                            ) : (
                              <>
                                <EyeOff className="mr-2 size-3.5" />
                                Exclude (moot)
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
