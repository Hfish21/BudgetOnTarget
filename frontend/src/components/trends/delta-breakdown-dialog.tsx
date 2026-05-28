"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { api } from "@/lib/api";
import { formatCents, getGroupLabel } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { Money } from "@/components/money";
import { PrivateYAxisTick } from "@/components/charts/private-axis-tick";
import type { SpendGroup, Transaction } from "@/types";
import type { TargetWithHistory } from "@/app/trends/page";

interface DeltaBreakdownDialogProps {
  lane: SpendGroup;
  targets: TargetWithHistory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BarData {
  name: string;
  targetId: number;
  avgDelta: number;
  avgActual: number;
  avgTarget: number;
}

const OVER_COLOR = "oklch(0.65 0.22 25)";
const UNDER_COLOR = "oklch(0.65 0.19 145)";

export function DeltaBreakdownDialog({
  lane,
  targets,
  open,
  onOpenChange,
}: DeltaBreakdownDialogProps) {
  const { privacyMode } = usePrivacy();
  const [selectedBar, setSelectedBar] = useState<BarData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const bars = useMemo(() => {
    const laneTargets = targets.filter((t) => t.spendGroup === lane);

    return laneTargets
      .map((t): BarData | null => {
        if (t.months.length === 0) return null;
        const totalDelta = t.months.reduce(
          (sum, m) => sum + (m.actual_value - m.target_value),
          0
        );
        const totalActual = t.months.reduce((sum, m) => sum + m.actual_value, 0);
        const totalTarget = t.months.reduce((sum, m) => sum + m.target_value, 0);
        const avgDelta = Math.round(totalDelta / t.months.length);
        if (avgDelta === 0) return null;
        return {
          name: t.name,
          targetId: t.id,
          avgDelta,
          avgActual: Math.round(totalActual / t.months.length),
          avgTarget: Math.round(totalTarget / t.months.length),
        };
      })
      .filter((b): b is BarData => b !== null)
      .sort((a, b) => b.avgDelta - a.avgDelta);
  }, [targets, lane]);

  const dateRange = useMemo(() => {
    const laneTargets = targets.filter((t) => t.spendGroup === lane);
    const allMonths = laneTargets.flatMap((t) => t.months);
    if (allMonths.length === 0) return null;
    const sorted = [...allMonths].sort((a, b) => a.year - b.year || a.month - b.month);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return { startYear: first.year, startMonth: first.month, endYear: last.year, endMonth: last.month };
  }, [targets, lane]);

  const isSpending = lane !== "income";
  const totalAvgDelta = bars.reduce((sum, b) => sum + b.avgDelta, 0);
  const label = getGroupLabel(lane);

  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.avgDelta)), 1);
  const chartData = bars.map((b) => ({
    ...b,
    value: b.avgDelta / 100,
  }));

  function deltaIsOver(delta: number) {
    return isSpending ? delta > 0 : delta < 0;
  }

  async function handleBarClick(bar: BarData) {
    if (selectedBar?.targetId === bar.targetId) {
      setSelectedBar(null);
      setTransactions([]);
      return;
    }
    setSelectedBar(bar);
    if (!dateRange) return;
    setTxLoading(true);
    try {
      const res = await api.dashboard.getTargetTransactions(
        bar.targetId,
        dateRange.startYear,
        dateRange.startMonth,
        dateRange.endYear,
        dateRange.endMonth
      );
      setTransactions(res.transactions);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSelectedBar(null);
      setTransactions([]);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{label} — Delta Breakdown</DialogTitle>
          <DialogDescription>
            Average monthly delta by category
            {totalAvgDelta !== 0 && (
              <>
                {" · Net: "}
                <span className={deltaIsOver(totalAvgDelta) ? "text-red-400" : "text-green-400"}>
                  <Money>
                    {totalAvgDelta > 0 ? "+" : "-"}
                    {formatCents(Math.abs(totalAvgDelta))}
                  </Money>
                </span>
                /mo
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto -mx-4 px-4 flex-1">
          {bars.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              All categories are exactly on target — nothing to break down.
            </p>
          ) : (
            <div className="py-2 space-y-4">
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: OVER_COLOR }} />
                  <span>{isSpending ? "Over budget" : "Below target"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: UNDER_COLOR }} />
                  <span>{isSpending ? "Under budget" : "Above target"}</span>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={Math.max(bars.length * 36 + 40, 120)}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={<PrivateYAxisTick formatter={(v: number) => {
                      const abs = Math.abs(v);
                      return abs >= 1000 ? `$${(abs / 1000).toFixed(0)}k` : `$${abs.toFixed(0)}`;
                    }} />}
                    domain={[-(maxAbs / 100) * 1.15, (maxAbs / 100) * 1.15]}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fill: "oklch(0.65 0 0)", fontSize: 11 }}
                  />
                  <ReferenceLine x={0} stroke="oklch(0.35 0 0)" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as BarData & { value: number };
                      const blur = privacyMode
                        ? { filter: "blur(8px)", userSelect: "none" as const }
                        : undefined;
                      const overUnder = isSpending
                        ? d.avgDelta > 0 ? "over" : "under"
                        : d.avgDelta > 0 ? "above" : "below";
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs">
                          <p className="mb-1 font-medium text-foreground">{d.name}</p>
                          <p className="text-muted-foreground">
                            Avg actual: <span style={blur}>{formatCents(d.avgActual)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Avg target: <span style={blur}>{formatCents(d.avgTarget)}</span>
                          </p>
                          <p className={deltaIsOver(d.avgDelta) ? "text-red-400" : "text-green-400"}>
                            Delta:{" "}
                            <span style={blur}>
                              {d.avgDelta > 0 ? "+" : "-"}{formatCents(Math.abs(d.avgDelta))}/mo {overUnder}
                            </span>
                          </p>
                          <p className="mt-1 text-muted-foreground/60">Click for transactions</p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 4, 4]}
                    maxBarSize={24}
                    cursor="pointer"
                    onClick={(_data, index) => {
                      if (index >= 0 && index < bars.length) handleBarClick(bars[index]);
                    }}
                  >
                    {chartData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={deltaIsOver(entry.avgDelta) ? OVER_COLOR : UNDER_COLOR}
                        opacity={selectedBar ? (selectedBar.targetId === entry.targetId ? 1 : 0.3) : 0.85}
                        stroke={selectedBar?.targetId === entry.targetId ? "oklch(0.9 0 0)" : "none"}
                        strokeWidth={selectedBar?.targetId === entry.targetId ? 1.5 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {selectedBar && (
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-foreground">
                      {selectedBar.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {txLoading ? "Loading..." : `${transactions.length} transactions`}
                      </span>
                    </p>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => { setSelectedBar(null); setTransactions([]); }}
                    >
                      Close
                    </button>
                  </div>
                  {txLoading ? (
                    <div className="h-20 animate-pulse rounded bg-muted" />
                  ) : transactions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center">No transactions found.</p>
                  ) : (
                    <div className="max-h-60 overflow-auto rounded border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card border-b border-border">
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1.5 px-2 font-medium">Date</th>
                            <th className="text-left py-1.5 px-2 font-medium">Description</th>
                            <th className="text-right py-1.5 px-2 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((tx) => (
                            <tr key={tx.id} className="border-b border-border/50 last:border-0">
                              <td className="py-1 px-2 text-muted-foreground whitespace-nowrap">{tx.date}</td>
                              <td className="py-1 px-2 text-foreground truncate max-w-[260px]">{tx.description}</td>
                              <td className="py-1 px-2 text-right tabular-nums whitespace-nowrap">
                                <Money>{tx.amount_display}</Money>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
