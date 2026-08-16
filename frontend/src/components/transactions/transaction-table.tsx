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
import { EyeOff, Eye, MoreVertical } from "lucide-react";
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

const LANE_COLORS: Record<string, string> = {
  income: "bg-green-500/15 text-green-400 border-green-500/30",
  necessary: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  discretionary: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  anomalous: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};
const LANE_LABELS: Record<string, string> = {
  income: "Income",
  necessary: "Necessary",
  discretionary: "Discr.",
  anomalous: "Anomalous",
};

function LaneBadge({ group }: { group: string | null | undefined }) {
  if (!group) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <Badge variant="outline" className={cn("text-[10px] border", LANE_COLORS[group])}>
      {LANE_LABELS[group] || group}
    </Badge>
  );
}

/** The category chip that turns into a <select> when tapped. Shared by both layouts. */
function CategoryControl({
  tx,
  categories,
  isEditing,
  onStartEdit,
  onPick,
  onStopEdit,
}: {
  tx: Transaction;
  categories: Category[];
  isEditing: boolean;
  onStartEdit: () => void;
  onPick: (categoryId: number) => void;
  onStopEdit: () => void;
}) {
  if (isEditing) {
    return (
      <select
        autoFocus
        value={tx.category_id ?? ""}
        onChange={(e) => {
          if (e.target.value) onPick(Number(e.target.value));
        }}
        onBlur={onStopEdit}
        className="h-7 w-full min-w-0 rounded border border-input bg-card px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Uncategorized</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <button
      onClick={() => !tx.is_excluded && onStartEdit()}
      className="min-w-0 text-left"
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
  );
}

function ExcludeMenu({
  tx,
  onExclude,
  className,
}: {
  tx: Transaction;
  onExclude: (id: number, excluded: boolean) => void;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-accent hover:text-accent-foreground focus:opacity-100 data-[popup-open]:opacity-100",
          className
        )}
        aria-label="Transaction actions"
      >
        <MoreVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExclude(tx.id, !tx.is_excluded)}>
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
  );
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

  const dateLabel = (date: string) =>
    new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

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
    <>
      {/* ---- Mobile: card list ---- */}
      <div className="space-y-4 md:hidden">
        {transactions.map((tx, idx) => {
          const prevDate = idx > 0 ? transactions[idx - 1].date : null;
          const showDateHeader = tx.date !== prevDate;
          const totals = dailyTotals[tx.date];
          const group = tx.category_id
            ? categorySpendGroup[tx.category_id]
            : null;

          return (
            <Fragment key={tx.id}>
              {showDateHeader && (
                <div className="flex items-center justify-between px-1 pt-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                    {dateLabel(tx.date)}
                  </span>
                  {totals && (
                    <div className="flex items-center gap-3">
                      {totals.spent !== 0 && (
                        <span className="text-xs font-semibold text-red-400">
                          <Money>{formatCents(totals.spent)}</Money>
                        </span>
                      )}
                      {totals.earned !== 0 && (
                        <span className="text-xs font-semibold text-green-400">
                          <Money>+{formatCents(totals.earned)}</Money>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div
                className={cn(
                  "space-y-2.5 rounded-xl border bg-card p-3",
                  tx.is_excluded && "opacity-40"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium",
                        tx.is_excluded && "line-through"
                      )}
                    >
                      <span className="truncate">{tx.description}</span>
                      {tx.is_pending && (
                        <Badge
                          variant="outline"
                          className="shrink-0 border-sky-500/30 bg-sky-500/15 text-[10px] text-sky-400"
                        >
                          Pending
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tx.account_name}
                      {tx.household_member_name
                        ? ` · ${tx.household_member_name}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      tx.amount_cents > 0 ? "text-green-400" : "text-foreground",
                      tx.is_excluded && "line-through"
                    )}
                  >
                    <Money>{tx.amount_display}</Money>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <CategoryControl
                      tx={tx}
                      categories={categories}
                      isEditing={editingId === tx.id}
                      onStartEdit={() => setEditingId(tx.id)}
                      onPick={(cid) => handleCategoryChange(tx.id, cid)}
                      onStopEdit={() => setEditingId(null)}
                    />
                    <LaneBadge group={group} />
                  </div>
                  {onExclude && (
                    <ExcludeMenu tx={tx} onExclude={onExclude} className="shrink-0" />
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* ---- Desktop: table ---- */}
      <div className="hidden rounded-xl border bg-card md:block">
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

              return (
                <Fragment key={tx.id}>
                  {showDateHeader && (
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-t-2 border-border">
                      <TableCell colSpan={4} className="py-2">
                        <span className="text-xs font-bold text-foreground/80 uppercase tracking-wider">
                          {dateLabel(tx.date)}
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
                      <CategoryControl
                        tx={tx}
                        categories={categories}
                        isEditing={editingId === tx.id}
                        onStartEdit={() => setEditingId(tx.id)}
                        onPick={(cid) => handleCategoryChange(tx.id, cid)}
                        onStopEdit={() => setEditingId(null)}
                      />
                    </TableCell>
                    <TableCell>
                      <LaneBadge
                        group={tx.category_id ? categorySpendGroup[tx.category_id] : null}
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.household_member_name || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.account_name}
                    </TableCell>
                    {onExclude && (
                      <TableCell className="p-1">
                        <ExcludeMenu
                          tx={tx}
                          onExclude={onExclude}
                          className="opacity-0 group-hover:opacity-100"
                        />
                      </TableCell>
                    )}
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
