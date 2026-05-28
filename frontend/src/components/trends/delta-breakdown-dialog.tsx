"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatCents, CHART_COLORS, getGroupLabel } from "@/lib/utils";
import { usePrivacy } from "@/components/privacy-provider";
import { Money } from "@/components/money";
import type { SpendGroup } from "@/types";
import type { TargetWithHistory } from "@/app/trends/page";

interface DeltaBreakdownDialogProps {
  lane: SpendGroup;
  targets: TargetWithHistory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SliceData {
  name: string;
  avgDelta: number;
  absAvgDelta: number;
  avgActual: number;
  avgTarget: number;
}

export function DeltaBreakdownDialog({
  lane,
  targets,
  open,
  onOpenChange,
}: DeltaBreakdownDialogProps) {
  const { privacyMode } = usePrivacy();

  const slices = useMemo(() => {
    const laneTargets = targets.filter((t) => t.spendGroup === lane);

    return laneTargets
      .map((t): SliceData | null => {
        if (t.months.length === 0) return null;
        const totalDelta = t.months.reduce(
          (sum, m) => sum + (m.actual_value - m.target_value),
          0
        );
        const totalActual = t.months.reduce((sum, m) => sum + m.actual_value, 0);
        const totalTarget = t.months.reduce((sum, m) => sum + m.target_value, 0);
        const avgDelta = Math.round(totalDelta / t.months.length);
        return {
          name: t.name,
          avgDelta,
          absAvgDelta: Math.abs(avgDelta),
          avgActual: Math.round(totalActual / t.months.length),
          avgTarget: Math.round(totalTarget / t.months.length),
        };
      })
      .filter((s): s is SliceData => s !== null && s.absAvgDelta > 0)
      .sort((a, b) => b.absAvgDelta - a.absAvgDelta);
  }, [targets, lane]);

  const isSpending = lane !== "income";
  const totalAvgDelta = slices.reduce((sum, s) => sum + s.avgDelta, 0);
  const label = getGroupLabel(lane);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{label} — Delta Breakdown</DialogTitle>
          <DialogDescription>
            Average monthly delta by category
            {totalAvgDelta !== 0 && (
              <>
                {" · Net: "}
                <span className={totalAvgDelta > 0 ? (isSpending ? "text-red-400" : "text-green-400") : (isSpending ? "text-green-400" : "text-red-400")}>
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
          {slices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              All categories are exactly on target — nothing to break down.
            </p>
          ) : (
            <div className="py-2">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="absAvgDelta"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={130}
                    innerRadius={65}
                    paddingAngle={2}
                    label={({ name, payload }) => {
                      const delta = (payload as SliceData).avgDelta;
                      return privacyMode
                        ? String(name)
                        : `${name}: ${delta > 0 ? "+" : "-"}${formatCents(Math.abs(delta))}`;
                    }}
                    labelLine={{ stroke: "oklch(0.55 0 0)" }}
                    style={{ fontSize: 11 }}
                  >
                    {slices.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as SliceData;
                      const blur = privacyMode
                        ? { filter: "blur(8px)", userSelect: "none" as const }
                        : undefined;
                      const deltaSign = d.avgDelta > 0 ? "+" : "-";
                      const overUnder = isSpending
                        ? d.avgDelta > 0 ? "over" : "under"
                        : d.avgDelta > 0 ? "above" : "below";
                      return (
                        <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs">
                          <p className="mb-1 font-medium text-foreground">
                            {d.name}
                          </p>
                          <p className="text-muted-foreground">
                            Avg actual:{" "}
                            <span style={blur}>{formatCents(d.avgActual)}</span>
                          </p>
                          <p className="text-muted-foreground">
                            Avg target:{" "}
                            <span style={blur}>{formatCents(d.avgTarget)}</span>
                          </p>
                          <p className={d.avgDelta > 0 ? (isSpending ? "text-red-400" : "text-green-400") : (isSpending ? "text-green-400" : "text-red-400")}>
                            Delta:{" "}
                            <span style={blur}>
                              {deltaSign}{formatCents(Math.abs(d.avgDelta))}/mo {overUnder}
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-2 space-y-1.5 px-2">
                {slices.map((s, i) => {
                  const deltaSign = s.avgDelta > 0 ? "+" : "-";
                  const pct = totalAvgDelta !== 0
                    ? Math.round((s.absAvgDelta / slices.reduce((sum, sl) => sum + sl.absAvgDelta, 0)) * 100)
                    : 0;
                  return (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="text-muted-foreground">{pct}%</span>
                        <span className={s.avgDelta > 0 ? (isSpending ? "text-red-400" : "text-green-400") : (isSpending ? "text-green-400" : "text-red-400")}>
                          <Money>
                            {deltaSign}{formatCents(Math.abs(s.avgDelta))}
                          </Money>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
