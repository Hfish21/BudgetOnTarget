"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import { Money } from "@/components/money";
import type { Transaction, TargetAssessment, TargetHistoryMonth } from "@/types";

interface TargetTransactionsDialogProps {
  assessment: TargetAssessment | null;
  year: number;
  month: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_COLORS: Record<string, string> = {
  on_target: "oklch(0.65 0.19 145)",
  in_tolerance: "oklch(0.75 0.15 85)",
  off_target: "oklch(0.65 0.22 25)",
};

export function TargetTransactionsDialog({
  assessment,
  year,
  month,
  open,
  onOpenChange,
}: TargetTransactionsDialogProps) {
  const { privacyMode } = usePrivacy();
  const [tab, setTab] = useState<"transactions" | "history">("transactions");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<TargetHistoryMonth[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setTab("transactions");
      return;
    }
    if (!assessment) return;
    setLoading(true);
    api.dashboard
      .getTargetTransactions(assessment.target_id, year, month)
      .then((data) => setTransactions(data.transactions))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [open, assessment, year, month]);

  useEffect(() => {
    if (!open || !assessment || tab !== "history") return;
    if (history.length > 0) return;
    setHistoryLoading(true);
    api.dashboard
      .getTargetHistory(assessment.target_id)
      .then((data) => setHistory(data.months))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [open, assessment, tab, history.length]);

  useEffect(() => {
    if (!open) setHistory([]);
  }, [open]);

  const chartData = useMemo(
    () =>
      history.map((m) => ({
        label: m.label,
        actual: m.actual_value / 100,
        target: m.target_value / 100,
        status: m.status,
        actualDisplay: m.actual_display,
        isCurrent: m.year === year && m.month === month,
      })),
    [history, year, month]
  );

  const targetLine = assessment ? assessment.target_value / 100 : 0;

  if (!assessment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{assessment.target_name}</DialogTitle>
          <DialogDescription>
            <Money>{assessment.actual_display}</Money> / <Money>{assessment.target_display}</Money>
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab("transactions")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "transactions"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Transactions ({transactions.length})
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === "history"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            History
          </button>
        </div>

        <div className="overflow-auto -mx-4 px-4 flex-1">
          {tab === "transactions" ? (
            loading ? (
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
                        <Money>{tx.amount_display}</Money>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : historyLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-48 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No history available.
            </p>
          ) : (
            <div className="py-4">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="oklch(0.25 0 0)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    tick={{ fill: "oklch(0.65 0 0)" }}
                    interval={chartData.length > 12 ? Math.floor(chartData.length / 8) : 0}
                    angle={chartData.length > 6 ? -45 : 0}
                    textAnchor={chartData.length > 6 ? "end" : "middle"}
                    height={chartData.length > 6 ? 60 : 30}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={<PrivateYAxisTick formatter={(v: number) => `$${v}`} />}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      const blur = privacyMode ? { filter: "blur(8px)", userSelect: "none" as const } : undefined;
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
                          <p className="mb-1 text-xs font-medium text-foreground">
                            {d.label}
                          </p>
                          <p className="text-sm" style={{ color: STATUS_COLORS[d.status] }}>
                            Actual: <span style={blur}>{d.actualDisplay}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Target: <span style={blur}>{assessment.target_display}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  {targetLine > 0 && (
                    <ReferenceLine
                      y={targetLine}
                      stroke={privacyMode ? "transparent" : "oklch(0.65 0 0)"}
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={privacyMode ? undefined : {
                        value: `Target: ${assessment.target_display}`,
                        position: "insideTopRight",
                        fill: "oklch(0.65 0 0)",
                        fontSize: 11,
                      }}
                    />
                  )}
                  <Bar dataKey="actual" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={STATUS_COLORS[entry.status]}
                        opacity={entry.isCurrent ? 1 : 0.7}
                        stroke={entry.isCurrent ? "oklch(0.9 0 0)" : "none"}
                        strokeWidth={entry.isCurrent ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
